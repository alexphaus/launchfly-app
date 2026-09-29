// src/lib/copilot/money/store.ts
// Data access for money read from the bank: statements in, rows out, and the
// numbers the rest of the app reads kept in step with them.
//
// Every function takes a profileId already authenticated by the session cookie,
// like ../store.ts. The arithmetic is in statement.ts and ledger.ts, where the
// tests reach it; this file only reads and writes rows.
//
// Two rules the whole file keeps:
//
//   A missing table is the unapplied 20260929, reported as `ready: false` — the
//   sheet says the feature is not set up — never as an account with no
//   statements. Any other failed read is said as unreadable (invariant 13).
//
//   Nothing a reading proposes is used until it has proved itself or the person
//   has looked: a `review` import keeps its rows in `pending`, and only
//   confirmImport moves them into copilot_transactions.

import { getProfile, logEvent } from '../base';
import { copilotDb, describeDbError, todayIso } from '../db';
import { recordOutcome } from '../outcomes';
import type { Finance, Profile } from '../types';
import {
  WIN_MATCH_DAYS, WIN_RECORD_DAYS, financeFromRead, financeWithoutStatements, importView, matchWin, moneyRead,
  winsToRecord, type AccountBalance, type LedgerTx, type MoneyImport, type MoneyRead, type Payee, type PayeeRole,
} from './ledger';
import {
  accountKey, cents, checkBalances, displayName, rowFingerprints, rowKey,
  type BalanceCheck, type Statement, type StatementFormat, type StatementRow,
} from './statement';

/**
 * A request the person's own data refuses — a payer not on their statements, a
 * business not theirs, a statement not waiting on them. A 400, not a 500: the
 * server is fine, the answer is no.
 */
export class MoneyRefusal extends Error {}

const IMPORT_COLS = 'id, file_name, format, method, status, balance_check, check_detail, currency, period_start, period_end, rows_found, rows_new, rows_dropped, total_in, total_out, error, note, started_at, finished_at';
/** A year and a month of rows: the read says "last 12 months", and the extra month keeps a bill's rhythm visible across the edge. */
const TX_READ_DAYS = 400;
/** Rows read at most. Past this the oldest fall out of the read, never the newest. */
const TX_READ_MAX = 6000;
/** PostgREST returns at most this many rows a request on Supabase, so reads and writes go in pages of it. */
const PAGE = 1000;

export interface MoneyRows {
  ready: boolean;
  imports: MoneyImport[];
  txs: LedgerTx[];
  payees: Payee[];
  accounts: AccountBalance[];
  unreadable: string | null;
}

type DbError = { code?: string; message?: string } | null;

/** 42P01 from Postgres, PGRST205 from a PostgREST that has not seen the table. Both mean 20260929 is not in. */
function isMissingTable(e: DbError): boolean {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''));
}

const accountLabel = (a: { label?: string | null; institution?: string | null; mask?: string | null }) =>
  a.label || [a.institution, a.mask ? `••${a.mask}` : null].filter(Boolean).join(' ') || 'Your statements';

/** Everything the money read is computed from. Never throws. */
export async function loadMoneyRows(profileId: string, now = new Date()): Promise<MoneyRows> {
  const db = copilotDb();
  const since = new Date(now.getTime() - TX_READ_DAYS * 86_400_000).toISOString().slice(0, 10);
  const empty: MoneyRows = { ready: true, imports: [], txs: [], payees: [], accounts: [], unreadable: null };

  const txRead = (async (): Promise<{ rows: Array<Record<string, unknown>>; error: DbError }> => {
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; from < TX_READ_MAX; from += PAGE) {
      const { data, error } = await db.from('copilot_transactions')
        .select('id, posted_on, amount, currency, counterparty_key, account_id, outcome_id, description')
        .eq('profile_id', profileId).gte('posted_on', since)
        .order('posted_on', { ascending: false }).order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { rows, error };
      rows.push(...((data ?? []) as Array<Record<string, unknown>>));
      if ((data ?? []).length < PAGE) break;
    }
    return { rows, error: null };
  })();

  const [imp, tx, cp, acc] = await Promise.all([
    db.from('copilot_money_imports').select(IMPORT_COLS).eq('profile_id', profileId).order('started_at', { ascending: false }).limit(12),
    txRead,
    db.from('copilot_counterparties').select('key, name, role, opportunity_id').eq('profile_id', profileId).limit(PAGE),
    db.from('copilot_money_accounts').select('id, label, institution, mask, currency, balance, balance_on').eq('profile_id', profileId),
  ]);
  const errors = [imp.error, tx.error, cp.error, acc.error] as DbError[];
  if (errors.some(isMissingTable)) return { ...empty, ready: false };
  const failed = errors.find((e) => e);
  if (failed) return { ...empty, unreadable: describeDbError(failed, 'Could not read your statements.') };

  return {
    ready: true,
    imports: ((imp.data ?? []) as Array<Record<string, unknown>>).map((r) => importView(r, now)),
    txs: tx.rows.map((r) => ({
      id: String(r.id),
      on: String(r.posted_on).slice(0, 10),
      amount: Number(r.amount),
      currency: (r.currency as string | null) ?? null,
      key: String(r.counterparty_key),
      accountId: (r.account_id as string | null) ?? null,
      outcomeId: (r.outcome_id as string | null) ?? null,
      description: (r.description as string | null) ?? undefined,
    })),
    payees: ((cp.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      key: String(r.key),
      name: String(r.name || displayName(String(r.key))),
      role: (['client', 'employer', 'self', 'other'] as const).find((x) => x === r.role) ?? null,
      opportunityId: (r.opportunity_id as string | null) ?? null,
    })),
    accounts: ((acc.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      label: accountLabel(r as { label?: string; institution?: string; mask?: string }),
      currency: (r.currency as string | null) ?? null,
      balance: r.balance == null ? null : Number(r.balance),
      on: r.balance_on ? String(r.balance_on).slice(0, 10) : null,
    })),
    unreadable: null,
  };
}

/**
 * Just the statements, for the screen to poll while one is being read — the
 * whole home is a few dozen queries, and this runs every few seconds.
 * Throws on a failed read: a poller that took "no rows" for "nothing reading"
 * would stop watching one still going.
 */
export async function loadImports(profileId: string): Promise<MoneyImport[]> {
  const { data, error } = await copilotDb().from('copilot_money_imports').select(IMPORT_COLS)
    .eq('profile_id', profileId).order('started_at', { ascending: false }).limit(12);
  if (error) throw new Error(describeDbError(error, 'Could not check on your statements.'));
  const now = new Date();
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => importView(r, now));
}

/** The currency a read is printed in when the rows carry none: the finance row's, else a money goal's, else "$". */
export async function moneyCurrency(profileId: string, profile?: Profile | null): Promise<string> {
  const p = profile ?? await getProfile(profileId);
  if (p?.finance?.currency) return p.finance.currency;
  const { data } = await copilotDb().from('copilot_goals').select('unit').eq('profile_id', profileId).eq('metric', 'currency').eq('status', 'active').order('priority').limit(1).maybeSingle();
  return (data?.unit as string | undefined) || '$';
}

/* ─── A statement in ──────────────────────────────────────────────────────── */

/**
 * The row an import reports on. `link` is the seam for a bank link: its sync
 * starts one of these with source, format and method 'link', and hands the
 * rows its provider returned to finishImport — the same dedupe, the same
 * check, the same read. No link provider exists yet, so nothing on screen
 * offers one (invariant 7); the table already has room for its accounts.
 */
export async function startImport(profileId: string, meta: { fileName: string; format: StatementFormat | 'link'; method: 'parsed' | 'read' | 'link'; source?: 'upload' | 'link' }): Promise<MoneyImport> {
  const { data, error } = await copilotDb().from('copilot_money_imports').insert({
    profile_id: profileId, source: meta.source ?? 'upload', file_name: meta.fileName.slice(0, 160), format: meta.format, method: meta.method, status: 'reading',
  }).select(IMPORT_COLS).single();
  if (error) {
    if (isMissingTable(error)) throw new Error('Statements are not set up on this server yet: apply supabase/migrations/20260929_copilot_money.sql.');
    throw new Error(describeDbError(error, 'Could not start reading that statement.'));
  }
  return importView(data as Record<string, unknown>, new Date());
}

/** Why it could not be read, on the row the sheet reads. Never throws: the failure is already the news. */
export async function failImport(importId: string, reason: string): Promise<void> {
  const { error } = await copilotDb().from('copilot_money_imports')
    .update({ status: 'failed', error: reason.slice(0, 600), finished_at: new Date().toISOString() }).eq('id', importId);
  // The row stays "reading" and reads as stopped after IMPORT_STALE_MS. Late, never "fine".
  if (error) console.error(`[copilot/money] could not mark import ${importId} failed; it will read as stopped:`, error.message);
}

interface Pending {
  accountId: string;
  currency: string | null;
  closing: number | null;
  rows: StatementRow[];
  fingerprints: string[];
}

/**
 * A statement, read, into the ledger — or into `review`, when it could not
 * vouch for itself. Returns the import as the sheet will show it.
 *
 *   parsed or link + anything but unbalanced   in, now: the bank wrote those rows
 *   read + balanced                            in, now: the arithmetic vouched for it
 *   everything else                            review: the person sees the totals first
 *
 * `provider` names where the rows came from — 'upload', or a bank link's
 * aggregator — and keys the account with it, so one bank uploaded and later
 * linked are two accounts until the person says otherwise.
 */
export async function finishImport(
  profileId: string,
  importId: string,
  input: { statement: Statement; dropped: number; truncated?: number; method: 'parsed' | 'read' | 'link'; provider?: string },
): Promise<MoneyImport> {
  const db = copilotDb();
  const st = input.statement;
  if (!st.rows.length) {
    await failImport(importId, input.method === 'read'
      ? 'No transactions could be read from it. If it is a statement, try the CSV or OFX from your bank’s website.'
      : 'No transactions came out of that file.');
    return reloadImport(profileId, importId);
  }
  const checked = checkBalances(st);
  const ready = input.method === 'read' ? checked.check === 'balanced' : checked.check !== 'unbalanced';
  const rows = checked.rows;
  const provider = input.provider ?? 'upload';

  const account = await upsertAccount(profileId, provider, st);
  const fingerprints = rowFingerprints(accountKey(provider, st.account), rows);
  const totalIn = rows.filter((r) => r.amount > 0).reduce((a, r) => a + cents(r.amount), 0) / 100;
  const totalOut = rows.filter((r) => r.amount < 0).reduce((a, r) => a - cents(r.amount), 0) / 100;
  const periodStart = rows.reduce((a, r) => (r.on < a ? r.on : a), rows[0].on);
  const periodEnd = rows.reduce((a, r) => (r.on > a ? r.on : a), rows[0].on);
  const dropped = input.dropped + (input.truncated ?? 0);

  const base = {
    account_id: account.id,
    balance_check: checked.check as BalanceCheck,
    check_detail: checked.detail,
    currency: st.currency,
    period_start: periodStart,
    period_end: periodEnd,
    opening_balance: checked.opening,
    closing_balance: checked.closing,
    rows_found: rows.length,
    rows_dropped: dropped,
    total_in: totalIn,
    total_out: totalOut,
    finished_at: new Date().toISOString(),
  };

  if (!ready) {
    const pending: Pending = { accountId: account.id, currency: st.currency, closing: checked.closing, rows, fingerprints };
    const { error } = await db.from('copilot_money_imports').update({ ...base, status: 'review', pending }).eq('id', importId);
    if (error) throw new Error(describeDbError(error, 'Could not save what was read.'));
    await logEvent(profileId, 'statement_review', { import_id: importId, rows: rows.length, check: checked.check });
    return reloadImport(profileId, importId);
  }

  const rowsNew = await commitRows(profileId, importId, { accountId: account.id, currency: st.currency, closing: checked.closing, rows, fingerprints });
  const { error } = await db.from('copilot_money_imports').update({ ...base, status: 'ready', rows_new: rowsNew, pending: null }).eq('id', importId);
  if (error) throw new Error(describeDbError(error, 'The rows are in, but the statement could not be marked read.'));
  await afterRowsLanded(profileId, importId, 'system');
  await logEvent(profileId, 'statement_imported', { import_id: importId, rows: rows.length, new: rowsNew, check: checked.check, method: input.method });
  return reloadImport(profileId, importId);
}

async function reloadImport(profileId: string, importId: string): Promise<MoneyImport> {
  const { data } = await copilotDb().from('copilot_money_imports').select(IMPORT_COLS).eq('profile_id', profileId).eq('id', importId).maybeSingle();
  return importView((data ?? { id: importId, status: 'failed', error: 'The statement row could not be read back.' }) as Record<string, unknown>, new Date());
}

async function upsertAccount(profileId: string, provider: string, st: Statement): Promise<{ id: string }> {
  const { data, error } = await copilotDb().from('copilot_money_accounts').upsert({
    profile_id: profileId,
    provider,
    external_key: accountKey(provider, st.account),
    institution: st.account.institution,
    mask: st.account.mask,
    currency: st.currency,
  }, { onConflict: 'profile_id,provider,external_key' }).select('id').single();
  if (error) throw new Error(describeDbError(error, 'Could not save the account this statement is from.'));
  return { id: String(data.id) };
}

/**
 * The rows into copilot_transactions, a page at a time. A row already there —
 * the same fingerprint from an overlapping statement — is skipped by the
 * database, not by a read beforehand, so two uploads racing cannot double it.
 * Returns how many were new.
 */
async function commitRows(profileId: string, importId: string, p: Pending): Promise<number> {
  const db = copilotDb();
  const payload = p.rows.map((r, i) => ({
    profile_id: profileId,
    account_id: p.accountId,
    import_id: importId,
    fingerprint: p.fingerprints[i],
    posted_on: r.on,
    amount: cents(r.amount) / 100,
    currency: p.currency,
    description: r.description.slice(0, 300),
    counterparty_key: rowKey(r),
    balance_after: r.balance == null ? null : cents(r.balance) / 100,
  }));
  let inserted = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const { data, error } = await db.from('copilot_transactions')
      .upsert(payload.slice(i, i + 500), { onConflict: 'profile_id,fingerprint', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(describeDbError(error, 'Could not save the transactions.'));
    inserted += (data ?? []).length;
  }
  // Everybody on the statement gets a row to be named on, once.
  const keys = [...new Set(payload.map((r) => r.counterparty_key))];
  for (let i = 0; i < keys.length; i += 500) {
    const { error } = await db.from('copilot_counterparties')
      .upsert(keys.slice(i, i + 500).map((key) => ({ profile_id: profileId, key, name: displayName(key) })), { onConflict: 'profile_id,key', ignoreDuplicates: true });
    if (error) throw new Error(describeDbError(error, 'Could not save who the statement names.'));
  }
  await recomputeBalances(profileId);
  return inserted;
}

/**
 * Each account's balance: the latest one the rows carry, or a statement's
 * closing figure when that is later. Recomputed rather than updated in place,
 * so removing a statement takes its balance with it.
 */
async function recomputeBalances(profileId: string): Promise<void> {
  const db = copilotDb();
  const { data: accounts } = await db.from('copilot_money_accounts').select('id').eq('profile_id', profileId);
  for (const a of (accounts ?? []) as Array<{ id: string }>) {
    const [tx, imp] = await Promise.all([
      db.from('copilot_transactions').select('posted_on, balance_after').eq('profile_id', profileId).eq('account_id', a.id)
        .not('balance_after', 'is', null).order('posted_on', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('copilot_money_imports').select('period_end, closing_balance').eq('profile_id', profileId).eq('account_id', a.id)
        .eq('status', 'ready').not('closing_balance', 'is', null).order('period_end', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const fromRow = tx.data ? { on: String(tx.data.posted_on).slice(0, 10), balance: Number(tx.data.balance_after) } : null;
    const fromImport = imp.data ? { on: String(imp.data.period_end).slice(0, 10), balance: Number(imp.data.closing_balance) } : null;
    const best = fromRow && fromImport ? (fromImport.on > fromRow.on ? fromImport : fromRow) : fromRow ?? fromImport;
    await db.from('copilot_money_accounts').update({ balance: best?.balance ?? null, balance_on: best?.on ?? null }).eq('id', a.id);
  }
}

/**
 * What changes when rows land, change or go: the finance row every other part
 * of the app reads, and the wins a client's deposits become. A failure here is
 * written on the statement's own row as its note — the rows are in, and the
 * sheet says what did not follow them.
 */
async function afterRowsLanded(profileId: string, importId: string | null, source: 'manual' | 'system'): Promise<void> {
  const problems: string[] = [];
  try { await refreshFinance(profileId); } catch (e) { problems.push(`Runway was not updated: ${e instanceof Error ? e.message : String(e)}`); }
  const wins = await recordClientWins(profileId, { source });
  if (wins.error) problems.push(wins.error);
  if (problems.length && importId) {
    const { error } = await copilotDb().from('copilot_money_imports').update({ note: problems.join(' ').slice(0, 600) }).eq('id', importId);
    if (error) console.error('[copilot/money] could not note what failed after an import:', problems, error.message);
  }
  if (problems.length && !importId) throw new Error(problems.join(' '));
}

/* ─── The finance row ─────────────────────────────────────────────────────── */

/**
 * Cash and burn from the rows, into the finance row — where metrics, the
 * forecast, the runway guard, scoreMove and the plan already read them. A
 * number the person typed after the statement's own date is left alone.
 */
export async function refreshFinance(profileId: string): Promise<MoneyRead | null> {
  const profile = await getProfile(profileId);
  if (!profile) return null;
  const rows = await loadMoneyRows(profileId);
  if (!rows.ready) return null;
  if (rows.unreadable) throw new Error(rows.unreadable);
  const read = moneyRead({ txs: rows.txs, payees: rows.payees, accounts: rows.accounts, today: todayIso(profile.timezone), currency: await moneyCurrency(profileId, profile) });
  const prev: Finance = profile.finance ?? {};
  const now = new Date().toISOString();
  const next = read ? financeFromRead(prev, read, now) : financeWithoutStatements(prev, now);
  if (next === prev || JSON.stringify(next) === JSON.stringify(prev)) return read;
  const { error } = await copilotDb().from('copilot_profiles').update({ finance: next }).eq('id', profileId);
  if (error) throw new Error(describeDbError(error, 'Could not update runway.'));
  return read;
}

/* ─── Deposits into wins ──────────────────────────────────────────────────── */

/**
 * Every recent deposit from a client, as a `won` outcome — or attached to the
 * win already logged by hand for the same money, so nothing counts twice.
 * `source` is 'manual' when the person's naming a payer caused it and 'system'
 * when a new statement brought money from somebody they had already named.
 */
export async function recordClientWins(profileId: string, opts: { keys?: string[]; source: 'manual' | 'system' }): Promise<{ recorded: number; attached: number; error: string | null }> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) return { recorded: 0, attached: 0, error: null };
  const rows = await loadMoneyRows(profileId);
  if (!rows.ready) return { recorded: 0, attached: 0, error: null };
  if (rows.unreadable) return { recorded: 0, attached: 0, error: `Wins were not recorded: ${rows.unreadable}` };
  const today = todayIso(profile.timezone);
  const due = winsToRecord({ txs: rows.txs, payees: rows.payees, today, keys: opts.keys });
  if (!due.length) return { recorded: 0, attached: 0, error: null };

  const since = new Date(Date.now() - (WIN_RECORD_DAYS + WIN_MATCH_DAYS + 2) * 86_400_000).toISOString();
  const [wins, linked] = await Promise.all([
    db.from('copilot_outcomes').select('id, amount, occurred_at').eq('profile_id', profileId).eq('kind', 'won').gte('occurred_at', since),
    db.from('copilot_transactions').select('outcome_id').eq('profile_id', profileId).not('outcome_id', 'is', null).limit(PAGE),
  ]);
  if (wins.error || linked.error) return { recorded: 0, attached: 0, error: `Wins were not recorded: ${describeDbError(wins.error ?? linked.error)}` };
  const taken = new Set(((linked.data ?? []) as Array<{ outcome_id: string }>).map((x) => x.outcome_id));
  const payee = new Map(rows.payees.map((p) => [p.key, p]));
  const currency = profile.finance?.currency ?? null;

  let recorded = 0;
  let attached = 0;
  const failures: string[] = [];
  for (const tx of due) {
    try {
      let outcomeId = matchWin(tx, (wins.data ?? []) as Array<{ id: string; amount: number | null; occurred_at: string }>, taken);
      if (outcomeId) attached++;
      else {
        const o = await recordOutcome(profileId, {
          kind: 'won',
          amount: tx.amount,
          currency: tx.currency ?? currency,
          note: `From your bank: ${(tx.description ?? payee.get(tx.key)?.name ?? tx.key).slice(0, 200)}`,
          opportunity_id: payee.get(tx.key)?.opportunityId ?? null,
          source: opts.source,
          // Noon on the day it posted: a date, not an instant, and never tomorrow in anybody's timezone.
          occurred_at: `${tx.on}T12:00:00.000Z`,
        });
        outcomeId = o.id;
        recorded++;
      }
      taken.add(outcomeId);
      const { error } = await db.from('copilot_transactions').update({ outcome_id: outcomeId }).eq('profile_id', profileId).eq('id', tx.id);
      if (error) failures.push(describeDbError(error));
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e));
    }
  }
  const error = failures.length ? `${failures.length} of ${due.length} deposits could not be recorded as wins: ${failures[0]}` : null;
  return { recorded, attached, error };
}

/* ─── The person's answers ────────────────────────────────────────────────── */

/**
 * Who a payer or payee is. The only way a role is ever set — nothing infers
 * one — and it moves the numbers: "my own account" leaves income and spending,
 * and "a client" turns their recent deposits into wins.
 */
export async function nameCounterparty(profileId: string, key: string, role: PayeeRole | null, opportunityId: string | null): Promise<{ recorded: number; attached: number }> {
  const db = copilotDb();
  const { data: existing, error: readError } = await db.from('copilot_counterparties').select('name').eq('profile_id', profileId).eq('key', key).maybeSingle();
  if (readError) throw new Error(describeDbError(readError, 'Could not read that payer.'));
  if (!existing) throw new MoneyRefusal('That payer is not on any of your statements.');
  // The business comes from the request, and a win recorded against it closes it:
  // it has to be one of this person's, or a client of somebody else's could be touched.
  if (role === 'client' && opportunityId) {
    const { data: opp, error: oppError } = await db.from('copilot_opportunities').select('id').eq('profile_id', profileId).eq('id', opportunityId).maybeSingle();
    if (oppError) throw new Error(describeDbError(oppError, 'Could not check that business.'));
    if (!opp) throw new MoneyRefusal('That business is not one of yours.');
  }
  const { error } = await db.from('copilot_counterparties').update({
    role,
    // A link only means something for a client.
    opportunity_id: role === 'client' ? opportunityId : null,
    named_at: role ? new Date().toISOString() : null,
  }).eq('profile_id', profileId).eq('key', key);
  if (error) throw new Error(describeDbError(error, 'Could not save that.'));
  await logEvent(profileId, 'counterparty_named', { role, linked: !!opportunityId });
  await refreshFinance(profileId);
  if (role !== 'client') return { recorded: 0, attached: 0 };
  const wins = await recordClientWins(profileId, { keys: [key], source: 'manual' });
  if (wins.error) throw new Error(wins.error);
  return { recorded: wins.recorded, attached: wins.attached };
}

/** A reading that waited for the person: they looked at the totals and they match. */
export async function confirmImport(profileId: string, importId: string): Promise<void> {
  const db = copilotDb();
  const { data, error } = await db.from('copilot_money_imports').select('status, pending').eq('profile_id', profileId).eq('id', importId).maybeSingle();
  if (error) throw new Error(describeDbError(error, 'Could not read that statement.'));
  if (!data) throw new MoneyRefusal('That statement is not on file any more.');
  if (data.status !== 'review') throw new MoneyRefusal('That statement is not waiting on you.');
  const pending = data.pending as Pending | null;
  if (!pending?.rows?.length) throw new MoneyRefusal('Nothing is waiting on that statement. Upload it again.');
  const rowsNew = await commitRows(profileId, importId, pending);
  const { error: e2 } = await db.from('copilot_money_imports')
    .update({ status: 'ready', rows_new: rowsNew, pending: null, confirmed_at: new Date().toISOString() })
    .eq('profile_id', profileId).eq('id', importId);
  if (e2) throw new Error(describeDbError(e2, 'The rows are in, but the statement could not be marked read.'));
  await logEvent(profileId, 'statement_confirmed', { import_id: importId, new: rowsNew });
  await afterRowsLanded(profileId, importId, 'system');
}

/**
 * A statement removed, and the rows it brought in with it — and its account,
 * when nothing else is left on it, so an empty account does not linger as one
 * "with no balance". Wins its deposits became stay: they are the person's
 * record of work, and the sheet says so before they tap.
 */
export async function discardImport(profileId: string, importId: string): Promise<void> {
  const db = copilotDb();
  const { error } = await db.from('copilot_money_imports').delete().eq('profile_id', profileId).eq('id', importId);
  if (error) throw new Error(describeDbError(error, 'Could not remove that statement.'));
  const { data: accounts } = await db.from('copilot_money_accounts').select('id').eq('profile_id', profileId);
  for (const a of (accounts ?? []) as Array<{ id: string }>) {
    const [tx, imp] = await Promise.all([
      db.from('copilot_transactions').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('account_id', a.id),
      db.from('copilot_money_imports').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('account_id', a.id),
    ]);
    if (!tx.error && !imp.error && !tx.count && !imp.count) await db.from('copilot_money_accounts').delete().eq('id', a.id);
  }
  await recomputeBalances(profileId);
  await refreshFinance(profileId);
}

/**
 * Every row this app read off somebody's bank, gone: transactions, statements,
 * payers, accounts — and the cash and burn that came from them. Wins already
 * recorded stay: they are the person's record of work, not bank data.
 */
export async function forgetMoney(profileId: string): Promise<void> {
  const db = copilotDb();
  for (const table of ['copilot_transactions', 'copilot_money_imports', 'copilot_counterparties', 'copilot_money_accounts']) {
    const { error } = await db.from(table).delete().eq('profile_id', profileId);
    if (error && !isMissingTable(error)) throw new Error(describeDbError(error, 'Could not delete your statement data.'));
  }
  const profile = await getProfile(profileId);
  if (profile) {
    const next = financeWithoutStatements(profile.finance ?? {}, new Date().toISOString());
    const { error } = await db.from('copilot_profiles').update({ finance: next }).eq('id', profileId);
    if (error) throw new Error(describeDbError(error, 'Your statement rows are gone, but runway still shows their numbers.'));
  }
  await logEvent(profileId, 'statements_forgotten', {});
}
