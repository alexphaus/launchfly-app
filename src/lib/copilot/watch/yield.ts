// src/lib/copilot/watch/yield.ts
// Which feeds are earning their place, computed rather than felt.
//
// Discovery without this makes the app worse. A watchlist somebody typed by hand
// is self-limiting — nobody pastes twelve URLs — but one the app fills has no
// such brake, and the failure is silent: every extra source is another nightly
// model call, another handful of Moves, and no way to tell which of them the
// user actually wanted. The feeling is "the app got noisy"; the fact is "these
// two feeds produced nineteen Moves and you binned all of them".
//
// Nothing new is stored. A watcher Move already carries `${source_id}:${item_id}`
// as its external_id and copilot_moves already records whether it was done or
// dismissed, so the whole read is a group-by over rows that exist. A counter
// column would be a second copy of that fact and the second copy is the one that
// drifts — see invariant 2: if a number is shown it is computed from rows the
// user created.
//
// Pure. store.ts does the reading.

import { KEEP_HIGH, KEEP_LOW, MIN_MOVE_SAMPLE } from '../moves';

/** Watched this long with nothing to show and it is not shy, it is wrong. */
export const QUIET_AFTER_DAYS = 14;

/** The columns this needs off copilot_moves, and no more. */
export interface WatchMoveRow {
  external_id: string | null;
  status: string | null;
}

/** The columns this needs off copilot_sources. */
export interface YieldSource {
  id: string;
  created_at: string;
  last_checked_at: string | null;
}

export type YieldVerdict =
  /** Added, never checked, or checked and still young. No opinion yet. */
  | 'new'
  /** Read for a fortnight and has never produced a single Move. */
  | 'quiet'
  /** Producing Moves that nobody has answered yet. */
  | 'unanswered'
  /** Answered often enough, and kept. */
  | 'earning'
  /** Answered often enough, and binned. */
  | 'noise';

export interface SourceYield {
  sourceId: string;
  /** Moves this source has ever produced. */
  moves: number;
  kept: number;
  dismissed: number;
  /** Produced but not yet answered. */
  open: number;
  /** kept / answered, or null below MIN_MOVE_SAMPLE — one bad morning is not a rate. */
  rate: number | null;
  verdict: YieldVerdict;
}

/**
 * The source half of a watcher Move's external_id.
 *
 * Written by movesFromVerdicts as `${source.id}:${item.id}`, and item ids are
 * whatever the feed said — they routinely contain colons, because a guid is
 * often a URL. So this splits on the FIRST colon only; splitting on the last, or
 * on all of them, mis-attributes every Move from every feed that uses URL guids,
 * which is most of them.
 */
export function sourceIdOf(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const at = externalId.indexOf(':');
  if (at <= 0) return null;
  return externalId.slice(0, at);
}

const daysBetween = (from: string, now: Date): number => {
  const t = Date.parse(from);
  return Number.isFinite(t) ? (now.getTime() - t) / 86_400_000 : 0;
};

/**
 * Per-source record, for every source — including the ones that produced
 * nothing, which are the interesting ones and the ones a group-by over Moves
 * alone would silently omit.
 */
export function sourceYield(rows: WatchMoveRow[], sources: YieldSource[], now: Date): Map<string, SourceYield> {
  const tally = new Map<string, { moves: number; kept: number; dismissed: number; open: number }>();
  for (const source of sources) tally.set(source.id, { moves: 0, kept: 0, dismissed: 0, open: 0 });

  for (const row of rows) {
    const id = sourceIdOf(row.external_id);
    // A Move whose source has since been deleted still happened, but there is no
    // card left to put its record on.
    if (!id) continue;
    const t = tally.get(id);
    if (!t) continue;
    t.moves += 1;
    if (row.status === 'done') t.kept += 1;
    else if (row.status === 'dismissed') t.dismissed += 1;
    else t.open += 1;
  }

  const out = new Map<string, SourceYield>();
  for (const source of sources) {
    const t = tally.get(source.id)!;
    const answered = t.kept + t.dismissed;
    const rate = answered >= MIN_MOVE_SAMPLE ? t.kept / answered : null;

    let verdict: YieldVerdict;
    if (rate != null) verdict = rate >= KEEP_HIGH ? 'earning' : rate <= KEEP_LOW ? 'noise' : 'unanswered';
    else if (t.moves > 0) verdict = 'unanswered';
    else if (source.last_checked_at && daysBetween(source.created_at, now) >= QUIET_AFTER_DAYS) verdict = 'quiet';
    else verdict = 'new';

    out.set(source.id, { sourceId: source.id, moves: t.moves, kept: t.kept, dismissed: t.dismissed, open: t.open, rate, verdict });
  }
  return out;
}

/**
 * The line under a source on the sheet.
 *
 * Counts, not adjectives. "12 found · 1 kept · 9 binned" lets somebody decide;
 * "low relevance" asks them to trust a word the app made up. Null when there is
 * genuinely nothing to say, and then the card stays quiet rather than printing
 * three zeroes.
 */
export function yieldLine(y: SourceYield | undefined): string | null {
  // Undefined is a real case, not a defensive flourish: a home payload written
  // before sourceYield existed, or a source added in the same tick the map was
  // built. Reading .verdict off it would blank the sheet, which is a worse
  // outcome than the line simply not being there.
  if (!y) return null;
  if (y.verdict === 'quiet') return `Nothing in ${QUIET_AFTER_DAYS} days`;
  if (!y.moves) return null;
  const parts = [`${y.moves} found`];
  if (y.kept) parts.push(`${y.kept} kept`);
  if (y.dismissed) parts.push(`${y.dismissed} binned`);
  return parts.join(' · ');
}

/**
 * Sources worth removing, worst first.
 *
 * A suggestion and never an action: the app deletes nothing the user chose to
 * watch. It earned the right to an opinion by counting, and that is the whole
 * extent of the right.
 */
export function pruneSuggestions(yields: Iterable<SourceYield>): SourceYield[] {
  return [...yields]
    .filter((y) => y.verdict === 'noise' || y.verdict === 'quiet')
    // Noise first: a feed producing Moves you bin costs a model call a night AND
    // a judgement every morning. A quiet one only costs the call.
    .sort((a, b) => (b.dismissed - a.dismissed) || (b.moves - a.moves));
}
