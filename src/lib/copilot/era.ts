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
