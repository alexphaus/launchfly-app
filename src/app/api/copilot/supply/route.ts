import { runDaily } from '@/lib/copilot/daily';
import { loadHome } from '@/lib/copilot/store';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** "Find new matches": pull real supply, reconcile replies, re-brief. */
export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  try {
    const result = await runDaily(auth.pid, { reason: 'manual' });
    return json({ ok: true, result, home: await loadHome(auth.pid) });
  } catch (e) {
    console.error('[copilot] supply run failed', e);
    return fail('Could not refresh matches right now.', 502);
  }
}
