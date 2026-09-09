// Daily loop for every active copilot profile: real supply → reply reconciliation → brief.
//
// Scheduling: vercel.json carries a cron entry for Vercel deploys. On a
// self-hosted deploy (Coolify, Docker, a VPS) vercel.json is inert — add a
// scheduled task that calls this endpoint instead:
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/copilot/cron/daily
import { NextRequest } from 'next/server';
import { runDaily } from '@/lib/copilot/daily';
import { copilotDb } from '@/lib/copilot/db';
import { fail, json } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Stop starting new briefs past this point so the run always returns a report. */
const RUN_BUDGET_MS = Number(process.env.COPILOT_CRON_BUDGET_MS ?? 240_000);
const BATCH = Number(process.env.COPILOT_CRON_BATCH ?? 25);

export async function GET(request: NextRequest) {
  // Fail closed. This endpoint spends model credits per profile, so an
  // unconfigured secret must not leave it open to the world.
  // Both names are accepted. The route asked for CRON_SECRET while the
  // environment defined COPILOT_CRON_SECRET, and the endpoint failed closed
  // with a 503 nobody was reading — one of the reasons this loop had never run.
  // Rejecting the operator's own secret over a prefix is a footgun, not a
  // safety property.
  const cronSecret = process.env.CRON_SECRET || process.env.COPILOT_CRON_SECRET;
  if (!cronSecret) return fail('Neither CRON_SECRET nor COPILOT_CRON_SECRET is configured; refusing to run.', 503);
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return fail('Unauthorized', 401);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: profiles, error } = await copilotDb()
    .from('copilot_profiles')
    .select('id')
    .eq('onboarding_complete', true)
    .gte('last_seen_at', since)
    .order('last_seen_at', { ascending: false })
    .limit(BATCH);
  if (error) return fail(error.message, 500);

  const startedAt = Date.now();
  const results: Array<{ id: string; ok: boolean; agent?: string; moves?: number; error?: string }> = [];
  let skipped = 0;

  for (const p of profiles ?? []) {
    if (Date.now() - startedAt > RUN_BUDGET_MS) { skipped += 1; continue; }
    try {
      const r = await runDaily(p.id, { reason: 'cron' });
      // moves is in the summary because it is the number that says whether the
      // non-outbound half of the loop did anything last night.
      results.push({ id: p.id, ok: true, agent: r.brief.agent, moves: r.jobs && 'written' in r.jobs ? r.jobs.written : 0 });
    } catch (e) {
      results.push({ id: p.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Report truncation rather than silently dropping profiles.
  return json({
    ok: true,
    eligible: profiles?.length ?? 0,
    processed: results.length,
    failed: results.filter((r) => !r.ok).length,
    skipped,
    truncated: skipped > 0,
    elapsedMs: Date.now() - startedAt,
    results,
  });
}
