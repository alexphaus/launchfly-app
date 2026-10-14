// src/lib/copilot/jobs/commission.ts
// Hand the live mandates to the hands that should have them, and surface what
// came back.
//
// This job does four things and deliberately not a fifth.
//
//   1. starts tonight's run of every job set to repeat (repeats.ts)
//   2. reads back the Claude agent's sessions — the webhook's fallback, because
//      a webhook is a hint that can be dropped and the session is the record
//   3. hands each active commission to a worker (workers.ts pickWorker): the
//      app's own Writer for writing, the Claude agent or the n8n workflow for
//      research, a person or a robot when the person chose one — and records
//      every hand-over, reached or not, so each worker's record is the app's
//      count and an unreachable one says so
//   4. turns anything blocked on the user into a Move, so a stalled mandate
//      competes for the morning through scoreMove like everything else
//
// It does NOT execute anything itself. No tools, no browser, no retry loop:
// those belong to the hands, and they change every six months, while the
// ledger and the ranking they report into do not. See the note at the top of
// commission.ts on why that split is where the value is. What it does hold is
// the contract: every result comes in through deliver.ts acceptWork, whoever
// sent it.

import { approveCommission, createCommission, loadCommissionEvents, loadCommissions, loadWorking, touchCommissionRun } from '../store';
import { AUTHORITY, blockedMove, commissionBrief, dueCommissions, reportOf, type Commission, type CommissionEvent } from '../commission';
import { expectationsOf, jobKindOf } from '../contract';
import { acceptWork } from '../deliver';
import { postToWebhook, registry, runWriter } from '../hands';
import { resumeSession, startSession, syncSession, type Resumed } from '../managed';
import { budgetCents, reachesWithAccounts } from '../managedwire';
import { REPEAT_SKIPPED, REPEAT_SPAWNED, dueRepeats } from '../repeats';
import { pickWorker, recordsOf } from '../workers';
import { WORK_DISPATCH, lastDispatch, sentBackIds } from '../worklog';
import { loadAccounts, loadCommissionsById, loadRepeats, loadWork, recordWork } from '../workstore';
import { workingBrief } from '../working';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

function resultUrl(commissionId: string): string | null {
  const base = process.env.NEXT_PUBLIC_COPILOT_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, '')}/api/copilot/commissions/${commissionId}/result` : null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Tonight's runs of the jobs set to repeat. Each is written and approved under
 * the standing grant the person made, so it is handed over in this same pass.
 * A run that finds no room is skipped and says so on the job, once a day.
 */
async function startRepeats(ctx: JobContext, all: Commission[]): Promise<{ started: number; notes: string[] }> {
  const pid = ctx.profile.id;
  const rep = await loadRepeats(pid);
  if (rep.unreadable) return { started: 0, notes: [`The jobs set to repeat could not be read: ${rep.unreadable}`] };
  if (!rep.rules.length) return { started: 0, notes: [] };
  const known = new Set(all.map((c) => c.id));
  const missing = [...new Set([...rep.rules.map((r) => r.template), ...rep.runs.map((r) => r.id)])].filter((id) => !known.has(id));
  const pool = [...all, ...(missing.length ? await loadCommissionsById(pid, missing) : [])];
  let started = 0;
  const notes: string[] = [];
  for (const { rule, template } of dueRepeats(rep.rules, rep.runs, pool, ctx.today)) {
    const t = pool.find((c) => c.id === template.id)!;
    try {
      const run = await createCommission(pid, {
        objective: t.objective, why: t.why, goal_id: t.goal_id, authority: 'read',
        budget_minutes: t.budget_minutes, plan: [], today: ctx.today,
      });
      if (!run) throw new Error('the run was not written');
      // Tied to its rule before it is approved: a run whose approval fails stays
      // a draft the person can see and approve, and holds the rule's one slot,
      // rather than becoming a stray the rule forgets and runs again beside.
      await recordWork(pid, REPEAT_SPAWNED, { commission_id: run.id, from: rule.template, every: rule.every });
      await approveCommission(pid, run.id, { today: ctx.today });
      started += 1;
    } catch (e) {
      const skippedToday = rep.skips.some((s) => s.template === rule.template && s.at.slice(0, 10) === ctx.today);
      if (!skippedToday) await recordWork(pid, REPEAT_SKIPPED, { commission_id: rule.template, why: message(e).slice(0, 200) }).catch((x) => notes.push(message(x)));
    }
  }
  return { started, notes };
}

export const commissionJob: Job = {
  key: 'commission',
  label: 'Work you commissioned',

  /**
   * Cheap, as the contract requires: environment only. A worker is registered
   * or it is not; whether this profile has any commission is a result, read in
   * run() — an account with no mandate is not a broken sensor.
   */
  available: () => registry().workers.length > 0,

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const pid = ctx.profile.id;
    const reg = registry();
    let all = await loadCommissions(pid);
    const notes: string[] = [];

    const repeats = await startRepeats(ctx, all);
    notes.push(...repeats.notes);
    if (repeats.started) all = await loadCommissions(pid);
    if (!all.length) return [];

    const ids = all.map((c) => c.id);
    const [events, work, acct] = await Promise.all([loadCommissionEvents(pid, ids), loadWork(pid, ids), loadAccounts(pid)]);
    // Without the hand-over record this pass cannot tell which jobs a session
    // already holds, and would open a second session on each: stop and say so.
    if (work.unreadable) throw new Error(`The record of hand-overs could not be read, so nothing was handed over: ${work.unreadable}`);
    const byCommission = new Map<string, CommissionEvent[]>();
    for (const e of events) byCommission.set(e.commission_id, [...(byCommission.get(e.commission_id) ?? []), e]);
    const status = new Map(all.map((c) => [c.id, c.status]));
    const now = (c: Commission): Commission => ({ ...c, status: status.get(c.id) ?? c.status });
    const failures: string[] = [];
    let reached = 0;
    const left = () => (ctx.deadline ? ctx.deadline - Date.now() : 90_000);

    // Read the sessions back first, so a job the agent finished an hour ago is
    // not handed to it again tonight, and an ask it raised reaches the person
    // in this same pass.
    for (const c of all.filter((x) => x.status === 'active' || x.status === 'blocked')) {
      const d = lastDispatch(work.log, c.id);
      if (!d?.session || left() < 8_000) continue;
      try {
        const synced = await syncSession(pid, now(c), d.session, { log: work.log, accounts: acct.accounts, cents: budgetCents(c.budget_minutes, process.env), deadline: ctx.deadline });
        status.set(c.id, synced.status);
        notes.push(...synced.notes);
      } catch (e) {
        failures.push(`Reading back "${c.objective.slice(0, 40)}": ${message(e)}`);
      }
    }

    const { goals } = await ctx.sense();
    // One read for the whole dispatch: the file is the same for every mandate
    // this profile holds, and it is what stops commissioned research reading
    // like it was written from a headline.
    const working = workingBrief(await loadWorking(pid).catch(() => []));
    const records = recordsOf({ dispatches: work.log.dispatches, commissions: all.map(now), sentBack: sentBackIds(work.log), worth: new Map() });

    for (const c0 of dueCommissions(all.map(now))) {
      if (left() < 5_000) break;
      const c = now(c0);
      const job = jobKindOf(c.objective).kind;
      const last = lastDispatch(work.log, c.id);
      const pick = pickWorker({ commission: c, job, registry: reg, assigned: work.log.assigned.get(c.id) ?? null, last: last?.worker ?? null, records });
      if (!pick.worker) {
        // Said on the card rather than waited out: a job no worker here may take
        // will never be picked up, and "Nothing back yet" would say otherwise.
        failures.push(pick.why);
        await recordWork(pid, WORK_DISPATCH, { commission_id: c.id, worker: 'none', job, ok: false, error: pick.why }).catch((e) => notes.push(message(e)));
        continue;
      }
      const w = pick.worker;
      const latest = work.log.checks.get(c.id)?.[0];
      const goal = goals.find((g) => g.id === c.goal_id) ?? null;
      // The log carries the user's answer to whatever this worker last asked,
      // and `checked` why its last done came back — without either the brief is
      // identical on every dispatch and the worker can only repeat itself.
      const brief = commissionBrief(c, ctx.profile, goal, resultUrl(c.id), {
        working, events: byCommission.get(c.id) ?? [], job,
        // Final or not: a job the person sent back for another go after the last
        // refusal still has to be told what was wrong with it.
        checked: latest && !latest.passed ? latest.sendBack : [],
      });
      try {
        let session: string | null = null;
        if (w.via === 'managed') {
          const x = expectationsOf(c.objective, c.created_at, job);
          const reaching = reachesWithAccounts(brief, acct.accounts, acct.vault);
          let resumed: Resumed | null = null;
          if (last?.worker === w.key && last.session) {
            resumed = await resumeSession(last.session, brief, x, last.at, { accounts: acct.accounts, vault: acct.vault });
            session = last.session;
          }
          // Busy is a session already at it: nothing to hand over, nothing to record.
          if (resumed === 'busy') continue;
          if (!session || resumed === 'ended') {
            session = await startSession(w, brief, x, { cents: budgetCents(c.budget_minutes, process.env), accounts: reaching ? acct.accounts : [], vault: reaching ? acct.vault : null });
          }
          await touchCommissionRun(pid, c.id);
        } else {
          const result = w.via === 'inapp' ? await runWriter(brief, { deadline: ctx.deadline }) : await postToWebhook(w, brief, { deadline: ctx.deadline });
          // An empty body is the normal answer from a worker that took the job
          // and will post back later; recording it still moves last_run_at,
          // which stops the same mandate being handed out twice in one night.
          const acc = await acceptWork(pid, c, result, { log: work.log, history: byCommission.get(c.id) ?? [], deadline: ctx.deadline });
          // The status the write produced, not the one loaded before it: a job
          // blocked by THIS run raises its ask in this same pass.
          status.set(c.id, acc.status);
          if (acc.events.length) byCommission.set(c.id, [...(byCommission.get(c.id) ?? []), ...acc.events]);
          if (acc.note) notes.push(acc.note);
        }
        reached += 1;
        await recordWork(pid, WORK_DISPATCH, { commission_id: c.id, worker: w.key, job, ok: true, error: null, session, why: pick.why }).catch((e) => notes.push(message(e)));
      } catch (e) {
        // A hand-over that never reached the worker is NOT "a night with no
        // progress". "Nothing back yet" means the worker is thinking; an
        // unreachable one means it was never asked, and the two must not read
        // the same — a 404 on a mistyped address looked exactly like a worker
        // taking its time, for as long as somebody kept waiting.
        failures.push(`${w.name}: ${message(e)}`);
        await recordWork(pid, WORK_DISPATCH, { commission_id: c.id, worker: w.key, job, ok: false, error: message(e).slice(0, 300), session: null }).catch((x) => notes.push(message(x)));
      }
    }

    // Nothing got through and something tried: throw, so runJobs records it on
    // perJob.commission.error, which /commissions/run returns and the nightly
    // jobs_ran event keeps.
    if (!reached && failures.length) throw new Error(`Could not hand anything over: ${failures[0]}`);
    // Handed over, but part of the record did not save: also an error, because
    // the crew's record and the next night's routing are read from it.
    if (notes.length) throw new Error(`Handed over, but: ${notes[0]}`);

    // Then the asks, from a fresh read of the blocked ones: a question the
    // Claude agent raised while its session was read back above was written by
    // the sync, not by this loop, and has to reach the morning tonight too.
    const blocked = all.filter((c) => status.get(c.id) === 'blocked');
    const fresh = blocked.length ? await loadCommissionEvents(pid, blocked.map((c) => c.id)) : [];
    const out: MoveDraft[] = [];
    for (const c of blocked) {
      const report = reportOf(c, fresh.filter((e) => e.commission_id === c.id));
      // A call through the person's own account is answered with an OK on the
      // job, where the message is written out. As a Move it would be ticked
      // done from the deck, which sends nothing and clears nothing.
      if ((work.log.asks.get(c.id) ?? []).some((a) => a.event_id === report.yours[0]?.id)) continue;
      const move = blockedMove(c, report, commissionJob.key);
      if (move) out.push(move);
    }
    return out;
  },
};

/** What a worker is allowed to do under each mandate, for the docs and the UI. */
export const AUTHORITY_SUMMARY = Object.entries(AUTHORITY)
  .map(([k, v]) => `${k}: ${v.autonomous ? 'runs by itself' : 'comes back for a tap'}`)
  .join(' · ');
