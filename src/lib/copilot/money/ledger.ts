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
  /** The currency every figure is in: the one most rows carry. */
  currency: string;
  from: string;
  to: string;
  days: number;
  inTotal: number;
  outTotal: number;
  /** Who paid, biggest first — the person's own accounts left out. */
  payers: PartyLine[];
  /** Who was paid, biggest first — the person's own accounts left out. */
  payees: PartyLine[];
  /** Averaged over the last `over` days of rows; null under MIN_SPAN_DAYS of history. */
  perMonth: { in: number; out: number; over: number } | null;
  /** Money in by what the payer is, over the whole span. */
  byRole: { client: number; employer: number; other: number; unnamed: number };
  lastIn: { name: string; amount: number; on: string; days: number } | null;
  recurring: Recurring[];
  recurringPerMonth: number;
  cash: { amount: number; on: string; accounts: number; missing: number } | null;
  runwayMonths: number | null;
  /** Rows in another currency than `currency`, kept out of every figure and said. */
  otherCurrencies: Array<{ currency: string; rows: number }>;
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

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PHP: '₱', JPY: '¥', INR: '₹', NGN: '₦', KRW: '₩', TRY: '₺', THB: '฿', VND: '₫', MXN: '$', CAD: '$', AUD: '$', NZD: '$', SGD: '$', HKD: '$', COP: '$', ARS: '$', CLP: '$' };

/** The currency as it should be printed: the symbol for a known code, the code otherwise, whatever was typed as a last resort. */
export function currencyMark(c: string | null | undefined): string {
  const raw = (c ?? '').trim();
  if (!raw) return '$';
  const code = raw.toUpperCase();
  return SYMBOL[code] ?? raw;
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
/** Past this, "nobody has paid you" is worth saying; under it, the last payment is. */
export const QUIET_DAYS = 14;
/** A statement older than this is said to be old. */
export const STALE_DAYS = 10;
/** How far ahead a repeat bill is worth naming. */
export const NEXT_BILL_DAYS = 21;
/** Questions asked at once. More is a form; the rest come after. */
export const MAX_QUESTIONS = 5;

export interface MoneyReadInput {
  txs: LedgerTx[];
  payees: Payee[];
  accounts: AccountBalance[];
  /** The person's own today, YYYY-MM-DD. */
  today: string;
  /** Printed when the rows carry none: the currency on their finance, else a goal's. */
  currency: string;
}

/** Null when there are no rows: an empty read is not a read. */
export function moneyRead(input: MoneyReadInput): MoneyRead | null {
  if (!input.txs.length) return null;

  // One currency per figure. Rows with none are the person's own currency.
  const tally = new Map<string, number>();
  for (const t of input.txs) {
    const c = (t.currency || '').toUpperCase();
    tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  const named = [...tally.entries()].filter(([c]) => c).sort((a, b) => b[1] - a[1]);
  const main = named[0]?.[0] ?? '';
  const inMain = (c: string | null) => { const u = (c || '').toUpperCase(); return !u || u === main; };
  const otherCurrencies = named.filter(([c]) => c !== main).map(([currency, rows]) => ({ currency, rows }));
  const currency = main || input.currency;

  const payee = new Map(input.payees.map((p) => [p.key, p]));
  const roleOf = (key: string) => payee.get(key)?.role ?? null;
  const nameOf = (key: string) => payee.get(key)?.name || displayName(key);
  // The person's own accounts are neither income nor spending: money moved, nothing happened.
  const txs = input.txs.filter((t) => inMain(t.currency) && roleOf(t.key) !== 'self');
  if (!txs.length) return null;

  const from = txs.reduce((a, t) => (t.on < a ? t.on : a), txs[0].on);
  const to = txs.reduce((a, t) => (t.on > a ? t.on : a), txs[0].on);
  const days = daysBetween(from, to) + 1;
  const inTotal = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const outTotal = txs.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);

  const parties = (sign: 1 | -1): PartyLine[] => {
    const by = new Map<string, { total: number; count: number; last: string; lastAmount: number }>();
    for (const t of txs) {
      if (Math.sign(t.amount) !== sign) continue;
      const e = by.get(t.key) ?? { total: 0, count: 0, last: t.on, lastAmount: 0 };
      e.total += Math.abs(t.amount);
      e.count += 1;
      if (t.on >= e.last) { e.last = t.on; e.lastAmount = Math.abs(t.amount); }
      by.set(t.key, e);
    }
    const whole = sign > 0 ? inTotal : outTotal;
    return [...by.entries()]
      .map(([key, e]) => ({ key, name: nameOf(key), ...e, share: whole > 0 ? e.total / whole : 0, role: roleOf(key), opportunityId: payee.get(key)?.opportunityId ?? null }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  };
  const payers = parties(1);
  const payees = parties(-1);

  const byRole = { client: 0, employer: 0, other: 0, unnamed: 0 };
  for (const p of payers) {
    if (p.role === 'client') byRole.client += p.total;
    else if (p.role === 'employer') byRole.employer += p.total;
    else if (p.role === 'other') byRole.other += p.total;
    else byRole.unnamed += p.total;
  }

  // Averages over the latest AVERAGE_DAYS, or the whole span when it is shorter.
  let perMonth: MoneyRead['perMonth'] = null;
  if (days >= MIN_SPAN_DAYS) {
    const over = Math.min(days, AVERAGE_DAYS);
    const start = addDay(to, -(over - 1));
    const inWindow = txs.filter((t) => t.on >= start);
    const scale = 30.44 / over;
    perMonth = {
      in: inWindow.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0) * scale,
      out: inWindow.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0) * scale,
      over,
    };
  }

  // The last payment from somebody who pays them: refunds and "something else" are not being paid.
  const paid = txs.filter((t) => t.amount > 0 && roleOf(t.key) !== 'other').sort((a, b) => b.on.localeCompare(a.on))[0];
  const lastIn = paid ? { name: nameOf(paid.key), amount: paid.amount, on: paid.on, days: daysBetween(paid.on, to) } : null;

  const recurring = recurringOut(txs, nameOf, to);
  const recurringPerMonth = recurring.reduce((a, r) => a + r.perMonth, 0);

  // Cash is the balance each account last printed, summed — only accounts in the main currency.
  const accounts = input.accounts.filter((a) => inMain(a.currency));
  const known = accounts.filter((a) => a.balance != null && a.on);
  const cash = known.length
    ? { amount: known.reduce((s, a) => s + (a.balance as number), 0), on: known.reduce((d, a) => (a.on! > d ? a.on! : d), known[0].on!), accounts: known.length, missing: accounts.length - known.length }
    : null;
  const runwayMonths = cash && perMonth && perMonth.out > 0 ? Math.max(0, round1(cash.amount / perMonth.out)) : null;

  const money = (n: number) => moneyText(n, currency);
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
  else if (cash) lines.push(`Balance: ${money(cash.amount)} on ${dayLabel(cash.on)}.`);
  const next = recurring
    .filter((r) => r.next >= input.today && daysBetween(input.today, r.next) <= NEXT_BILL_DAYS)
    .sort((a, b) => a.next.localeCompare(b.next))[0];
  if (next) lines.push(`Next: ${next.name} ${money(next.amount)} around ${dayLabel(next.next)}.`);
  if (daysBetween(to, input.today) > STALE_DAYS) lines.push(`Your statement ends ${dayLabel(to)}. Add a newer one to keep this current.`);
  for (const o of otherCurrencies) lines.push(`${o.rows} row${o.rows === 1 ? '' : 's'} in ${o.currency} are not in these numbers.`);

  return {
    currency, from, to, days, inTotal, outTotal, payers, payees: payees.slice(0, 12), perMonth, byRole,
    lastIn, recurring, recurringPerMonth, cash, runwayMonths, otherCurrencies, lines,
    toName: payers.filter((p) => p.role == null).slice(0, MAX_QUESTIONS),
    ownCheck: payees.filter((p) => p.role == null && OWN_ACCOUNT.test(p.key)).slice(0, MAX_QUESTIONS),
  };
}

/* ─── Into the finance every other part reads ─────────────────────────────── */

/**
 * The finance row, with cash and burn from the statement where the statement
 * is the newer evidence. A number the person typed after the statement's own
 * date stands: they know something the file does not. `source` says where each
 * number came from, so the sheet can say it.
 */
export function financeFromRead(prev: Finance, read: MoneyRead | null, nowIso: string): Finance {
  if (!read) return prev;
  const next: Finance = { ...prev, source: { ...(prev.source ?? {}) } };
  const typedOn = prev.typed_at?.slice(0, 10) ?? null;
  const newer = (field: 'cash' | 'monthly_burn', on: string) => prev.source?.[field] !== 'typed' || !typedOn || on >= typedOn;
  let changed = false;
  if (read.cash && newer('cash', read.cash.on)) {
    next.cash = Math.round(read.cash.amount * 100) / 100;
    next.cash_on = read.cash.on;
    next.source!.cash = 'statement';
    changed = true;
  }
  if (read.perMonth && read.perMonth.out > 0 && newer('monthly_burn', read.to)) {
    next.monthly_burn = Math.round(read.perMonth.out);
    next.burn_to = read.to;
    next.source!.monthly_burn = 'statement';
    changed = true;
  }
  if (!changed) return prev;
  if (!next.currency) next.currency = currencyMark(read.currency);
  next.updated_at = nowIso;
  return next;
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
  totalIn: number | null;
  totalOut: number | null;
  currency: string | null;
  error: string | null;
  note: string | null;
  startedAt: string;
  finishedAt: string | null;
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
  opportunities: Array<{ id: string; title: string }>;
  unreadable: string | null;
}): MoneyHome {
  const read = moneyRead({ txs: input.txs, payees: input.payees, accounts: input.accounts, today: input.today, currency: input.currency });
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
    read: read ? { ...read, payers: read.payers.slice(0, 30), recurring: read.recurring.slice(0, 10) } : null,
    suggest,
    named: input.payees
      .filter((p): p is Payee & { role: PayeeRole } => p.role != null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40)
      .map((p) => ({ key: p.key, name: p.name, role: p.role, linked: !!p.opportunityId })),
    rows: input.txs.length,
    unreadable: input.unreadable,
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
    return `Read ${name}: ${fresh || i.rowsFound == null ? rows : 'nothing new — you had every row already'}${i.check === 'balanced' ? ', and the balances add up' : ''}.`;
  }
  return null;
}
