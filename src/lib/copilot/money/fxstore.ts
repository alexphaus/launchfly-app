// src/lib/copilot/money/fxstore.ts
// The rates the conversions need: from copilot_fx_rates when they are there,
// fetched once from the ECB's reference rates when they are not.
//
// Called on every home load, so the common case is one small query and no
// network. A span is fetched only when the rates on file do not reach it
// (fx.ts covers), a pair that just failed is not asked again for a while — a
// rate service that is down must not add six seconds to every open — and a
// table that is not there yet (20260930 unapplied) falls back to this
// process's memory rather than to no conversion at all.
//
// Never throws. What could not be had is returned as a sentence per pair, and
// the read says it beside the rows it left out (invariant 13).

import { copilotDb } from '../db';
import { NO_RATES, covers, fxTable, parseRates, type FxNeed, type FxRow, type FxTable } from './fx';

const FX_URL = () => (process.env.COPILOT_FX_URL?.trim() || 'https://api.frankfurter.dev/v1').replace(/\/+$/, '');
/** Past this a fetch is abandoned: the screen is waiting on it. */
const FETCH_TIMEOUT_MS = 6000;
/** A pair that failed is not asked again for this long — per server process. */
const RETRY_AFTER_MS = 15 * 60_000;
/** A pair fetched this recently is not asked again even if the answer stopped short (a holiday week). */
const REFETCH_AFTER_MS = 6 * 60 * 60_000;
/** Days fetched before a need starts, so its first row has a business day behind it. */
const LEAD_DAYS = 7;

/** Rates kept here when copilot_fx_rates is not there yet. */
const memory = new Map<string, FxRow[]>();
const attempts = new Map<string, { at: number; ok: boolean }>();

type DbError = { code?: string; message?: string } | null;
const isMissingTable = (e: DbError) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''));
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export interface LoadedRates {
  table: FxTable;
  /** Why a pair has no rate, keyed by the currency converted from: a phrase to sit after a colon, lower case, no full stop. */
  missing: Record<string, string>;
  /** False when copilot_fx_rates is not there: rates are held in memory, and health says so. */
  cached: boolean;
}

async function readCached(needs: FxNeed[]): Promise<{ rows: FxRow[]; cached: boolean }> {
  const to = needs[0].to;
  const start = shift(needs.reduce((a, n) => (n.start < a ? n.start : a), needs[0].start), -LEAD_DAYS);
  const end = needs.reduce((a, n) => (n.end > a ? n.end : a), needs[0].end);
  const froms = [...new Set(needs.map((n) => n.from))];
  const rows: FxRow[] = [];
  // Both directions: a pair fetched the other way round is still a rate.
  for (let page = 0; page < 20; page++) {
    const { data, error } = await copilotDb().from('copilot_fx_rates').select('base, quote, day, rate')
      .or(`and(quote.eq.${to},base.in.(${froms.join(',')})),and(base.eq.${to},quote.in.(${froms.join(',')}))`)
      .gte('day', start).lte('day', end).order('day').range(page * 1000, page * 1000 + 999);
    if (error) {
      if (isMissingTable(error)) return { rows: [...memory.values()].flat(), cached: false };
      // A cache that cannot be read is treated as empty: the fetch below still converts.
      return { rows: [...memory.values()].flat(), cached: true };
    }
    for (const r of (data ?? []) as Array<{ base: string; quote: string; day: string; rate: number | string }>) {
      rows.push({ base: r.base, quote: r.quote, day: String(r.day).slice(0, 10), rate: Number(r.rate) });
    }
    if ((data ?? []).length < 1000) break;
  }
  return { rows: [...rows, ...[...memory.values()].flat()], cached: true };
}

async function fetchSpan(need: FxNeed): Promise<{ rows: FxRow[]; error: string | null }> {
  const start = shift(need.start, -LEAD_DAYS);
  const url = `${FX_URL()}/${start}..${need.end}?base=${encodeURIComponent(need.from)}&symbols=${encodeURIComponent(need.to)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
    if (res.status === 404 || res.status === 422) return { rows: [], error: `the ECB publishes no rate for ${need.from}` };
    if (!res.ok) return { rows: [], error: `the exchange-rate service answered ${res.status}` };
    const rows = parseRates(await res.json(), need.from, need.to);
    return rows.length ? { rows, error: null } : { rows: [], error: `no ${need.from} to ${need.to} rate came back for those days` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], error: /abort|timeout/i.test(msg) ? 'the exchange-rate service did not answer in time' : `the exchange-rate service could not be reached (${msg})` };
  }
}

async function keep(rows: FxRow[], cached: boolean): Promise<void> {
  if (!rows.length) return;
  const key = `${rows[0].base}>${rows[0].quote}`;
  memory.set(key, [...(memory.get(key) ?? []), ...rows].slice(-2000));
  if (!cached) return;
  const payload = rows.map((r) => ({ base: r.base, quote: r.quote, day: r.day, rate: r.rate, source: 'ecb', fetched_at: new Date().toISOString() }));
  for (let i = 0; i < payload.length; i += 500) {
    // Kept in memory above either way: a cache write that fails costs the next
    // process a fetch, never this screen its conversion.
    await copilotDb().from('copilot_fx_rates').upsert(payload.slice(i, i + 500), { onConflict: 'base,quote,day' });
  }
}

/** The rates for every need, from the cache or the ECB. */
export async function loadRates(needs: FxNeed[], today: string): Promise<LoadedRates> {
  if (!needs.length) return { table: NO_RATES, missing: {}, cached: true };
  const { rows, cached } = await readCached(needs);
  let table = fxTable(rows);
  const missing: Record<string, string> = {};
  const now = Date.now();
  for (const need of needs) {
    const list = table.pairs.get(`${need.from}>${need.to}`) ?? [];
    const inverse = table.pairs.get(`${need.to}>${need.from}`) ?? [];
    const have = list.length ? list : inverse;
    if (covers({ first: have[0]?.day ?? null, last: have[have.length - 1]?.day ?? null }, need, today)) continue;
    const key = `${need.from}>${need.to}`;
    const last = attempts.get(key);
    if (last && now - last.at < (last.ok ? REFETCH_AFTER_MS : RETRY_AFTER_MS)) {
      if (!last.ok && !have.length) missing[need.from] = `no ${need.from} to ${need.to} rate yet — the last try failed, and it is tried again within 15 minutes`;
      continue;
    }
    const got = await fetchSpan(need);
    attempts.set(key, { at: now, ok: !got.error });
    if (got.error) { if (!have.length) missing[need.from] = got.error; continue; }
    await keep(got.rows, cached).catch(() => undefined);
    table = fxTable([...rows, ...[...memory.values()].flat()]);
  }
  return { table, missing, cached };
}
