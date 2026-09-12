// src/lib/copilot/obligations.ts
// Money with a name and a date on it.
//
// Pure — no DB import — so copilot-core.test.ts covers the arithmetic. The reads
// live in store.ts.
//
// Why this is the missing sensor. scoreMove multiplies five factors and one of
// them has never moved: `money` is built to range 1.0 to 3.0 from stake.value
// against monthly burn, and only three jobs can set a value at all — two of them
// read a legacy sales table this product does not use, and the third sets a goal
// gap. On a real account the money factor is 1.0 on nearly every Move. The day
// collapses to outreach not because outreach wins but because nothing else
// brings a number to the argument.
//
// An unpaid $2,000 invoice against $350 a month of burn, due Thursday:
//
//   money   = 1 + clamp(2000/350, 0, 2) = 3.0   (capped)
//   urgency = clamp(30/3, 0.5, 3)       = 3.0
//   score   = 1.0 x 3.0 x 3.0 x 1.0     = 9.0   against a send queue at 3.0
//
// The arbitration already does the right thing. This is the input it was built
// for, and every number in it is typed by a person rather than inferred.

export type ObligationDirection = 'in' | 'out';
export type ObligationStatus = 'open' | 'settled' | 'written_off';

export interface Obligation {
  id: string;
  direction: ObligationDirection;
  counterparty: string;
  amount: number;
  currency: string | null;
  /** YYYY-MM-DD. A date somebody agreed to, not a guess. */
  due_on: string;
  status: ObligationStatus;
  note: string | null;
  settled_at: string | null;
  created_at: string;
}

/** Past this an inflow is a conversation, not a collection. */
export const CHASE_AFTER_DAYS = 0;
/** Far enough out that it is not today's decision. */
export const HORIZON_DAYS = 60;

export const daysUntil = (dueOn: string, now: Date): number => {
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  if (!Number.isFinite(due)) return Number.POSITIVE_INFINITY;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((due - today) / 86_400_000);
};

export const isOpen = (o: Obligation): boolean => o.status === 'open';

/** Owed to you and past its date. The clearest money in the product. */
export function overdueIn(obligations: Obligation[], now: Date): Obligation[] {
  return obligations
    .filter(isOpen)
    .filter((o) => o.direction === 'in' && daysUntil(o.due_on, now) <= CHASE_AFTER_DAYS)
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || b.amount - a.amount);
}

/** Coming due within the horizon, either direction, soonest first. */
export function dueSoon(obligations: Obligation[], now: Date, horizon = HORIZON_DAYS): Obligation[] {
  return obligations
    .filter(isOpen)
    .filter((o) => {
      const d = daysUntil(o.due_on, now);
      return d > CHASE_AFTER_DAYS && d <= horizon;
    })
    .sort((a, b) => a.due_on.localeCompare(b.due_on));
}

export interface Forecast {
  /** Cash on hand, as typed. */
  cash: number;
  /** Open money owed to you inside the horizon. */
  incoming: number;
  /** Open money you owe inside the horizon. */
  outgoing: number;
  /** cash + incoming - outgoing. What the horizon actually ends on. */
  net: number;
  /** Months of runway on cash alone, and on the forecast. Null without a burn. */
  months: number | null;
  forecastMonths: number | null;
  /** True when the obligations change the answer rather than decorate it. */
  changesTheAnswer: boolean;
}

/** Below this difference the forecast is the same number with extra words. */
export const MATERIAL_MONTHS = 0.5;

/**
 * Runway as a forecast rather than a figure.
 *
 * `cash / burn` is a snapshot that assumes nothing is owed in either direction,
 * which is never true of somebody running on invoices. Two months of runway with
 * $4,000 landing next week is not two months, and two months with $3,000 of tax
 * due is not two months either.
 *
 * Everything here is division over numbers a person typed. Nothing is inferred,
 * and when there is no burn on file it returns nulls rather than a guess.
 */
export function forecast(
  input: { cash: number; monthlyBurn: number | null },
  obligations: Obligation[],
  now: Date,
  horizon = HORIZON_DAYS,
): Forecast {
  const inside = obligations.filter(isOpen).filter((o) => daysUntil(o.due_on, now) <= horizon);
  const incoming = inside.filter((o) => o.direction === 'in').reduce((a, o) => a + o.amount, 0);
  const outgoing = inside.filter((o) => o.direction === 'out').reduce((a, o) => a + o.amount, 0);
  const net = input.cash + incoming - outgoing;

  const burn = input.monthlyBurn && input.monthlyBurn > 0 ? input.monthlyBurn : null;
  const months = burn ? Math.round((input.cash / burn) * 10) / 10 : null;
  // Never negative: "minus one month of runway" is not a number anybody can act
  // on, and zero already says the thing.
  const forecastMonths = burn ? Math.max(0, Math.round((net / burn) * 10) / 10) : null;

  return {
    cash: input.cash,
    incoming,
    outgoing,
    net,
    months,
    forecastMonths,
    changesTheAnswer: months != null && forecastMonths != null && Math.abs(forecastMonths - months) >= MATERIAL_MONTHS,
  };
}
