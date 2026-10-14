// src/lib/copilot/workstore.ts
// Reads and writes the work layer's rows: hand-overs, checks, calls waiting on
// the person, their accounts and their repeats (worklog.ts, accounts.ts,
// repeats.ts say what each row is). All copilot_events; no table of its own.
//
// Every read degrades to empty and says so in `unreadable` (invariant 13): an
// empty hand-over log is also what a brand-new account looks like, so a read
// that failed must not render as one.

import { copilotDb, describeDbError } from './db';
import { ACCOUNT_EVENTS, accountsOf, type Account } from './accounts';
import { REPEAT_EVENTS, repeatsOf, type RepeatRule, type RepeatRun, type RepeatSkip } from './repeats';
import { WORK_EVENTS, workOf, type WorkLog } from './worklog';
import type { Commission } from './commission';

/** Rows of hand-over history read per load: years of nights for three live jobs and a dozen closed. */
export const WORK_ROW_LIMIT = 800;

const emptyLog = (): WorkLog => workOf([]);

export async function loadWork(profileId: string, commissionIds: string[]): Promise<{ log: WorkLog; unreadable: string | null }> {
  if (!commissionIds.length) return { log: emptyLog(), unreadable: null };
  try {
    const { data, error } = await copilotDb().from('copilot_events')
      .select('event_type, payload, created_at')
      .eq('profile_id', profileId)
      .in('event_type', [...WORK_EVENTS])
      .in('payload->>commission_id', commissionIds)
      .order('created_at', { ascending: false })
      .limit(WORK_ROW_LIMIT);
    if (error) return { log: emptyLog(), unreadable: describeDbError(error) };
    return { log: workOf((data ?? []) as Array<{ event_type: string; payload: unknown; created_at: string }>), unreadable: null };
  } catch (e) {
    return { log: emptyLog(), unreadable: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * One row of the work layer. Throws with the reason: every caller either says
 * it on screen or carries it into the job's error, because a hand-over whose
 * record did not save is a job the crew's record will not count.
 */
export async function recordWork(profileId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await copilotDb().from('copilot_events').insert({ profile_id: profileId, event_type: type, payload });
  if (error) throw new Error(describeDbError(error, `Could not record ${type.replace(/_/g, ' ')}.`));
}

export async function loadAccounts(profileId: string): Promise<{ vault: string | null; accounts: Account[]; unreadable: string | null }> {
  try {
    const { data, error } = await copilotDb().from('copilot_events')
      .select('event_type, payload, created_at')
      .eq('profile_id', profileId).in('event_type', [...ACCOUNT_EVENTS])
      .order('created_at', { ascending: false }).limit(200);
    if (error) return { vault: null, accounts: [], unreadable: describeDbError(error) };
    return { ...accountsOf((data ?? []) as Array<{ event_type: string; payload: unknown; created_at: string }>), unreadable: null };
  } catch (e) {
    return { vault: null, accounts: [], unreadable: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The repeats, not filtered by job: a job set to repeat can be older than the
 * window loadCommissions keeps, and a rule that only loaded while its job was in
 * that window would stop the week the twelfth newer job closed, with nothing said.
 */
export async function loadRepeats(profileId: string): Promise<{ rules: RepeatRule[]; runs: RepeatRun[]; skips: RepeatSkip[]; unreadable: string | null }> {
  try {
    const { data, error } = await copilotDb().from('copilot_events')
      .select('event_type, payload, created_at')
      .eq('profile_id', profileId).in('event_type', [...REPEAT_EVENTS])
      .order('created_at', { ascending: false }).limit(400);
    if (error) return { rules: [], runs: [], skips: [], unreadable: describeDbError(error) };
    return { ...repeatsOf((data ?? []) as Array<{ event_type: string; payload: unknown; created_at: string }>), unreadable: null };
  } catch (e) {
    return { rules: [], runs: [], skips: [], unreadable: e instanceof Error ? e.message : String(e) };
  }
}

const COMMISSION_COLS = 'id, goal_id, objective, why, authority, budget_minutes, status, plan, created_at, approved_at, last_run_at, closed_at, outcome, seen_at';

/** Jobs by id, for the ones a repeat names that the usual window no longer holds. */
export async function loadCommissionsById(profileId: string, ids: string[]): Promise<Commission[]> {
  if (!ids.length) return [];
  const { data, error } = await copilotDb().from('copilot_commissions').select(COMMISSION_COLS).eq('profile_id', profileId).in('id', ids);
  if (error) throw new Error(describeDbError(error, 'Could not read the jobs set to repeat.'));
  return ((data ?? []) as unknown as Commission[]).map((c) => ({ ...c, plan: Array.isArray(c.plan) ? c.plan : [] }));
}

/** The job a session or a post-back names, with whose it is. Read from the row, never taken from the caller. */
export async function commissionOwner(id: string): Promise<string | null> {
  const { data } = await copilotDb().from('copilot_commissions').select('profile_id').eq('id', id).maybeSingle();
  return (data as { profile_id?: string } | null)?.profile_id ?? null;
}

/**
 * What the person said each job was worth when they closed it, by job. A worker's
 * record counts these all time, never over a window it would not name. Empty
 * when the ledger's commission_id has not shipped (20260921): the record then
 * says nothing about worth rather than a number short of the truth.
 */
export async function loadWorth(profileId: string, commissionIds: string[]): Promise<Map<string, string>> {
  if (!commissionIds.length) return new Map();
  const { data, error } = await copilotDb().from('copilot_outcomes').select('commission_id, kind')
    .eq('profile_id', profileId).in('commission_id', commissionIds);
  if (error) return new Map();
  return new Map(((data ?? []) as Array<{ commission_id: string | null; kind: string }>).filter((r) => r.commission_id).map((r) => [r.commission_id as string, r.kind]));
}
