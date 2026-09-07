import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { todayIso } from '@/lib/copilot/db';
import { getProfile, loadHome, respondToDecision } from '@/lib/copilot/store';

export const runtime = 'nodejs';

/**
 * What the user did about today's call.
 *
 * 'ignored' is deliberately not accepted: it is inferred by the sweep from a
 * call that was still pending when the next one arrived. A record that only
 * contains the outcomes someone chose to type in is a flattering record, and a
 * flattering record cannot tell you which of your calls were wrong.
 */
const RESPONSES = ['did', 'rejected', 'wrong'] as const;

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const response = RESPONSES.find((r) => r === b.response);
  if (!response) return fail('Unknown response', 400);

  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  const decision = await respondToDecision(auth.pid, todayIso(profile.timezone), response);
  if (!decision) return fail('No call recorded for today yet', 404);
  return json({ ok: true, decision, home: await loadHome(auth.pid) });
}
