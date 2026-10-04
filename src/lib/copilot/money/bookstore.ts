// src/lib/copilot/money/bookstore.ts
// The money book's rows in and out of copilot_transactions (book.ts computes
// what the screen shows from them).
//
// A logged row is an ordinary transaction — the read, runway, money in and the
// plan take it with no change of their own — told apart by its fingerprint:
// 'book:<uuid>', or 'repeat:<series>:<day>' for one a repeat wrote. Only those
// are edited or deleted here. A row read off a file stays as the file said; a
// deleted one would come back with the next upload of the same file anyway.
//
// The phone names each move it logs (the uuid in 'book:<uuid>'), so sending the
// same move twice — a retry after a dropped connection, a queued move sent from
// two screens — is one row, never two. That is what lets the add sheet close the
// moment "Log it" is tapped and send in the background (MoneyTab.tsx).
//
// Every refusal is a MoneyRefusal with a sentence for the sheet.

import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { getProfile, logEvent } from '../base';
import { copilotDb, describeDbError, todayIso } from '../db';
import type { BookAnchorRow, Finance, Profile } from '../types';
import {
  anchorOf, bookCategories, bookView, checkEntry, convertEntry, parseRepeat, repeatValue, repeatsDue, safeToSpend, seriesDay, shiftMonth, spreadMonths,
  type BookAnchor, type BookRow, type BookView, type SafeToSpend,
} from './book';
import { currencyForZone, dayLabel } from './ledger';
import { latestRate, mainCurrency, toCode } from './fx';
import { loadRates } from './fxstore';
import { MoneyRefusal, bookBalanceNow, isMissingColumn, moneyGoals, refreshFinance } from './store';
import { displayName, rowKey } from './statement';

const BASE_COLS = 'id, posted_on, amount, currency, description, category, note, repeat, created_at, fingerprint, import_id';
const ENTERED_COLS = 'entered_amount, entered_currency';
/** How far back the book reads: two years is every month anybody scrolls to. */
const BOOK_DAYS = 730;
const PAGE = 1000;
const NOT_SET_UP = 'The Money tab is not set up on this server yet: apply supabase/migrations/20261001_copilot_book.sql.';
const noEntered = (book: string) =>
  `Logging in another currency needs supabase/migrations/20261002_copilot_book_entered.sql on this server. Log it in ${book} for now.`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * When 20261002's columns were last found missing. Read without them until
 * then plus ten minutes, so every open does not ask twice, and applying the
 * migration takes effect without a restart.
 */
let enteredMissingAt = 0;
const enteredKnownMissing = () => Date.now() - enteredMissingAt < 10 * 60_000;

type DbError = { code?: string; message?: string } | null;
const missingTable = (e: DbError) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''));

export interface BookPayload extends BookView {
  /** False when the tables or columns are not there: the screen says so rather than showing an empty book. */
  ready: boolean;
  notReady: string | null;
  /** The book has a balance to start from. Before that the screen asks for one. */
  started: boolean;
  /** What the start card fills in: the currency most likely, and cash the person already typed in it. */
  suggest: { currency: string; balance: number | null };
  today: string;
  /** The app's main currency (fx.ts mainCurrency): the other one the screen offers to show amounts in. */
  main: string;
  /**
   * The currency moves are typed in by default when it is not the book's, and
   * its latest rate into the book's — the add sheet's "≈ ₱790". Null: typed in
   * the book's own.
   */
  entry: EntryDefault;
  /** Logging in another currency works on this server (20261002 applied). */
  enteredReady: boolean;
}

export type EntryDefault = { currency: string; rate: { rate: number; day: string } | null } | null;

/** The series a logged row belongs to: its own id, or the one its repeat fingerprint names. */
function seriesOf(fingerprint: string): string | null {
  const m = /^(?:book:([^:]+)|repeat:([^:]+):)/.exec(fingerprint);
  return m ? (m[1] ?? m[2]) : null;
}

async function readRowsWith(profileId: string, since: string, cols: string, pages: number): Promise<{ rows: Array<Record<string, unknown>>; error: DbError }> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < pages * PAGE; from += PAGE) {
    const { data, error } = await copilotDb().from('copilot_transactions').select(cols)
      .eq('profile_id', profileId).gte('posted_on', since)
      .order('posted_on', { ascending: false }).order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if ((data ?? []).length < PAGE) break;
  }
  return { rows, error: null };
}

/** The book's rows, with what was typed in another currency when the server has 20261002 — and without it when not, never failing on it. */
async function readRows(profileId: string, since: string, pages = 10): Promise<{ rows: Array<Record<string, unknown>>; error: DbError; entered: boolean }> {
  if (!enteredKnownMissing()) {
    const first = await readRowsWith(profileId, since, `${BASE_COLS}, ${ENTERED_COLS}`, pages);
    if (!first.error || !isMissingColumn(first.error)) return { ...first, entered: true };
    enteredMissingAt = Date.now();
  }
  return { ...(await readRowsWith(profileId, since, BASE_COLS, pages)), entered: false };
}

function bookRowOf(r: Record<string, unknown>, files: Map<string, string>): BookRow {
  const enteredAmount = r.entered_amount == null ? null : Number(r.entered_amount);
  const enteredCurrency = toCode(r.entered_currency as string | null);
  return {
    id: String(r.id),
    on: String(r.posted_on).slice(0, 10),
    amount: Number(r.amount),
    currency: (r.currency as string | null) ?? null,
    description: String(r.description ?? ''),
    category: (r.category as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    repeat: (r.repeat as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    book: /^(book|repeat):/.test(String(r.fingerprint ?? '')),
    source: typeof r.import_id === 'string' ? files.get(r.import_id) ?? null : null,
    entered: enteredAmount != null && Number.isFinite(enteredAmount) && enteredCurrency ? { amount: enteredAmount, currency: enteredCurrency } : null,
  };
}

/** Every statement's file name, for "from DefaultTransactions.csv". Read beside the rows rather than after them. */
async function importNames(profileId: string): Promise<Map<string, string>> {
  const { data, error } = await copilotDb().from('copilot_money_imports').select('id, file_name').eq('profile_id', profileId).limit(500);
  if (error && !missingTable(error)) throw new Error(describeDbError(error, 'Could not read your statements.'));
  const files = new Map<string, string>();
  for (const f of (data ?? []) as Array<{ id: string; file_name: string | null }>) if (f.file_name) files.set(f.id, f.file_name);
  return files;
}

/**
 * The rows every repeat still owes: for each series, from its latest row only —
 * an older one writing its successor again would bring back a row the person
 * deleted. Idempotent: the fingerprint of a repeat's row is its series and day,
 * so writing it twice is one row.
 *
 * A repeat logged in another currency repeats its amount in the book's: the
 * rent that was €400 on the day it was logged is ₱26,000 every month after.
 */
export async function materializeRepeats(profileId: string, today: string): Promise<{ written: number; error: string | null }> {
  const db = copilotDb();
  const { data, error } = await db.from('copilot_transactions')
    .select('id, fingerprint, account_id, posted_on, amount, currency, description, counterparty_key, category, note, repeat')
    .eq('profile_id', profileId).not('repeat', 'is', null)
    // Newest first: a series' latest row is in the page even behind a thousand older ones.
    .order('posted_on', { ascending: false }).limit(PAGE);
  // Before 20261001 nothing can repeat, so nothing is owed; the tab says it is not set up.
  if (error && (isMissingColumn(error) || missingTable(error))) return { written: 0, error: null };
  if (error) return { written: 0, error: describeDbError(error) };
  const latest = new Map<string, { r: Record<string, unknown>; day: string }>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const series = seriesOf(String(r.fingerprint));
    if (!series) continue;
    const day = seriesDay(String(r.posted_on).slice(0, 10), String(r.fingerprint));
    const had = latest.get(series);
    if (!had || day > had.day) latest.set(series, { r, day });
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const [series, { r, day }] of latest) {
    const rule = parseRepeat(r.repeat as string);
    if (!rule) continue;
    for (const on of repeatsDue(rule, day, today)) {
      rows.push({
        profile_id: profileId, account_id: r.account_id, import_id: null, fingerprint: `repeat:${series}:${on}`,
        posted_on: on, amount: r.amount, currency: r.currency, description: r.description, counterparty_key: r.counterparty_key,
        category: r.category, note: r.note, repeat: r.repeat, balance_after: null,
      });
    }
  }
  if (!rows.length) return { written: 0, error: null };
  const { data: put, error: e2 } = await db.from('copilot_transactions').upsert(rows, { onConflict: 'profile_id,fingerprint', ignoreDuplicates: true }).select('id');
  return { written: (put ?? []).length, error: e2 ? describeDbError(e2) : null };
}

/**
 * The nightly pass's share of the book: a monthly rent turns up as pending on
 * the Money tab even in a month nobody opens it, and runway, which the pass
 * settles next, counts the one whose day has come.
 */
export async function writeRepeatsDue(profileId: string): Promise<{ written: number; error: string | null }> {
  const profile = await getProfile(profileId);
  if (!profile) return { written: 0, error: null };
  return materializeRepeats(profileId, todayIso(profile.timezone));
}

/** The currency a new book is kept in: the one most rows already on file are in, else the time zone's, else the main one. */
function suggestCurrency(profile: Profile, rows: Array<{ currency: string | null }>, main: string): string {
  const n = new Map<string, number>();
  for (const r of rows) { const c = toCode(r.currency); if (c) n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currencyForZone(profile.timezone) ?? main;
}

/** The newest rate from the currency moves are typed in to the book's: cached like every rate, fetched at most once a few hours. */
async function entryRate(from: string, to: string, today: string): Promise<{ rate: number; day: string } | null> {
  const fx = await loadRates([{ from, to, start: shiftDay(today, -7), end: today }], today);
  return latestRate(fx.table, from, to);
}

const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function loadBook(profileId: string, opts: { month?: string | null; view?: string | null } = {}): Promise<BookPayload> {
  const profile = await getProfile(profileId);
  if (!profile) throw new MoneyRefusal('Not signed in.');
  const today = todayIso(profile.timezone);
  const anchor = anchorOf(profile.finance);
  const month = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : today.slice(0, 7);
  const since = shiftMonth(today.slice(0, 7), -Math.round(BOOK_DAYS / 30)) + '-01';
  const empty = (why: string): BookPayload => ({
    ready: false, notReady: why, started: !!anchor, suggest: { currency: anchor?.currency ?? 'USD', balance: null }, today, main: anchor?.currency ?? 'USD',
    currency: anchor?.currency ?? 'USD', view: anchor?.currency ?? 'USD', balance: null, month, monthLabel: month, first: month, last: month,
    totals: { spent: 0, received: 0 }, days: [], calendar: [], pending: [], categories: { out: [], in: [] }, missing: null, unlabelled: 0,
    entry: null, enteredReady: false, safe: null, safeShown: null, safeChoices: [], pace: null,
  });

  // Everything the screen needs, read at once. These ran one after another —
  // six round trips before the list could draw, the longest wait on the tab
  // after the app itself.
  const asked = toCode(opts.view);
  const viewNeed = anchor && asked && asked !== anchor.currency
    ? { from: anchor.currency, to: asked, start: `${month}-01` < today ? `${month}-01` : today, end: today }
    : null;
  const readBalance = () => (anchor ? bookBalanceNow(profileId, profile.finance, today) : Promise.resolve(null));
  let [repeats, read, goals, files, balanceNow, viewFx, rate] = await Promise.all([
    materializeRepeats(profileId, today),
    readRows(profileId, since),
    moneyGoals(profileId),
    importNames(profileId),
    readBalance(),
    viewNeed ? loadRates([viewNeed], today) : Promise.resolve(null),
    anchor?.entry ? entryRate(anchor.entry, anchor.currency, today) : Promise.resolve(null),
  ]);
  // A repeat just written was not there when the rows were read beside it: read again.
  if (repeats.written > 0) [read, balanceNow] = await Promise.all([readRows(profileId, since), readBalance()]);
  if (read.error) {
    if (isMissingColumn(read.error)) return empty(NOT_SET_UP);
    if (missingTable(read.error)) return empty('Statements are not set up on this server yet: apply supabase/migrations/20260929_copilot_money.sql.');
    throw new Error(describeDbError(read.error, 'Could not read your book.'));
  }
  const rows = read.rows.map((r) => bookRowOf(r, files));

  const main = mainCurrency(profile.finance, goals);
  const currency = anchor?.currency ?? suggestCurrency(profile, rows, main);
  const view = bookView({
    rows, anchor, currency, view: asked ?? currency, today, month,
    fx: viewFx?.table ?? { pairs: new Map() }, fxMissing: viewFx?.missing[currency] ?? null, balanceNow,
  });

  // Cash already typed on the Runway sheet in the book's currency, offered as the balance to start from.
  const typed = profile.finance?.typed_in?.cash;
  const suggestBalance = typed && toCode(typed.currency) === currency ? typed.amount
    : profile.finance?.cash != null && toCode(profile.finance.currency) === currency && profile.finance.source?.cash !== 'statement' ? profile.finance.cash
    : null;
  return {
    ...view,
    ready: true,
    // A repeat that failed to write is said on the screen, not lost (invariant 13).
    notReady: repeats.error ? `A repeat could not be written: ${repeats.error}` : null,
    started: !!anchor,
    suggest: { currency, balance: suggestBalance },
    today,
    main,
    entry: anchor?.entry ? { currency: anchor.entry, rate } : null,
    enteredReady: read.entered,
  };
}

/* ─── The Log money shortcut ──────────────────────────────────────────────── */

/**
 * The balance now and what is safe to spend today, for the pages that draw no
 * list. The rows safe-to-spend reads are today's and the pending ones, so it
 * asks for those and no more — the book's two years are the list's business.
 */
export async function balanceAndSafe(profileId: string, finance: Finance | null | undefined, today: string): Promise<{ balance: number | null; safe: SafeToSpend | null }> {
  const anchor = anchorOf(finance);
  if (!anchor) return { balance: null, safe: null };
  const [balance, ahead] = await Promise.all([
    bookBalanceNow(profileId, finance, today),
    copilotDb().from('copilot_transactions').select('posted_on, amount, currency, repeat, description, created_at, fingerprint')
      .eq('profile_id', profileId).gte('posted_on', today).order('posted_on', { ascending: true }).limit(1000),
  ]);
  if (balance == null) return { balance: null, safe: null };
  // Before 20261001 nothing can repeat or be pending: the balance stands, and there is nothing promised to read.
  if (ahead.error && !isMissingColumn(ahead.error)) throw new Error(describeDbError(ahead.error, 'Could not read what is coming up.'));
  const rows = ((ahead.error ? [] : ahead.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    on: String(r.posted_on).slice(0, 10), amount: Number(r.amount), currency: (r.currency as string | null) ?? null,
    repeat: (r.repeat as string | null) ?? null, description: String(r.description ?? ''), createdAt: String(r.created_at ?? ''),
    book: /^(book|repeat):/.test(String(r.fingerprint ?? '')),
  }));
  return { balance, safe: safeToSpend({ anchor, balance, rows, today }) };
}

export interface LogScreenData {
  ready: boolean;
  notReady: string | null;
  /** Logging in another currency works on this server (20261002 applied). */
  enteredReady: boolean;
  started: boolean;
  currency: string;
  categories: { out: string[]; in: string[] };
  today: string;
  /** For the page to work out today itself when it is shown from the phone's copy, offline. */
  timezone: string | null;
  entry: EntryDefault;
  balance: number | null;
  /** What is safe to spend today, for the label over the categories. */
  safe: SafeToSpend | null;
}

/**
 * What the shortcut's own page needs to draw the keypad, and nothing else: the
 * app's whole home is fifty reads the keypad does not use. One read for the
 * profile, then three at once.
 */
export async function loadLogScreen(profileId: string): Promise<LogScreenData | null> {
  const profile = await getProfile(profileId);
  if (!profile) return null;
  const today = todayIso(profile.timezone);
  const anchor = anchorOf(profile.finance);
  const base = { today, timezone: profile.timezone ?? null, entry: null, balance: null, safe: null, categories: { out: [], in: [] }, enteredReady: false };
  if (!anchor) return { ...base, ready: true, notReady: null, started: false, currency: currencyForZone(profile.timezone) ?? 'USD' };
  // The categories, read with 20261002's column so the pad knows whether a move
  // in another currency can be kept — and without it, when it is not there.
  const categories = (cols: string) => copilotDb().from('copilot_transactions').select(cols).eq('profile_id', profileId)
    .not('category', 'is', null).order('posted_on', { ascending: false }).limit(600);
  let [cats, snap, rate] = await Promise.all([
    categories(enteredKnownMissing() ? 'category, amount' : 'category, amount, entered_currency'),
    balanceAndSafe(profileId, profile.finance, today),
    anchor.entry ? entryRate(anchor.entry, anchor.currency, today) : Promise.resolve(null),
  ]);
  let enteredReady = !enteredKnownMissing();
  if (cats.error && enteredReady && isMissingColumn(cats.error)) {
    enteredMissingAt = Date.now();
    enteredReady = false;
    cats = await categories('category, amount');
  }
  if (cats.error) {
    if (isMissingColumn(cats.error)) return { ...base, ready: false, notReady: NOT_SET_UP, started: true, currency: anchor.currency };
    throw new Error(describeDbError(cats.error, 'Could not read your book.'));
  }
  return {
    ready: true, notReady: null, enteredReady, started: true, currency: anchor.currency, today, timezone: profile.timezone ?? null, balance: snap.balance, safe: snap.safe,
    categories: bookCategories((cats.data ?? []) as unknown as Array<{ category: string | null; amount: number }>),
    entry: anchor.entry ? { currency: anchor.entry, rate } : null,
  };
}

/* ─── Writes ──────────────────────────────────────────────────────────────── */

/** The one account logged rows live in, made the first time it is needed. */
async function bookAccount(profileId: string, currency: string): Promise<string> {
  const { data, error } = await copilotDb().from('copilot_money_accounts').upsert({
    profile_id: profileId, provider: 'book', external_key: 'book', label: 'Money book', currency,
  }, { onConflict: 'profile_id,provider,external_key' }).select('id').single();
  if (error) throw new Error(describeDbError(error, 'Could not open your book.'));
  return String(data.id);
}

async function bookOf(profileId: string): Promise<{ profile: Profile; anchor: BookAnchor; today: string }> {
  const profile = await getProfile(profileId);
  if (!profile) throw new MoneyRefusal('Not signed in.');
  const anchor = anchorOf(profile.finance);
  if (!anchor) throw new MoneyRefusal('Say your balance first: the book starts from it.');
  return { profile, anchor, today: todayIso(profile.timezone) };
}

/** checkEntry's sentences are the person's to act on: a refusal, not a server failure. */
function entryOf(body: Record<string, unknown>, today: string): ReturnType<typeof checkEntry> {
  try { return checkEntry(body, today); } catch (e) { throw new MoneyRefusal(e instanceof Error ? e.message : 'That is not a move the book can take.'); }
}

/** A logged row's columns, from what the sheet sent. */
function entryColumns(e: ReturnType<typeof checkEntry>, currency: string) {
  const description = e.note ?? e.category ?? 'Money';
  return {
    posted_on: e.on,
    amount: e.amount,
    currency,
    description,
    // The same key a budget export's row gets — the note, else the category —
    // so a payee named once is named for both, and the read groups them as one.
    counterparty_key: rowKey({ description, counterparty: null }),
    category: e.category,
    note: e.note,
    repeat: e.repeat ? repeatValue(e.repeat, e.on) : null,
  };
}

type Columns = ReturnType<typeof entryColumns> & { entered_amount?: number | null; entered_currency?: string | null };

/**
 * The columns for a move typed in `typedIn`: as typed when that is the book's
 * currency, else converted into it at the rate on the move's day and kept as
 * pesos — with what was typed beside it — so the balance never moves again
 * when the rate does. No rate, no row: a number the book would have to guess.
 */
async function movedColumns(e: ReturnType<typeof checkEntry>, anchor: BookAnchor, typedIn: unknown, today: string): Promise<Columns> {
  const cols = entryColumns(e, anchor.currency);
  const from = toCode(typeof typedIn === 'string' ? typedIn : null);
  if (!from || from === anchor.currency) return cols;
  if (enteredKnownMissing()) throw new MoneyRefusal(noEntered(anchor.currency));
  const fx = await loadRates([{ from, to: anchor.currency, start: e.on < today ? e.on : today, end: today }], today);
  const c = convertEntry(fx.table, from, anchor.currency, e.amount, e.on, today);
  if (!c) {
    const why = fx.missing[from];
    throw new MoneyRefusal(`No ${from} to ${anchor.currency} rate for ${dayLabel(e.on)}${why ? ` (${why})` : ''}. Log it in ${anchor.currency}, or try again later.`);
  }
  return { ...cols, amount: c.amount, entered_amount: e.amount, entered_currency: from };
}

async function namePayee(profileId: string, key: string): Promise<void> {
  const { error } = await copilotDb().from('copilot_counterparties')
    .upsert({ profile_id: profileId, key, name: displayName(key) }, { onConflict: 'profile_id,key', ignoreDuplicates: true });
  if (error) throw new Error(describeDbError(error, 'Could not save who it was with.'));
}

/**
 * Runway after a row moved, once the answer has gone: the phone is not kept
 * waiting on a second of reads it does not show. This is not the last word on
 * runway — every home load settles the same row again and says on the Runway
 * sheet when it cannot (loadHome's settleError), and the Money tab asks for a
 * home load after each move — so a failure here is logged for the server, and
 * the screen hears about it from the load that follows.
 */
function settleLater(profileId: string): void {
  after(async () => {
    try { await refreshFinance(profileId); }
    catch (e) { console.error('[copilot/book] runway not settled after a move; the next home load settles it again and says so:', e); }
  });
}

/** A move logged. `body.id`, the phone's name for it, makes sending it twice one row. */
export async function addEntry(profileId: string, body: Record<string, unknown>): Promise<void> {
  const { anchor, today } = await bookOf(profileId);
  const e = entryOf(body, today);
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id.toLowerCase() : randomUUID();
  const [account, cols] = await Promise.all([bookAccount(profileId, anchor.currency), movedColumns(e, anchor, body.currency, today)]);
  const { error } = await copilotDb().from('copilot_transactions').upsert({
    profile_id: profileId, account_id: account, import_id: null, fingerprint: `book:${id}`, balance_after: null, ...cols,
  }, { onConflict: 'profile_id,fingerprint', ignoreDuplicates: true });
  if (error) {
    if (isMissingColumn(error)) {
      if (cols.entered_currency) { enteredMissingAt = Date.now(); throw new MoneyRefusal(noEntered(anchor.currency)); }
      throw new MoneyRefusal(NOT_SET_UP);
    }
    throw new Error(describeDbError(error, 'Could not save that.'));
  }
  await Promise.all([
    namePayee(profileId, cols.counterparty_key),
    logEvent(profileId, 'book_logged', { amount: e.amount, category: e.category, repeat: cols.repeat, entered: cols.entered_currency ?? null }),
    cols.repeat
      ? materializeRepeats(profileId, today).then((r) => { if (r.error) throw new Error(`Saved, but its next repeat could not be written: ${r.error}`); })
      : null,
  ]);
  settleLater(profileId);
}

async function loggedRow(profileId: string, id: string): Promise<{ fingerprint: string; posted_on: string; repeat: string | null }> {
  const { data, error } = await copilotDb().from('copilot_transactions').select('fingerprint, posted_on, repeat')
    .eq('profile_id', profileId).eq('id', id).maybeSingle();
  if (error) throw new Error(describeDbError(error, 'Could not read that row.'));
  if (!data) throw new MoneyRefusal('That row is not in your book any more.');
  if (!/^(book|repeat):/.test(String(data.fingerprint))) throw new MoneyRefusal('That row came from a statement. Remove the statement on Bank statements to take its rows out.');
  return { fingerprint: String(data.fingerprint), posted_on: String(data.posted_on).slice(0, 10), repeat: (data.repeat as string | null) ?? null };
}

/**
 * A series stopped: no row of it repeats any more, and the ones it wrote ahead
 * of their day go. What already happened stays — it happened.
 */
async function stopSeries(profileId: string, series: string, today: string): Promise<void> {
  const db = copilotDb();
  const inSeries = `fingerprint.eq.book:${series},fingerprint.like.repeat:${series}:*`;
  const { error } = await db.from('copilot_transactions').update({ repeat: null }).eq('profile_id', profileId).or(inSeries);
  if (error) throw new Error(describeDbError(error, 'Could not stop the repeat.'));
  const { error: e2 } = await db.from('copilot_transactions').delete().eq('profile_id', profileId).like('fingerprint', `repeat:${series}:%`).gt('posted_on', today);
  if (e2) throw new Error(describeDbError(e2, 'Could not remove the upcoming repeats.'));
}

export async function editEntry(profileId: string, id: string, body: Record<string, unknown>): Promise<void> {
  const { anchor, today } = await bookOf(profileId);
  const [row, cols] = await Promise.all([loggedRow(profileId, id), movedColumns(entryOf(body, today), anchor, body.currency, today)]);
  const series = seriesOf(row.fingerprint);
  // Turning a repeat off stops the whole series, not this one row: otherwise
  // the next one it already wrote would carry on repeating by itself.
  if (row.repeat && !cols.repeat && series) await stopSeries(profileId, series, today);
  const db = copilotDb();
  // Typed in the book's currency now: what it was typed in before goes with it.
  const cleared = cols.entered_currency ? cols : { ...cols, entered_amount: null, entered_currency: null };
  let { error } = await db.from('copilot_transactions').update(enteredKnownMissing() ? cols : cleared).eq('profile_id', profileId).eq('id', id);
  if (error && isMissingColumn(error) && !cols.entered_currency) {
    enteredMissingAt = Date.now();
    ({ error } = await db.from('copilot_transactions').update(cols).eq('profile_id', profileId).eq('id', id));
  }
  if (error) throw isMissingColumn(error) && cols.entered_currency ? new MoneyRefusal(noEntered(anchor.currency)) : new Error(describeDbError(error, 'Could not save that.'));
  await namePayee(profileId, cols.counterparty_key);
  if (cols.repeat) {
    const r = await materializeRepeats(profileId, today);
    if (r.error) throw new Error(`Saved, but its next repeat could not be written: ${r.error}`);
  }
  settleLater(profileId);
}

/**
 * A logged row gone. An upcoming repeat deleted stops its series — the row
 * before it would otherwise write it again the next time the book opened — and
 * the sheet says so before the tap.
 */
export async function deleteEntry(profileId: string, id: string): Promise<{ stopped: boolean }> {
  const { today } = await bookOf(profileId);
  const row = await loggedRow(profileId, id);
  const series = seriesOf(row.fingerprint);
  const stops = !!series && row.posted_on > today && !!row.repeat;
  if (stops) await stopSeries(profileId, series!, today);
  const { error } = await copilotDb().from('copilot_transactions').delete().eq('profile_id', profileId).eq('id', id);
  if (error) throw new Error(describeDbError(error, 'Could not delete that.'));
  settleLater(profileId);
  return { stopped: stops };
}

/**
 * The balance the book starts from — or restarts from: said again, it replaces
 * the last, and only rows logged after it move it. Runway reads it at once.
 */
export async function setBookBalance(profileId: string, body: Record<string, unknown>): Promise<void> {
  const profile = await getProfile(profileId);
  if (!profile) throw new MoneyRefusal('Not signed in.');
  const raw = typeof body.balance === 'number' ? body.balance : typeof body.balance === 'string' ? Number(body.balance.replace(/,/g, '')) : NaN;
  if (!Number.isFinite(raw) || Math.abs(raw) >= 1e10) throw new MoneyRefusal('Type your balance as a number.');
  const was = anchorOf(profile.finance);
  const asked = toCode(typeof body.currency === 'string' ? body.currency : null);
  // A book's currency is chosen once: its rows are in it, and a second one
  // would turn every peso logged so far into a euro.
  if (was && asked && asked !== was.currency) throw new MoneyRefusal(`Your book is kept in ${was.currency}. Type the balance in ${was.currency}; switch what it shows with the currency on the Money tab.`);
  const currency = was?.currency ?? asked;
  if (!currency) throw new MoneyRefusal('Which currency is your book in?');
  const book: BookAnchorRow = {
    currency, balance: Math.round(raw * 100) / 100, at: new Date().toISOString(), on: todayIso(profile.timezone),
    ...(was?.entry ? { entry: was.entry } : {}),
    // How long it has to last is about the person, not the number: saying the balance again keeps it.
    ...(was?.months ? { months: was.months } : {}),
  };
  const finance: Finance = { ...(profile.finance ?? {}), book };
  const { error } = await copilotDb().from('copilot_profiles').update({ finance }).eq('id', profileId);
  if (error) throw new Error(describeDbError(error, 'Could not save your balance.'));
  await logEvent(profileId, 'book_balance', { currency, balance: book.balance, restart: !!was });
  settleLater(profileId);
}

/**
 * The currency moves are typed in from now on — tap ₱ on the add sheet. Kept
 * on the account rather than the phone, so the shortcut's page, which draws
 * before any script runs, already knows it. Written only if the balance was
 * not said again meanwhile (the same guard as a settle): this rewrites the
 * whole finance row, and must not put back a balance the person just changed.
 */
export async function setEntryCurrency(profileId: string, raw: unknown): Promise<EntryDefault> {
  const { profile, anchor, today } = await bookOf(profileId);
  const code = toCode(typeof raw === 'string' ? raw : null);
  if (!code || !/^[A-Z]{3}$/.test(code)) throw new MoneyRefusal('Which currency? Three letters, like EUR.');
  const book: BookAnchorRow = { ...(profile.finance?.book as BookAnchorRow) };
  if (code === anchor.currency) delete book.entry;
  else book.entry = code;
  const { data, error } = await copilotDb().from('copilot_profiles').update({ finance: { ...(profile.finance ?? {}), book } })
    .eq('id', profileId).eq('finance->book->>at', anchor.at).select('id');
  if (error) throw new Error(describeDbError(error, 'Could not save that.'));
  if (!data?.length) throw new MoneyRefusal('Your balance was changed just now. Try that again.');
  return code === anchor.currency ? null : { currency: code, rate: await entryRate(code, anchor.currency, today) };
}

/**
 * How many months the balance has to last, for safe to spend. Kept on the
 * account beside the balance, so the shortcut's page and every phone read the
 * same figure. Written under the same guard as the entry currency, for the
 * same reason: this rewrites the whole finance row.
 */
export async function setSpread(profileId: string, raw: unknown): Promise<number> {
  const { profile, anchor } = await bookOf(profileId);
  const asked = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  const months = spreadMonths(asked);
  if (months !== asked) throw new MoneyRefusal('How many months? A whole number from 1 to 12.');
  const book: BookAnchorRow = { ...(profile.finance?.book as BookAnchorRow) };
  if (months === 1) delete book.months;
  else book.months = months;
  const { data, error } = await copilotDb().from('copilot_profiles').update({ finance: { ...(profile.finance ?? {}), book } })
    .eq('id', profileId).eq('finance->book->>at', anchor.at).select('id');
  if (error) throw new Error(describeDbError(error, 'Could not save that.'));
  if (!data?.length) throw new MoneyRefusal('Your balance was changed just now. Try that again.');
  await logEvent(profileId, 'book_spread', { months });
  return months;
}

/* ─── A copy to keep ──────────────────────────────────────────────────────── */

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Every row the money book reads — logged, repeated, read off a file — as a
 * CSV the person keeps. The database is the only other copy; a file on their
 * phone is the one nobody else can lose for them.
 */
export async function exportBookCsv(profileId: string): Promise<{ name: string; csv: string }> {
  const profile = await getProfile(profileId);
  if (!profile) throw new MoneyRefusal('Not signed in.');
  // Every row there is, not the screen's two years: a hundred thousand is decades of coffee.
  const [read, files] = await Promise.all([readRows(profileId, '1900-01-01', 100), importNames(profileId)]);
  if (read.error) throw new Error(isMissingColumn(read.error) ? NOT_SET_UP : describeDbError(read.error, 'Could not read your book.'));
  const rows = read.rows.map((r) => ({ r, row: bookRowOf(r, files) })).sort((a, b) => a.row.on.localeCompare(b.row.on) || a.row.createdAt.localeCompare(b.row.createdAt));
  const head = ['Date', 'Kind', 'Amount', 'Currency', 'Category', 'Note', 'Description', 'Typed amount', 'Typed currency', 'Repeats', 'From', 'Logged at'];
  const lines = rows.map(({ r, row }) => [
    row.on,
    String(r.fingerprint ?? '').startsWith('repeat:') ? 'repeat' : row.book ? 'logged' : 'statement',
    row.amount, row.currency ?? '', row.category ?? '', row.note ?? '', row.description,
    row.entered?.amount ?? '', row.entered?.currency ?? '', row.repeat ?? '', row.source ?? '', row.createdAt,
  ].map(csvCell).join(','));
  return { name: `copilot-money-${todayIso(profile.timezone)}.csv`, csv: [head.join(','), ...lines].join('\n') + '\n' };
}
