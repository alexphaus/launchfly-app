// src/lib/copilot/usage.ts
// Monthly metered counters. The period is computed in the profile's own
// timezone, so a user in Lisbon does not get a new allowance at 1am because the
// server thinks it is already the first.

import { copilotDb } from './db';
import { limitsFor, remaining, type PlanLimits } from './plans';

export type Metric = 'matches' | 'briefs';

/** 'YYYY-MM' for right now in the given timezone. */
export function periodKey(timezone = 'UTC', now = new Date()): string {
  try {
    // en-CA gives ISO-ish YYYY-MM-DD, which slices cleanly.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
  } catch {
    return now.toISOString().slice(0, 7);
  }
}

export async function getUsage(profileId: string, period: string): Promise<Record<Metric, number>> {
  const { data } = await copilotDb()
    .from('copilot_usage')
    .select('metric, count')
    .eq('profile_id', profileId)
    .eq('period', period);
  const out: Record<Metric, number> = { matches: 0, briefs: 0 };
  for (const row of (data ?? []) as Array<{ metric: Metric; count: number }>) out[row.metric] = row.count;
  return out;
}

/**
 * Increment atomically and return the new total. Two supply runs finishing at
 * once must not both read 40 and both write 45.
 */
export async function bumpUsage(profileId: string, period: string, metric: Metric, delta: number): Promise<number> {
  if (delta <= 0) return 0;
  const { data, error } = await copilotDb().rpc('copilot_bump_usage', {
    p_profile: profileId, p_period: period, p_metric: metric, p_delta: delta,
  });
  if (error) {
    // Metering must never take the feature down with it. Log and let the run finish.
    console.error('[copilot] usage bump failed', error);
    return 0;
  }
  return (data as number) ?? 0;
}

export interface UsageSnapshot {
  period: string;
  limits: PlanLimits;
  matches: { used: number; limit: number; remaining: number };
  briefs: { used: number };
}

export async function usageSnapshot(
  profile: { id: string; timezone?: string | null; plan?: string | null; plan_status?: string | null },
): Promise<UsageSnapshot> {
  const period = periodKey(profile.timezone ?? 'UTC');
  const [used, limits] = [await getUsage(profile.id, period), limitsFor(profile)];
  return {
    period,
    limits,
    matches: { used: used.matches, limit: limits.matchesPerMonth, remaining: remaining(limits.matchesPerMonth, used.matches) },
    briefs: { used: used.briefs },
  };
}
