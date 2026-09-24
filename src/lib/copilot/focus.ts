// src/lib/copilot/focus.ts
// Deep work, as the person logs it.
//
// The You tab was asked for "money, runway, deep work hours". The first two were
// already rows — cash and burn typed on the profile, wins logged against
// matches. The third had no sensor at all, and invariant 2 is plain about what
// happens then: a number with no rows behind it is not shown. Estimating focus
// from capacity (what somebody said they had) or from app activity (taps) would
// produce a figure that looks like measurement and is not, which is exactly what
// 3eaa03f deleted. So this is the sensor, and the smallest honest one: a block
// of minutes on a day, typed by the person who did it.
//
// Stored as copilot_events rather than a new table: the events log is already
// "everything the user does in the app", it needs no migration, and nothing is
// lost if the shape grows later. Not a context item, deliberately — those are
// read into the brief's prompt newest-first under a cap, and a log line a day
// would push the user's own notes out of it.
//
// Pure: no DB import. store.ts reads and writes; the route validates with this.

export const FOCUS_EVENT = 'focus_logged';

/** Below this it is a break between two other things, not a block of work. */
export const FOCUS_MIN_MINUTES = 15;
/** One entry. Somebody logging a whole day does it as one line, not twelve. */
export const FOCUS_MAX_MINUTES = 12 * 60;
/**
 * How far back a block can be logged. The tile shows the last seven days, so a
 * forgotten Tuesday can still be put in on Friday — and nothing older, because a
 * week-old guess at how long you focused is a guess.
 */
export const FOCUS_BACK_DAYS = 6;
export const FOCUS_NOTE_MAX = 120;
/** The buttons. Typing a number at the end of a day is the step people skip. */
export const FOCUS_PRESETS = [30, 60, 90, 120, 180, 240] as const;

export interface FocusLog {
  id: string;
  minutes: number;
  /** The day it happened, YYYY-MM-DD in the person's own timezone. */
  on: string;
  note: string | null;
  at: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Shift a YYYY-MM-DD day in UTC, so a DST boundary never moves it by an hour. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type FocusInput = { minutes: number; on: string; note: string | null };

/**
 * What the route will write, or the sentence explaining why not.
 *
 * Future days are refused rather than clamped: a block logged for tomorrow is a
 * plan, and a plan counted as focus is the flattering number this exists to not
 * produce.
 */
export function normalizeFocus(raw: Record<string, unknown>, today: string): { ok: true; value: FocusInput } | { ok: false; error: string } {
  const minutes = typeof raw.minutes === 'number' ? raw.minutes : Number(raw.minutes);
  if (!Number.isFinite(minutes)) return { ok: false, error: 'How long was it?' };
  const m = Math.round(minutes);
  if (m < FOCUS_MIN_MINUTES) return { ok: false, error: `Log blocks of ${FOCUS_MIN_MINUTES} minutes or more.` };
  if (m > FOCUS_MAX_MINUTES) return { ok: false, error: 'That is longer than a day of work. Log it as the hours you actually focused.' };

  const on = raw.on == null || raw.on === '' ? today : raw.on;
  if (!isIsoDay(on)) return { ok: false, error: 'That is not a day.' };
  if (on > today) return { ok: false, error: 'That day has not happened yet.' };
  if (on < shiftDay(today, -FOCUS_BACK_DAYS)) return { ok: false, error: `Only the last ${FOCUS_BACK_DAYS + 1} days can be logged.` };

  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, FOCUS_NOTE_MAX) : null;
  return { ok: true, value: { minutes: m, on, note } };
}

/**
 * Rows off copilot_events, trusted no further than their shape. An event whose
 * payload does not parse is dropped rather than counted as zero — a zero would
 * be a number, and this row does not say one.
 */
export function focusFromEvents(rows: Array<{ id: number | string; payload: unknown; created_at: string }>): FocusLog[] {
  const out: FocusLog[] = [];
  for (const r of rows) {
    const p = (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>;
    const minutes = typeof p.minutes === 'number' ? Math.round(p.minutes) : NaN;
    if (!Number.isFinite(minutes) || minutes <= 0 || !isIsoDay(p.on)) continue;
    out.push({
      id: String(r.id),
      minutes,
      on: p.on,
      note: typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null,
      at: r.created_at,
    });
  }
  return out;
}

export interface FocusWeek {
  /** Seven days ending today, oldest first. A day with nothing logged is 0. */
  days: Array<{ on: string; minutes: number }>;
  total: number;
  today: number;
  /** Days with anything logged — the difference between "0h" and "not logged". */
  loggedDays: number;
}

export function focusWeek(logs: FocusLog[], today: string): FocusWeek {
  const days = Array.from({ length: FOCUS_BACK_DAYS + 1 }, (_, i) => ({ on: shiftDay(today, i - FOCUS_BACK_DAYS), minutes: 0 }));
  const at = new Map(days.map((d, i) => [d.on, i]));
  for (const l of logs) {
    const i = at.get(l.on);
    if (i != null) days[i].minutes += l.minutes;
  }
  return {
    days,
    total: days.reduce((a, d) => a + d.minutes, 0),
    today: days[days.length - 1].minutes,
    loggedDays: days.filter((d) => d.minutes > 0).length,
  };
}

/** "45m", "1h", "1.5h", "12h". Hours to one decimal — nobody logs focus to the minute. */
export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

/** The day's initial, for a seven-column strip. Read off the day string, never an instant. */
export function dayLetter(day: string): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${day}T00:00:00Z`).getUTCDay()];
}
