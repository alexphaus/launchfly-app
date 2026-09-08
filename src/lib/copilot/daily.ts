// src/lib/copilot/daily.ts
// The whole loop for one profile: pull real supply → reconcile replies → brief.
// Used by the cron and by "Find new matches". Each step is isolated so a
// failing scraper never blocks the brief.

import { runBrief, type BriefResult } from './brief';
import { reconcileReplies } from './outcomes';
import { runSupply, type SupplyResult } from './supply';
import { runWeeklySignals } from './weekly';

export interface DailyResult {
  supply: SupplyResult | { error: string } | null;
  reconcile: { checked: number; matched: number } | { error: string } | null;
  brief: Pick<BriefResult, 'agent' | 'fellBack' | 'graded' | 'pushed'> & { skipped?: string };
  /** Monday only, cron only: the weekly Signals read. */
  weekly: { wrote: boolean; reason?: string } | { error: string } | null;
}

export async function runDaily(profileId: string, opts: { reason: string; supply?: boolean; reconcile?: boolean; deadline?: number } ): Promise<DailyResult> {
  const out: DailyResult = { supply: null, reconcile: null, brief: { agent: 'starter', fellBack: false, graded: { ignored: 0, verified: 0 }, pushed: 0 }, weekly: null };
  if (opts.supply !== false) {
    try { out.supply = await runSupply(profileId, { reason: opts.reason, deadline: opts.deadline }); }
    catch (e) { out.supply = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] supply failed', e); }
  }
  if (opts.reconcile !== false) {
    try { out.reconcile = await reconcileReplies(profileId); }
    catch (e) { out.reconcile = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] reconcile failed', e); }
  }
  // The brief is the slowest step and the least urgent one here: whoever tapped
  // "Find new matches" wants matches, and the next brief will rank them anyway.
  // Skipping it beats spending the remaining budget and returning nothing.
  if (opts.deadline && Date.now() > opts.deadline) {
    out.brief = { ...out.brief, skipped: 'no time left this run; the next brief will rank what was found' };
    return out;
  }
  const brief = await runBrief(profileId, { reason: opts.reason });
  // Surfaced in the cron report: it is how you can tell from outside whether
  // the record is actually being graded, or just accumulating.
  out.brief = { agent: brief.agent, fellBack: brief.fellBack, graded: brief.graded, pushed: brief.pushed };
  // The weekly read rides the cron, not the "Find new matches" tap: it decides
  // for itself whether it is Monday in the profile's timezone.
  if (opts.reason === 'cron') {
    try { out.weekly = await runWeeklySignals(profileId); }
    catch (e) { out.weekly = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] weekly failed', e); }
  }
  return out;
}
