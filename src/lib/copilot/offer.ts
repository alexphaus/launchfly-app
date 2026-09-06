// src/lib/copilot/offer.ts
// The offer is what every drafted message is built from. These are the rules
// about it that more than one place needs to agree on, kept pure so the brief,
// the draft route, the starter agent and the client all read the same answer.
//
// Why this exists: 44 drafts were generated for a profile whose offer was empty.
// They read like a stranger's template — because they were — and none got sent.
// Nothing should draft from a blank, and the rule has to live server-side.

import type { Offer } from './types';

/** The one "you" task the plan carries instead of drafts when the offer is empty. */
export const OFFER_TASK_TITLE = 'Set your offer so drafts are written in your words';
export const OFFER_TASK_DETAIL = 'Two lines: what you sell and the problem it solves. Every waiting draft is rewritten from it.';

/** Longest `sells` we store. Raised from 120 so "Add to offer" has room to append. */
export const SELLS_MAX = 240;

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

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
 * Append a demand term to what the user sells, without duplicating something
 * already there and without blowing the column cap. Returns the offer unchanged
 * when the term is already present or would not fit.
 */
export function addTermToOffer(offer: Offer | null | undefined, term: string, max = SELLS_MAX): Offer {
  const base = offer ?? {};
  const t = term.trim();
  if (!t) return base;
  const current = (base.sells ?? '').trim();
  const parts = current.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => p.toLowerCase() === t.toLowerCase())) return base;
  const next = current ? `${current}, ${t}` : t;
  if (next.length > max) return base;
  return { ...base, sells: next };
}
