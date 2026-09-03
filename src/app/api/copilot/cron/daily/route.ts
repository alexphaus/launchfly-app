// Daily brief for every active copilot profile. Scheduled in vercel.json.
import { NextRequest } from 'next/server';
import { runBrief } from '@/lib/copilot/brief';
import { copilotDb } from '@/lib/copilot/db';
import { fail, json } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) return fail('Unauthorized', 401);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: profiles, error } = await copilotDb()
    .from('copilot_profiles')
    .select('id')
    .eq('onboarding_complete', true)
    .gte('last_seen_at', since)
    .order('last_seen_at', { ascending: false })
    .limit(50);
  if (error) return fail(error.message, 500);

  const results: Array<{ id: string; ok: boolean; agent?: string; error?: string }> = [];
  for (const p of profiles ?? []) {
    try {
      const r = await runBrief(p.id, { reason: 'cron' });
      results.push({ id: p.id, ok: true, agent: r.agent });
    } catch (e) {
      results.push({ id: p.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ ok: true, count: results.length, results });
}
