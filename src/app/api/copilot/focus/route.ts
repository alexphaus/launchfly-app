// src/app/api/copilot/focus/route.ts
// Deep work, logged by the person who did it. The sensor behind the one number
// on You that nothing else in the app can supply — see lib/copilot/focus.ts for
// why it is typed rather than inferred.

import { todayIso } from '@/lib/copilot/db';
import { normalizeFocus } from '@/lib/copilot/focus';
import { deleteFocus, getProfile, insertFocus, loadHome } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);

  // "Today" is the person's, not the server's: a block logged at 11pm in Manila
  // is on the Manila date, which UTC would put on tomorrow.
  const f = normalizeFocus(await readJson(req), todayIso(profile.timezone));
  if (!f.ok) return fail(f.error);

  try {
    await insertFocus(auth.pid, f.value);
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not log that', 500);
  }
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Which one?');
  try {
    await deleteFocus(auth.pid, id);
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not remove that', 500);
  }
}
