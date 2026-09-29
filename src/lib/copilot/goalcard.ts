// src/lib/copilot/goalcard.ts
// What a goal's card on You says: how far, by when, and where the number came from.
//
// Two lines on the card were wrong in a way the Path beside them made obvious:
//
//   "60d" and "60-day horizon" on a goal the Path said was due 31 Oct, 32 days
//   left. The card read horizon_days — the length it was written with — as time
//   left, which is the exact bug due.ts was written to end, in the one reader
//   it missed.
//
//   "$2 from logged wins" under every money goal, the exit fund included, when
//   recordOutcome credits a win to the first money goal by priority and to no
//   other. The line claimed money had gone into a fund it never touched.
//
// Pure: no DB import, so copilot-core.test.ts holds it to both.

import { dueLabel, goalDue } from './due';
import type { Goal } from './types';

export interface GoalCard {
  /** 0–100 against the target, null with no target to be a fraction of. */
  pct: number | null;
  /** The corner of the card: "20%", "32d", "Today", "Past", or "—". */
  badge: string;
  /** Under the bar: where it stands, by when, and for the credited goal what recent wins added. */
  sub: string;
}

/**
 * The goal a logged win moves: the first money goal by priority. The same rule
 * recordOutcome applies, in one place the screen can ask.
 */
export function creditedGoalId(goals: Array<Pick<Goal, 'id' | 'metric' | 'priority'>>): string | null {
  const money = goals.filter((g) => g.metric === 'currency').sort((a, b) => a.priority - b.priority);
  return money[0]?.id ?? null;
}

function valueOf(v: number, g: Pick<Goal, 'metric' | 'unit'>): string {
  const n = v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (g.metric === 'currency') return `${g.unit || '$'}${n}`;
  if (g.metric === 'percent') return `${n}%`;
  return g.unit ? `${n} ${g.unit}` : n;
}

export function goalCard(
  g: Pick<Goal, 'id' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days' | 'note'> & { created_at?: string | null },
  input: { today: string; creditedId: string | null; wonAmount: number; windowDays: number },
): GoalCard {
  const due = goalDue(g, input.today);
  const when = dueLabel(due, input.today);
  if (g.target_value && g.target_value > 0) {
    const cur = g.current_value ?? 0;
    const pct = Math.max(0, Math.min(100, Math.round((cur / g.target_value) * 100)));
    const won = g.id === input.creditedId && input.wonAmount > 0 ? `${valueOf(input.wonAmount, g)} won in the last ${input.windowDays} days` : null;
    return { pct, badge: `${pct}%`, sub: [`${valueOf(cur, g)} of ${valueOf(g.target_value, g)}`, when, won].filter(Boolean).join(' · ') };
  }
  const badge = !due ? '—' : due.daysLeft > 0 ? `${due.daysLeft}d` : due.daysLeft === 0 ? 'Today' : 'Past';
  return { pct: null, badge, sub: g.note?.trim() || when || 'No target and no date yet' };
}
