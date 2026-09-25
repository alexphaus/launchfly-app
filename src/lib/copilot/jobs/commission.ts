// src/lib/copilot/jobs/commission.ts
// Hand the live mandates to whatever holds the tools, and surface what came back.
//
// This job does two things and deliberately not a third.
//
//   1. dispatches active commissions to the worker, with an objective, the
//      authority they may use and an id to report against
//   2. turns anything blocked on the user into a Move, so a stalled mandate
//      competes for the morning through scoreMove like everything else
//
// It does NOT execute anything. No tools, no browser, no retry loop — those
// belong to the thing being rented and they change every six months, while the
// ledger and the ranking they report into do not. See the note at the top of
// commission.ts on why that split is where the value is rather than where the
// modesty is.
//
// The worker may answer synchronously (small work, inside the request) or take
// the brief, return nothing, and POST to result_url later. Both are supported
// because both are real: research inside 20 seconds is one shape, and an agent
// that browses for ten minutes is another.

import { AUTHORITY, blockedMove, commissionBrief, dueCommissions, normalizeResult, reportOf } from '../commission';
import { loadCommissionEvents, loadCommissions, loadWorking, recordCommissionWork } from '../store';
import { workingBrief } from '../working';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

/** A worker that browses is slow by nature; this is the synchronous ceiling. */
const TIMEOUT_MS = 90_000;

function resultUrl(commissionId: string): string | null {
  const base = process.env.NEXT_PUBLIC_COPILOT_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, '')}/api/copilot/commissions/${commissionId}/result` : null;
}

export const commissionJob: Job = {
  key: 'commission',
  label: 'Work you commissioned',

  /**
   * Cheap, as the contract requires: environment only. Whether this profile has
   * any commission is a result, read in run() — an account with no mandate is
   * not a broken sensor, it is somebody who has not written one yet.
   */
  available: () => !!process.env.COPILOT_JOBS_URL,

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const all = await loadCommissions(ctx.profile.id);
    if (!all.length) return [];

    const events = await loadCommissionEvents(ctx.profile.id, all.map((c) => c.id));
    const byCommission = new Map<string, typeof events>();
    for (const e of events) byCommission.set(e.commission_id, [...(byCommission.get(e.commission_id) ?? []), e]);

    // Dispatch first, so a mandate that gets blocked during this very run
    // surfaces its ask in the same pass rather than tomorrow. Keyed by id
    // because recordCommissionWork moves the row and the objects in `all` are a
    // snapshot taken before any of that happened.
    const status = new Map(all.map((c) => [c.id, c.status]));
    // Why the dispatch failed, per mandate, so a run that reached nobody can say
    // so instead of reporting the same thing as a quiet one.
    const failures: string[] = [];
    let reached = 0;
    const { goals } = await ctx.sense();
    // One read for the whole dispatch: the file is the same for every mandate
    // this profile holds, and it is what stops commissioned research reading
    // like it was written from a headline — because until now it was.
    const working = workingBrief(await loadWorking(ctx.profile.id).catch(() => []));
    for (const c of dueCommissions(all)) {
      const left = ctx.deadline ? ctx.deadline - Date.now() : TIMEOUT_MS;
      if (left < 5_000) break;
      const goal = goals.find((g) => g.id === c.goal_id) ?? null;
      // The log carries the user's answer to whatever this worker last asked.
      // Without it the brief is identical on every dispatch and a question can
      // only ever be asked again — see CommissionBrief.log.
      const brief = commissionBrief(c, ctx.profile, goal, resultUrl(c.id), {
        working,
        events: byCommission.get(c.id) ?? [],
      });

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), Math.min(TIMEOUT_MS, left));
      try {
        const res = await fetch(process.env.COPILOT_JOBS_URL!, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.COPILOT_JOBS_SECRET ? { authorization: `Bearer ${process.env.COPILOT_JOBS_SECRET}` } : {}),
          },
          body: JSON.stringify(brief),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        const result = normalizeResult(await res.json().catch(() => ({})));
        // An empty body is the normal answer from a worker that took the job and
        // will post back later. Recording it anyway moves last_run_at, which is
        // what stops the same mandate being handed out twice in one night.
        reached += 1;
        const recorded = await recordCommissionWork(ctx.profile.id, c, result);
        // The status the write produced, not the one loaded before it. The first
        // version read c.status from the pre-dispatch snapshot, so a mandate
        // blocked by THIS run was skipped by the loop below and its ask reached
        // the user a night late — which is the one thing dispatching first was
        // supposed to prevent.
        status.set(c.id, recorded.status);
        if (recorded.events.length) byCommission.set(c.id, [...(byCommission.get(c.id) ?? []), ...recorded.events]);
      } catch (e) {
        // A dispatch that never reached the worker is NOT "a night with no
        // progress", which is what this used to say while swallowing the error.
        // "Nothing back yet" means the worker is thinking; an unreachable worker
        // means it was never asked. Those are opposite states and the screen
        // showed the same sentence for both, so a 404 on a mistyped webhook URL
        // was indistinguishable from a worker taking its time — for as long as
        // somebody was willing to keep waiting.
        const message = e instanceof Error ? e.message : String(e);
        failures.push(message);
        console.error(`[copilot/commission] ${c.id} dispatch failed:`, message);
      } finally {
        clearTimeout(t);
      }
    }

    // Nothing got through, and something tried. Throw so runJobs records it on
    // perJob.commission.error, which /commissions/run returns and the nightly
    // jobs_ran event keeps — the only honest way for the screen to tell "the
    // worker has not answered yet" apart from "there is no worker there".
    if (!reached && failures.length) {
      throw new Error(`Could not reach the worker: ${failures[0]}`);
    }

    // Then the asks. Re-read nothing: byCommission already carries this run's
    // events alongside the stored ones.
    const out: MoveDraft[] = [];
    for (const c of all) {
      if (status.get(c.id) !== 'blocked') continue;
      const report = reportOf(c, byCommission.get(c.id) ?? []);
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
