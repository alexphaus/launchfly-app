// src/lib/copilot/jobs/capability-gap.ts
// The one thing to get better at, and the one thing to stop doing.
//
// growthEdge() already works this out from the funnel, the openings read and the
// decision record, and Signals renders it in a card at the bottom of a long
// scroll. This job is the same finding delivered as a Move, with somewhere to
// go attached — because "get better at writing openers" is advice, and advice
// is the one thing a chat window already gives away free.
//
// Two kinds out of one input, decided by the evidence rather than by taste:
// a capability the funnel says is missing is a `learn`; a topic the decision
// record says you keep acting on while nothing moves is an `avoid`. Those are
// opposite instructions and the difference matters more than the wording.

import type { GrowthEdge } from '../diagnose';
import type { MoveDraft } from '../moves';
import { isoWeekKey } from '../diagnose';
import type { Job, JobContext } from './types';

/**
 * Where to go and look. A search is a real destination that returns real
 * tutorials; a specific video id would have to be invented, and a Move that
 * links to a video nobody checked exists is worse than one that links to the
 * shelf it is on.
 */
export function tutorialSearch(capability: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${capability} tutorial`)}`;
}

/** One edge becomes one Move. Pure, so both branches are under test. */
export function capabilityMove(edge: GrowthEdge, week: string): MoveDraft {
  // A dead topic is the expensive one: repeating something that has already
  // failed costs the weeks you spend on it plus the call you did not take.
  const stop = edge.source === 'decisions';
  return {
    job: capabilityGapJob.key,
    kind: stop ? 'avoid' : 'learn',
    // Keyed by week as well as capability: the same gap next week is a new
    // card, because it is still the gap. Binned twice running and runJobs
    // stops offering it.
    external_id: `${stop ? 'stop' : 'edge'}:${edge.capability.toLowerCase()}:${week}`,
    headline: stop
      ? `Stop taking calls about ${edge.capability} — the number has never moved`
      : `Get better at ${edge.capability}`,
    why: edge.because,
    artifact: stop
      ? {
          kind: 'text',
          label: 'Show what to do instead',
          value: edge.experiment,
        }
      : {
          kind: 'link',
          label: 'Find a tutorial',
          // The experiment, not the capability: the link is where to learn it,
          // the value is what to actually do once you have.
          value: `${edge.experiment}\n\nThis came from your own funnel, not from a guess about your industry.`,
          href: tutorialSearch(edge.capability),
        },
    cost_label: stop ? null : '2 h',
    stake: stop
      // Stopping something is not measured by a number going up. What it buys is
      // the week you were about to spend, which nothing in Metrics counts.
      ? { metric: 'none', direction: 'up', by: 0, withinDays: 7 }
      : { metric: 'replies', direction: 'up', by: 1, withinDays: 14 },
  };
}

export const capabilityGapJob: Job = {
  key: 'capability_gap',
  label: 'What to get better at',
  standing: true,

  // The sensor is the funnel itself, which exists from the moment onboarding
  // does — there is nothing to connect. Gated on onboarding rather than hardwired
  // to true so that a profile with nothing set up at all still reports zero
  // sensors: "no job can see anything here" and "a quiet day" are different
  // answers, and one always-available job would have collapsed them back into one.
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const { edge } = await ctx.sense();
    return edge ? [capabilityMove(edge, isoWeekKey(ctx.now))] : [];
  },
};
