import { runDaily } from '@/lib/copilot/daily';
import { limitsFor } from '@/lib/copilot/plans';
import { getProfile, loadHome } from '@/lib/copilot/store';
import { getUsage, periodKey } from '@/lib/copilot/usage';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** "Find new matches": pull real supply, reconcile replies, re-brief. */
export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);

  // The monthly allowance is the real limit; the daily one only stops a user
  // burning a month of credits in an afternoon.
  const limits = limitsFor(profile);
  const used = (await getUsage(auth.pid, periodKey(profile.timezone))).matches;
  if (used >= limits.matchesPerMonth) {
    return fail(`You have used all ${limits.matchesPerMonth} matches on your plan this month. Your daily brief keeps running on what you already have — upgrade for more, or this resets on the 1st.`, 402);
  }
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
