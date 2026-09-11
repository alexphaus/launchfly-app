// src/lib/copilot/daily.ts
// The whole loop for one profile: pull real supply → reconcile replies → brief.
// Used by the cron and by "Find new matches". Each step is isolated so a
// failing scraper never blocks the brief.

import { runBrief, type BriefResult } from './brief';
import { runJobs, type JobsResult } from './jobs';
import { reconcileReplies } from './outcomes';
import { runSupply, type SupplyResult } from './supply';

export interface DailyResult {
  supply: SupplyResult | { error: string } | null;
  reconcile: { checked: number; matched: number } | { error: string } | null;
  /** Every non-outbound job: what each found and what was new. */
  jobs: JobsResult | { error: string } | null;
  brief: Pick<BriefResult, 'agent' | 'fellBack' | 'graded' | 'pushed'> & { skipped?: string };
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
  opts: { reason: string; deadline?: number; jobsDeadline?: number },
): Promise<JobsThenBrief> {
  let jobs: JobsResult | { error: string };
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
  return { jobs, brief: await runBrief(profileId, { reason: opts.reason }) };
}

export async function runDaily(profileId: string, opts: { reason: string; supply?: boolean; reconcile?: boolean; deadline?: number } ): Promise<DailyResult> {
  const out: DailyResult = { supply: null, reconcile: null, jobs: null, brief: { agent: 'starter', fellBack: false, graded: { ignored: 0, verified: 0 }, pushed: 0 } };
  if (opts.supply !== false) {
    try { out.supply = await runSupply(profileId, { reason: opts.reason, deadline: opts.deadline }); }
    catch (e) { out.supply = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] supply failed', e); }
  }
  if (opts.reconcile !== false) {
    try { out.reconcile = await reconcileReplies(profileId); }
    catch (e) { out.reconcile = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] reconcile failed', e); }
  }
  // Jobs before the brief — see runJobsThenBrief for why that order is load-bearing.
  const ran = await runJobsThenBrief(profileId, { reason: opts.reason, deadline: opts.deadline });
  out.jobs = ran.jobs;
  if (!ran.brief) {
    out.brief = { ...out.brief, skipped: ran.skipped };
    return out;
  }
  // Surfaced in the cron report: it is how you can tell from outside whether
  // the record is actually being graded, or just accumulating.
  out.brief = { agent: ran.brief.agent, fellBack: ran.brief.fellBack, graded: ran.brief.graded, pushed: ran.brief.pushed };
  return out;
}
