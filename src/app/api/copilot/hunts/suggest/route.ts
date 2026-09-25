// src/app/api/copilot/hunts/suggest/route.ts
// Three or four hunts to start from, read off the offer. Nothing is saved: a
// suggestion becomes a hunt only when the user adds it, and then it is theirs.

import { suggestHunts } from '@/lib/copilot/hunting';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  // Each ask is a model call. Twenty a day is a person iterating; more is a loop.
  const rl = await rateLimit(`copilot:hunt-suggest:${auth.pid}`, 20, 86400);
  if (!rl.ok) return fail('That is twenty suggestion runs today. Add one of these, or write your own.', 429);
  try {
    return json({ ok: true, ...(await suggestHunts(auth.pid)) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not suggest hunts', 400);
  }
}
