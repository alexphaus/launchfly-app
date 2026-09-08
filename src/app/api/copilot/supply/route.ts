import { runDaily } from '@/lib/copilot/daily';
import { limitsFor } from '@/lib/copilot/plans';
import { getProfile, loadHome } from '@/lib/copilot/store';
import { getUsage, periodKey } from '@/lib/copilot/usage';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * How long the work itself may take. maxDuration above is what Next allows, not
 * what survives: the reverse proxy in front of this deployment gives up around
 * 60s, and three Google Maps segments at 90s each plus a brief is minutes. The
 * budget leaves room for loadHome and the response, and the run returns what it
 * found instead of dying. Raise it only after raising the proxy's own timeout.
 */
const BUDGET_MS = Number(process.env.COPILOT_SUPPLY_BUDGET_MS) > 0 ? Number(process.env.COPILOT_SUPPLY_BUDGET_MS) : 40_000;

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
    const result = await runDaily(auth.pid, { reason: 'manual', deadline: Date.now() + BUDGET_MS });
    return json({ ok: true, result, home: await loadHome(auth.pid) });
  } catch (e) {
    console.error('[copilot] supply run failed', e);
    return fail('Could not refresh matches right now.', 502);
  }
}
