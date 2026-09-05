// src/lib/copilot/ranking.ts
// Transparent, deterministic re-ranking. The agent gives a raw fit score;
// this layer blends in what the user told us (hunt types, capacity) and what
// they did (type affinity from saves / skips). Runs at read time, so changing
// capacity re-ranks instantly with no writes.

import { CAPACITY_META, type Action, type Capacity, type Effort, type Opportunity, type OpportunityType, type OutcomeKind } from './types';

/** An LLM guess can never outrank a real listing. */
export const INFERRED_SCORE_CAP = 70;
export const SOURCED_BONUS = 8;

export interface RankContext {
  capacity: Capacity;
  huntTypes: OpportunityType[];
  typeAffinity: Record<OpportunityType, number>;
  now?: Date;
}

const EFFORT_RANK: Record<Effort, number> = { light: 0, medium: 1, deep: 2 };
const CAPACITY_RANK: Record<Capacity, number> = { low: 0, moderate: 1, deep: 2 };

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function scoreOpportunity(o: Pick<Opportunity, 'type' | 'effort' | 'fit_score' | 'created_at'> & { source_kind?: Opportunity['source_kind'] }, ctx: RankContext): number {
  const now = ctx.now ?? new Date();
  let s = o.fit_score * 0.85;

  // What the user asked us to hunt for.
  s += ctx.huntTypes.includes(o.type) ? 8 : -15;

  // Learned preference: 0.5 .. 1.5 maps to -20 .. +20.
  const aff = ctx.typeAffinity[o.type] ?? 1;
  s += (aff - 1) * 40;

  // Capacity fit: effort vs. what the user has right now.
  const gap = Math.abs(EFFORT_RANK[o.effort] - CAPACITY_RANK[ctx.capacity]);
  s += gap === 0 ? 6 : gap === 1 ? 0 : -12;

  // Freshness: lose 3 points per day, capped. Sourced rows decay slower: a real
  // business does not stop being real after a week.
  const ageDays = Math.max(0, (now.getTime() - new Date(o.created_at).getTime()) / 86_400_000);
  const sourced = o.source_kind === 'sourced';
  s -= Math.min(15, ageDays * (sourced ? 1 : 3));

  if (sourced) s += SOURCED_BONUS;
  const out = clamp(s);
  return sourced ? out : Math.min(out, INFERRED_SCORE_CAP);
}

export function rankOpportunities<T extends Pick<Opportunity, 'type' | 'effort' | 'fit_score' | 'created_at' | 'score'> & { source_kind?: Opportunity['source_kind'] }>(opps: T[], ctx: RankContext): T[] {
  return opps
    .map((o) => ({ ...o, score: scoreOpportunity(o, ctx) }))
    .sort((a, b) => b.score - a.score);
}

/** A plan is a shortlist. Past this many open items it stops being a plan and
 *  becomes a queue — which is what the Drafts waiting count is for. */
export const MAX_PLAN_ITEMS = 5;
/** Drafts are cheap, so without a ceiling of their own thirty of them fill every
 *  slot and the day's real work never appears. */
export const MAX_AI_PLAN_ITEMS = 3;
/** Reviewing and sending a drafted message is short, but it is not free. */
export const AI_REVIEW_MINUTES = 2;

export function selectPlan<T extends Pick<Action, 'owner' | 'minutes' | 'status'>>(actions: T[], capacity: Capacity): T[] {
  const budget = CAPACITY_META[capacity].minutes;
  const cost = (a: T) => a.minutes ?? (a.owner === 'ai' ? AI_REVIEW_MINUTES : 30);
  const keep = new Set<T>();
  let used = 0;
  let open = 0;
  let ai = 0;

  // Finished items stay for the record and cost nothing.
  for (const a of actions) if (a.status === 'done') keep.add(a);

  const fits = (a: T) => open < MAX_PLAN_ITEMS && used + cost(a) <= budget;
  const take = (a: T) => { keep.add(a); used += cost(a); open += 1; if (a.owner === 'ai') ai += 1; };

  // First pass holds drafts to their ceiling, so work only the user can do still
  // reaches the plan. Second pass hands any slot nothing else wanted back to them.
  for (const a of actions) {
    if (keep.has(a) || (a.owner === 'ai' && ai >= MAX_AI_PLAN_ITEMS)) continue;
    if (fits(a)) take(a);
  }
  for (const a of actions) {
    if (keep.has(a)) continue;
    if (fits(a)) take(a);
  }

  // Never show a plan with nothing the user can do. If one oversized item blew
  // the budget, fall back to the cheapest task rather than the first one.
  const hasOpen = actions.some((a) => keep.has(a) && a.status !== 'done');
  if (!hasOpen) {
    const cheapest = actions.filter((a) => a.status !== 'done').sort((x, y) => cost(x) - cost(y))[0];
    if (cheapest) keep.add(cheapest);
  }

  return actions.filter((a) => keep.has(a));
}

/** Build affinity weights from what the user did with past suggestions. */
export function computeTypeAffinity(events: Array<{ event_type: string; payload: Record<string, unknown> }>): Record<OpportunityType, number> {
  const net: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const e of events) {
    const t = e.payload?.type as string | undefined;
    if (!t) continue;
    total[t] = (total[t] ?? 0) + 1;
    if (e.event_type === 'opportunity_saved' || e.event_type === 'opportunity_acted') net[t] = (net[t] ?? 0) + 1;
    if (e.event_type === 'opportunity_dismissed') net[t] = (net[t] ?? 0) - 1;
  }
  const out = {} as Record<OpportunityType, number>;
  for (const t of ['client', 'people', 'service', 'community', 'signal'] as OpportunityType[]) {
    const n = net[t] ?? 0;
    const c = total[t] ?? 0;
    // Shrink toward neutral when there is little data.
    out[t] = Math.max(0.5, Math.min(1.5, 1 + (n / (c + 4)) * 0.5));
  }
  return out;
}

/**
 * Outcome-weighted affinity. Saves and skips give a prior; real replies and wins
 * per type move it further. A type that gets replies is worth more than one the
 * user merely saved. Shrinks toward neutral with little data.
 */
export function computeOutcomeAffinity(
  events: Array<{ event_type: string; payload: Record<string, unknown> }>,
  sentByType: Partial<Record<OpportunityType, number>>,
  outcomesByType: Partial<Record<OpportunityType, Partial<Record<OutcomeKind, number>>>>,
): Record<OpportunityType, number> {
  const base = computeTypeAffinity(events);
  const out = { ...base };
  for (const t of Object.keys(base) as OpportunityType[]) {
    const sent = sentByType[t] ?? 0;
    if (sent === 0) continue;
    const o = outcomesByType[t] ?? {};
    const replies = (o.reply ?? 0) + (o.meeting ?? 0) + (o.proposal ?? 0) + (o.won ?? 0);
    const wins = o.won ?? 0;
    // Reply rate above 10% lifts, below lowers; wins lift more. The signal is
    // bounded so one lucky win on one send cannot saturate, then shrunk by volume.
    const replyRate = replies / sent;
    const signal = Math.max(-1, Math.min(1, (replyRate - 0.1) * 2 + (wins / sent) * 3));
    const confidence = sent / (sent + 5);
    out[t] = Math.max(0.5, Math.min(1.5, out[t] + signal * confidence));
  }
  return out;
}
