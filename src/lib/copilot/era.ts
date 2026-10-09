// src/lib/copilot/era.ts
// The funnel's counts from a pivot on: what Proof judges a part on once the
// person has said the business changed there.
//
// Why. The live account pivoted who buys on 7 Oct — from booking automation
// for resorts to the app itself, for people starting out — and Proof went on
// judging the new offer by two $1 tests and six meetings from September, with
// another buyer, another product and another price. "What they pay: Not
// working" was a verdict on plumbers. A pivot is the person's own word that the
// old rows measure a different business (business.ts PIVOT_REACH says which
// parts), so from its day on those parts count only what came after.
//
// The counts are diagnose()'s own, over the rows from the day on, so the chain
// and the funnel cannot count one row two ways. Server-side, because the home
// payload carries the funnel's totals and not its rows; one pass per pivot day
// (usually one), on rows loadHome has already read.
//
// Pure: no DB import.

import type { EraCounts } from './business';
import { diagnose, type DiagnoseInput } from './diagnose';
import { dayIn } from './lab';
import type { Offer } from './types';

export type EraRows = Pick<DiagnoseInput, 'opportunities' | 'executions' | 'outcomes'>;

/**
 * Sends and outcomes from `since` (the person's day) on, counted as the funnel
 * counts them. A row with no time cannot be placed after a day and is left
 * out, as a bet leaves it out.
 */
export function eraCounts(rows: EraRows, since: string, timezone: string, offer: Offer, targetSegments: string[] = []): EraCounts {
  const from = (iso: string | null | undefined) => {
    const d = dayIn(iso ?? null, timezone);
    return !!d && d >= since;
  };
  const executions = rows.executions.filter((e) => e.approval_state === 'sent' && from(e.sent_at));
  const outcomes = rows.outcomes.filter((o) => from(o.occurred_at));
  const d = diagnose({ opportunities: rows.opportunities, executions, outcomes, offer, targetSegments });
  const count = (k: string) => d.stages.find((s) => s.key === k)?.count ?? 0;
  // Outside the app means the app never sent to them, all time: a reply this
  // week to a message sent before the pivot was the app's send all the same.
  const everSent = new Set(rows.executions.filter((e) => e.approval_state === 'sent' && e.opportunity_id).map((e) => e.opportunity_id));
  const outside = new Set(outcomes.filter((o) => o.opportunity_id && !everSent.has(o.opportunity_id)).map((o) => o.opportunity_id)).size;
  return {
    funnel: { sent: count('sent'), replied: count('replied'), meetings: count('meeting'), won: count('won'), outside },
    bySegment: d.bySegment ?? [],
    byChannel: d.byChannel ?? [],
    wins: d.wins ?? [],
  };
}

/** The counts for each pivot day the chain needs, keyed by the day. */
export function erasFor(days: string[], rows: EraRows, timezone: string, offer: Offer, targetSegments: string[] = []): Record<string, EraCounts> {
  return Object.fromEntries([...new Set(days)].map((day) => [day, eraCounts(rows, day, timezone, offer, targetSegments)]));
}

/* ─── What a pivot on who buys left behind ────────────────────────────────── */
//
// Its owner pivoted who buys on 7 Oct, from booking automation for resorts to
// the app itself for people starting out, and two days later the app still
// searched Maps for pest control and plumbing in Manila, held 148 of those
// businesses, and had rewritten 35 drafts to them from the new offer: a $29 app
// for people starting a business, pitched to exterminators. Saving the offer
// rewrites the waiting drafts by design (store.ts setOffer) — a reworded offer
// is the same business — and only the pivot says the buyers changed. So the
// pivot is what asks: these were found for the buyers you left; set them aside,
// or keep them. Asked once per pivot, answered by a tap, never done for them.

/** What a pivot on who buys left behind, said on Proof until it is answered. */
export interface PivotLeft {
  /** The pivot's day, the person's. */
  day: string;
  /** What Maps still searches for, as the person typed it before the pivot. */
  segments: string[];
  /** Businesses waiting in the pool that were found for the old buyers. */
  businesses: number;
  /** Drafts waiting to be sent to them. */
  drafts: number;
}

/** A business waiting in the pool: when it was found, on the person's day, and the segment it was found under. */
export interface PoolRow { id: string; day: string | null; segment: string | null }

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The businesses found for the old buyers: everything found before the pivot's
 * day, and anything found since under a segment typed before it — Maps went on
 * searching those every night. A business found since by a search planned from
 * the new offer is the new business's, and stays.
 */
export function foundForOld(rows: PoolRow[], day: string, segments: string[]): string[] {
  const segs = new Set(segments.map(norm).filter(Boolean));
  return rows.filter((r) => (!!r.day && r.day < day) || (!!r.segment && segs.has(norm(r.segment)))).map((r) => r.id);
}

/**
 * What the last pivot on who buys left behind, or null: no such pivot, an answer
 * already given for it (set aside or kept), or nothing left to set aside. A
 * later pivot asks again — it is another business again.
 */
export function pivotLeft(i: { day: string | null; answered: string | null; segments: string[]; pool: PoolRow[]; drafts: Array<{ opp: string | null }> }): PivotLeft | null {
  if (!i.day || (i.answered && i.answered >= i.day)) return null;
  const old = new Set(foundForOld(i.pool, i.day, i.segments));
  const drafts = i.drafts.filter((d) => !!d.opp && old.has(d.opp)).length;
  if (!i.segments.length && !old.size) return null;
  return { day: i.day, segments: i.segments, businesses: old.size, drafts };
}
