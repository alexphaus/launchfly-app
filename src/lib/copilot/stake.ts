// src/lib/copilot/stake.ts
// What a Move claims it will move, and how the day's one Call gets picked.
//
// Pure — no DB import — so copilot-core.test.ts covers the arbitration that
// decides what a person is told to do first.
//
// Why this exists. The app had two production paths that never competed: the
// brief wrote a Decision, the jobs wrote Moves, and loadHome put the Decision on
// top no matter what. Since starterDecision's seven branches are all outreach
// branches, the Call was "send the drafts" on a day when a customer who had paid
// three months ago was still waiting to hear from anybody. Not a ranking bug —
// there was no ranking. A Move could not win because nothing was comparing them.
//
// So every Move now declares a stake, and the Call is simply the Move that wins.
// Outreach is a Job like any other (jobs/send-queue.ts) and has to earn the top
// of the screen the same way a runway decision does.

import { KIND_ORDER, type MoveKind } from './moves';

/**
 * Everything a Call is allowed to stake itself on.
 *
 * The first five are the outbound funnel. `queue` and `runway_months` are the
 * first two that are not, and both are already computed in Metrics — that is
 * the whole reason they are here and, say, `delivered` is not: a metric nobody
 * can read back is not a stake, it is a promise. Widening this list is how the
 * app learns about a new part of the business, so it is deliberately additive
 * and deliberately small.
 */
export const BUSINESS_METRICS = [
  'sent', 'replies', 'meetings', 'won', 'won_amount',
  'queue', 'runway_months',
  'none',
] as const;
export type BusinessMetric = (typeof BUSINESS_METRICS)[number];

/**
 * Which way is good. A shrinking send queue is progress; a shrinking runway is
 * not. Without this, verdictOf graded "get the queue down" as a failure every
 * time it worked — the direction is a property of the metric, not of the call,
 * so it lives here rather than in a column somebody has to remember to set.
 */
export const METRIC_GOOD_DIRECTION: Record<BusinessMetric, 'up' | 'down' | 'none'> = {
  sent: 'up', replies: 'up', meetings: 'up', won: 'up', won_amount: 'up',
  queue: 'down', runway_months: 'up', none: 'none',
};

export interface Stake {
  /** What number should move if this was the right call. */
  metric: BusinessMetric;
  direction: 'up' | 'down';
  /** How far, in the metric's own unit. */
  by: number;
  /**
   * By when. Drives urgency and, later, when to read the number back. A job
   * computes this from something it can see — days since a customer paid,
   * months before runway hits the line — never from a feeling about priority.
   */
  withinDays: number;
  /**
   * Money this move actually moves, in the profile's currency. Omitted when the
   * job genuinely cannot know it, which is most of them; the kind prior carries
   * those instead of a number somebody made up.
   */
  value?: number;
}

/**
 * The prior, used when a Move cannot say what it is worth.
 *
 * It is a PRIOR, not a measurement, and it is the weakest input on purpose:
 * bounded between 0.2 and 1.0 so a real number always outranks a guess about a
 * category. Derived from KIND_ORDER so there is one opinion about kinds in the
 * codebase rather than two that can drift.
 */
export function kindPrior(kind: MoveKind): number {
  return 1 - KIND_ORDER[kind] * 0.1;
}

/** Reference scale when the profile has no burn on file. */
export const DEFAULT_REFERENCE = 1000;
/** A move can be worth at most three times the prior on money alone. */
export const MAX_MONEY_FACTOR = 3;
/** Same-day pressure is worth 3x; a quarter out, half. */
export const URGENCY_HORIZON_DAYS = 30;
/** Below this nothing is promoted and the day falls back to the written call. */
export const CALL_FLOOR = 0.35;

export interface ScoreCtx {
  /** What the business spends a month. The scale money is judged against. */
  monthlyBurn?: number | null;
  /** Minutes the user says they have today. */
  capacityMinutes: number;
}

export interface Scorable {
  kind: MoveKind;
  stake?: Stake | null;
  /** Parsed from cost_label. Unknown costs are assumed to be half an hour. */
  costMinutes?: number | null;
}

export const DEFAULT_COST_MINUTES = 30;
/** Anything quicker than this rounds up; a two-minute task is not infinitely good. */
export const MIN_COST_MINUTES = 15;

/** "20 min", "2 h", "₱18,000" → minutes, or null when the label is not a duration. */
export function costMinutesOf(label?: string | null): number | null {
  if (!label) return null;
  const m = /(\d+(?:\.\d+)?)\s*(min|m|h|hr|hour)/i.exec(label);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Four bounded factors, each explainable in one sentence. The absolute number
 * means nothing; only the order does, which is why every factor has a floor and
 * a ceiling — one input can never run away with the day.
 *
 *   prior    what kind of move this is, when nothing better is known
 *   money    what it moves, against what the business spends a month
 *   urgency  how soon the thing it is about stops being fixable
 *   fit      whether it fits in the time the user says they have
 */
export function scoreMove(m: Scorable, ctx: ScoreCtx): number {
  const prior = kindPrior(m.kind);
  const s = m.stake;

  const reference = ctx.monthlyBurn && ctx.monthlyBurn > 0 ? ctx.monthlyBurn : DEFAULT_REFERENCE;
  const money = s?.value != null && s.value > 0
    ? 1 + clamp(s.value / reference, 0, MAX_MONEY_FACTOR - 1)
    : 1;

  const urgency = s?.withinDays != null
    ? clamp(URGENCY_HORIZON_DAYS / Math.max(s.withinDays, 1), 0.5, 3)
    : 1;

  const cost = Math.max(m.costMinutes ?? DEFAULT_COST_MINUTES, MIN_COST_MINUTES);
  // Not a hard exclusion: a day with only work that does not fit should still
  // name the best of it rather than go blank.
  const fit = cost <= ctx.capacityMinutes ? 1 : 0.5;

  return prior * money * urgency * fit;
}

export interface Arbitrated<T> {
  /** The Move that won the day, or null when nothing cleared the floor. */
  call: T | null;
  /** What the call is instead of — the runner-up, named. */
  insteadOf: T | null;
  /** Everything else, best first. The call is not in here. */
  rest: T[];
}

/**
 * Pick the day's one Call.
 *
 * Ties break on kind order and then on id, so the same inputs always produce the
 * same screen — a Call that reshuffles on reload is not a decision.
 */
export function arbitrate<T extends Scorable & { id: string }>(
  moves: T[],
  ctx: ScoreCtx,
  floor = CALL_FLOOR,
): Arbitrated<T> {
  const ranked = [...moves]
    .map((m) => ({ m, score: scoreMove(m, ctx) }))
    .sort((a, b) => (b.score - a.score) || (KIND_ORDER[a.m.kind] - KIND_ORDER[b.m.kind]) || a.m.id.localeCompare(b.m.id))
    .map((x) => x.m);

  const top = ranked[0];
  if (!top || scoreMove(top, ctx) < floor) return { call: null, insteadOf: null, rest: ranked };
  return { call: top, insteadOf: ranked[1] ?? null, rest: ranked.slice(1) };
}
