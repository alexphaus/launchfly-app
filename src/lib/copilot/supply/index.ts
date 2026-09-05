// src/lib/copilot/supply/index.ts
// Runs every available adapter and upserts candidates as sourced opportunities.
// Dedupe is by (profile, source, external_id), never by title.

import { copilotDb } from '../db';
import { limitsFor } from '../plans';
import { scoreOpportunity } from '../ranking';
import { getProfile, logEvent, typeAffinityFor } from '../store';
import { bumpUsage, getUsage, periodKey } from '../usage';
import { googleMapsAdapter } from './google-maps';
import { hunterAdapter } from './hunter';
import { remoteAdapter } from './remote';
import { heuristicFit, type SupplyAdapter, type SupplyCandidate } from './types';

export const ADAPTERS: SupplyAdapter[] = [hunterAdapter, googleMapsAdapter, remoteAdapter];

export interface SupplyResult {
  runId: string;
  found: number;
  inserted: number;
  perAdapter: Record<string, { found: number; inserted: number; skipped?: string; error?: string }>;
  /** Monthly match allowance left after this run, and what it was capped at. */
  quota: { limit: number; used: number; remaining: number; exhausted: boolean };
}

export async function runSupply(profileId: string, opts: { limit?: number; only?: string[]; reason?: string } = {}): Promise<SupplyResult> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  // The monthly allowance applies to BILLABLE adapters only, and caps what they
  // are ASKED for rather than only what is counted afterwards: scraping 400
  // places and discarding 380 bills the credits anyway. Free sources are neither
  // metered nor stopped — charging for a RemoteOK listing would be charging for
  // an HTTP request, and cutting one off once the allowance is gone punishes a
  // user for something that costs nothing to serve.
  const plan = limitsFor(profile);
  const period = periodKey(profile.timezone);
  const usedBefore = (await getUsage(profileId, period)).matches;
  const allowance = Math.max(0, plan.matchesPerMonth - usedBefore);
  const asked = opts.limit ?? 40;

  const { data: run } = await db.from('copilot_agent_runs')
    .insert({ profile_id: profileId, kind: 'supply', agent: 'adapters', input_summary: { reason: opts.reason ?? 'manual', adapters: opts.only ?? ADAPTERS.map((a) => a.key) } })
    .select('id').single();
  const runId = run?.id as string;

  const affinity = await typeAffinityFor(profileId);
  const result: SupplyResult = {
    runId, found: 0, inserted: 0, perAdapter: {},
    quota: { limit: plan.matchesPerMonth, used: usedBefore, remaining: allowance, exhausted: allowance <= 0 },
  };

  let billableInserted = 0;

  for (const adapter of ADAPTERS) {
    if (opts.only && !opts.only.includes(adapter.key)) continue;
    const limit = adapter.billable ? Math.min(asked, allowance - billableInserted) : asked;
    if (limit <= 0) { result.perAdapter[adapter.key] = { found: 0, inserted: 0, skipped: 'monthly match allowance used up' }; continue; }
    const entry = { found: 0, inserted: 0 } as SupplyResult['perAdapter'][string];
    result.perAdapter[adapter.key] = entry;
    try {
      if (!(await adapter.available(profile))) { entry.skipped = 'not configured for this profile'; continue; }
      const candidates = await adapter.discover({ ...profile, target_segments: profile.target_segments.slice(0, plan.segments) }, { limit });
      entry.found = candidates.length;
      result.found += candidates.length;
      if (!candidates.length) continue;

      const now = new Date();
      const rows = candidates.map((c: SupplyCandidate) => {
        const fit_score = heuristicFit(profile, c);
        const created_at = now.toISOString();
        return {
          profile_id: profileId, type: c.type, title: c.title.slice(0, 200), reason: c.summary.slice(0, 400),
          value_label: c.value_label ?? null, effort: c.effort ?? 'medium', fit_score,
          score: scoreOpportunity({ type: c.type, effort: c.effort ?? 'medium', fit_score, created_at, source_kind: 'sourced' }, { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: affinity, now }),
          source: c.source, source_kind: 'sourced', external_id: c.external_id, url: c.url ?? null, contact: c.contact, data: c.data,
          agent_run_id: runId, expires_at: null,
        };
      });
      // ON CONFLICT (profile_id, source, external_id) DO NOTHING — existing rows keep their status and agent score.
      const { data: inserted, error } = await db.from('copilot_opportunities')
        .upsert(rows, { onConflict: 'profile_id,source,external_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      entry.inserted = inserted?.length ?? 0;
      result.inserted += entry.inserted;
      if (adapter.billable) billableInserted += entry.inserted;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      console.error(`[copilot/supply] ${adapter.key} failed:`, entry.error);
    }
  }

  // Meter what the user actually received from a paid source: a failed adapter,
  // an all-duplicates run, or anything from a free source costs them nothing.
  if (billableInserted > 0) {
    const total = await bumpUsage(profileId, period, 'matches', billableInserted);
    if (total) result.quota.used = total;
  }
  result.quota.remaining = Math.max(0, plan.matchesPerMonth - result.quota.used);
  result.quota.exhausted = result.quota.remaining <= 0;

  await db.from('copilot_agent_runs').update({ status: 'ok', output: result as unknown as Record<string, unknown>, finished_at: new Date().toISOString() }).eq('id', runId);
  await logEvent(profileId, 'supply_run', { found: result.found, inserted: result.inserted, plan_remaining: result.quota.remaining });
  return result;
}
