import { runJobsThenBrief } from '@/lib/copilot/daily';
import { limitsFor } from '@/lib/copilot/plans';
import { getProfile, loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 90;

/** Jobs run first and must not be what makes this 504. See runJobsThenBrief. */
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
    // The button says "Run agent", so it runs the agent — all of it, in the one
    // order that works. This route used to run the brief and then the jobs,
    // which meant the Call was picked before today's Moves existed and
    // arbitration could never fire. Jobs are bounded and their failure is
    // swallowed inside runJobsThenBrief; the brief is what may 502.
    const ran = await runJobsThenBrief(auth.pid, {
      reason: typeof body.reason === 'string' ? body.reason : 'manual',
      jobsDeadline: Date.now() + JOBS_BUDGET_MS,
    });
    if (!ran.brief) return fail('The agent could not produce a brief right now.', 502);
    const home = await loadHome(auth.pid);
    return json({ ok: true, agent: ran.brief.agent, fellBack: ran.brief.fellBack, home });
  } catch (e) {
    console.error('[copilot] brief failed', e);
    return fail('The agent could not produce a brief right now.', 502);
  }
}
