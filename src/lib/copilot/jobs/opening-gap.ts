// src/lib/copilot/jobs/opening-gap.ts
// Your matches have something in common and nothing you send says so.
//
// This is the one read in the product that nothing general can reconstruct: it
// is counted off THIS user's own matched listings, not off an article about
// their industry. Signals already renders it as a chart. A chart is a thing to
// look at; a Move is a thing to do — so the same measurement, once enough
// businesses share it to be worth acting on, arrives as a decision with the
// line already written.
//
// It is an OPENING, not a demand. Every term here was written by a scraper
// ABOUT the prospect — no_website, few_reviews, low_rating, running facebook
// ads — and nobody asked for any of them. That is why the line goes into
// `problem`, the thing the offer says it fixes, and never into `sells`: this
// job's first draft offered to add "running facebook ads" to what the user
// sells, which is an offer describing a business nobody runs.
//
// Uses no model. The term came from real listings and the line is assembled by
// addOpeningToOffer, so it cannot invent a condition that was not observed.

import type { Opening } from '../diagnose';
import { addOpeningToOffer } from '../offer';
import type { MoveDraft } from '../moves';
import type { Offer, Profile } from '../types';
import { isoWeekKey } from '../diagnose';
import type { Job, JobContext } from './types';

/**
 * Below this it is a coincidence, not a pattern. Same floor as MIN_OPENING in
 * diagnose.ts and MIN_TRIAGE_SAMPLE in triage.ts, for the same reason: a
 * conclusion drawn from two rows will reverse itself on the third.
 */
export const MIN_GAP_BUSINESSES = 3;
/** One decision at a time. A list of openings is a chart again, which Signals already is. */
export const MAX_GAP_MOVES = 1;

const TREND_NOTE: Record<Opening['trend'], string> = {
  new: 'It did not show up at all until this week.',
  rising: 'It turns up more often now than it did a month ago.',
  steady: 'It has turned up at this rate for weeks.',
  falling: 'It turns up less than it did — this window may be closing.',
};

/**
 * One opening becomes one decision. Pure, so the wording and the guard are
 * testable.
 *
 * Returns null when the opening is already named or will not fit, because then
 * there is no line to add and the Move would be a chart with advice attached —
 * which is what Signals is for.
 */
export function openingMove(profile: Pick<Profile, 'offer'>, term: Opening, week: string): MoveDraft | null {
  const next: Offer = addOpeningToOffer(profile.offer, term.term);
  const problem = next.problem?.trim();
  if (!problem || problem === profile.offer?.problem?.trim()) return null;

  const where = term.segments[0];
  return {
    job: openingGapJob.key,
    kind: 'decide',
    // Once per term, ever. An opening still open tomorrow is the same opening.
    // Same term next week is a new card while the offer still does not name
    // it. Once-ever meant the single most valuable finding in the app was
    // shown one morning and never again.
    external_id: `opening:${term.term.toLowerCase()}:${week}`,
    headline: `${term.count} of your matches have ${term.term} in common — nothing you send says so`,
    why: [
      `${term.count} ${term.count === 1 ? 'business' : 'businesses'} you matched show ${term.term} on their own listing. Your openers never mention it.`,
      TREND_NOTE[term.trend],
      where ? `Mostly ${where.segment} — ${where.count} of them.` : 'It is spread across your segments rather than coming from one.',
    ],
    artifact: {
      kind: 'text',
      label: 'Show the line to add',
      // The whole point: the decision arrives with the edit already written.
      value: `${problem}\n\nThat is the problem your offer says it fixes, with "${term.term}" added. Paste it into Offer and every waiting draft is rewritten to lead with it.\n\nWhat you sell does not change — nobody asked for ${term.term}, it is the weakness you would be selling against.\n\nThe other answer is just as real: if you do not want to sell against ${term.term}, stop matching ${where ? where.segment : 'the segments it comes from — they are on Signals, by segment'}.`,
    },
    cost_label: '5 min',
    stake: {
      // A named opening changes the first line of every draft after it, so what
      // it should move is replies — not sends, which it does not touch.
      metric: 'replies', direction: 'up', by: 1, withinDays: 14,
    },
  };
}

export const openingGapJob: Job = {
  key: 'opening_gap',
  standing: true,
  label: 'What your matches have in common',

  // The sensor is targeting: without segments there are no matches to read an
  // opening off. Whether any opening is actually strong enough to act on is a
  // result, not availability — an account with targeting and nothing in common
  // has nothing to do, which is different from having nothing plugged in.
  available(ctx: JobContext) {
    return ctx.profile.target_segments.length > 0;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const { diagnosis } = await ctx.sense();
    const week = isoWeekKey(ctx.now);
    return diagnosis.openings
      .filter((t) => t.count >= MIN_GAP_BUSINESSES)
      .map((t) => openingMove(ctx.profile, t, week))
      .filter((m): m is MoveDraft => !!m)
      .slice(0, MAX_GAP_MOVES);
  },
};
