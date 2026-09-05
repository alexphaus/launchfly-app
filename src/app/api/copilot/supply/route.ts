import { runDaily } from '@/lib/copilot/daily';
import { loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** "Find new matches": pull real supply, reconcile replies, re-brief. */
export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const rl = await rateLimit(`copilot:supply:${auth.pid}`, 10, 86400);
  if (!rl.ok) return fail('You have refreshed matches 10 times today. Each run costs scraping credits; try again tomorrow.', 429);
  try {
    const result = await runDaily(auth.pid, { reason: 'manual' });
    return json({ ok: true, result, home: await loadHome(auth.pid) });
  } catch (e) {
    console.error('[copilot] supply run failed', e);
    return fail('Could not refresh matches right now.', 502);
  }
}
