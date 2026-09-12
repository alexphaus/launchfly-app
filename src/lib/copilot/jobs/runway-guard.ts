// src/lib/copilot/jobs/runway-guard.ts
// How long the money lasts, and what would have to be true to change it.
//
// Runway is already on the header as "runway 5 mo" — a number, once, with
// nothing attached. A number is a fact; this is the decision that follows from
// it, and it only appears when the fact is bad enough to be a decision.
//
// The arithmetic is the whole artifact. It uses no model on purpose: a copilot
// that hallucinates a revenue target is worse than one that stays quiet, and
// every input here is something the user typed or something the ledger counted.

import { computeRunwayMonths } from '../metrics';
import type { MoveDraft } from '../moves';
import type { Finance, Metrics, Profile } from '../types';
import { isoWeekKey } from '../diagnose';
import type { Job, JobContext } from './types';

/** Above this, runway is a number to glance at rather than a decision to make. */
export const RUNWAY_ALERT_MONTHS = 4;
/** Below this there is no decision left to make, only a consequence to absorb. */
export const RUNWAY_DECISION_LINE = 2;

export function hasFinance(f: Finance | null | undefined): boolean {
  return !!f && Number.isFinite(f.cash) && Number.isFinite(f.monthly_burn) && (f.monthly_burn ?? 0) > 0;
}

/**
 * A symbol currency gets no space; a three-letter code does. Somebody whose
 * finance row says "$" was reading "$ 1,200".
 */
export function money(amount: number, currency?: string | null): string {
  const raw = (currency || 'USD').trim();
  const cur = /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : raw;
  const n = Math.round(amount).toLocaleString('en-US');
  return /^[A-Za-z]{3}$/.test(cur) ? `${cur} ${n}` : `${cur}${n}`;
}

/**
 * Below this share of a month's burn, a "win" is a test row, a refund or a
 * rounding error — not a deal size to plan from.
 *
 * The floor exists because the live account had exactly one recorded win worth
 * $1 against a $350 burn, and the arithmetic below did what it was told:
 * "covering $350 a month takes 350 of those a month. At your rate that is about
 * 3,150 sends a month." Every number in that sentence was correct and the
 * sentence was worthless, which is a more expensive kind of wrong than silence.
 */
export const MIN_CREDIBLE_DEAL_SHARE = 0.05;

/**
 * What the ledger can and cannot say about closing the gap.
 *
 * With no win in the window there is no deal size and no conversion rate, so
 * there is nothing to project from — and saying "you need 3 clients" from zero
 * data would be the exact invention this file exists to avoid.
 */
export function coverPlan(m: Metrics, burn: number, currency?: string | null): string {
  if (m.won < 1 || m.won_amount <= 0) {
    return `Nothing has closed in the last ${m.window_days} days, so there is no deal size to work back from. The first number to get is one win — until then any revenue target here would be made up.`;
  }
  const avg = m.won_amount / m.won;
  // A win too small to matter against the burn cannot carry a projection, and
  // projecting from it anyway produces a confidently absurd number.
  if (avg < burn * MIN_CREDIBLE_DEAL_SHARE) {
    return `The ${m.won === 1 ? 'one win' : `${m.won} wins`} logged in the last ${m.window_days} days ${m.won === 1 ? 'is' : 'average'} ${money(avg, currency)}, which is too small against ${money(burn, currency)} a month to work back from — a test row or a refund would look the same. Log a real one and this becomes arithmetic instead of a guess.`;
  }
  const deals = Math.ceil(burn / avg);
  const perDeal = m.sent > 0 ? Math.ceil(m.sent / m.won) : null;
  return [
    `Your ${m.won} win${m.won === 1 ? '' : 's'} in the last ${m.window_days} days averaged ${money(avg, currency)}.`,
    `Covering ${money(burn, currency)} a month takes ${deals} of those a month.`,
    perDeal ? `At your rate that is about ${deals * perDeal} sends a month — you have sent ${m.sent} in ${m.window_days} days.` : null,
  ].filter(Boolean).join(' ');
}

/** One week, one decision. Pure, so the arithmetic is under test. */
export function runwayMove(profile: Pick<Profile, 'finance'>, m: Metrics, week: string): MoveDraft | null {
  const f = profile.finance;
  if (!hasFinance(f)) return null;
  const months = computeRunwayMonths(f);
  if (months == null || months > RUNWAY_ALERT_MONTHS) return null;

  const burn = f.monthly_burn as number;
  const cash = f.cash as number;
  const cur = f.currency;
  return {
    job: runwayGuardJob.key,
    kind: 'decide',
    // A standing money problem restated every morning is noise;
    // restated never is how it arrives as a surprise.
    // Weekly, not monthly. Runway falling below the line is true every day
    // until it is not, and a card that fires once in January is not a guard.
    external_id: `runway:${week}`,
    headline: months <= 1
      ? `Under a month of runway — decide what changes this week`
      : `${months} months of runway — decide now, not at two`,
    why: [
      `${money(cash, cur)} against ${money(burn, cur)} a month.`,
      coverPlan(m, burn, cur),
      // The point of naming it early: at one month the only lever left is the
      // one nobody wants, and it takes longer than a month to work.
      'Cutting burn works immediately and revenue does not, so the order of those two is the decision.',
    ],
    artifact: {
      kind: 'text',
      label: 'Show the arithmetic',
      value: [
        `Cash ${money(cash, cur)}`,
        `Burn ${money(burn, cur)} a month`,
        `Runway ${months} month${months === 1 ? '' : 's'}`,
        '',
        coverPlan(m, burn, cur),
        '',
        'Three levers, in the order they take effect: cut burn (this week), raise the price on work already sold (this month), win new work (next month at the earliest). Pick one and tell the copilot which — it is the number the next brief reads back.',
      ].join('\n'),
    },
    cost_label: '15 min',
    stake: {
      metric: 'runway_months', direction: 'up', by: 1,
      // Not months of runway left — days until the last month in which you still
      // have a choice. Below the alert line every remaining option is the one
      // nobody wants, so the urgency is how soon you stop being able to pick.
      withinDays: Math.max(1, Math.round((months - RUNWAY_DECISION_LINE) * 30)),
      value: burn,
    },
  };
}

export const runwayGuardJob: Job = {
  standing: true,
  key: 'runway_guard',
  label: 'Runway',

  // The sensor is the two numbers the user typed. Without them runway is not
  // unknown-but-fine, it is unknown — and guessing it from Stripe volume would
  // be a different, worse number wearing the same label.
  available(ctx: JobContext) {
    return hasFinance(ctx.profile.finance);
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const { metrics } = await ctx.sense();
    const move = runwayMove(ctx.profile, metrics, isoWeekKey(ctx.now));
    return move ? [move] : [];
  },
};
