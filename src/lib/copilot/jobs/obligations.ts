// src/lib/copilot/jobs/obligations.ts
// Collect what you are owed. Decide about what you owe.
//
// The first job in this registry that can reliably put a real number on
// stake.value — and therefore the first thing that can outrank the send queue on
// evidence rather than on a kind prior. See obligations.ts for the arithmetic.
//
// No model. Every figure is one somebody typed against a counterparty and a
// date, which is exactly the kind of row a general agent with a memory file
// cannot hold.

import { daysUntil, dueSoon, overdueIn, type Obligation } from '../obligations';
import { loadObligations } from '../store';
import { money } from './runway-guard';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

/** Two at most: the money you are owed, and the bill that changes the month. */
export const MAX_OBLIGATION_MOVES = 2;
/** An outflow further out than this is not today's decision. */
export const OUTFLOW_HORIZON_DAYS = 21;

const cur = (o: Obligation) => o.currency || '$';

/** One overdue inflow, as the thing to do today. Pure, so it is under test. */
export function collectMove(o: Obligation, now: Date): MoveDraft {
  const late = Math.abs(daysUntil(o.due_on, now));
  return {
    job: obligationsJob.key,
    kind: 'earn',
    // Per obligation, per day it is still open. A debt is a standing state, and
    // the job supersedes its own older cards so they cannot stack.
    external_id: `collect:${o.id}`,
    headline: late > 0
      ? `${money(o.amount, cur(o))} from ${o.counterparty} is ${late} day${late === 1 ? '' : 's'} late — ask for it today`
      : `${money(o.amount, cur(o))} from ${o.counterparty} is due today — ask for it`,
    why: [
      `You entered this one: ${money(o.amount, cur(o))}, due ${o.due_on}.`,
      // The comparison that makes it a decision rather than a reminder.
      'Money already agreed is the cheapest money in the business — no opener, no reply rate, no waiting.',
      o.note ? o.note : 'Nothing else on this screen has a date somebody already accepted.',
    ],
    artifact: {
      kind: 'text',
      label: 'What to say',
      // Short, factual, and not a template pretending to be their voice: the
      // user knows this person, and the app does not.
      value: [
        `Hi ${o.counterparty}, following up on ${money(o.amount, cur(o))} — it was due ${o.due_on}.`,
        '',
        'Could you let me know when it is going out? Happy to resend the invoice if it is easier.',
        '',
        `— your own words are better than these; the amount and the date are the parts that matter.`,
      ].join('\n'),
    },
    cost_label: '5 min',
    stake: {
      metric: 'won_amount',
      direction: 'up',
      by: Math.round(o.amount),
      // Late money is today's problem; money due today is today's problem.
      withinDays: 3,
      // The whole reason this job exists: a real figure, typed by a person,
      // reaching scoreMove's money factor.
      value: o.amount,
    },
  };
}

/** One outflow coming due, as a decision about what it costs. */
export function coverMove(o: Obligation, now: Date, runwayMonths: number | null): MoveDraft {
  const days = Math.max(0, daysUntil(o.due_on, now));
  return {
    job: obligationsJob.key,
    kind: 'decide',
    external_id: `cover:${o.id}`,
    headline: `${money(o.amount, cur(o))} to ${o.counterparty} is due in ${days} day${days === 1 ? '' : 's'} — decide now what covers it`,
    why: [
      `You entered this one: ${money(o.amount, cur(o))}, due ${o.due_on}.`,
      runwayMonths != null
        ? `Runway is ${runwayMonths} months before this leaves.`
        : 'No runway on file, so this is the only number about the month that exists.',
      'Deciding at three days is a choice. Deciding on the day is whatever is left.',
    ],
    artifact: {
      kind: 'text',
      label: 'The three answers',
      value: [
        `${money(o.amount, cur(o))} to ${o.counterparty}, due ${o.due_on}.`,
        '',
        'It comes out of cash, or something owed to you lands first, or the date moves. Only the third is free today, and it is the one that costs the most later.',
        o.note ? `\nYour note: ${o.note}` : '',
      ].join('\n'),
    },
    cost_label: '10 min',
    stake: {
      metric: 'runway_months',
      direction: 'up',
      by: 1,
      withinDays: Math.max(1, days),
      value: o.amount,
    },
  };
}

export const obligationsJob: Job = {
  key: 'obligations',
  label: 'Money owed, either way',
  // A debt is true until it is paid, so its card comes back — and only the
  // newest one per obligation is worth showing.
  standing: true,

  // Cheap, as the contract requires: nothing to connect, the rows are typed.
  // Whether any are open is a result, read in run().
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const obligations = await loadObligations(ctx.profile.id);
    if (!obligations.length) return [];
    const { metrics } = await ctx.sense();

    // Inflows first, always. Money already agreed needs no opener, no reply and
    // no luck — it is the cheapest thing in the product, and the only reason it
    // has never led a morning is that the app could not see it.
    const collect = overdueIn(obligations, ctx.now).map((o) => collectMove(o, ctx.now));
    const cover = dueSoon(obligations, ctx.now, OUTFLOW_HORIZON_DAYS)
      .filter((o) => o.direction === 'out')
      .map((o) => coverMove(o, ctx.now, metrics.runway_months));

    return [...collect, ...cover].slice(0, MAX_OBLIGATION_MOVES);
  },
};
