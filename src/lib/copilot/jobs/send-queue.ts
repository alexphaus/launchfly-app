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

export function daysWaiting(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
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
        // Today. A queue is only urgent because it is not getting less urgent.
        withinDays: 1,
        value: perSend != null ? Math.round(perSend * ask) : undefined,
      },
    }];
  },
};
