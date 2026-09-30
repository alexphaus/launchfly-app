// src/lib/copilot/money/book.ts
// The money book: the list under the balance, the calendar, and the numbers on
// both — computed from rows, never kept as a second copy of them.
//
// Its owner logs cash in a budgeting app and used exactly one screen of it:
// log a move, read the list under the balance with the day's spend on each
// header, glance at the calendar. Everything else there went unopened. Feeding
// that app's CSV to this one was a month behind by construction, so the screen
// moved here, writing into the same copilot_transactions every read already
// uses (bookstore.ts). Runway, money in and the plan move the moment a row is
// logged.
//
// The balance is the one number the rows cannot give — a budget export prints
// none — so the person says it once (`BookAnchor`) and every row they log after
// it moves it. Rows read off a file never move it: those were already in the
// number they typed, and counting them again would take a peso off twice.
//
// Pure: no DB, no network. copilot-core.test.ts holds it.

import type { Finance } from '../types';
import { FX_SOURCE, currencyMark, latestRate, rateOn, toCode, type FxTable } from './fx';

/** The balance the person said, in the book's currency, and when. */
export interface BookAnchor {
  currency: string;
  balance: number;
  /** ISO instant it was said: rows logged after it move it. */
  at: string;
  /** YYYY-MM-DD, the person's day it was said on. */
  on: string;
  /** The currency moves are typed in by default, when another than the book's (BookAnchorRow.entry). */
  entry?: string | null;
}

/** A finance row's book, read defensively: written by whichever version ran it. */
export function anchorOf(f: Finance | null | undefined): BookAnchor | null {
  const b = f?.book;
  if (!b || typeof b.balance !== 'number' || !Number.isFinite(b.balance) || typeof b.at !== 'string' || typeof b.on !== 'string') return null;
  const currency = toCode(b.currency);
  const entry = toCode(b.entry);
  return currency ? { currency, balance: b.balance, at: b.at, on: b.on, ...(entry && entry !== currency ? { entry } : {}) } : null;
}

export interface BookRow {
  id: string;
  /** YYYY-MM-DD. After today it is pending. */
  on: string;
  /** Signed, in `currency`: money in positive. */
  amount: number;
  currency: string | null;
  description: string;
  category: string | null;
  note: string | null;
  /** 'weekly' or 'monthly@<day>' on a logged row that repeats. */
  repeat: string | null;
  createdAt: string;
  /** Logged in the book, not read off a file. Only these can be edited, and only these move the balance. */
  book: boolean;
  /** The file a read row came from, for "from DefaultTransactions.csv". */
  source: string | null;
  /**
   * What the person typed, when they logged it in another currency than the
   * book's: €12 in a peso book. `amount` is that, converted on its day and
   * kept — so the balance never moves when a rate does.
   */
  entered?: { amount: number; currency: string } | null;
}

/* ─── Repeats ─────────────────────────────────────────────────────────────── */

export type Repeat = { every: 'week' } | { every: 'month'; day: number };

export function parseRepeat(v: string | null | undefined): Repeat | null {
  if (v === 'weekly') return { every: 'week' };
  const m = /^monthly@(\d{1,2})$/.exec(v ?? '');
  if (!m) return null;
  const day = Number(m[1]);
  return day >= 1 && day <= 31 ? { every: 'month', day } : null;
}

/** How a repeat is stored: a monthly one keeps the day it started on, so the 31st comes back after February's 28th. */
export function repeatValue(every: 'week' | 'month', on: string): string {
  return every === 'week' ? 'weekly' : `monthly@${Number(on.slice(8, 10))}`;
}

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const shift = (d: string, n: number) => new Date(dayMs(d) + n * 86_400_000).toISOString().slice(0, 10);

/** The day after `on` a repeat comes round again. */
export function nextRepeat(r: Repeat, on: string): string {
  if (r.every === 'week') return shift(on, 7);
  const [y, m] = on.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(r.day, last)).padStart(2, '0')}`;
}

/**
 * The day a series' row stands for: its date, or the day in its fingerprint
 * when that is later. A repeat's next row moved to an earlier date keeps the
 * fingerprint of the day it was written for, and counting from its new date
 * would ask for that same fingerprint again — the write is ignored as a
 * duplicate, and the series stops without a word.
 */
export function seriesDay(postedOn: string, fingerprint: string): string {
  const m = /^repeat:[^:]+:(\d{4}-\d{2}-\d{2})$/.exec(fingerprint);
  return m && m[1] > postedOn ? m[1] : postedOn;
}

/**
 * The rows a repeat still owes, up to and including the first one after today:
 * a row whose day has come writes the next, which is pending until its own day.
 * Bounded, so a series nobody opened the app for in a year writes a year of
 * rows once and not forever.
 */
export function repeatsDue(r: Repeat, last: string, today: string, max = 60): string[] {
  const out: string[] = [];
  let at = last;
  while (at <= today && out.length < max) {
    at = nextRepeat(r, at);
    out.push(at);
  }
  return out;
}

/* ─── The balance ─────────────────────────────────────────────────────────── */

/**
 * The balance now: the one the person said, moved by every row they logged
 * after saying it — written after it, or dated after its day — that is not
 * pending. Rows read off a file never move it (see the top of this file).
 */
export function bookBalance(
  anchor: BookAnchor,
  rows: ReadonlyArray<{ on: string; amount: number; currency: string | null; createdAt?: string; book?: boolean }>,
  today: string,
): number {
  let total = anchor.balance;
  for (const r of rows) {
    if (!r.book || r.on > today || toCode(r.currency) !== anchor.currency) continue;
    if ((r.createdAt ?? '') > anchor.at || r.on > anchor.on) total += r.amount;
  }
  return Math.round(total * 100) / 100;
}

/* ─── The screen ──────────────────────────────────────────────────────────── */

export interface BookLine {
  id: string;
  on: string;
  /** What the person reads: their note, else the category, else what the file said. */
  label: string;
  /** The category, when the label is the note. */
  sub: string | null;
  amount: number;
  /** In the view currency; equal to `amount` when the view is the book's own. */
  shown: number;
  book: boolean;
  repeat: string | null;
  category: string | null;
  note: string | null;
  source: string | null;
  /** What it was for, as a picture: see categoryIcon. */
  icon: BookIcon;
  /** Typed in another currency than the book's (BookRow.entered). */
  entered: { amount: number; currency: string } | null;
}

export interface BookDay {
  on: string;
  /** "Today", "Yesterday", "Tue 29 Sep". */
  label: string;
  spent: number;
  received: number;
  lines: BookLine[];
}

export interface CalendarCell {
  on: string;
  day: number;
  spent: number;
  received: number;
  /** The balance at the end of the day; null after today or with no balance set. */
  balance: number | null;
  future: boolean;
}

export interface BookView {
  /** The book's currency: what is logged in. */
  currency: string;
  /** What amounts are shown in. The book's own when no rate reaches the one asked for (see `missing`). */
  view: string;
  balance: { amount: number; shown: number; rateDay: string | null } | null;
  month: string;
  monthLabel: string;
  /** The months there is anything in, for the arrows. */
  first: string;
  last: string;
  totals: { spent: number; received: number };
  days: BookDay[];
  calendar: CalendarCell[];
  pending: BookLine[];
  categories: { out: string[]; in: string[] };
  /** Why the view asked for is not the one shown. */
  missing: string | null;
  /** Rows from a file that named no currency: not in the book until the person says which. */
  unlabelled: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today", "Yesterday", "Tue 29 Sep" — a fixed list, so the server and the phone print the same words. */
export function bookDayLabel(on: string, today: string): string {
  if (on === today) return 'Today';
  if (on === shift(today, -1)) return 'Yesterday';
  if (on === shift(today, 1)) return 'Tomorrow';
  const d = new Date(`${on}T00:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** The month before or after "2026-09". */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Categories the picker offers before anything is logged: the ones a cash budget uses most. */
export const DEFAULT_CATEGORIES = {
  out: ['Groceries', 'Dining Out', 'Coffee', 'Transportation', 'Utilities', 'Housing', 'Self-care', 'Purchases'],
  in: ['Salary', 'Client', 'Help'],
};
/** Chips shown in the picker. Past this it is a list to scroll, not a tap. */
const CATEGORY_CHIPS = 12;

/** "₱71,479.06", "₱510" — the cents a book is kept to, and none when there are none. */
export function bookMoney(n: number, currency: string): string {
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Math.round(abs * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
  const mark = currencyMark(currency);
  return `${n < 0 ? '-' : ''}${/^[A-Za-z]{2,}$/.test(mark) ? `${mark} ` : mark}${body}`;
}

export function bookView(input: {
  rows: BookRow[];
  anchor: BookAnchor | null;
  /** The book's currency, a code. */
  currency: string;
  /** The currency to show amounts in, a code. */
  view: string;
  today: string;
  /** "2026-09". */
  month: string;
  fx: FxTable;
  /** Why the rate service gave nothing for this pair, when it did not. */
  fxMissing?: string | null;
  /**
   * The balance now, when the caller read the rows that move it on their own
   * (store.ts bookBalanceNow) — runway's figure, so the two cannot differ for a
   * book kept longer than `rows` reach. Absent, it is counted from `rows`.
   */
  balanceNow?: number | null;
}): BookView {
  const { currency, today, month } = input;
  const rows = input.rows.filter((r) => toCode(r.currency) === currency);
  const unlabelled = input.rows.filter((r) => !r.currency).length;
  const effective = rows.filter((r) => r.on <= today);

  // One currency on screen. Every row converts at its own day's rate, or none
  // does: a list with half its amounts in pesos and half in euros adds up to
  // nothing, so a missing rate shows the whole month in the book's own.
  const inMonth = effective.filter((r) => r.on.slice(0, 7) === month);
  const pendingRows = rows.filter((r) => r.on > today).sort((a, b) => a.on.localeCompare(b.on));
  let view = input.view;
  let missing: string | null = null;
  if (view !== currency) {
    const unconvertible = [...inMonth, ...pendingRows].some((r) => !rateOn(input.fx, currency, view, r.on > today ? today : r.on))
      || (input.anchor && !latestRate(input.fx, currency, view));
    if (unconvertible) {
      missing = `No ${currency} to ${view} rate for these days${input.fxMissing ? ` (${input.fxMissing})` : ''}, so this is in ${currency}.`;
      view = currency;
    }
  }
  const shown = (amount: number, on: string) => {
    if (view === currency) return amount;
    const r = rateOn(input.fx, currency, view, on > today ? today : on)!;
    return Math.round(amount * r.rate * 100) / 100;
  };
  const line = (r: BookRow): BookLine => {
    const label = r.note?.trim() || r.category?.trim() || r.description;
    const entered = r.entered && r.entered.currency !== currency ? r.entered : null;
    return {
      id: r.id, on: r.on, label,
      sub: r.note?.trim() && r.category?.trim() ? r.category.trim() : null,
      amount: r.amount,
      // Shown in the currency it was typed in, it is what was typed: €12, not
      // €12 turned into pesos and back at two rates.
      shown: entered && entered.currency === view ? entered.amount : shown(r.amount, r.on),
      book: r.book, repeat: r.repeat,
      category: r.category, note: r.note, source: r.book ? null : r.source,
      icon: categoryIcon(r.category, `${r.note ?? ''} ${r.description}`, r.amount), entered,
    };
  };

  const balanceNow = input.anchor && input.anchor.currency === currency ? input.balanceNow ?? bookBalance(input.anchor, rows, today) : null;
  const rate = view === currency ? null : latestRate(input.fx, currency, view);
  const balance = balanceNow == null ? null : {
    amount: balanceNow,
    shown: rate ? Math.round(balanceNow * rate.rate * 100) / 100 : balanceNow,
    rateDay: rate?.day ?? null,
  };

  // The list: this month's days, newest first, each with what went out and came in.
  const byDay = new Map<string, BookRow[]>();
  for (const r of inMonth) byDay.set(r.on, [...(byDay.get(r.on) ?? []), r]);
  const days: BookDay[] = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([on, list]) => {
      // Newest logged first within a day, the way the person entered them.
      const lines = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(line);
      return {
        on, label: bookDayLabel(on, today), lines,
        spent: round2(lines.filter((l) => l.shown < 0).reduce((s, l) => s - l.shown, 0)),
        received: round2(lines.filter((l) => l.shown > 0).reduce((s, l) => s + l.shown, 0)),
      };
    });

  // The calendar: every day of the month, the day's spend, and the balance at
  // its end — worked back from now, so it needs a balance and stops at today.
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const later = (d: string) => effective.filter((r) => r.on > d).reduce((s, r) => s + r.amount, 0);
  const calendar: CalendarCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const on = `${month}-${String(d).padStart(2, '0')}`;
    const day = byDay.get(on) ?? [];
    const future = on > today;
    const bal = balanceNow != null && !future ? balanceNow - later(on) : null;
    calendar.push({
      on, day: d, future,
      spent: round2(day.filter((r) => r.amount < 0).reduce((s, r) => s - shown(r.amount, r.on), 0)),
      received: round2(day.filter((r) => r.amount > 0).reduce((s, r) => s + shown(r.amount, r.on), 0)),
      balance: bal == null ? null : Math.round((rate ? bal * rate.rate : bal) * 100) / 100,
    });
  }


  const months = rows.map((r) => r.on.slice(0, 7));
  const thisMonth = today.slice(0, 7);
  return {
    currency, view, balance, month,
    monthLabel: monthLabel(month),
    first: months.reduce((a, b) => (b < a ? b : a), thisMonth),
    last: months.reduce((a, b) => (b > a ? b : a), thisMonth),
    totals: { spent: round2(days.reduce((s, d) => s + d.spent, 0)), received: round2(days.reduce((s, d) => s + d.received, 0)) },
    days, calendar,
    pending: pendingRows.slice(0, 20).map(line),
    categories: bookCategories(rows),
    missing, unlabelled,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the picker offers: the person's own categories, most used first, then the usual ones they have not used. */
export function bookCategories(rows: ReadonlyArray<{ category: string | null; amount: number }>): { out: string[]; in: string[] } {
  const tally = (sign: 1 | -1) => {
    const n = new Map<string, number>();
    for (const r of rows) {
      const c = r.category?.trim();
      if (c && Math.sign(r.amount) === sign) n.set(c, (n.get(c) ?? 0) + 1);
    }
    const own = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
    const defaults = (sign > 0 ? DEFAULT_CATEGORIES.in : DEFAULT_CATEGORIES.out).filter((c) => !own.some((o) => o.toLowerCase() === c.toLowerCase()));
    return [...own, ...defaults].slice(0, CATEGORY_CHIPS);
  };
  return { out: tally(-1), in: tally(1) };
}

/**
 * Where a converted book says its rate came from, under the balance: a figure
 * in euros off a peso book is a claim about a rate as well as the rows.
 * "Rate of 29 Sep, ECB daily rates" — each row in the list is at its own day's.
 */
export function bookRateLine(v: Pick<BookView, 'currency' | 'view' | 'balance'>): string | null {
  if (v.view === v.currency) return null;
  const day = v.balance?.rateDay;
  return `${day ? `rate of ${Number(day.slice(8, 10))} ${MON[Number(day.slice(5, 7)) - 1]}, ` : ''}${FX_SOURCE}`;
}

/* ─── Pictures for categories ─────────────────────────────────────────────── */

export type BookIcon =
  | 'groceries' | 'dining' | 'coffee' | 'transport' | 'bills' | 'phone' | 'home' | 'care' | 'health'
  | 'shopping' | 'sent' | 'salary' | 'client' | 'gift' | 'in' | 'out';

/**
 * A picture for a row, so a list is read at a glance: by its category first,
 * then by words in what it says — the person's own categories ("Siomai",
 * "5G DATA") get one too. A plain arrow in or out when nothing matches: a
 * wrong picture is worse than a plain one.
 */
const ICON_WORDS: Array<[BookIcon, RegExp]> = [
  ['groceries', /grocer|supermarket|market|palengke|sari.?sari|7.?eleven|minimart/],
  ['coffee', /coffee|caf[eé]|starbucks|latte|tea\b|milk ?tea/],
  ['dining', /dining|restaurant|food|eat|lunch|dinner|breakfast|snack|jollibee|mcdo|siomai|grab ?food|foodpanda/],
  ['transport', /transport|taxi|grab(?! ?food)|jeep|bus|fare|gas|fuel|petrol|parking|toll|mrt|lrt|train|angkas|car\b/],
  ['phone', /\bload\b|data|5g|4g|internet|wifi|wi-fi|mobile|phone|globe|smart|dito|pldt|converge/],
  ['bills', /utilit|electric|meralco|water|bill|vps|hosting|subscription|netflix|spotify/],
  ['home', /hous|rent|condo|apartment|home/],
  ['health', /health|pharma|medic|doctor|clinic|hospital|dentist|drug/],
  ['care', /self.?care|care|gym|salon|haircut|barber|spa|massage|beauty/],
  ['shopping', /purchase|shop|lazada|shopee|cloth|amazon|mall/],
  ['sent', /sent|transfer|remit|send|gcash out|padala/],
  ['salary', /salary|wage|payroll|pay ?check|job/],
  ['client', /client|sale|invoice|customer|project|deposit/],
  ['gift', /help|gift|family|allowance|donation|support/],
];

export function categoryIcon(category: string | null | undefined, text: string, amount: number): BookIcon {
  for (const hay of [category ?? '', text]) {
    const h = hay.toLowerCase();
    if (!h.trim()) continue;
    for (const [icon, re] of ICON_WORDS) if (re.test(h)) return icon;
  }
  return amount > 0 ? 'in' : 'out';
}

/* ─── The keypad ──────────────────────────────────────────────────────────── */

/**
 * One key on the add sheet's keypad, applied to what is typed so far. Its own
 * keypad rather than the phone's keyboard: a keyboard only opens on a tap in
 * the field, covers the categories and has to be closed to reach them — three
 * steps on every coffee. Two decimals, nine digits, no leading zeros.
 */
export function padKey(current: string, key: string): string {
  if (key === 'clear') return '';
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : `${current || '0'}.`;
  if (!/^\d$/.test(key)) return current;
  const [whole, cents] = current.split('.');
  if (cents !== undefined) return cents.length >= 2 ? current : current + key;
  if (whole === '0') return key;
  return whole.length >= 9 ? current : current + key;
}

/**
 * What was typed in the amount field, kept to what padKey allows. A phone's
 * number keyboard offers a comma too: here it is a thousands mark ("1,500" is
 * fifteen hundred), never a decimal point, so it is dropped rather than read.
 */
export function cleanAmount(raw: string): string {
  return [...raw.replace(/[,\s]/g, '')].reduce(padKey, '');
}

/* ─── Logged in another currency ──────────────────────────────────────────── */

/**
 * €12 in a peso book, as pesos: at the rate on its day, or the latest before
 * it (a weekend, today before the ECB publishes). Null without one — the book
 * does not take a number it would have to guess.
 */
export function convertEntry(fx: FxTable, from: string, to: string, amount: number, on: string, today: string): { amount: number; rate: number; day: string } | null {
  const r = rateOn(fx, from, to, on > today ? today : on);
  return r ? { amount: Math.round(amount * r.rate * 100) / 100, rate: r.rate, day: r.day } : null;
}

/**
 * A logged row, from what the add sheet sends, checked. Throws a sentence the
 * sheet can show: a book that took "abc" or a date in 1970 would be worse than
 * one that said no.
 */
export function checkEntry(input: {
  kind?: unknown; amount?: unknown; on?: unknown; category?: unknown; note?: unknown; repeat?: unknown;
}, today: string): { amount: number; on: string; category: string | null; note: string | null; repeat: 'week' | 'month' | null } {
  const raw = typeof input.amount === 'number' ? input.amount : typeof input.amount === 'string' ? Number(input.amount.replace(/,/g, '')) : NaN;
  if (!Number.isFinite(raw) || raw <= 0) throw new Error('Type an amount above zero.');
  if (raw >= 1e9) throw new Error('That amount is too large to be one move.');
  const kind = input.kind === 'in' ? 'in' : input.kind === 'out' ? 'out' : null;
  if (!kind) throw new Error('Money in or out?');
  const on = typeof input.on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.on) && !Number.isNaN(Date.parse(`${input.on}T00:00:00Z`)) ? input.on : null;
  if (!on) throw new Error('Pick a day.');
  const gap = Math.round((dayMs(on) - dayMs(today)) / 86_400_000);
  // Both ways: the read and runway look back about a year, and a cash book
  // that reaches further than that is an import, not a move to log.
  if (gap > 366 || gap < -366) throw new Error('Pick a day within a year from today.');
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);
  const category = text(input.category, 40);
  const note = text(input.note, 200);
  if (!category && !note) throw new Error('Pick a category or write what it was.');
  const repeat = input.repeat === 'week' || input.repeat === 'month' ? input.repeat : null;
  return { amount: Math.round((kind === 'out' ? -raw : raw) * 100) / 100, on, category, note, repeat };
}
