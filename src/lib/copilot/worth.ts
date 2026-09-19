// src/lib/copilot/worth.ts
// What a piece of work turned out to be worth, in the user's own words.
//
// The gap this closes. copilot_outcomes could only describe a message: reply,
// meeting, proposal, won, lost, no_reply. Eight of the nine Jobs produce work
// that is not a message, and a commission is work the app was authorised to have
// had DONE — and when one closed, the answer went into a free-text column that
// nothing read. So the app knew that handing work over had happened and never
// knew whether it had been worth anything.
//
// That absence had three consequences, all of them invisible:
//
//   scoreMove weighted commission work by kindPrior, i.e. by a guess about a
//   category, and would have gone on doing so for as long as the product ran
//
//   decisionReview's deadTopic can only grade a call whose METRIC moved, so work
//   whose value is not a funnel number could never be graded at all
//
//   "has this app paid for itself" had no row to read
//
// Pure — no DB import — so copilot-core.test.ts covers the vocabulary, the
// rollup and the sentence. store.ts writes the rows, stake.ts reads the rollup.

import type { OutcomeKind } from './types';

/* ─── The question ────────────────────────────────────────────────────────── */

/**
 * The four answers to "what did this turn out to be worth?".
 *
 * A subset of OutcomeKind, because a worth answer IS an outcome — there is one
 * ledger, not two. The four were chosen so that a person closing a mandate on a
 * phone can answer in one tap without lying:
 *
 *   won        money arrived
 *   saved      money or time that would otherwise have gone
 *   delivered  something useful exists now, and no number describes it
 *   nothing    it was worth nothing
 *
 * `nothing` is the load-bearing one. A close-out question with no honest zero
 * collects agreement: every answer is a flavour of value, the rollup reads as
 * uniformly positive, and the ranker learns nothing it did not already assume.
 * "I did this and it was worth nothing to me" is the most expensive sentence a
 * user can say about a feature, and until there is a row for it the product
 * cannot hear it.
 */
export const WORTH_KINDS = ['won', 'saved', 'delivered', 'nothing'] as const;
export type WorthKind = (typeof WORTH_KINDS)[number];

export interface WorthMeta {
  /** The button. Second person, concrete, no hedge. */
  label: string;
  /** One line under it, so the four are told apart without thinking. */
  sub: string;
  /**
   * Whether a number is asked for.
   *
   * Never 'required', anywhere. Somebody who knows it made money but not how
   * much would either abandon the question or type something — and a typed
   * number is exactly the invented figure invariant 2 exists to keep out of this
   * database. An amount-less `won` is a worse row than one with a figure and a
   * far better row than a fiction.
   */
  amount: 'optional' | 'none';
}

export const WORTH: Record<WorthKind, WorthMeta> = {
  won: { label: 'It made money', sub: 'Paid, or agreed and coming.', amount: 'optional' },
  saved: { label: 'It saved money or time', sub: 'Something you would otherwise have spent.', amount: 'optional' },
  delivered: { label: 'Something useful exists now', sub: 'A document, a shortlist, a decision you can act on.', amount: 'none' },
  nothing: { label: 'Nothing', sub: 'It ran and you got nothing out of it.', amount: 'none' },
};

export function isWorthKind(v: unknown): v is WorthKind {
  return typeof v === 'string' && (WORTH_KINDS as readonly string[]).includes(v);
}

/** Longest a worth note is kept. The row is evidence, not a journal entry. */
export const WORTH_NOTE_MAX = 300;

/**
 * The answer as a sentence, for copilot_commissions.outcome.
 *
 * Written as well as the ledger row, not instead of it, and the duplication is
 * deliberate: the two writes can fail independently. If the ledger insert is
 * rejected — an unapplied 20260921 makes `delivered` a 23514 and move_id a
 * PGRST204 — the commission is already closed and the user's answer has to
 * survive somewhere they can see it. A column nothing ranks on still beats
 * losing the sentence.
 */
export function worthSentence(kind: WorthKind, amount?: number | null, note?: string | null, currency = ''): string {
  const money = amount != null && Number.isFinite(amount) && amount > 0
    ? `${currency}${Math.round(amount).toLocaleString()}`
    : null;
  const head = kind === 'won' ? (money ? `Made ${money}.` : 'Made money.')
    : kind === 'saved' ? (money ? `Saved ${money}.` : 'Saved money or time.')
    : kind === 'delivered' ? 'Produced something usable.'
    : 'Worth nothing.';
  const tail = note?.trim().slice(0, WORTH_NOTE_MAX);
  return tail ? `${head} ${tail}` : head;
}

/* ─── The rollup ──────────────────────────────────────────────────────────── */

/** One outcome row, reduced to what the rollup needs. */
export interface WorthRow {
  /**
   * The job key this outcome belongs to — copilot_moves.job for a Move, and the
   * literal 'commission' for a mandate, which is the key commissionJob already
   * publishes. Null when the outcome is a reply or a win against a business,
   * which the funnel metrics already grade.
   */
  job: string | null;
  kind: OutcomeKind;
  amount: number | null;
}

export interface WorthRecord {
  /** How many worth answers this job has collected. */
  closes: number;
  /**
   * Money attributed to it, won and saved together.
   *
   * Saved money counts HERE and deliberately not in Metrics.won_amount: it is
   * real evidence about whether this kind of work is worth doing again, and it
   * is not revenue. computeMetrics sums only `won`, so the goal bar and the
   * runway forecast never see a saving as income.
   */
  money: number;
  /** How many of those answers were `nothing`. */
  nothing: number;
}

// There is deliberately no all-outcomes total here. "Has this app been worth
// anything" must be answered from work the app actually drove — rows carrying a
// move_id or a commission_id — and not from every win in the ledger. A manual
// `won` logged after a phone call is real money and is not evidence about this
// product, and rolling it in would let the app take credit for the user's week.
// askWorth computes its totals from worthByJob for exactly that reason.

/**
 * Worth per job key. The record scoreMove reads instead of guessing.
 *
 * Kinds outside WORTH_KINDS are skipped rather than counted as a close: a reply
 * arriving against a Move is news, not a verdict, and counting it as one would
 * let the funnel's own events dilute the `nothing` ratio this exists to detect.
 */
export function worthByJob(rows: WorthRow[]): Record<string, WorthRecord> {
  const out: Record<string, WorthRecord> = {};
  for (const r of rows) {
    if (!r.job || !isWorthKind(r.kind)) continue;
    const rec = (out[r.job] ??= { closes: 0, money: 0, nothing: 0 });
    rec.closes += 1;
    if (r.kind === 'nothing') rec.nothing += 1;
    if ((r.kind === 'won' || r.kind === 'saved') && r.amount != null && r.amount > 0) rec.money += r.amount;
  }
  return out;
}
