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
// Every refusal is a MoneyRefusal with a sentence for the sheet.

import { randomUUID } from 'node:crypto';
import { getProfile, logEvent } from '../base';
import { copilotDb, describeDbError, todayIso } from '../db';
import type { BookAnchorRow, Finance, Profile } from '../types';
import { anchorOf, bookView, checkEntry, parseRepeat, repeatValue, repeatsDue, shiftMonth, type BookAnchor, type BookRow, type BookView } from './book';
import { currencyForZone } from './ledger';
import { mainCurrency, toCode } from './fx';
import { loadRates } from './fxstore';
import { MoneyRefusal, bookBalanceNow, isMissingColumn, moneyGoals, refreshFinance } from './store';
import { displayName, rowKey } from './statement';

const BOOK_COLS = 'id, posted_on, amount, currency, description, category, note, repeat, created_at, fingerprint, import_id';
/** How far back the book reads: two years is every month anybody scrolls to. */
const BOOK_DAYS = 730;
const PAGE = 1000;
const NOT_SET_UP = 'The Money tab is not set up on this server yet: apply supabase/migrations/20261001_copilot_book.sql.';

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
}

/** The series a logged row belongs to: its own id, or the one its repeat fingerprint names. */
function seriesOf(fingerprint: string): string | null {
  const m = /^(?:book:([^:]+)|repeat:([^:]+):)/.exec(fingerprint);
  return m ? (m[1] ?? m[2]) : null;
}

async function readRows(profileId: string, since: string): Promise<{ rows: Array<Record<string, unknown>>; error: DbError }> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < 10 * PAGE; from += PAGE) {
    const { data, error } = await copilotDb().from('copilot_transactions').select(BOOK_COLS)
      .eq('profile_id', profileId).gte('posted_on', since)
      .order('posted_on', { ascending: false }).order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
    if ((data ?? []).length < PAGE) break;
  }
  return { rows, error: null };
}

/**
 * The rows every repeat still owes: for each series, from its latest row only —
 * an older one writing its successor again would bring back a row the person
 * deleted. Idempotent: the fingerprint of a repeat's row is its series and day,
 * so writing it twice is one row.
 */
export async function materializeRepeats(profileId: string, today: string): Promise<{ written: number; error: string | null }> {
  const db = copilotDb();
  const { data, error } = await db.from('copilot_transactions')
    .select('id, fingerprint, account_id, posted_on, amount, currency, description, counterparty_key, category, note, repeat')
    .eq('profile_id', profileId).not('repeat', 'is', null).limit(PAGE);
  // Before 20261001 nothing can repeat, so nothing is owed; the tab says it is not set up.
  if (error && (isMissingColumn(error) || missingTable(error))) return { written: 0, error: null };
  if (error) return { written: 0, error: describeDbError(error) };
  const latest = new Map<string, Record<string, unknown>>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const series = seriesOf(String(r.fingerprint));
    if (!series) continue;
    const had = latest.get(series);
    if (!had || String(r.posted_on) > String(had.posted_on)) latest.set(series, r);
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const [series, r] of latest) {
    const rule = parseRepeat(r.repeat as string);
    if (!rule) continue;
    for (const on of repeatsDue(rule, String(r.posted_on).slice(0, 10), today)) {
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

export async function loadBook(profileId: string, opts: { month?: string | null; view?: string | null } = {}): Promise<BookPayload> {
  const profile = await getProfile(profileId);
  if (!profile) throw new MoneyRefusal('Not signed in.');
  const today = todayIso(profile.timezone);
  const anchor = anchorOf(profile.finance);
  const month = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : today.slice(0, 7);
  const empty = (why: string): BookPayload => ({
    ready: false, notReady: why, started: !!anchor, suggest: { currency: anchor?.currency ?? 'USD', balance: null }, today, main: anchor?.currency ?? 'USD',
    currency: anchor?.currency ?? 'USD', view: anchor?.currency ?? 'USD', balance: null, month, monthLabel: month, first: month, last: month,
    totals: { spent: 0, received: 0 }, days: [], calendar: [], pending: [], categories: { out: [], in: [] }, missing: null, unlabelled: 0,
  });

  // A repeat that failed to write is said on the screen, not lost (invariant 13).
  const repeats = await materializeRepeats(profileId, today);
  const { rows: raw, error } = await readRows(profileId, shiftMonth(today.slice(0, 7), -Math.round(BOOK_DAYS / 30)) + '-01');
  if (error) {
    if (isMissingColumn(error)) return empty(NOT_SET_UP);
    if (missingTable(error)) return empty('Statements are not set up on this server yet: apply supabase/migrations/20260929_copilot_money.sql.');
    throw new Error(describeDbError(error, 'Could not read your book.'));
  }
  const importIds = [...new Set(raw.map((r) => r.import_id).filter((x): x is string => typeof x === 'string'))];
  const files = new Map<string, string>();
  if (importIds.length) {
    const { data } = await copilotDb().from('copilot_money_imports').select('id, file_name').eq('profile_id', profileId).in('id', importIds.slice(0, 200));
    for (const f of (data ?? []) as Array<{ id: string; file_name: string | null }>) if (f.file_name) files.set(f.id, f.file_name);
  }
  const rows: BookRow[] = raw.map((r) => ({
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
  }));

  const main = mainCurrency(profile.finance, await moneyGoals(profileId));
  const currency = anchor?.currency ?? suggestCurrency(profile, rows, main);
  const wanted = toCode(opts.view) ?? currency;
  // Rates only when another view is asked for: from the month's first day (or
  // the earliest pending one) to today, one fetch, cached like every other.
  const fx = wanted === currency
    ? { table: { pairs: new Map() }, missing: {} as Record<string, string> }
    : await loadRates([{ from: currency, to: wanted, start: `${month}-01` < today ? `${month}-01` : today, end: today }], today);
  const view = bookView({
    rows, anchor, currency, view: wanted, today, month, fx: fx.table, fxMissing: fx.missing[currency] ?? null,
    balanceNow: anchor ? await bookBalanceNow(profileId, profile.finance, today) : null,
  });

  // Cash already typed on the Runway sheet in the book's currency, offered as the balance to start from.
  const typed = profile.finance?.typed_in?.cash;
  const suggestBalance = typed && toCode(typed.currency) === currency ? typed.amount
    : profile.finance?.cash != null && toCode(profile.finance.currency) === currency && profile.finance.source?.cash !== 'statement' ? profile.finance.cash
    : null;
  return {
    ...view,
    ready: true,
    notReady: repeats.error ? `A repeat could not be written: ${repeats.error}` : null,
    started: !!anchor,
    suggest: { currency, balance: suggestBalance },
    today,
    main,
  };
}

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

async function namePayee(profileId: string, key: string): Promise<void> {
  const { error } = await copilotDb().from('copilot_counterparties')
    .upsert({ profile_id: profileId, key, name: displayName(key) }, { onConflict: 'profile_id,key', ignoreDuplicates: true });
  if (error) throw new Error(describeDbError(error, 'Could not save who it was with.'));
}

/**
 * Runway after a row moved: the finance row settles on the next home load
 * anyway, but the plan and the brief read it before then. The row is saved
 * whatever happens here, so a failure comes back as a sentence for the toast
 * rather than as a failed save (invariant 13).
 */
async function settle(profileId: string): Promise<string | null> {
  try {
    await refreshFinance(profileId);
    return null;
  } catch (e) {
    return `Saved, but runway was not updated: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function addEntry(profileId: string, body: Record<string, unknown>): Promise<{ warning: string | null }> {
  const { anchor, today } = await bookOf(profileId);
  const e = entryOf(body, today);
  const cols = entryColumns(e, anchor.currency);
  const account = await bookAccount(profileId, anchor.currency);
  const { error } = await copilotDb().from('copilot_transactions').insert({
    profile_id: profileId, account_id: account, import_id: null, fingerprint: `book:${randomUUID()}`, balance_after: null, ...cols,
  });
  if (error) throw new Error(isMissingColumn(error) ? NOT_SET_UP : describeDbError(error, 'Could not save that.'));
  await namePayee(profileId, cols.counterparty_key);
  if (cols.repeat) {
    const r = await materializeRepeats(profileId, today);
    if (r.error) throw new Error(`Saved, but its next repeat could not be written: ${r.error}`);
  }
  await logEvent(profileId, 'book_logged', { amount: e.amount, category: e.category, repeat: cols.repeat });
  return { warning: await settle(profileId) };
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

export async function editEntry(profileId: string, id: string, body: Record<string, unknown>): Promise<{ warning: string | null }> {
  const { anchor, today } = await bookOf(profileId);
  const row = await loggedRow(profileId, id);
  const e = entryOf(body, today);
  const cols = entryColumns(e, anchor.currency);
  const series = seriesOf(row.fingerprint);
  // Turning a repeat off stops the whole series, not this one row: otherwise
  // the next one it already wrote would carry on repeating by itself.
  if (row.repeat && !cols.repeat && series) await stopSeries(profileId, series, today);
  const { error } = await copilotDb().from('copilot_transactions').update(cols).eq('profile_id', profileId).eq('id', id);
  if (error) throw new Error(describeDbError(error, 'Could not save that.'));
  await namePayee(profileId, cols.counterparty_key);
  if (cols.repeat) {
    const r = await materializeRepeats(profileId, today);
    if (r.error) throw new Error(`Saved, but its next repeat could not be written: ${r.error}`);
  }
  return { warning: await settle(profileId) };
}

/**
 * A logged row gone. An upcoming repeat deleted stops its series — the row
 * before it would otherwise write it again the next time the book opened — and
 * the sheet says so before the tap.
 */
export async function deleteEntry(profileId: string, id: string): Promise<{ stopped: boolean; warning: string | null }> {
  const { today } = await bookOf(profileId);
  const row = await loggedRow(profileId, id);
  const series = seriesOf(row.fingerprint);
  const stops = !!series && row.posted_on > today && !!row.repeat;
  if (stops) await stopSeries(profileId, series!, today);
  const { error } = await copilotDb().from('copilot_transactions').delete().eq('profile_id', profileId).eq('id', id);
  if (error) throw new Error(describeDbError(error, 'Could not delete that.'));
  return { stopped: stops, warning: await settle(profileId) };
}

/**
 * The balance the book starts from — or restarts from: said again, it replaces
 * the last, and only rows logged after it move it. Runway reads it at once.
 */
export async function setBookBalance(profileId: string, body: Record<string, unknown>): Promise<{ warning: string | null }> {
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
  const book: BookAnchorRow = { currency, balance: Math.round(raw * 100) / 100, at: new Date().toISOString(), on: todayIso(profile.timezone) };
  const finance: Finance = { ...(profile.finance ?? {}), book };
  const { error } = await copilotDb().from('copilot_profiles').update({ finance }).eq('id', profileId);
  if (error) throw new Error(describeDbError(error, 'Could not save your balance.'));
  await logEvent(profileId, 'book_balance', { currency, balance: book.balance, restart: !!was });
  return { warning: await settle(profileId) };
}
