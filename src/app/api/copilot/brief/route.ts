import { runBrief } from '@/lib/copilot/brief';
import { runJobs } from '@/lib/copilot/jobs';
import { limitsFor } from '@/lib/copilot/plans';
import { getProfile, loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 90;

/** Jobs ride along after the brief; they must not be what makes this 504. */
const JOBS_BUDGET_MS = 8_000;

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  // Each brief is a model call, so the daily cap is what the plan pays for.
  const perDay = limitsFor(profile).briefsPerDay;
  const rl = await rateLimit(`copilot:brief:${auth.pid}`, perDay, 86400);
  if (!rl.ok) return fail(`That is your ${perDay} brief${perDay === 1 ? '' : 's'} for today. A higher plan rebuilds it more often.`, 429);
  const body = await readJson(req);
  try {
    const result = await runBrief(auth.pid, { reason: typeof body.reason === 'string' ? body.reason : 'manual' });
    // The button says "Run agent", so it runs the agent — all of it. Jobs used
    // to fire only from the cron and "Find new matches", which meant the button
    // most people reach for produced no Moves and looked broken.
    //
    // Bounded and swallowed: this is behind the proxy, and a job failing must
    // never cost the brief that already succeeded.
    try { await runJobs(auth.pid, { deadline: Date.now() + JOBS_BUDGET_MS }); }
    catch (e) { console.error('[copilot] jobs after brief failed', e); }
    const home = await loadHome(auth.pid);
    return json({ ok: true, agent: result.agent, fellBack: result.fellBack, home });
  } catch (e) {
    console.error('[copilot] brief failed', e);
    return fail('The agent could not produce a brief right now.', 502);
  }
}
