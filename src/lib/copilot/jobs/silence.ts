// src/lib/copilot/jobs/silence.ts
// The messages that got nothing back, with the messages attached.
//
// "Note why the 3 sent openers got silence" was a row in the old "Also today"
// list — a real instruction, with nothing under it, telling somebody to go and
// think about three messages the app was already holding. That list is gone
// (see BriefOutput) and this is the one thing in it worth keeping, rebuilt to
// the standard everything else on the screen is held to: a Move carries the
// finished thing.
//
// No model. Every line is counted off executions that were actually sent and
// outcomes that were actually recorded, and the artifact prints the messages so
// each claim can be checked against the text under it. What it will never do is
// say WHY somebody did not reply — nothing here knows that, and a confident
// sentence about it is the invention invariant 2 exists to stop.

import { isoWeekKey } from '../diagnose';
import { MIN_SILENT, readSilence, silenceArtifact } from '../silence';
import { loadSilence } from '../store';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

/** A reply is worth asking for within the week. Longer and it is not a decision. */
const WITHIN_DAYS = 7;

export const silenceJob: Job = {
  key: 'silence',
  label: 'What got no reply',

  // Cheap, as the contract requires. Whether anything was actually ignored is a
  // result, read in run(): an account that has sent nothing has no silence, and
  // that is a quiet day rather than a missing sensor.
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const messages = await loadSilence(ctx.profile.id, ctx.now);
    const read = readSilence(messages);
    // Under the floor there is no pattern to look at, only a bad week — and a
    // card asking somebody to study two messages is the homework this app keeps
    // deleting.
    if (read.silent.length < MIN_SILENT) return [];

    const { metrics } = await ctx.sense();
    const headline = read.differences.length
      ? `${read.silent.length} openers got nothing back — and they differ from the ones that worked`
      : read.replied.length
      ? `${read.silent.length} openers got nothing back. Read them next to the ${read.replied.length} that were answered`
      : `${read.silent.length} openers got nothing back, and none have ever been answered`;

    return [{
      job: silenceJob.key,
      kind: 'decide',
      // Once a week. Silence is a standing state, not an event: restated every
      // morning it is noise, and restated never it is how somebody sends the
      // same opener for a month.
      external_id: `silence:${isoWeekKey(ctx.now)}`,
      headline,
      why: [
        `${metrics.sent} sent and ${metrics.replies} replied in the last ${metrics.window_days} days.`,
        // The first difference, or the honest reason there is none. Never a
        // guess at motive — only what is countable in the text itself.
        read.differences[0]
          ?? (read.replied.length
            ? 'Too few on one side to separate a habit from a coincidence yet.'
            : 'Nothing has ever come back, so there is no version that worked to compare against.'),
        'The messages are here. Whatever you change next should come from reading them, not from a rule somebody wrote.',
      ],
      artifact: {
        kind: 'text',
        label: 'Read what you sent',
        value: silenceArtifact(read),
      },
      cost_label: '10 min',
      stake: {
        metric: 'replies',
        direction: 'up',
        by: 1,
        withinDays: WITHIN_DAYS,
        // No value: what a changed opener is worth cannot be known before it is
        // changed, and the kind prior carries this rather than a made-up number.
      },
    }];
  },
};
