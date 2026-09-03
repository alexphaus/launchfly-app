// src/lib/copilot/ranking.ts
// Transparent, deterministic re-ranking. The agent gives a raw fit score;
// this layer blends in what the user told us (hunt types, capacity) and what
// they did (type affinity from saves / skips). Runs at read time, so changing
// capacity re-ranks instantly with no writes.

import { CAPACITY_META, type Action, type Capacity, type Effort, type Opportunity, type OpportunityType } from './types';

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

export function scoreOpportunity(o: Pick<Opportunity, 'type' | 'effort' | 'fit_score' | 'created_at'>, ctx: RankContext): number {
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

  // Freshness: lose 3 points per day, capped.
  const ageDays = Math.max(0, (now.getTime() - new Date(o.created_at).getTime()) / 86_400_000);
  s -= Math.min(15, ageDays * 3);

  return clamp(s);
}

export function rankOpportunities<T extends Pick<Opportunity, 'type' | 'effort' | 'fit_score' | 'created_at' | 'score'>>(opps: T[], ctx: RankContext): T[] {
  return opps
    .map((o) => ({ ...o, score: scoreOpportunity(o, ctx) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Pick today's leverage plan for the current capacity.
 * AI-drafted items are always kept (they only need a review). "Needs you" items
 * are kept while their estimated minutes fit inside the capacity budget.
 */
export function selectPlan<T extends Pick<Action, 'owner' | 'minutes' | 'status'>>(actions: T[], capacity: Capacity): T[] {
  const budget = CAPACITY_META[capacity].minutes;
  let used = 0;
  const out: T[] = [];
  for (const a of actions) {
    if (a.status === 'done') { out.push(a); continue; }
    if (a.owner === 'ai') { out.push(a); continue; }
    const cost = a.minutes ?? 30;
    if (used + cost <= budget || out.filter((x) => x.owner === 'you' && x.status !== 'done').length === 0) {
      out.push(a);
      used += cost;
    }
  }
  return out;
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
