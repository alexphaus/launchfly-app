// src/lib/copilot/money/ledger.ts
// What the rows of someone's bank say, in sentences they can check.
//
// "Last 12 months: $8,400 in from 7 payers. Two of them were 64% of it. Nobody
// has paid you in 23 days. You spend $900 a month, $310 of it on repeat bills."
// Every number in that is a sum, a count or a date off copilot_transactions —
// nothing estimated, nothing asked (invariant 2). Where the rows cannot say a
// thing (no balance printed, a fortnight of history) the sentence is left out,
// not filled in.
//
// It is also where the money meets the rest of the ledger:
//
//   financeFromRead   the cash and burn every other part of the app already
//                     reads (runway, the runway guard, scoreMove's money
//                     factor, the plan), written from the statement instead of
//                     typed — unless the person typed something newer
//   winsToRecord      a client's deposit becomes a `won` outcome once the
//                     person has said the payer is a client — the join from a
//                     message to money that actually landed
//   matchWin          so a win they already logged by hand is attached to the
//                     deposit, never counted twice
//
// Pure: no DB import. store reads the rows, this reads them back.

import type { Finance } from '../types';
import { FX_SOURCE, currencyCodeOf, currencyMark, rateLine, rateOn, toCode, type FxTable } from './fx';
import { displayName } from './statement';

/* ─── Shapes ──────────────────────────────────────────────────────────────── */

/** What a payer or payee is to this person. Theirs to say, one tap each; never inferred. */
export type PayeeRole = 'client' | 'employer' | 'self' | 'other';
export const PAYEE_ROLES: PayeeRole[] = ['client', 'employer', 'self', 'other'];
export const ROLE_LABEL: Record<PayeeRole, string> = {
  client: 'A client',
  employer: 'My job',
  self: 'My own account',
  other: 'Something else',
};

export interface LedgerTx {
  id: string;
  /** YYYY-MM-DD. */
  on: string;
  /** Signed: money in positive. */
  amount: number;
  currency: string | null;
  /** The counterparty key (statement.ts counterpartyKey). */
  key: string;
  accountId: string | null;
  /** The win this deposit was recorded as, once it was. */
  outcomeId: string | null;
  /** When the row was written. The book's balance counts logged rows written after it was set. */
  createdAt?: string;
  /** Logged in the Money tab rather than read off a statement. */
  book?: boolean;
  /** As printed. Carried for the note a recorded win keeps; never sent to the screen. */
  description?: string;
}

export interface Payee {
  key: string;
  name: string;
  role: PayeeRole | null;
  /** The business in the pipeline this payer is, when the person linked one. */
  opportunityId: string | null;
}

export interface AccountBalance {
  id: string;
  label: string;
  currency: string | null;
  /** The last balance the rows carry, and its day. Null when no statement for it printed one. */
  balance: number | null;
  on: string | null;
}

export interface Recurring {
  key: string;
  name: string;
  /** The typical amount, positive. */
  amount: number;
  every: 'week' | 'fortnight' | 'month';
  perMonth: number;
  count: number;
  last: string;
  /** When the next one should land, if the pattern holds. */
  next: string;
}

export interface PartyLine {
  key: string;
  name: string;
  total: number;
  count: number;
  last: string;
  lastAmount: number;
  /** Of all money in (or out), excluding the person's own accounts. */
  share: number;
  role: PayeeRole | null;
  opportunityId: string | null;
}

export interface MoneyRead {
  /** The currency every figure is in: the one the person chose when rows carry it, else the one most rows carry. */
  currency: string;
  /**
   * False when no row on file names a currency — a budget export nobody has
   * said the currency of yet. The figures are then printed as bare numbers and
   * kept out of runway: counted as "the person's currency" they were written
   * into a dollar runway as $37,708 a month of peso spending.
   */
  currencyKnown: boolean;
  /** Rows behind the figures: in that currency, and not between the person's own accounts. */
  rows: number;
  from: string;
  to: string;
  days: number;
  inTotal: number;
  outTotal: number;
  /** Who paid, biggest first — the person's own accounts left out. */
  payers: PartyLine[];
  /** Who was paid, biggest first — the person's own accounts left out. */
  payees: PartyLine[];
  /**
   * Averaged over the latest whole calendar months on file (`months`, oldest
   * first, at most WHOLE_MONTHS), or with none whole yet over the last `over`
   * days of rows; null under MIN_SPAN_DAYS of history.
   */
  perMonth: { in: number; out: number; over: number; months?: string[] } | null;
  /**
   * The last RECENT_DAYS of rows, ending on the last row — not on today: a
   * statement that ends on 30 Jun has nothing in "the last 30 days" in
   * September, and a tile reading ₱0 would be a zero that measures nothing.
   * `from` is later than the read's own `from` when there is less history.
   */
  recent: { from: string; to: string; in: number; out: number; payers: PartyLine[] };
  /** Calendar months with rows, newest first. `partial` when the rows start or stop inside it. */
  months: Array<{ month: string; label: string; in: number; out: number; partial: boolean }>;
  /** Where the money goes a month, over the same days perMonth averages, biggest first. Empty when perMonth is null. */
  spend: Array<{ key: string; name: string; perMonth: number; share: number }>;
  /** Money in by what the payer is, over the whole span. */
  byRole: { client: number; employer: number; other: number; unnamed: number };
  lastIn: { name: string; amount: number; on: string; days: number } | null;
  recurring: Recurring[];
  recurringPerMonth: number;
  cash: { amount: number; on: string; accounts: number; missing: number } | null;
  runwayMonths: number | null;
  /** Rows kept out of every figure and said: '' is rows whose file named no currency; a code is one with no rate to convert it. */
  otherCurrencies: Array<{ currency: string; rows: number; why?: string }>;
  /** True when the figures are in the main currency — the only read runway takes (financeFromRead). */
  inMain: boolean;
  /** Currencies converted into the main one, and how many rows each. */
  converted: Array<{ currency: string; rows: number }>;
  /** The read, one sentence each, every number off the rows above. */
  lines: string[];
  /** Payers nobody has named yet, biggest first — the questions. */
  toName: PartyLine[];
  /**
   * Money out to something that reads like the person's own account ("MY
   * SAVINGS"), not yet answered. Asked, never assumed: until they say so it is
   * spending, and a monthly transfer to savings is the biggest "bill" on the list.
   */
  ownCheck: PartyLine[];
}

/** Words that name a place money is kept rather than spent. Only ever the reason to ask. */
const OWN_ACCOUNT = /\b(SAVING|SAVINGS|AHORRO|AHORROS|EPARGNE|SPARKONTO|SPAREN|INVEST|INVESTMENT|INVESTMENTS|BROKERAGE|BROKER|ISA|POT|VAULT|MY|OWN|MYSELF)\b/;

/* ─── Days ────────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a: string, b: string): number => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
export const addDay = (d: string, n: number): string => new Date(dayMs(d) + n * DAY_MS).toISOString().slice(0, 10);
function addMonth(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Sep". A fixed list rather than Intl, so the server and the phone print the same words. */
export function dayLabel(d: string): string {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MONTH_ABBR[m - 1]}`;
}

/* ─── Money, written ──────────────────────────────────────────────────────── */

// The marks live with the rates (fx.ts), so the two can never disagree about what "$" is.
export { currencyCodeOf, currencyMark } from './fx';

/**
 * The currency a time zone most likely spends, offered as the first chip when
 * a file names none — never applied without the tap. A person in Manila was
 * offered USD and EUR and had to type PHP. Only zones that map to one currency.
 */
const ZONE_CURRENCY: Array<[RegExp, string]> = [
  [/^Asia\/Manila$/, 'PHP'], [/^Asia\/(Kolkata|Calcutta)$/, 'INR'], [/^Asia\/Singapore$/, 'SGD'], [/^Asia\/Tokyo$/, 'JPY'],
  [/^Asia\/Bangkok$/, 'THB'], [/^Asia\/(Ho_Chi_Minh|Saigon)$/, 'VND'], [/^Asia\/Jakarta$/, 'IDR'], [/^Asia\/Seoul$/, 'KRW'],
  [/^Europe\/London$/, 'GBP'], [/^Europe\/(Madrid|Paris|Berlin|Rome|Amsterdam|Brussels|Lisbon|Vienna|Dublin|Athens|Helsinki|Bratislava|Ljubljana|Tallinn|Riga|Vilnius|Luxembourg|Valletta|Zagreb)$/, 'EUR'],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$|^Pacific\/Honolulu$/, 'USD'],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax)$/, 'CAD'], [/^America\/Mexico_City$/, 'MXN'], [/^America\/Sao_Paulo$/, 'BRL'],
  [/^America\/Bogota$/, 'COP'], [/^America\/Argentina\//, 'ARS'], [/^Australia\//, 'AUD'], [/^Pacific\/Auckland$/, 'NZD'], [/^Africa\/Lagos$/, 'NGN'],
];
export function currencyForZone(tz: string | null | undefined): string | null {
  return ZONE_CURRENCY.find(([re]) => re.test(tz ?? ''))?.[1] ?? null;
}

/** A figure with no currency to put on it: the same rounding as moneyText, no mark. */
export function plainMoney(n: number): string {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}${abs >= 100 ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(2).replace(/\.00$/, '')}`;
}

/** The printer for a read's own figures: its currency when a row names one, bare numbers until then. */
export function readMoney(read: Pick<MoneyRead, 'currency' | 'currencyKnown'>): (n: number) => string {
  return (n) => (read.currencyKnown ? moneyText(n, read.currency) : plainMoney(n));
}

/** "$1,200", "$5.50", "USD 1,200" — whole units at 100 and over, cents under it. */
export function moneyText(n: number, currency: string): string {
  const mark = currencyMark(currency);
  const abs = Math.abs(n);
  const body = abs >= 100 ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(2).replace(/\.00$/, '');
  const sign = n < 0 ? '-' : '';
  return /^[A-Za-z]{2,}$/.test(mark) ? `${sign}${mark} ${body}` : `${sign}${mark}${body}`;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ─── Repeat bills ────────────────────────────────────────────────────────── */

/** Three of the same makes a pattern; two is a coincidence. */
export const RECURRING_MIN = 3;
/** How far an amount may drift and still be the same bill (a phone plan with a roaming month). */
const AMOUNT_DRIFT = 0.2;
const CADENCES: Array<{ every: Recurring['every']; days: number; min: number; max: number }> = [
  { every: 'week', days: 7, min: 6, max: 8 },
  { every: 'fortnight', days: 14, min: 13, max: 16 },
  { every: 'month', days: 30.44, min: 26, max: 35 },
];

const median = (ns: number[]): number => {
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Money that leaves on a rhythm: the same payee, about the same amount, weekly,
 * fortnightly or monthly, at least RECURRING_MIN times, and still going — a
 * gym cancelled in June is not a bill due in October. Found in the rows; the
 * next date is the rhythm carried forward and is said as "around".
 */
export function recurringOut(txs: LedgerTx[], nameOf: (key: string) => string, to: string): Recurring[] {
  const byKey = new Map<string, LedgerTx[]>();
  for (const t of txs) if (t.amount < 0) byKey.set(t.key, [...(byKey.get(t.key) ?? []), t]);
  const out: Recurring[] = [];
  for (const [key, list] of byKey) {
    if (list.length < RECURRING_MIN) continue;
    const m = median(list.map((t) => -t.amount));
    const series = list.filter((t) => Math.abs(-t.amount - m) <= m * AMOUNT_DRIFT).sort((a, b) => a.on.localeCompare(b.on));
    if (series.length < RECURRING_MIN) continue;
    const gaps = series.slice(1).map((t, i) => daysBetween(series[i].on, t.on)).filter((g) => g > 0);
    if (gaps.length < RECURRING_MIN - 1) continue;
    const g = median(gaps);
    const cadence = CADENCES.find((c) => g >= c.min && g <= c.max);
    if (!cadence) continue;
    const steady = gaps.filter((x) => Math.abs(x - g) <= g * 0.25 + 2).length;
    if (steady < Math.ceil(gaps.length * (2 / 3))) continue;
    const last = series[series.length - 1].on;
    // Stopped: nothing for more than one and a half turns before the rows end.
    if (daysBetween(last, to) > cadence.days * 1.6) continue;
    const amount = median(series.map((t) => -t.amount));
    out.push({
      key,
      name: nameOf(key),
      amount,
      every: cadence.every,
      perMonth: amount * (30.44 / cadence.days),
      count: series.length,
      last,
      next: cadence.every === 'month' ? addMonth(last) : addDay(last, cadence.days),
    });
  }
  return out.sort((a, b) => b.perMonth - a.perMonth);
}

/* ─── The read ────────────────────────────────────────────────────────────── */

/** Under this much history, a monthly average is a guess about a month nobody has seen. */
export const MIN_SPAN_DAYS = 20;
/** Monthly figures are averaged over at most this many of the latest days: recent enough to be now. */
export const AVERAGE_DAYS = 90;
/** With whole calendar months on file, the monthly figures are their average: at most this many, the latest. */
export const WHOLE_MONTHS = 3;
/** Past this, "nobody has paid you" is worth saying; under it, the last payment is. */
export const QUIET_DAYS = 14;
/** A statement older than this is said to be old. */
export const STALE_DAYS = 10;
/** How far ahead a repeat bill is worth naming. */
export const NEXT_BILL_DAYS = 21;
/** Questions asked at once. More is a form; the rest come after. */
export const MAX_QUESTIONS = 5;
/** An account whose last row is further than this before the newest row is not averaged into what is spent now. */
export const LIVE_ACCOUNT_DAYS = 31;
/** How far back Money in looks: the thirty days every other tile counts. */
export const RECENT_DAYS = 30;
/** Calendar months the sheets show: a quarter, and the month before it to compare. */
const MONTHS_SHOWN = 4;
/** Lines of where the money goes. Past eight it is a statement again, not an answer. */
const SPEND_SHOWN = 8;

export interface MoneyReadInput {
  txs: LedgerTx[];
  payees: Payee[];
  accounts: AccountBalance[];
  /** The person's own today, YYYY-MM-DD. */
  today: string;
  /** Printed when the rows carry none: the currency on their finance, else a goal's. */
  currency: string;
  /**
   * The currency the whole app counts in (fx.ts mainCurrency). Every row in
   * another is converted into it at the rate for its own day. Absent, nothing
   * is converted and the figures are in the pile with the most rows.
   */
  main?: string;
  fx?: FxTable;
  /** Why a currency has no rate (fxstore.ts), said beside the rows it leaves out. Lower case, no full stop. */
  fxMissing?: Record<string, string>;
}

/**
 * The calendar months the rows cover from their first day to their last, newest
 * first: a month whose rows start after its 1st, or stop before its last day,
 * is part of a month and not in the list.
 */
export function wholeMonths(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = to.slice(0, 7).split('-').map(Number);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    const first = `${month}-01`;
    if (first < from) break;
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (last <= to) out.push(month);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** Null when there are no rows: an empty read is not a read. */
export function moneyRead(input: MoneyReadInput): MoneyRead | null {
  // A row dated after today is pending — a bill logged ahead, a repeat's next
  // one — and money that has not moved is in no figure.
  const effective = input.txs.filter((t) => t.on <= input.today);
  if (!effective.length) return null;

  // One currency per figure. With a main currency, every row in another is
  // converted into it at the ECB rate for its own day; a row whose currency
  // has no rate is left out and said — never converted at a guess. A file that
  // named no currency is its own pile until the person says which: counted as
  // "their currency", it once wrote ₱37,708 a month of spending into a dollar
  // runway. With no main currency, or nothing that converts (the rate service
  // down on a first load), the figures are in the pile with the most rows.
  const codeOf = (c: string | null) => (c ? toCode(c) ?? c.toUpperCase() : '');
  const tally = new Map<string, number>();
  for (const t of effective) tally.set(codeOf(t.currency), (tally.get(codeOf(t.currency)) ?? 0) + 1);
  const main = input.main ? toCode(input.main) ?? input.main.toUpperCase() : null;
  const why = new Map<string, string>();
  const converted = new Map<string, number>();
  let pool: LedgerTx[] = [];
  let figures = '';
  if (main) {
    for (const t of effective) {
      const c = codeOf(t.currency);
      if (!c) continue;
      if (c === main) { pool.push(t); continue; }
      const r = input.fx ? rateOn(input.fx, c, main, t.on) : null;
      if (r) { pool.push({ ...t, amount: t.amount * r.rate, currency: main }); converted.set(c, (converted.get(c) ?? 0) + 1); }
      else why.set(c, input.fxMissing?.[c] ?? `no ${c} to ${main} rate for those days`);
    }
    if (pool.length) figures = main;
  }
  if (!figures) {
    converted.clear();
    figures = [...tally.entries()].filter(([c]) => c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    pool = effective.filter((t) => codeOf(t.currency) === figures);
  }
  // With no main currency asked for, the figures' own currency is the main one.
  const inMain = main ? figures === main : figures !== '';
  const currencyKnown = figures !== '';
  const currency = figures || input.currency;
  const otherCurrencies = [...tally.entries()]
    .filter(([c]) => c !== figures && !converted.has(c))
    .sort((a, b) => b[1] - a[1])
    .map(([c, rows]) => ({ currency: c, rows, ...(why.has(c) ? { why: why.get(c)! } : {}) }));

  const payee = new Map(input.payees.map((p) => [p.key, p]));
  const roleOf = (key: string) => payee.get(key)?.role ?? null;
  const nameOf = (key: string) => payee.get(key)?.name || displayName(key);
  // The person's own accounts are neither income nor spending: money moved, nothing happened.
  const txs = pool.filter((t) => roleOf(t.key) !== 'self');
  if (!txs.length) return null;

  const from = txs.reduce((a, t) => (t.on < a ? t.on : a), txs[0].on);
  const to = txs.reduce((a, t) => (t.on > a ? t.on : a), txs[0].on);
  const days = daysBetween(from, to) + 1;
  const inTotal = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const outTotal = txs.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);

  const partiesOf = (list: LedgerTx[], sign: 1 | -1): PartyLine[] => {
    const by = new Map<string, { total: number; count: number; last: string; lastAmount: number }>();
    for (const t of list) {
      if (Math.sign(t.amount) !== sign) continue;
      const e = by.get(t.key) ?? { total: 0, count: 0, last: t.on, lastAmount: 0 };
      e.total += Math.abs(t.amount);
      e.count += 1;
      if (t.on >= e.last) { e.last = t.on; e.lastAmount = Math.abs(t.amount); }
      by.set(t.key, e);
    }
    const whole = list.filter((t) => Math.sign(t.amount) === sign).reduce((a, t) => a + Math.abs(t.amount), 0);
    return [...by.entries()]
      .map(([key, e]) => ({ key, name: nameOf(key), ...e, share: whole > 0 ? e.total / whole : 0, role: roleOf(key), opportunityId: payee.get(key)?.opportunityId ?? null }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  };
  const payers = partiesOf(txs, 1);
  const payees = partiesOf(txs, -1);
  const sumIn = (list: LedgerTx[]) => list.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const sumOut = (list: LedgerTx[]) => list.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);

  const recentFrom = addDay(to, -(RECENT_DAYS - 1));
  const recentTxs = txs.filter((t) => t.on >= recentFrom);
  const recent = { from: recentFrom < from ? from : recentFrom, to, in: sumIn(recentTxs), out: sumOut(recentTxs), payers: partiesOf(recentTxs, 1) };

  const monthly = new Map<string, LedgerTx[]>();
  for (const t of txs) monthly.set(t.on.slice(0, 7), [...(monthly.get(t.on.slice(0, 7)) ?? []), t]);
  const months = [...monthly.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, MONTHS_SHOWN)
    .map(([month, list]) => {
      const [y, mm] = month.split('-').map(Number);
      return {
        month,
        label: `${MONTH_ABBR[mm - 1]}${String(y) === to.slice(0, 4) ? '' : ` ${y}`}`,
        in: sumIn(list),
        out: sumOut(list),
        // Rows that start after the 1st, or stop before the month's last day: a half month is not a month.
        partial: (month === from.slice(0, 7) && from.slice(8) !== '01') || (month === to.slice(0, 7) && addDay(to, 1).slice(0, 7) === month),
      };
    });

  const byRole = { client: 0, employer: 0, other: 0, unnamed: 0 };
  for (const p of payers) {
    if (p.role === 'client') byRole.client += p.total;
    else if (p.role === 'employer') byRole.employer += p.total;
    else if (p.role === 'other') byRole.other += p.total;
    else byRole.unnamed += p.total;
  }

  // Averaged over the accounts still being written. One whose rows stop a
  // month before the newest does not speak for this month: a Wise quarter
  // ending 30 Jun beside a budget export starting 15 Jul averaged 90 days across
  // a fortnight nobody recorded, and $648 a month read as $554.
  const firstBy = new Map<string, string>();
  const lastBy = new Map<string, string>();
  for (const t of txs) {
    const a = t.accountId ?? '';
    if (!firstBy.has(a) || t.on < firstBy.get(a)!) firstBy.set(a, t.on);
    if (!lastBy.has(a) || t.on > lastBy.get(a)!) lastBy.set(a, t.on);
  }
  const live = new Set([...lastBy.entries()].filter(([, last]) => daysBetween(last, to) <= LIVE_ACCOUNT_DAYS).map(([a]) => a));
  const liveFrom = [...live].reduce((d, a) => (firstBy.get(a)! < d ? firstBy.get(a)! : d), to);
  const liveDays = daysBetween(liveFrom, to) + 1;
  // Over those accounts, the latest whole calendar months, or before one month
  // is whole the latest AVERAGE_DAYS (the whole span when it is shorter).
  // Whole months first because, averaged over the latest 90 days of rows, a
  // fortnight of moving in at the start of the statement and a rent paid on the
  // 1st at the end both counted as if they were every month: $1,736 over 86
  // days read as $614 a month, when August was $504 and September $478. The
  // latest whole months — up to WHOLE_MONTHS of them — are what a month costs
  // now; the span is the fallback until one whole month is on file.
  let perMonth: MoneyRead['perMonth'] = null;
  let spend: MoneyRead['spend'] = [];
  const whole = wholeMonths(liveFrom, to).slice(0, WHOLE_MONTHS);
  const averaged = whole.length
    ? { start: `${whole[whole.length - 1]}-01`, end: new Date(Date.UTC(Number(whole[0].slice(0, 4)), Number(whole[0].slice(5, 7)), 0)).toISOString().slice(0, 10), months: [...whole].reverse() }
    : liveDays >= MIN_SPAN_DAYS
    ? { start: addDay(to, -(Math.min(liveDays, AVERAGE_DAYS) - 1)), end: to, months: undefined }
    : null;
  if (averaged) {
    const over = daysBetween(averaged.start, averaged.end) + 1;
    const inWindow = txs.filter((t) => t.on >= averaged.start && t.on <= averaged.end && live.has(t.accountId ?? ''));
    const scale = 30.44 / over;
    perMonth = { in: sumIn(inWindow) * scale, out: sumOut(inWindow) * scale, over, ...(averaged.months ? { months: averaged.months } : {}) };
    spend = partiesOf(inWindow, -1).slice(0, SPEND_SHOWN).map((p) => ({ key: p.key, name: p.name, perMonth: p.total * scale, share: p.share }));
  }

  // The last payment from somebody who pays them: refunds and "something else" are not being paid.
  const paid = txs.filter((t) => t.amount > 0 && roleOf(t.key) !== 'other').sort((a, b) => b.on.localeCompare(a.on))[0];
  const lastIn = paid ? { name: nameOf(paid.key), amount: paid.amount, on: paid.on, days: daysBetween(paid.on, to) } : null;

  const recurring = recurringOut(txs, nameOf, to);
  const recurringPerMonth = recurring.reduce((a, r) => a + r.perMonth, 0);

  // Cash is the balance each account last printed, summed: in the figures'
  // currency, or converted into the main one at the rate on the balance's day.
  const accounts = input.accounts.flatMap((a): AccountBalance[] => {
    const c = codeOf(a.currency);
    if (c === figures) return [a];
    if (!inMain || !c) return [];
    if (a.balance == null || !a.on) return [a];
    const r = input.fx ? rateOn(input.fx, c, figures, a.on) : null;
    return r ? [{ ...a, balance: a.balance * r.rate, currency: figures }] : [];
  });
  const known = accounts.filter((a) => a.balance != null && a.on);
  const cash = known.length
    ? { amount: known.reduce((s, a) => s + (a.balance as number), 0), on: known.reduce((d, a) => (a.on! > d ? a.on! : d), known[0].on!), accounts: known.length, missing: accounts.length - known.length }
    : null;
  // Runway off the rows only when every account printed a balance: a budget
  // export prints none, and "0 months of runway on $5.50" was one euro account's
  // balance standing in for all the money there is.
  const runwayMonths = cash && !cash.missing && perMonth && perMonth.out > 0 ? Math.max(0, round1(cash.amount / perMonth.out)) : null;

  const money = (n: number) => (currencyKnown ? moneyText(n, currency) : plainMoney(n));
  const lines: string[] = [];
  const label = days >= 330 ? 'Last 12 months' : `Since ${dayLabel(from)}`;
  const payerCount = payers.length;
  lines.push(inTotal > 0 ? `${label}: ${money(inTotal)} in from ${payerCount} payer${payerCount === 1 ? '' : 's'}.` : `${label}: nothing came in.`);
  const [first, second] = payers;
  if (first && payerCount >= 2 && first.share >= 0.6) lines.push(`${first.name} was ${pct(first.share)} of it.`);
  else if (first && second && payerCount >= 3 && first.share + second.share >= 0.5) lines.push(`Two of them were ${pct(first.share + second.share)} of it.`);
  const namedParts = [
    byRole.client > 0 ? `clients ${money(byRole.client)}` : null,
    byRole.employer > 0 ? `your job ${money(byRole.employer)}` : null,
  ].filter(Boolean);
  if (namedParts.length) lines.push(`Of that: ${namedParts.join(' · ')}${byRole.unnamed > 0 ? ` · not named yet ${money(byRole.unnamed)}` : ''}.`);
  // The month as the tiles count it — what "Money in" shows — once there is more history than a month.
  // After the shares, which are of the whole span: between them, "it" would read as the month.
  if (days > RECENT_DAYS) lines.push(`${recentLabel(recent, input.today)}: ${money(recent.in)} in, ${money(recent.out)} out.`);
  if (lastIn) {
    const tail = daysBetween(to, input.today) > 2 ? ` to ${dayLabel(to)}` : '';
    if (lastIn.days >= QUIET_DAYS) lines.push(`Nobody has paid you in the ${lastIn.days} days${tail}.`);
    else {
      const when = lastIn.days === 0 ? (tail ? `on ${dayLabel(lastIn.on)}` : 'today') : lastIn.days === 1 && !tail ? 'yesterday' : `on ${dayLabel(lastIn.on)}`;
      lines.push(`Last paid ${when}: ${lastIn.name}, ${money(lastIn.amount)}.`);
    }
  }
  if (perMonth) lines.push(`You spend ${money(perMonth.out)} a month${recurringPerMonth >= 1 ? `, ${money(recurringPerMonth)} of it on repeat bills` : ''}.`);
  if (cash && runwayMonths != null) lines.push(`That is ${runwayMonths} month${runwayMonths === 1 ? '' : 's'} of runway on ${money(cash.amount)} (${dayLabel(cash.on)}).`);
  else if (cash && cash.missing) lines.push(`Balance: ${money(cash.amount)} on ${dayLabel(cash.on)} in ${cash.accounts} of ${cash.accounts + cash.missing} accounts — the other${cash.missing === 1 ? ' prints' : 's print'} no balance, so type your cash for runway.`);
  else if (cash) lines.push(`Balance: ${money(cash.amount)} on ${dayLabel(cash.on)}.`);
  const next = recurring
    .filter((r) => r.next >= input.today && daysBetween(input.today, r.next) <= NEXT_BILL_DAYS)
    .sort((a, b) => a.next.localeCompare(b.next))[0];
  if (next) lines.push(`Next: ${next.name} ${money(next.amount)} around ${dayLabel(next.next)}.`);
  if (daysBetween(to, input.today) > STALE_DAYS) lines.push(`Your statement ends ${dayLabel(to)}. Add a newer one to keep this current.`);
  // Said, because a converted figure is a claim about a rate as well as the rows.
  if (converted.size) lines.push(`Converted to ${figures} from ${[...converted.entries()].map(([c, n]) => `${c} (${n} row${n === 1 ? '' : 's'})`).join(' and ')} at ${FX_SOURCE}.`);
  if (main && !inMain && currencyKnown) lines.push(`Shown in ${figures}, not ${main}: ${why.get(figures) ?? `no ${figures} to ${main} rate yet`}.`);
  for (const o of otherCurrencies) {
    const n = `${o.rows} row${o.rows === 1 ? '' : 's'}`;
    lines.push(!o.currency ? `${n} with no currency are not in these numbers. Say which on Bank statements.`
      : `${n} in ${o.currency} are not in these numbers${o.why && o.currency !== figures ? `: ${o.why}` : ''}.`);
  }

  return {
    currency, currencyKnown, inMain, converted: [...converted.entries()].map(([c, rows]) => ({ currency: c, rows })), rows: txs.length, from, to, days, inTotal, outTotal, recent, months, spend, payers, payees: payees.slice(0, 12), perMonth, byRole,
    lastIn, recurring, recurringPerMonth, cash, runwayMonths, otherCurrencies, lines,
    toName: payers.filter((p) => p.role == null).slice(0, MAX_QUESTIONS),
    ownCheck: payees.filter((p) => p.role == null && OWN_ACCOUNT.test(p.key)).slice(0, MAX_QUESTIONS),
  };
}

/**
 * How the Money in window is named: "Last 30 days" while the rows reach today,
 * "30 days to 30 Jun" once they stop short of it — a month that ended in June
 * is not the last thirty days in September — and "Since 15 Jul" under a month.
 */
export function recentLabel(recent: Pick<MoneyRead['recent'], 'from' | 'to'>, today: string): string {
  if (daysBetween(recent.from, recent.to) + 1 < RECENT_DAYS) return `Since ${dayLabel(recent.from)}`;
  return daysBetween(recent.to, today) <= 2 ? `Last ${RECENT_DAYS} days` : `${RECENT_DAYS} days to ${dayLabel(recent.to)}`;
}

/* ─── Into the finance every other part reads ─────────────────────────────── */

/** The newest rate from one currency to another, for a number typed today. */
export type LatestRate = (from: string, to: string) => { rate: number; day: string } | null;

/**
 * How the main currency is written in the finance row: its mark when the mark
 * says only it ("$" is USD, "₱" is PHP), its code when it does not ("CAD"), so
 * the row always reads back as the currency it was written in.
 */
export function financeMark(code: string): string {
  const mark = currencyMark(code);
  return toCode(mark) === code ? mark : code;
}

/**
 * The finance row, in the main currency. Everything else reads cash and burn
 * off it — metrics, the forecast, the runway guard, scoreMove, the plan — and
 * none of them converts, so this is where it happens.
 *
 * Statement figures arrive converted (moneyRead) and are written where the
 * statement is the newer evidence: a number the person typed after the
 * statement's own date stands, because they know something the file does not.
 * A read that is not in the main currency (no rate yet, or nothing but a file
 * whose currency nobody has said) writes nothing, and a figure an earlier read
 * left behind goes with it.
 *
 * Typed numbers are kept as typed (`typed_in`) whenever they were typed in
 * another currency — ₱71,804 of cash in a dollar app — and converted at the
 * newest rate each time this runs, so the dollar figure follows the peso as it
 * moves. Without a rate the number is left out, not guessed, and the Runway
 * sheet says so.
 *
 * Returns `prev` itself when nothing changes, so the home screen can settle the
 * row on every load and write only when it moved.
 */
export function financeFromRead(
  prev: Finance,
  read: MoneyRead | null,
  nowIso: string,
  opts: {
    main?: string; latest?: LatestRate; book?: number | null;
    /**
     * When the newest statement was read in (statementAt), or null for none.
     * Given, a monthly spend the person typed is replaced only by a statement
     * read in after they typed it — never by the Money tab's own rows, which
     * are dated today every time a coffee is logged, so the "newer rows replace
     * what was typed" rule wiped a typed number on the very next load. Absent,
     * the rows' own dates decide, as they did.
     */
    statementAt?: string | null;
  } = {},
): Finance {
  const main = opts.main ?? toCode(prev.currency) ?? (read ? toCode(read.currency) : null) ?? 'USD';
  const prevCode = toCode(prev.currency) ?? main;
  const next: Finance = { ...prev, source: { ...(prev.source ?? {}) } };

  const typedIn: NonNullable<Finance['typed_in']> = { ...(prev.typed_in ?? {}) };
  // The money book's balance (book.ts bookBalance) is the cash, ahead of any
  // statement: the person said what they had and has logged every move since,
  // which is newer than any file. It is kept as typed in the book's currency
  // and converted below like any number typed in another.
  const book = prev.book && opts.book != null ? { amount: opts.book, currency: toCode(prev.book.currency) ?? prev.book.currency } : null;
  const bookGone = !book && prev.source?.cash === 'book';
  if (book) { next.source!.cash = 'book'; delete next.cash_on; typedIn.cash = { amount: book.amount, currency: book.currency }; }
  else if (bookGone) { delete next.source!.cash; delete next.cash; delete typedIn.cash; }
  for (const f of ['cash', 'monthly_burn'] as const) {
    if (next.source?.[f] === 'statement') { delete typedIn[f]; continue; }
    if (f === 'cash' && bookGone) continue;
    const orig = typedIn[f] ?? (prev[f] != null ? { amount: prev[f] as number, currency: prevCode } : null);
    if (!orig) continue;
    if (orig.currency === main) { next[f] = orig.amount; delete typedIn[f]; continue; }
    const r = opts.latest?.(orig.currency, main) ?? null;
    typedIn[f] = { amount: orig.amount, currency: orig.currency, ...(r ? { rate: r.rate, day: r.day } : {}) };
    if (r) next[f] = Math.round(orig.amount * r.rate * 100) / 100;
    else delete next[f];
  }
  if (Object.keys(typedIn).length) next.typed_in = typedIn;
  else delete next.typed_in;

  const usable = !!read && read.currencyKnown && read.inMain && toCode(read.currency) === main;
  if (!usable) {
    if (next.source?.cash === 'statement') { delete next.cash; delete next.cash_on; delete next.source.cash; }
    if (next.source?.monthly_burn === 'statement') { delete next.monthly_burn; delete next.burn_to; delete next.source.monthly_burn; }
  } else {
    const typedOn = prev.typed_at?.slice(0, 10) ?? null;
    const newer = (f: 'cash' | 'monthly_burn', on: string) => next.source?.[f] !== 'typed' || !typedOn || on >= typedOn;
    // Only a balance for every account: one account's is not what there is.
    if (read.cash && !read.cash.missing && next.source?.cash !== 'book' && newer('cash', read.cash.on)) {
      next.cash = Math.round(read.cash.amount * 100) / 100;
      next.cash_on = read.cash.on;
      next.source!.cash = 'statement';
      delete next.typed_in?.cash;
    }
    const burnNewer = opts.statementAt === undefined
      ? newer('monthly_burn', read.to)
      : next.source?.monthly_burn !== 'typed' || !prev.typed_at || (!!opts.statementAt && opts.statementAt > prev.typed_at);
    if (read.perMonth && read.perMonth.out > 0 && burnNewer) {
      next.monthly_burn = Math.round(read.perMonth.out);
      next.burn_to = read.to;
      next.source!.monthly_burn = 'statement';
      delete next.typed_in?.monthly_burn;
    }
    if (next.typed_in && !Object.keys(next.typed_in).length) delete next.typed_in;
  }
  next.currency = financeMark(main);
  if (sameFinance(next, prev)) return prev;
  next.updated_at = nowIso;
  return next;
}

/** Equal in everything runway and the sheet read — `updated_at` aside, which differs on every write. */
function sameFinance(a: Finance, b: Finance): boolean {
  const shape = (f: Finance) => JSON.stringify([
    f.cash ?? null, f.cash_on ?? null, f.monthly_burn ?? null, f.burn_to ?? null, f.currency ?? null, f.typed_at ?? null,
    f.source?.cash ?? null, f.source?.monthly_burn ?? null, f.typed_in ?? null, f.main_currency ?? null, f.book ?? null,
  ]);
  return shape(a) === shape(b);
}

/**
 * The monthly spend handed back to the rows: a number typed on the Runway sheet
 * forgotten, so the next settle (financeFromRead) writes the estimate in its
 * place. A typed number otherwise stood until a newer statement arrived, and
 * the sheet had no way back to the app's own figure short of waiting for one.
 * Cash is left as it is, typed or not.
 */
export function burnFromRows(prev: Finance, nowIso: string): Finance {
  const next: Finance = { ...prev, source: { ...(prev.source ?? {}) }, updated_at: nowIso };
  delete next.monthly_burn;
  delete next.burn_to;
  delete next.source!.monthly_burn;
  if (next.typed_in?.monthly_burn) {
    next.typed_in = { ...next.typed_in };
    delete next.typed_in.monthly_burn;
    if (!Object.keys(next.typed_in).length) delete next.typed_in;
  }
  return next;
}

/**
 * What the person typed on the Runway sheet, into the row. In the main
 * currency it is the figure; in another it is kept as typed and converted by
 * financeFromRead at the newest rate. A number equal to the statement's, typed
 * in the main currency, stays the statement's — saving the sheet unchanged
 * must not turn the bank's figure into a guess.
 */
export function financeFromTyped(
  prev: Finance,
  input: { cash?: number; monthly_burn?: number; currencies?: { cash?: string; monthly_burn?: string } },
  nowIso: string,
  main: string,
): Finance {
  const codeOf = (f: 'cash' | 'monthly_burn') => toCode(input.currencies?.[f]) ?? main;
  const source: NonNullable<Finance['source']> = {};
  const next: Finance = { currency: financeMark(main), updated_at: nowIso, source };
  if (prev.main_currency) next.main_currency = prev.main_currency;
  const typedIn: NonNullable<Finance['typed_in']> = {};
  // With a money book the cash is its balance, changed on the Money tab where
  // the moves are; a cash typed here would be overwritten on the next load.
  if (prev.book) {
    next.book = prev.book;
    if (prev.source?.cash === 'book') {
      source.cash = 'book';
      if (prev.cash != null) next.cash = prev.cash;
      if (prev.typed_in?.cash) typedIn.cash = prev.typed_in.cash;
    }
  }
  let typed = false;
  for (const f of ['cash', 'monthly_burn'] as const) {
    const v = input[f];
    if (v == null || (f === 'cash' && prev.book)) continue;
    const code = codeOf(f);
    if (code === main && v === prev[f] && prev.source?.[f] === 'statement') {
      next[f] = v;
      source[f] = 'statement';
      if (f === 'cash') next.cash_on = prev.cash_on; else next.burn_to = prev.burn_to;
      continue;
    }
    source[f] = 'typed';
    typed = true;
    if (code === main) next[f] = v;
    else typedIn[f] = { amount: v, currency: code };
  }
  if (Object.keys(typedIn).length) next.typed_in = typedIn;
  next.typed_at = typed ? nowIso : prev.typed_at;
  return next;
}

/** What a number typed in another currency became, said on the Runway sheet: "₱71,804 → $1,238 (₱58.0 = $1 on 29 Sep)". */
export function typedInLines(finance: Finance): string[] {
  const out: string[] = [];
  const main = toCode(finance.currency) ?? 'USD';
  for (const [f, label] of [['cash', 'Cash'], ['monthly_burn', 'Burn']] as const) {
    const t = finance.typed_in?.[f];
    if (!t) continue;
    if (f === 'cash' && finance.source?.cash === 'book') {
      out.push(t.rate != null && finance.cash != null
        ? `Cash: the Money tab's balance, ${moneyText(t.amount, t.currency)}, which is ${moneyText(finance.cash, main)} (${rateLine(t.currency, main, { rate: t.rate, day: t.day ?? '' }, dayLabel)}, ${FX_SOURCE}).`
        : `Cash: the Money tab's balance, ${moneyText(t.amount, t.currency)}, and there is no ${t.currency} to ${main} rate yet, so runway leaves it out until there is.`);
      continue;
    }
    out.push(t.rate != null && finance[f] != null
      ? `${label}: you typed ${moneyText(t.amount, t.currency)}, which is ${moneyText(finance[f]!, main)} (${rateLine(t.currency, main, { rate: t.rate, day: t.day ?? '' }, dayLabel)}, ${FX_SOURCE}).`
      : `${label}: you typed ${moneyText(t.amount, t.currency)}, and there is no ${t.currency} to ${main} rate yet, so runway leaves it out until there is.`);
  }
  return out;
}

/** Statements gone: the numbers read off them go too. What was typed stays — and a row with nothing read off a statement is returned as it is. */
export function financeWithoutStatements(prev: Finance, nowIso: string): Finance {
  if (prev.source?.cash !== 'statement' && prev.source?.monthly_burn !== 'statement') return prev;
  const next: Finance = { ...prev, source: { ...(prev.source ?? {}) } };
  if (prev.source?.cash === 'statement') { delete next.cash; delete next.cash_on; delete next.source!.cash; }
  if (prev.source?.monthly_burn === 'statement') { delete next.monthly_burn; delete next.burn_to; delete next.source!.monthly_burn; }
  next.updated_at = nowIso;
  return next;
}

/* ─── Deposits into wins ──────────────────────────────────────────────────── */

/**
 * How far back a deposit from a client becomes a win when the payer is named.
 * The metrics window: older money is in the read as income, but turning a
 * year of it into wins at once would rewrite a funnel that was never about it.
 */
export const WIN_RECORD_DAYS = 30;
/** A win logged by hand this close to a deposit of the same amount is the same money. */
export const WIN_MATCH_DAYS = 10;

/** Deposits from clients, recent enough, not yet a win. */
export function winsToRecord(input: { txs: LedgerTx[]; payees: Payee[]; today: string; keys?: string[] }): LedgerTx[] {
  const clients = new Set(input.payees.filter((p) => p.role === 'client').map((p) => p.key));
  const only = input.keys ? new Set(input.keys) : null;
  const since = addDay(input.today, -WIN_RECORD_DAYS);
  return input.txs
    .filter((t) => t.amount > 0 && !t.outcomeId && clients.has(t.key) && (!only || only.has(t.key)) && t.on >= since && t.on <= input.today)
    .sort((a, b) => a.on.localeCompare(b.on));
}

/**
 * A win already on the ledger for this deposit: `won`, the same amount to the
 * cent or within one percent, within WIN_MATCH_DAYS, and not already the win of
 * another deposit. The nearest in time wins a tie.
 */
export function matchWin(
  tx: { on: string; amount: number },
  wins: Array<{ id: string; amount: number | null; occurred_at: string }>,
  taken: Set<string>,
): string | null {
  const close = wins
    .filter((w) => !taken.has(w.id) && w.amount != null && w.amount > 0)
    .filter((w) => Math.abs((w.amount as number) - tx.amount) <= Math.max(0.01, tx.amount * 0.01))
    .map((w) => ({ id: w.id, gap: Math.abs(daysBetween(tx.on, w.occurred_at.slice(0, 10))) }))
    .filter((w) => w.gap <= WIN_MATCH_DAYS)
    .sort((a, b) => a.gap - b.gap);
  return close[0]?.id ?? null;
}

/* ─── Which business a payer is ───────────────────────────────────────────── */

/** Words half the pipeline shares: matching on them links every resort to every resort. */
const GENERIC = new Set(['RESORT', 'RESORTS', 'HOTEL', 'HOTELS', 'INN', 'TOURS', 'TOUR', 'TRAVEL', 'SHOP', 'STORE', 'CAFE', 'RESTAURANT', 'BAR', 'SERVICES', 'SERVICE', 'GROUP', 'COMPANY', 'CORP', 'CORPORATION', 'LTD', 'LLC', 'INC', 'CO', 'SA', 'SL', 'GMBH', 'THE', 'AND', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'BEACH', 'ISLAND', 'CITY', 'STUDIO', 'AGENCY', 'CLINIC', 'CENTER', 'CENTRE', 'LODGE']);

const tokens = (s: string) => new Set(
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w) && !/^\d+$/.test(w)),
);

/**
 * The business in the pipeline a payer most likely is, by the distinctive words
 * they share — or none. Offered on the question as a suggestion; the person's
 * tap is what links them.
 */
export function suggestOpportunity(name: string, opps: Array<{ id: string; title: string }>): { id: string; title: string } | null {
  const mine = tokens(name);
  if (!mine.size) return null;
  const scored = opps
    .map((o) => {
      const theirs = tokens(o.title);
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      return { o, shared, score: shared / Math.max(mine.size, Math.min(theirs.size, 3)) };
    })
    .filter((x) => x.shared >= 1)
    .sort((a, b) => b.shared - a.shared || b.score - a.score);
  if (!scored.length) return null;
  // Two businesses sharing as many of the payer's words are two answers, which
  // is none: "Coron" names a town, not a client.
  if (scored[1] && scored[1].shared === scored[0].shared) return null;
  if (scored[0].score < 0.5) return null;
  return { id: scored[0].o.id, title: scored[0].o.title };
}

/* ─── Statements, as the sheet shows them ─────────────────────────────────── */

export type ImportStatus = 'reading' | 'review' | 'ready' | 'failed';

export interface MoneyImport {
  id: string;
  fileName: string | null;
  format: 'csv' | 'ofx' | 'pdf' | 'image' | 'link';
  /** parsed: the bank's own export. read: a model's reading of a PDF or a screenshot. */
  method: 'parsed' | 'read' | 'link';
  status: ImportStatus;
  check: 'balanced' | 'unbalanced' | 'no_balances' | null;
  checkDetail: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  rowsFound: number | null;
  rowsNew: number | null;
  rowsDropped: number | null;
  /** "Left out 24 scheduled rows (…)." — rows the file had that are not money yet, or not money at all. */
  skipped: string | null;
  totalIn: number | null;
  totalOut: number | null;
  currency: string | null;
  error: string | null;
  note: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** When the newest statement was read in: the last import whose rows are on file. Null with none. */
export function statementAt(imports: MoneyImport[]): string | null {
  return imports
    .filter((i) => i.status === 'ready')
    .map((i) => i.finishedAt ?? i.startedAt)
    .reduce<string | null>((a, b) => (!a || b > a ? b : a), null);
}

/**
 * A reading still "reading" after this belongs to a process that is gone — a
 * redeploy kills after() work mid-call. Said as stopped, never left spinning:
 * a spinner that never ends is the calm screen over a failure (invariant 13).
 */
export const IMPORT_STALE_MS = 6 * 60_000;

const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** One copilot_money_imports row, read defensively: written by whichever version ran it. */
export function importView(row: Record<string, unknown>, now: Date): MoneyImport {
  const startedAt = strOrNull(row.started_at) ?? now.toISOString();
  let status = (['reading', 'review', 'ready', 'failed'] as const).find((s) => s === row.status) ?? 'failed';
  let error = strOrNull(row.error);
  if (status === 'reading' && now.getTime() - Date.parse(startedAt) > IMPORT_STALE_MS) {
    status = 'failed';
    error = 'It stopped before it finished — the server restarted while reading it. Upload it again.';
  }
  const format = (['csv', 'ofx', 'pdf', 'image', 'link'] as const).find((f) => f === row.format) ?? 'csv';
  const method = (['parsed', 'read', 'link'] as const).find((m) => m === row.method) ?? 'parsed';
  const check = (['balanced', 'unbalanced', 'no_balances'] as const).find((c) => c === row.balance_check) ?? null;
  return {
    id: String(row.id),
    fileName: strOrNull(row.file_name),
    format,
    method,
    status,
    check,
    checkDetail: strOrNull(row.check_detail),
    periodStart: strOrNull(row.period_start),
    periodEnd: strOrNull(row.period_end),
    rowsFound: numOrNull(row.rows_found),
    rowsNew: numOrNull(row.rows_new),
    rowsDropped: numOrNull(row.rows_dropped),
    skipped: strOrNull(row.skipped),
    totalIn: numOrNull(row.total_in),
    totalOut: numOrNull(row.total_out),
    currency: strOrNull(row.currency),
    error,
    note: strOrNull(row.note),
    startedAt,
    finishedAt: strOrNull(row.finished_at),
  };
}

/** Whether anything is still being read, so the screen knows to keep looking. */
export function importsInFlight(imports: MoneyImport[]): boolean {
  return imports.some((i) => i.status === 'reading');
}

/** Everything the screen needs about the person's money, in one payload. */
export interface MoneyHome {
  /**
   * False when the tables are not there (20260929 unapplied): the sheet says so
   * rather than offering an upload whose rows have nowhere to go.
   */
  ready: boolean;
  /** Whether PDFs and screenshots can be read here — a model is set up. CSV and OFX need nothing. */
  canRead: boolean;
  imports: MoneyImport[];
  read: MoneyRead | null;
  /** The business each unnamed payer most likely is, by key — offered, never linked unasked. */
  suggest: Record<string, { id: string; title: string }>;
  /** Everybody the person has already said something about, so an answer can be taken back. */
  named: Array<{ key: string; name: string; role: PayeeRole; linked: boolean }>;
  /** Rows on file, and the span they cover. */
  rows: number;
  /** A read that failed, said instead of rendering as an account with no statements. */
  unreadable: string | null;
  /** Runway could not be written from the rows (loadHome's settle): said on the Runway sheet. */
  settleError: string | null;
}

export function moneyHome(input: {
  ready: boolean;
  canRead: boolean;
  imports: MoneyImport[];
  txs: LedgerTx[];
  payees: Payee[];
  accounts: AccountBalance[];
  today: string;
  currency: string;
  /** The main currency and its rates: see MoneyReadInput. */
  main?: string;
  fx?: FxTable;
  fxMissing?: Record<string, string>;
  opportunities: Array<{ id: string; title: string }>;
  unreadable: string | null;
}): MoneyHome {
  const read = moneyRead({ txs: input.txs, payees: input.payees, accounts: input.accounts, today: input.today, currency: input.currency, main: input.main, fx: input.fx, fxMissing: input.fxMissing });
  const suggest: MoneyHome['suggest'] = {};
  for (const p of read?.toName ?? []) {
    const s = suggestOpportunity(p.name, input.opportunities);
    if (s) suggest[p.key] = s;
  }
  return {
    ready: input.ready,
    canRead: input.canRead,
    imports: input.imports,
    // The payload crosses the wire on every mutation: the lists are cut to what a screen shows.
    read: read ? { ...read, payers: read.payers.slice(0, 30), recurring: read.recurring.slice(0, 10), recent: { ...read.recent, payers: read.recent.payers.slice(0, 20) } } : null,
    suggest,
    named: input.payees
      .filter((p): p is Payee & { role: PayeeRole } => p.role != null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40)
      .map((p) => ({ key: p.key, name: p.name, role: p.role, linked: !!p.opportunityId })),
    rows: input.txs.length,
    unreadable: input.unreadable,
    settleError: null,
  };
}

/**
 * The money lines the plan is shown, and the fingerprint that redraws it when
 * they change — a new statement, a payer named. Built only from totals computed
 * before any list is cut for the screen, so the phone (which holds the cut
 * read) and the server (which holds all of it) always compute the same one: a
 * fingerprint that differed between them would redraw the plan on every open.
 */
export function moneyForPlan(read: MoneyRead | null): { lines: string[]; signature: string | null } {
  if (!read) return { lines: [], signature: null };
  const r = Math.round;
  return {
    // The stale-statement line is for the person, not the planner.
    lines: read.lines.filter((l) => !/^Your statement ends/.test(l)),
    signature: [read.to, r(read.inTotal), r(read.outTotal), r(read.byRole.client), r(read.byRole.employer), r(read.byRole.other)].join('|'),
  };
}

/** What a statement that just finished says, in one line for the toast. Null for one still reading. */
export function importLine(i: MoneyImport): string | null {
  const name = i.fileName ?? 'your statement';
  if (i.status === 'failed') return `Could not read ${name}: ${i.error ?? 'no reason given'}`;
  if (i.status === 'review') return `Read ${name}. Check its totals before they count.`;
  if (i.status === 'ready') {
    const fresh = i.rowsNew ?? 0;
    const rows = fresh === 1 ? '1 new row' : `${fresh} new rows`;
    return `Read ${name}: ${fresh || i.rowsFound == null ? rows : 'nothing new — you had every row already'}${i.check === 'balanced' ? ', and the balances add up' : ''}.${i.skipped ? ` ${i.skipped}` : ''}`;
  }
  return null;
}
