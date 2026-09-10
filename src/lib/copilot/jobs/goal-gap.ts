// src/lib/copilot/jobs/goal-gap.ts
// The gap between what somebody said they are saving for and what is happening.
//
// Why this exists. The live account had six goals on file — an emergency fund at
// $1,200 of $15,000, a MacBook at $0 of $1,000, "Get a job — urgent money" —
// and not one thing the app produced or ranked referenced any of them. The
// brief could see them (ContextPack.goals) but the decision layer could not, so
// the Call was "send the drafts" on a morning when the owner's own stated
// priority was money in the next ninety days.
//
// Uses no model. It is division: a gap, a rate read off logged wins, and whether
// the second closes the first before the date the user set.

import { money } from './runway-guard';
import type { MoveDraft } from '../moves';
import type { Goal, Metrics } from '../types';
import type { Job, JobContext } from './types';

/** A month, for turning a 30-day window into a rate anyone can hold in their head. */
const DAYS_PER_MONTH = 30;
/** Past this the answer is "not on this path", and more decimals do not help. */
export const MAX_PROJECTED_MONTHS = 120;

/**
 * Only currency goals with a target can be measured against the ledger.
 *
 * "Monetize App — 0 of 10 users" and "Get a job" are real goals and this job
 * says nothing about them, because nothing in Metrics counts users or offers,
 * and a projection with no meter behind it is the invention every other job
 * here refuses to make. They belong to a sensor that does not exist yet.
 */
export function measurable(g: Goal): boolean {
  return g.metric === 'currency'
    && typeof g.target_value === 'number' && g.target_value > 0
    && (g.current_value ?? 0) < g.target_value;
}

/** Monthly money in, from logged wins only. Null when nothing has closed. */
export function monthlyRate(m: Metrics): number | null {
  if (m.won_amount <= 0 || m.window_days <= 0) return null;
  return (m.won_amount / m.window_days) * DAYS_PER_MONTH;
}

/**
 * The one goal to speak about. Highest priority among the measurable ones —
 * the order the user themselves put them in, rather than a ranking this file
 * invents on their behalf.
 */
export function pickGoal(goals: Goal[]): Goal | null {
  return [...goals].filter(measurable).sort((a, b) => a.priority - b.priority)[0] ?? null;
}

/** One goal becomes one decision. Pure, so the arithmetic is under test. */
export function goalMove(goal: Goal, m: Metrics, month: string): MoveDraft | null {
  if (!measurable(goal)) return null;
  const target = goal.target_value as number;
  const current = goal.current_value ?? 0;
  const gap = target - current;
  const cur = goal.unit || '$';
  const rate = monthlyRate(m);
  const horizonDays = goal.horizon_days && goal.horizon_days > 0 ? goal.horizon_days : null;
  const months = rate ? Math.min(MAX_PROJECTED_MONTHS, Math.ceil(gap / rate)) : null;
  const neededPerMonth = horizonDays ? gap / (horizonDays / DAYS_PER_MONTH) : null;

  const verdict = months == null
    ? 'nothing is closing it'
    : months >= MAX_PROJECTED_MONTHS ? 'the rate does not reach it'
    : horizonDays && months > horizonDays / DAYS_PER_MONTH ? `${months} months away, not ${horizonDays} days`
    : `${months} month${months === 1 ? '' : 's'} away at your current rate`;

  return {
    job: goalGapJob.key,
    kind: 'decide',
    // Once a month per goal. A standing gap restated every morning is noise;
    // restated never is how the date arrives without warning.
    external_id: `goal:${goal.id}:${month}`,
    headline: `${goal.title} is at ${money(current, cur)} of ${money(target, cur)} — ${verdict}`,
    why: [
      `${money(gap, cur)} to go${horizonDays ? `, and ${horizonDays} days to do it in` : ''}.`,
      rate == null
        ? `Nothing has closed in the last ${m.window_days} days, so the gap is not closing at all.`
        : `You are logging about ${money(rate, cur)} a month${neededPerMonth ? `; this needs ${money(neededPerMonth, cur)}` : ''}.`,
      // The point of naming it: a goal you set and never measure against is a
      // wish, and the app is the only thing here holding both numbers.
      'You set this one. Nothing else on this screen knows that unless it is said.',
    ],
    artifact: {
      kind: 'text',
      label: 'Show the arithmetic',
      value: [
        `${goal.title}`,
        `Now ${money(current, cur)} · target ${money(target, cur)} · gap ${money(gap, cur)}`,
        horizonDays ? `Days left ${horizonDays}` : null,
        rate == null ? 'Rate — nothing logged in the window' : `Rate ${money(rate, cur)} a month`,
        '',
        neededPerMonth != null
          ? `Reaching it on time needs ${money(neededPerMonth, cur)} a month. ${rate == null ? 'You are at nothing.' : `You are at ${money(rate, cur)}.`}`
          : rate == null
          ? 'With nothing logged there is no rate to project from. One logged win turns this into arithmetic.'
          : `At ${money(rate, cur)} a month it lands in ${months} month${months === 1 ? '' : 's'}.`,
        '',
        'Three ways this number moves: the gap gets smaller (spend less against it), the rate gets bigger (close something), or the date moves. Only the third one is free, and it is the one that costs the most later.',
      ].filter(Boolean).join('\n'),
    },
    cost_label: '10 min',
    stake: {
      metric: 'won_amount', direction: 'up', by: Math.round(gap),
      withinDays: horizonDays ?? 90,
      value: gap,
    },
  };
}

export const goalGapJob: Job = {
  key: 'goal_gap',
  label: 'Where your goals actually stand',

  // No sensor to connect: the goals are rows the user typed. Gated on onboarding
  // for the same reason capability_gap is — a profile with nothing set up should
  // report no sensors at all rather than one that always answers.
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const { goals, metrics } = await ctx.sense();
    const goal = pickGoal(goals);
    if (!goal) return [];
    const move = goalMove(goal, metrics, ctx.today.slice(0, 7));
    return move ? [move] : [];
  },
};
