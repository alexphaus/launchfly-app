// src/lib/copilot/due.ts
// When a goal is due, and how many days are left.
//
// `horizon_days` is written once, when the goal is — 90 by default, because the
// goal sheet never asked — and it never counts down. Six places read it as the
// time remaining: the funnel plan said "90 days left" on the day it was written
// and on every day after; the goal-gap Move said "90 days to do it in"; the
// proposer, the per-source judge, the brief's pack and the Claude handoff all
// said the same; and the Path wrote "Within 90 days, as you set it" under goals
// nobody had set a date on. So every model in the app believed a November
// deadline was always three months away.
//
// The date is `created_at + horizon_days`, which needs no migration: setting a
// date on a goal stores the horizon that lands on it (horizonFor), and every
// reader asks goalDue how many days are left today.
//
// Pure, and imports nothing, so plan.ts, roadmap.ts and the jobs can all use it.

export interface Due {
  /** ISO date, YYYY-MM-DD. */
  dueOn: string;
  /** From today to it. Zero on the day, negative once it has passed. */
  daysLeft: number;
}

/** What the database gives a goal nobody chose a date for. Said as such to the planner. */
export const DEFAULT_HORIZON_DAYS = 90;

const DAY_MS = 86_400_000;
/** Midnight UTC of the calendar day an ISO date or timestamp falls on. */
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The goal's date and the days left to it, or null when it has no horizon or
 * the row did not say when it was written. Null rather than a guess: without
 * `created_at` the only number available is the horizon itself, and reading
 * that as time left is the bug this file exists to end.
 */
export function goalDue(g: { horizon_days?: number | null; created_at?: string | null }, today: string): Due | null {
  const h = g.horizon_days;
  if (!h || h <= 0 || !g.created_at) return null;
  const start = dayOf(g.created_at);
  const now = dayOf(today);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;
  const due = start + h * DAY_MS;
  return { dueOn: new Date(due).toISOString().slice(0, 10), daysLeft: Math.round((due - now) / DAY_MS) };
}

/**
 * The horizon that lands on `dueOn`, counted from the day the goal was written
 * (today, for one being written now). Null for a date on or before that day.
 */
export function horizonFor(dueOn: string, createdAt: string | null | undefined, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return null;
  const due = dayOf(dueOn);
  const start = dayOf(createdAt || today);
  if (!Number.isFinite(due) || !Number.isFinite(start)) return null;
  const days = Math.round((due - start) / DAY_MS);
  return days > 0 ? days : null;
}

/** "30 Nov", with the year only when it is not this one. Fixed locale and zone, so server and client agree. */
export function dateLabel(iso: string, today: string): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  });
}

/** "By 30 Nov · 63 days left", "Due today", "4 days past its date". */
export function dueLabel(due: Due | null, today: string): string | null {
  if (!due) return null;
  if (due.daysLeft > 0) return `By ${dateLabel(due.dueOn, today)} · ${plural(due.daysLeft, 'day')} left`;
  if (due.daysLeft === 0) return 'Due today';
  return `${plural(-due.daysLeft, 'day')} past its date`;
}

/** "63 days left", "due today", "4 days past its date" — the same, inside a sentence. */
export function daysPhrase(due: Due): string {
  if (due.daysLeft > 0) return `${plural(due.daysLeft, 'day')} left`;
  if (due.daysLeft === 0) return 'due today';
  return `${plural(-due.daysLeft, 'day')} past its date`;
}
