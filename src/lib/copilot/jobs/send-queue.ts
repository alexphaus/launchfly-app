// src/lib/copilot/jobs/send-queue.ts
// Outreach, demoted to a Job.
//
// This is the load-bearing file of the whole arbitration change, and it is the
// shortest one. For as long as the brief owned the Call, "send the drafts" was
// the top of the screen by construction: starterDecision has seven branches and
// all seven are outreach branches. Making outreach a Job is what forces it to
// COMPETE — on a morning when somebody who paid three months ago is still
// waiting to hear from anyone, that Move should win, and until now it could not.
//
// The artifact is the oldest waiting draft itself, not a link to the pile. A
// Move whose artifact is "open the queue" is a signpost; one carrying the
// message, addressed, with the deep link to send it as yourself, is work that
// was done while they slept. It is also the correct answer to the number that
// started all of this: 45 of 54 drafts written and never sent.

import { loadSendQueue } from '../execution';
import type { MoveDraft } from '../moves';
import { offerIsEmpty } from '../offer';
import type { Job, JobContext } from './types';

/** How many the call asks for. A queue of 45 is a pile; ten is an afternoon. */
export const SEND_TARGET = 10;
/** Older than this and a draft is stale enough to lead with. */
export const STALE_DAYS = 2;

/**
 * When a draft stops being the message you would write today.
 *
 * It is an opinion, and naming it as one is the point: the stake used to say
 * `withinDays: 1`, which is not an opinion about drafts at all — it is an
 * opinion about ranking, hardcoded. One day is the floor of the urgency curve,
 * so the send queue took the maximum multiplier (x3) every morning of its life,
 * on top of the top kind prior, which gave outreach a structural ceiling
 * nothing without a money figure on its stake could reach. Arbitration was
 * real and the screen was unchanged.
 *
 * A queue is urgent because its recipients are going cold, and how cold they
 * are is a fact about a row — the oldest draft's created_at — not a constant.
 * So urgency now RISES as the queue ages instead of starting pinned:
 *
 *   written today   withinDays 14  ->  x2.14
 *   four days on    withinDays 10  ->  x3.00
 *
 * Two weeks is where a fortnight-old opener stops being worth sending as
 * written rather than rewriting, which is the same judgement STALE_DAYS makes
 * one step earlier. It is a guess until something has actually been sent and
 * replies can be read back against the wait — the first number here worth
 * measuring rather than choosing.
 */
export const COLD_AFTER_DAYS = 14;

export function daysWaiting(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** How long the oldest draft has left before it is not worth sending as written. */
export function coldIn(waited: number): number {
  return Math.max(1, COLD_AFTER_DAYS - waited);
}

export const sendQueueJob: Job = {
  key: 'send_queue',
  // One queue, one card. Three days of unanswered ones stacked up on the live
  // account, each quoting a different count of the same pile.
  supersedes: true,
  label: 'Drafts waiting to go out',

  // Cheap, as the contract requires: an account that cannot draft cannot have a
  // queue. Whether anything is actually waiting is a result, read in run().
  available(ctx: JobContext) {
    return !offerIsEmpty(ctx.profile.offer);
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const queue = await loadSendQueue(ctx.profile.id);
    if (!queue.length) return [];

    // Oldest first — the opposite of what the screen used to show. A draft that
    // has waited eleven days is the one whose recipient is closest to having
    // moved on, and it is the number that makes somebody send.
    const oldest = [...queue].sort((a, b) => a.execution.created_at.localeCompare(b.execution.created_at))[0];
    const waited = daysWaiting(oldest.execution.created_at, ctx.now);
    const ask = Math.min(SEND_TARGET, queue.length);
    const who = oldest.opp?.title || oldest.title.replace(/^Opener to /, '').replace(/, ready to review$/, '');

    const { metrics } = await ctx.sense();
    // Only claimed when the ledger can back it: won revenue per send, times the
    // number being asked for. With nothing closed there is no rate, and the
    // stake carries no value rather than a made-up one.
    const perSend = metrics.won > 0 && metrics.sent > 0 ? metrics.won_amount / metrics.sent : null;

    return [{
      job: sendQueueJob.key,
      kind: 'earn',
      // One per day: the queue is a standing state, not an event, so it must not
      // accumulate a card per morning the way a sale does.
      external_id: `queue:${ctx.today}`,
      headline: `${queue.length} drafts written and not sent — send ${ask}, starting with ${who}`,
      why: [
        `${metrics.sent} sent against ${queue.length} waiting in the last ${metrics.window_days} days.`,
        waited >= STALE_DAYS
          ? `The oldest has been sitting ${waited} days. Nobody is getting warmer.`
          : 'Every one is addressed to a real business with a contact on file.',
        'The writing is already paid for. Sending is the only step left that costs nothing.',
      ],
      artifact: {
        kind: 'message',
        label: oldest.execution.deep_link ? (oldest.execution.channel === 'whatsapp' ? 'Open in WhatsApp' : 'Open in email') : 'Copy the message',
        value: oldest.execution.body,
        href: oldest.execution.deep_link ?? null,
      },
      cost_label: `${ask * 3} min`,
      stake: {
        metric: 'queue',
        direction: 'down',
        by: ask,
        // From the oldest draft's own age, not from a constant — see
        // COLD_AFTER_DAYS. A queue written this morning is not as urgent as one
        // whose oldest has sat eleven days, and saying it was is what kept
        // outreach at the top of the screen whatever else the night produced.
        withinDays: coldIn(waited),
        value: perSend != null ? Math.round(perSend * ask) : undefined,
      },
    }];
  },
};
