// src/lib/copilot/offer.ts
// The offer is what every drafted message is built from. These are the rules
// about it that more than one place needs to agree on, kept pure so the brief,
// the draft route, the starter agent and the client all read the same answer.
//
// Why this exists: 44 drafts were generated for a profile whose offer was empty.
// They read like a stranger's template — because they were — and none got sent.
// Nothing should draft from a blank, and the rule has to live server-side.

import { FOUND_BY, type FoundBy, type Offer } from './types';

/** The one "you" task the plan carries instead of drafts when the offer is empty. */
export const OFFER_TASK_TITLE = 'Set your offer so drafts are written in your words';
export const OFFER_TASK_DETAIL = 'Two lines: what you sell and the problem it solves. Every waiting draft is rewritten from it.';

/** Longest `sells` we store. Raised from 120 so "Add to offer" has room to append. */
export const SELLS_MAX = 240;
/** Longest `problem` we store. Same reason: openings append to it. */
export const PROBLEM_MAX = 240;

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

/** How buyers find you, the way a person would say it. */
export const FOUND_BY_LABEL: Record<FoundBy, string> = {
  outreach: 'You reach out',
  inbound: 'They find you online',
  referrals: 'Word of mouth',
  marketplace: 'A marketplace',
  local: 'In person',
};

/** What each covers, so the choice is not a guess. */
export const FOUND_BY_HINT: Record<FoundBy, string> = {
  outreach: 'Messages, calls and emails you send first',
  inbound: 'Search, social posts, content and ads bring them to you',
  referrals: 'Clients, friends and partners send them',
  marketplace: 'A platform lists you: Upwork, Fiverr, Etsy, an app store',
  local: 'A shop, a stall, events and walk-ins',
};

/** A stored value held to the list: anything else is "not said", never a guess at what was meant. */
export function isFoundBy(v: unknown): v is FoundBy {
  return typeof v === 'string' && (FOUND_BY as readonly string[]).includes(v);
}

/**
 * How buyers find this business: what the person said, else outreach when the
 * app has sent for them or found businesses to write to — finding them is what
 * outreach starts with, and nothing else here does — else nobody has said.
 * `said` keeps the two apart, so a screen can show an inferred channel as
 * inferred.
 */
export function foundByOf(offer: Offer | null | undefined, sent: number, matched = 0): { value: FoundBy | null; said: boolean } {
  if (isFoundBy(offer?.found_by)) return { value: offer!.found_by!, said: true };
  return { value: sent > 0 || matched > 0 ? 'outreach' : null, said: false };
}

/** An offer with nothing in `sells` cannot produce a message that is the user's. */
export function offerIsEmpty(offer?: Offer | null): boolean {
  return !norm(offer?.sells);
}

/**
 * Whether a change is big enough that drafts written from the old offer are now
 * wrong. Price band is left out: it never appears in an opener, so editing it
 * should not throw the queue away.
 */
export function offerChangedMaterially(prev: Offer | null | undefined, next: Offer | null | undefined): boolean {
  const keys = ['sells', 'for_who', 'problem', 'proof_url'] as const;
  return keys.some((k) => norm(prev?.[k]) !== norm(next?.[k]));
}

/**
 * Append an opening to the PROBLEM the offer says it solves.
 *
 * Deliberately not `sells`, which is where this used to append. The terms it is
 * called with are conditions a scraper observed about a prospect, so appending
 * one to what the user sells produced "WhatsApp booking automations, no
 * website" — an offer describing a business nobody runs. What they sell is
 * unchanged; what they now say they fix is not.
 *
 * `problem` is a material field for offerChangedMaterially, so waiting drafts
 * are rewritten from it — which is the whole point: the opening belongs in the
 * first line of the next opener.
 */
export function addOpeningToOffer(offer: Offer | null | undefined, term: string, max = PROBLEM_MAX): Offer {
  const base = offer ?? {};
  const t = term.trim();
  if (!t) return base;
  const current = (base.problem ?? '').trim();
  const parts = current.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === t.toLowerCase())) return base;
  const next = current ? `${current}, ${t}` : t;
  if (next.length > max) return base;
  return { ...base, problem: next };
}
