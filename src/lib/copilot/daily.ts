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
  brief: Pick<BriefResult, 'agent' | 'fellBack'>;
  /** Monday only, cron only: the weekly Signals read. */
  weekly: { wrote: boolean; reason?: string } | { error: string } | null;
}

export async function runDaily(profileId: string, opts: { reason: string; supply?: boolean; reconcile?: boolean } ): Promise<DailyResult> {
  const out: DailyResult = { supply: null, reconcile: null, brief: { agent: 'starter', fellBack: false }, weekly: null };
  if (opts.supply !== false) {
    try { out.supply = await runSupply(profileId, { reason: opts.reason }); }
    catch (e) { out.supply = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] supply failed', e); }
  }
  if (opts.reconcile !== false) {
    try { out.reconcile = await reconcileReplies(profileId); }
    catch (e) { out.reconcile = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] reconcile failed', e); }
  }
  const brief = await runBrief(profileId, { reason: opts.reason });
  out.brief = { agent: brief.agent, fellBack: brief.fellBack };
  // The weekly read rides the cron, not the "Find new matches" tap: it decides
  // for itself whether it is Monday in the profile's timezone.
  if (opts.reason === 'cron') {
    try { out.weekly = await runWeeklySignals(profileId); }
    catch (e) { out.weekly = { error: e instanceof Error ? e.message : String(e) }; console.error('[copilot/daily] weekly failed', e); }
  }
  return out;
}
