// src/lib/copilot/signal.ts
// The count link: what the person's own forms and checkout send, counted as
// rows.
//
// Why it exists. For a business whose buyers find it, "how they hear" was the
// one part of the chain the app could not see at all ("The app cannot see this
// way in, so a bet counts it"), and a bet counted it only as fast as the person
// typed tallies. Its owner sells the app itself, online: every sign-up and every
// payment already happens in software that can send a webhook — a form tool, a
// landing page, Stripe. A count link is that webhook's address. Each POST to it
// is one sign-up, enquiry or sale, counted where Proof counts how buyers hear
// and what they pay: measured, not typed. DIRECTION.md's order — add the sensor
// first, then the ranking — and its survival test: these are rows a memory file
// never collected.
//
// What it keeps is the count and nothing about who. A form's payload carries the
// visitor's name and email, and none of it is stored: the app keeps no file on
// anyone (DIRECTION.md), least of all on people who never chose to be in it. A
// sale keeps its amount and currency, as a sale logged by hand does, and becomes
// one (an outcome won), so the pay part, the verdict, the goal and the history
// see it without anything new reading it.
//
// The link is a secret: anyone holding it can add to the count. It is signed
// (signalkey.ts) over the account and the link's generation, and making a new
// link ends the old one. A GET never counts (invariant 8): a mail scanner or a
// browser opening the link must not add a sign-up.
//
// Pure: no DB import, no crypto.

export const SIGNAL_IN = 'signal_in';
/** A link made: the newest names the one that works, and any older one is dead. */
export const SIGNAL_LINK = 'signal_link';
export const SIGNAL_EVENTS = [SIGNAL_IN, SIGNAL_LINK] as const;

export const SIGNAL_KINDS = ['signup', 'enquiry', 'sale'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** One and many, as a count says it. */
export const SIGNAL_WORDS: Record<SignalKind, [string, string]> = {
  signup: ['sign-up', 'sign-ups'],
  enquiry: ['enquiry', 'enquiries'],
  sale: ['sale', 'sales'],
};

/** Where a signal came from: a Stripe event, anything else posted to the link, or this app's own sign-ups for its operator. */
export type SignalFrom = 'stripe' | 'link' | 'app';

/** How many one account can send in an hour. Past it a form is being spammed, and a count of spam is not a count. */
export const SIGNALS_PER_HOUR = 300;
/** What a home payload carries of them, newest first. */
export const SIGNALS_KEPT = 1000;
export const REF_MAX = 120;

export interface SignalDraft {
  kind: SignalKind;
  /** A sale's amount, in its own currency's whole units. Null for a sign-up or enquiry, and for a sale sent with none. */
  amount: number | null;
  /** A three-letter code, upper case. Null when none was sent: then it is the sales currency. */
  currency: string | null;
  /** The sender's own id for the event — Stripe's event id, a form's submission id — so a retry is one signal, not two. */
  ref: string | null;
  from: SignalFrom;
  /** What it was, for the sheet: "invoice.paid", "form". Never the visitor's details. */
  what: string | null;
}

export type SignalRead =
  | { ok: true; value: SignalDraft }
  /** Accepted and not counted, with why: a Stripe event that is not a payment. The sender is answered 200 so it does not retry. */
  | { ok: 'skip'; why: string }
  | { ok: false; status: number; error: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[, ]/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
};
const code = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : null);
const ref = (v: unknown): string | null => {
  const s = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  return s && /^[\w:.#@/-]+$/.test(s) ? s.slice(0, REF_MAX) : null;
};

/** The words a form tool or a person might use for each kind, matched whole. */
const KIND_WORDS: Array<[RegExp, SignalKind]> = [
  [/^(sign[\s_-]?ups?|signups?|registrations?|registered|subscribers?|subscribed|joined|trials?|waitlist)$/, 'signup'],
  [/^(enquir(y|ies)|inquir(y|ies)|leads?|contacts?|requests?|bookings?|calls?)$/, 'enquiry'],
  [/^(sales?|payments?|paid|orders?|purchases?)$/, 'sale'],
];

/** "sign-up", "Sign Ups", "lead", "payment" → its kind. Null for anything else, never a guess. */
export function kindOf(v: unknown): SignalKind | null {
  if (typeof v !== 'string') return null;
  const w = v.trim().toLowerCase();
  return KIND_WORDS.find(([re]) => re.test(w))?.[1] ?? null;
}

/** Stripe's currencies with no minor unit, and the three with thousandths: an amount is in these units, not cents. */
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/** A Stripe amount, in the currency's whole units. */
export function stripeAmount(minor: number, currency: string): number {
  const c = currency.toUpperCase();
  return ZERO_DECIMAL.has(c) ? minor : THREE_DECIMAL.has(c) ? minor / 1000 : minor / 100;
}

/**
 * A Stripe event, read as a sale or not. Two are counted, and only two, because
 * Stripe sends several events for one payment: `invoice.paid` (every
 * subscription payment, the first included, and every invoice) and
 * `checkout.session.completed` for a one-off payment. A subscription's checkout
 * is skipped because its first invoice already counts it, and charge or intent
 * events are skipped because they echo the two above — counted, one payment
 * would be two or three sales.
 */
function fromStripe(e: Record<string, unknown>): SignalRead {
  const type = typeof e.type === 'string' ? e.type : '';
  const o = obj(obj(e.data).object);
  const id = ref(e.id);
  const sale = (minor: unknown, currency: unknown): SignalRead => {
    const c = code(currency);
    const m = num(minor);
    if (!c || m == null) return { ok: false, status: 400, error: 'That Stripe event carries no amount and currency.' };
    if (m <= 0) return { ok: 'skip', why: 'A payment of nothing is not a sale.' };
    return { ok: true, value: { kind: 'sale', amount: stripeAmount(m, c), currency: c, ref: id, from: 'stripe', what: type } };
  };
  if (type === 'invoice.paid') return sale(o.amount_paid, o.currency);
  if (type === 'checkout.session.completed') {
    if (o.mode === 'subscription') return { ok: 'skip', why: 'A subscription’s first payment is counted from its invoice.paid.' };
    if (o.payment_status !== 'paid') return { ok: 'skip', why: 'Not paid yet: it is counted when it is.' };
    return sale(o.amount_total, o.currency);
  }
  return { ok: 'skip', why: `${type || 'That event'} is not counted. Only invoice.paid and checkout.session.completed are — the others repeat the same payment.` };
}

/**
 * What a POST to the link says, or why it says nothing. `kind` is the link's own
 * (?kind=signup): the person pasted that link into their form tool, so it says
 * what every post to it counts, whatever shape the tool's payload has. Without
 * it the body has to say, as `kind`. Of the body, only the kind, a sale's amount
 * and currency, and an id for de-duplicating are read — never a name, an email
 * or anything else a form sends about the person who filled it in.
 */
export function readSignal(body: unknown, linkKind: string | null): SignalRead {
  const b = obj(body);
  if (b.object === 'event' && typeof b.type === 'string' && b.data) return fromStripe(b);
  const fromLink = linkKind != null && linkKind !== '' ? kindOf(linkKind) : null;
  if (linkKind && !fromLink) return { ok: false, status: 400, error: `"${linkKind.slice(0, 30)}" is not something this counts. Use ?kind=signup, ?kind=enquiry or ?kind=sale.` };
  const kind = fromLink ?? kindOf(b.kind) ?? kindOf(b.type) ?? kindOf(b.event);
  if (!kind) return { ok: false, status: 400, error: 'Say what this counts: add ?kind=signup, ?kind=enquiry or ?kind=sale to the link.' };
  const id = ref(b.ref) ?? ref(b.id) ?? ref(b.event_id) ?? ref(b.submission_id) ?? ref(b.response_id);
  if (kind !== 'sale') return { ok: true, value: { kind, amount: null, currency: null, ref: id, from: 'link', what: 'form' } };
  const amount = num(b.amount);
  if (amount != null && amount < 0) return { ok: false, status: 400, error: 'A sale cannot be for less than nothing.' };
  return { ok: true, value: { kind, amount: amount != null && amount > 0 ? amount : null, currency: code(b.currency), ref: id, from: 'link', what: 'payment' } };
}

/**
 * Whether a signal counts, and why not. A sale in another currency than the
 * one sales are counted in is kept and said, never converted here and never
 * added as if it were the same money: "$29" and "€29" are not one price.
 */
export function signalCounts(d: Pick<SignalDraft, 'kind' | 'currency'>, salesCode: string | null): { counted: boolean; why: string | null } {
  if (d.kind !== 'sale' || !d.currency || !salesCode || d.currency === salesCode) return { counted: true, why: null };
  return { counted: false, why: `In ${d.currency}, and your sales are counted in ${salesCode}, so it is not added to them.` };
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface SignalEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

export interface SignalRow {
  id: string;
  kind: SignalKind;
  at: string;
  amount: number | null;
  currency: string | null;
  from: SignalFrom;
  what: string | null;
  counted: boolean;
  why: string | null;
  /** A sale that could not be recorded and has not been sent again since. */
  failed: boolean;
}

/** The link's state and every signal it recorded, newest first. Rows that do not hold together are dropped, not guessed at. */
export function signalsFromEvents(rows: SignalEventRow[]): { made: string | null; gen: string | null; signals: SignalRow[] } {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const link = sorted.find((r) => r.event_type === SIGNAL_LINK);
  const gen = link ? obj(link.payload).gen : null;
  const signals: SignalRow[] = [];
  // A sale that failed to record and then went in on the sender's retry is one
  // sale: the failure is dropped once a later row with its id settled it.
  const settled = new Set<string>();
  for (const r of sorted) {
    if (r.event_type !== SIGNAL_IN) continue;
    const p = obj(r.payload);
    if (!(SIGNAL_KINDS as readonly string[]).includes(p.kind as string)) continue;
    const id = ref(p.ref);
    if (p.failed === true && id && settled.has(id)) continue;
    if (p.failed !== true && id) settled.add(id);
    const from = p.from === 'stripe' || p.from === 'app' ? p.from : 'link';
    signals.push({
      id: String(r.id), kind: p.kind as SignalKind, at: r.created_at,
      amount: typeof p.amount === 'number' && Number.isFinite(p.amount) ? p.amount : null,
      currency: code(p.currency), from, what: typeof p.what === 'string' ? p.what.slice(0, 60) : null,
      counted: p.counted !== false && p.failed !== true, why: typeof p.why === 'string' ? p.why.slice(0, 200) : null,
      failed: p.failed === true,
    });
  }
  return { made: link?.created_at ?? null, gen: typeof gen === 'string' ? gen : null, signals };
}

/** The count link, as the home payload carries it. */
export interface SignalHome {
  /** When the link in use was made; null before there is one. */
  made: string | null;
  /** Newest first, at most a screenful. */
  recent: SignalRow[];
  /** Sign-ups and enquiries that counted, on the person's day — what bets and the chain count. */
  days: Array<{ kind: 'signup' | 'enquiry'; on: string }>;
  /** Every kind that counted, of the rows read ("12 sign-ups · 2 sales"), and the sales that could not be recorded. */
  counts: Record<SignalKind, number>;
  failed: number;
  /** The read's failure, said where the link is — never shown as a link that recorded nothing (invariant 13). */
  unreadable: string | null;
}

/** "12 sign-ups · 2 sales": the counted ones, said. Empty when there are none. */
export function signalLine(counts: Partial<Record<SignalKind, number>>): string {
  return SIGNAL_KINDS
    .map((k) => {
      const n = counts[k] ?? 0;
      return n ? `${n} ${SIGNAL_WORDS[k][n === 1 ? 0 : 1]}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * The kind of signal a bet's own word counts, for a bet that counts something
 * the person names (lab.ts `logged`): "sign-ups" are sign-ups, "enquiries" and
 * "leads" are enquiries. Anything else — "walk-ins", "orders" — the link does not
 * send, and stays the person's to log.
 */
export function unitSignal(unit: string | null | undefined): 'signup' | 'enquiry' | null {
  const u = (unit ?? '').trim().toLowerCase();
  if (!u) return null;
  const k = kindOf(u);
  return k === 'signup' || k === 'enquiry' ? k : null;
}

/** The link's address, for a token and an origin. `kind` says what every post to it counts. */
export function signalUrl(origin: string, token: string, kind?: SignalKind): string {
  return `${origin.replace(/\/+$/, '')}/api/copilot/signal/${encodeURIComponent(token)}${kind ? `?kind=${kind}` : ''}`;
}
