// src/lib/copilot/jobs/demand-gap.ts
// The market in front of you keeps asking for something you do not sell.
//
// This is the one read in the product that nothing general can reconstruct: it
// is computed from THIS user's own matches, not from an article about their
// industry. Signals already renders it as a chart. A chart is a thing to look
// at; a Move is a thing to do — so the same measurement, once it is strong
// enough to act on, arrives as a decision with the new offer line attached.
//
// Uses no model. The term came from real listings and the line is assembled by
// addTermToOffer, so this cannot invent a demand that was not measured.

import type { DemandTerm } from '../diagnose';
import { addTermToOffer } from '../offer';
import type { MoveDraft } from '../moves';
import type { Offer, Profile } from '../types';
import type { Job, JobContext } from './types';

/**
 * Below this it is a coincidence, not a market. Same floor as MIN_DEMAND in
 * diagnose.ts and MIN_TRIAGE_SAMPLE in triage.ts, for the same reason: a
 * conclusion drawn from two rows will reverse itself on the third.
 */
export const MIN_GAP_BUSINESSES = 3;
/** One decision at a time. A list of gaps is a chart again, which Signals already is. */
export const MAX_GAP_MOVES = 1;

const TREND_NOTE: Record<DemandTerm['trend'], string> = {
  new: 'It did not appear at all until this week.',
  rising: 'It is asked for more often now than it was a month ago.',
  steady: 'It has been asked for at this rate for weeks.',
  falling: 'It is asked for less than it was — this window may be closing.',
};

/**
 * One gap becomes one decision. Pure, so the wording and the guard are testable.
 *
 * Returns null when the term is already in the offer or will not fit, because
 * then there is no line to add and the Move would be advice with a chart
 * attached — which is what Signals is for.
 */
export function demandGapMove(profile: Pick<Profile, 'offer'>, term: DemandTerm): MoveDraft | null {
  const next: Offer = addTermToOffer(profile.offer, term.term);
  const sells = next.sells?.trim();
  if (!sells || sells === profile.offer?.sells?.trim()) return null;

  const where = term.segments[0];
  return {
    job: demandGapJob.key,
    kind: 'decide',
    // Once per term, ever. A gap that is still open tomorrow is the same gap.
    external_id: `gap:${term.term.toLowerCase()}`,
    headline: `${term.count} of your own matches want ${term.term} — decide whether you sell it`,
    why: [
      `${term.count} ${term.count === 1 ? 'business' : 'businesses'} you matched mention ${term.term}. Your offer does not.`,
      TREND_NOTE[term.trend],
      where ? `Mostly ${where.segment} — ${where.count} of them.` : 'It is spread across your segments rather than coming from one.',
    ],
    artifact: {
      kind: 'text',
      label: 'Show the line to add',
      // The whole point: the decision arrives with the edit already written.
      value: `${sells}\n\nThat is your current offer with "${term.term}" added. Paste it into Offer and every waiting draft is rewritten in those words.\n\nThe other answer is just as real: if you do not want to sell ${term.term}, stop matching the segments that keep asking for it — ${where ? where.segment : 'they are in Signals, by segment'}.`,
    },
    cost_label: '5 min',
  };
}

export const demandGapJob: Job = {
  key: 'demand_gap',
  label: 'What the market keeps asking for',

  // The sensor is targeting: without segments there are no matches to read a
  // demand out of. Whether any gap is actually strong enough to act on is a
  // result, not availability — an account with targeting and no gap has nothing
  // to do, which is different from having nothing plugged in.
  available(ctx: JobContext) {
    return ctx.profile.target_segments.length > 0;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const { diagnosis } = await ctx.sense();
    return diagnosis.demand
      .filter((t) => t.count >= MIN_GAP_BUSINESSES)
      .map((t) => demandGapMove(ctx.profile, t))
      .filter((m): m is MoveDraft => !!m)
      .slice(0, MAX_GAP_MOVES);
  },
};
