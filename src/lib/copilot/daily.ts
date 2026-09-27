// src/lib/copilot/daily.ts
// The whole loop for one profile: pull real supply → reconcile replies → brief.
// Used by the cron, by "Run again" (as runNightlyPass) and by "Find new
// matches". Each step is isolated so a failing scraper never blocks the brief.

import { runBrief, type BriefResult } from './brief';
import { JOBS, runJobs, type JobsResult } from './jobs';
import { redrawIfDue, type NightlyRoadmap } from './agent/roadmap';
import { isNightlyPass, type NightlyOutput, type NightlyStep } from './nightly';
import { reconcileReplies } from './outcomes';
import { finishNightlyRun, markNightlyStep } from './store';
import { ADAPTERS, runSupply, type SupplyResult } from './supply';

export interface DailyResult {
  supply: SupplyResult | { error: string } | null;
  reconcile: { checked: number; matched: number } | { error: string } | null;
  /** Every non-outbound job: what each found and what was new. */
  jobs: JobsResult | { error: string } | null;
  brief: Pick<BriefResult, 'agent' | 'fellBack' | 'graded' | 'pushed'> & { skipped?: string };
  /** The Path's plan. Only the nightly pass redraws it; "Find new matches" leaves it alone. */
  roadmap?: NightlyRoadmap | null;
}

export interface JobsThenBrief {
  jobs: JobsResult | { error: string };
  /** Null only when the run was out of budget before the brief could start. */
  brief: BriefResult | null;
  skipped?: string;
}

/**
 * Jobs, then the brief. In that order, always — and it is not a preference.
 *
 * runBrief picks the day's Call by arbitrating over the OPEN Moves (call.ts).
 * If the jobs that write today's Moves run AFTERWARDS, the Call is decided from
 * yesterday's leftovers; on a morning when those were all answered, from nothing
 * at all — and nothing falls through to starterDecision, every branch of which
 * is an outreach branch.
 *
 * That is exactly what shipped. `/api/copilot/brief` — the button most people
 * reach for — called runBrief first and runJobs after, so arbitration was live,
 * merged, and could never fire: the app went on saying "send the 45 drafts
 * already written" for a fifth morning while the Move that should have won sat
 * in the list underneath it.
 *
 * Both callers go through here now, so the two orders cannot drift apart again.
 */
export async function runJobsThenBrief(
  profileId: string,
  opts: { reason: string; deadline?: number; jobsDeadline?: number; onStep?: (step: NightlyStep) => Promise<void> },
): Promise<JobsThenBrief> {
  let jobs: JobsResult | { error: string };
  await opts.onStep?.('jobs');
  try {
    jobs = await runJobs(profileId, { deadline: opts.jobsDeadline ?? opts.deadline });
  } catch (e) {
    jobs = { error: e instanceof Error ? e.message : String(e) };
    console.error('[copilot/daily] jobs failed', e);
  }

  // The brief is the slowest step. Out of budget, hand back what the jobs found
  // rather than spend the rest of it and return nothing.
  if (opts.deadline && Date.now() > opts.deadline) {
    return { jobs, brief: null, skipped: 'no time left this run; the next brief will rank what was found' };
  }
  await opts.onStep?.('brief');
  return { jobs, brief: await runBrief(profileId, { reason: opts.reason }) };
}

export async function runDaily(
  profileId: string,
  opts: { reason: string; supply?: boolean; reconcile?: boolean; deadline?: number; onStep?: (step: NightlyStep) => Promise<void> },
): Promise<DailyResult> {
  const out: DailyResult = { supply: null, reconcile: null, jobs: null, brief: { agent: 'starter', fellBack: false, graded: { ignored: 0, verified: 0 }, pushed: 0 } };
  if (opts.supply !== false) {
    await opts.onStep?.('supply');
    try { out.supply = await runSupply(profileId, { reason: opts.reason, deadline: opts.deadline }); }
    catch (e) { out.supply = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] supply failed', e); }
  }
  if (opts.reconcile !== false) {
    await opts.onStep?.('reconcile');
    try { out.reconcile = await reconcileReplies(profileId); }
    catch (e) { out.reconcile = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] reconcile failed', e); }
  }
  // Jobs before the brief — see runJobsThenBrief for why that order is load-bearing.
  const ran = await runJobsThenBrief(profileId, { reason: opts.reason, deadline: opts.deadline, onStep: opts.onStep });
  out.jobs = ran.jobs;
  if (!ran.brief) {
    out.brief = { ...out.brief, skipped: ran.skipped };
    return out;
  }
  // Surfaced in the cron report: it is how you can tell from outside whether
  // the record is actually being graded, or just accumulating.
  out.brief = { agent: ran.brief.agent, fellBack: ran.brief.fellBack, graded: ran.brief.graded, pushed: ran.brief.pushed };
  // Last, after the replies were read and the call was graded, so a redraw
  // "from what came back" has what came back. Isolated like every other step.
  if (isNightlyPass(opts.reason)) {
    await opts.onStep?.('roadmap');
    try { out.roadmap = await redrawIfDue(profileId, opts.reason); }
    catch (e) { out.roadmap = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] roadmap failed', e); }
  }
  return out;
}

/** Labels as of this run, stored on the row so the report can name what broke. */
const RUN_LABELS: NonNullable<NightlyOutput['labels']> = {
  supply: Object.fromEntries(ADAPTERS.map((a) => [a.key, a.label])),
  jobs: Object.fromEntries(JOBS.map((j) => [j.key, j.label])),
};

/**
 * The nightly pass for one profile, with a row of its own the screen can read.
 *
 * The cron and "Run again" both come through here, so the button runs the
 * night itself rather than something that resembles it. That was the ask:
 * test the nightly without waiting a night. A route that ran "most of" the
 * pass would have tested something else.
 *
 * `runId` is null only when the row could not be written. The cron still runs
 * the pass then, since its own report carries the result; the button refuses
 * instead, because a pass nobody can watch is exactly the silent kind.
 *
 * Throws when runDaily does, after recording why, so the cron's per-profile
 * report still says `ok: false`.
 */
export async function runNightlyPass(profileId: string, opts: { reason: string; runId: string | null }): Promise<DailyResult> {
  const { runId } = opts;
  const unrecorded: string[] = [];
  const onStep = async (step: NightlyStep) => {
    if (!runId) return;
    // A progress write that fails costs the running label, not the pass. It is
    // kept and reported with the result, since the screen was stale meanwhile.
    try {
      const err = await markNightlyStep(runId, step);
      if (err) unrecorded.push(err);
    } catch (e) { unrecorded.push(e instanceof Error ? e.message : String(e)); }
  };

  // Closing the row never throws. A pass that worked must not be reported as a
  // failure by the cron because the write after it did not land. If a close
  // does fail, the row stays "running" until NIGHTLY_STALE_MS and then reads
  // "stopped without finishing". That is late, but it is never "fine".
  const close = async (fin: Parameters<typeof finishNightlyRun>[1]) => {
    if (!runId) return;
    const err = await finishNightlyRun(runId, fin).catch((x: unknown) => (x instanceof Error ? x.message : String(x)));
    if (err) console.error(`[copilot/nightly] could not close run ${runId}; it will read as stopped:`, err);
  };

  let result: DailyResult;
  try {
    result = await runDaily(profileId, { reason: opts.reason, onStep });
  } catch (e) {
    await close({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  await close({ status: 'ok', output: { ...result, labels: RUN_LABELS, ...(unrecorded.length ? { unrecorded } : {}) } });
  return result;
}
