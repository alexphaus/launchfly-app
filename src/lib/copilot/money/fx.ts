// src/lib/copilot/money/fx.ts
// One main currency, and every other one converted into it at a sourced rate.
//
// Why: a person who sells in dollars, lives on a peso budget app and keeps a
// euro Wise account had three piles the app would not add up. The read showed
// whichever pile had the most rows, said the others "are not in these numbers",
// and runway flipped currency with the statements. They asked for one currency
// the whole app counts in, with everything else converted into it.
//
// A converted figure is still not an invented one (invariant 2): the rate is
// the European Central Bank's reference rate for the row's own day, fetched
// and cached (fxstore.ts), and the screen says so. A row whose currency has no
// rate is left out and said — never converted at a guess.
//
// Pure: no DB, no network. copilot-core.test.ts holds it.

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const daysBetween = (a: string, b: string): number => Math.round((dayMs(b) - dayMs(a)) / 86_400_000);

/** Where the rates come from, said wherever a converted figure is. */
export const FX_SOURCE = 'ECB daily rates';

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PHP: '₱', JPY: '¥', INR: '₹', NGN: '₦', KRW: '₩', TRY: '₺', THB: '฿', VND: '₫', MXN: '$', CAD: '$', AUD: '$', NZD: '$', SGD: '$', HKD: '$', COP: '$', ARS: '$', CLP: '$' };

/** The currency as it should be printed: the symbol for a known code, the code otherwise, whatever was typed as a last resort. */
export function currencyMark(c: string | null | undefined): string {
  const raw = (c ?? '').trim();
  if (!raw) return '$';
  const code = raw.toUpperCase();
  return SYMBOL[code] ?? raw;
}

/** The code for a mark only one currency uses: ₱ is PHP, $ is a dozen of them and says nothing. */
export function currencyCodeOf(c: string | null | undefined): string | null {
  const raw = (c ?? '').trim();
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const codes = Object.entries(SYMBOL).filter(([, mark]) => mark === raw).map(([code]) => code);
  return codes.length === 1 ? codes[0] : null;
}

/**
 * A currency as a code the rates can be looked up by. "$" is USD here, unlike
 * in currencyCodeOf: this is the main currency, the person asked for "$", and a
 * dollar sign with nothing else said is a US dollar far more often than not.
 * Settings is where a Canadian says otherwise.
 */
export function toCode(c: string | null | undefined): string | null {
  const raw = (c ?? '').trim();
  if (raw === '$' || /^us\$$/i.test(raw)) return 'USD';
  return currencyCodeOf(raw);
}

/**
 * The currency the whole app counts in: the one chosen in Settings, else the
 * one runway is already in, else the money goal's, else USD. Runway's before
 * the goal's so that nobody's runway changes currency the day this ships; once
 * it settles (financeFromRead) the finance row carries the answer, so it holds.
 */
export function mainCurrency(
  finance: { main_currency?: string; currency?: string } | null | undefined,
  goals: ReadonlyArray<{ metric: string; unit: string | null; priority?: number }>,
): string {
  const chosen = toCode(finance?.main_currency);
  if (chosen) return chosen;
  const runway = toCode(finance?.currency);
  if (runway) return runway;
  const goal = [...goals].filter((g) => g.metric === 'currency' && g.unit?.trim()).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))[0];
  return toCode(goal?.unit) ?? 'USD';
}

/* ─── Rates ───────────────────────────────────────────────────────────────── */

/** How many `quote` one `base` bought on `day`. */
export interface FxRow { base: string; quote: string; day: string; rate: number }

/** Rates by pair ("PHP>USD"), oldest first. */
export interface FxTable { pairs: Map<string, Array<{ day: string; rate: number }>> }

export function fxTable(rows: FxRow[]): FxTable {
  const pairs = new Map<string, Array<{ day: string; rate: number }>>();
  for (const r of rows) {
    if (!(r.rate > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) continue;
    const key = `${r.base}>${r.quote}`;
    const list = pairs.get(key) ?? [];
    list.push({ day: r.day, rate: r.rate });
    pairs.set(key, list);
  }
  for (const [key, list] of pairs) {
    // One rate a day: a re-fetched day replaces, it does not stack.
    const byDay = new Map(list.map((e) => [e.day, e]));
    pairs.set(key, [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)));
  }
  return { pairs };
}

export const NO_RATES: FxTable = { pairs: new Map() };

/**
 * How old a rate can be and still be a day's. The ECB publishes on business
 * days only, so a Saturday takes Friday's, and a long holiday weekend runs to
 * four days. Past this the rate belongs to some other week.
 */
export const RATE_STALE_DAYS = 5;

function lookup(list: Array<{ day: string; rate: number }> | undefined, day: string): { rate: number; day: string } | null {
  if (!list?.length) return null;
  let lo = 0;
  let hi = list.length - 1;
  let at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].day <= day) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (at >= 0 && daysBetween(list[at].day, day) <= RATE_STALE_DAYS) return list[at];
  // A row dated before the series' first published day — a Sunday at the
  // start of a statement — takes the first rate after it, within the same window.
  if (at < 0 && daysBetween(day, list[0].day) <= RATE_STALE_DAYS) return list[0];
  return null;
}

/** The rate on a day, from the pair either way round. Null when there is none close enough to be that day's. */
export function rateOn(t: FxTable, from: string, to: string, day: string): { rate: number; day: string } | null {
  if (from === to) return { rate: 1, day };
  const direct = lookup(t.pairs.get(`${from}>${to}`), day);
  if (direct) return direct;
  const inverse = lookup(t.pairs.get(`${to}>${from}`), day);
  return inverse ? { rate: 1 / inverse.rate, day: inverse.day } : null;
}

/** The newest rate on file for a pair, for a number that is today's — cash typed a minute ago. */
export function latestRate(t: FxTable, from: string, to: string): { rate: number; day: string } | null {
  if (from === to) return { rate: 1, day: '' };
  const direct = t.pairs.get(`${from}>${to}`);
  if (direct?.length) return direct[direct.length - 1];
  const inverse = t.pairs.get(`${to}>${from}`);
  if (inverse?.length) { const e = inverse[inverse.length - 1]; return { rate: 1 / e.rate, day: e.day }; }
  return null;
}

/** One day's rate, said the way a person reads it: "₱57.83 = $1 on 26 Sep". */
export function rateLine(from: string, to: string, r: { rate: number; day: string }, dayLabel: (d: string) => string): string {
  // Quoted as units of the weaker currency per one of the stronger: "57.83 PHP per USD" reads; "0.0173" does not.
  const [weak, strong, n] = r.rate < 1 ? [from, to, 1 / r.rate] : [to, from, r.rate];
  const shown = n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(4);
  return `${currencyMark(weak)}${shown} = ${currencyMark(strong)}1${r.day ? ` on ${dayLabel(r.day)}` : ''}`;
}

/* ─── What to fetch ───────────────────────────────────────────────────────── */

/** A pair's days the rows need a rate for. `to` is always the main currency. */
export interface FxNeed { from: string; to: string; start: string; end: string }

/**
 * For each currency the rows, balances and typed numbers are in other than the
 * main one, the span of days they need a rate for. Rows with no currency need
 * none: they are not converted until the person says what they are.
 */
export function ratesNeeded(input: {
  main: string;
  txs: ReadonlyArray<{ on: string; currency: string | null }>;
  accounts?: ReadonlyArray<{ currency: string | null; on: string | null }>;
  typed?: ReadonlyArray<string>;
  today: string;
}): FxNeed[] {
  const span = new Map<string, { start: string; end: string }>();
  const add = (c: string | null | undefined, day: string) => {
    const code = toCode(c);
    if (!code || code === input.main) return;
    const s = span.get(code);
    span.set(code, s ? { start: day < s.start ? day : s.start, end: day > s.end ? day : s.end } : { start: day, end: day });
  };
  for (const t of input.txs) add(t.currency, t.on);
  for (const a of input.accounts ?? []) if (a.on) add(a.currency, a.on);
  // A typed number is converted at the newest rate, so it needs the last few days.
  for (const c of input.typed ?? []) add(c, input.today);
  return [...span.entries()].map(([from, s]) => ({ from, to: input.main, start: s.start, end: s.end })).sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Whether the rates on file answer a need: a rate within RATE_STALE_DAYS of
 * its first day, and one at most RATE_STALE_DAYS before its last. The ends are
 * enough — a pair is only ever fetched a whole span at a time.
 */
export function covers(have: { first: string | null; last: string | null }, need: Pick<FxNeed, 'start' | 'end'>, today: string): boolean {
  if (!have.first || !have.last) return false;
  const end = need.end > today ? today : need.end;
  return daysBetween(have.first, need.start) >= -RATE_STALE_DAYS && daysBetween(have.last, end) <= RATE_STALE_DAYS;
}

/**
 * The rate service's answer into rows. Frankfurter answers a span as
 * `{ base, rates: { "2026-09-26": { "USD": 0.0173 } } }` and a single day as
 * `{ base, date, rates: { "USD": 0.0173 } }`. Anything else is no rows, and the
 * caller says the pair has no rate rather than trusting a shape it cannot read.
 */
export function parseRates(body: unknown, base: string, quote: string): FxRow[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as { base?: unknown; date?: unknown; rates?: unknown };
  if (typeof b.base === 'string' && b.base.toUpperCase() !== base) return [];
  const rates = b.rates && typeof b.rates === 'object' ? (b.rates as Record<string, unknown>) : null;
  if (!rates) return [];
  const one = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  if (typeof b.date === 'string' && one(rates[quote]) != null) return [{ base, quote, day: b.date, rate: one(rates[quote])! }];
  const out: FxRow[] = [];
  for (const [day, v] of Object.entries(rates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !v || typeof v !== 'object') continue;
    const rate = one((v as Record<string, unknown>)[quote]);
    if (rate != null) out.push({ base, quote, day, rate });
  }
  return out;
}
