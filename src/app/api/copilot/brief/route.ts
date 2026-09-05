import { runBrief } from '@/lib/copilot/brief';
import { loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const rl = await rateLimit(`copilot:brief:${auth.pid}`, 30, 86400);
  if (!rl.ok) return fail('You have rebuilt the brief 30 times today. Try again tomorrow.', 429);
  const body = await readJson(req);
  try {
    const result = await runBrief(auth.pid, { reason: typeof body.reason === 'string' ? body.reason : 'manual' });
    const home = await loadHome(auth.pid);
    return json({ ok: true, agent: result.agent, fellBack: result.fellBack, home });
  } catch (e) {
    console.error('[copilot] brief failed', e);
    return fail('The agent could not produce a brief right now.', 502);
  }
}
