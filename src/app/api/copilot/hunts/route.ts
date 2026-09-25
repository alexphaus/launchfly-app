// src/app/api/copilot/hunts/route.ts
// What to look for, beyond Maps and feeds. See lib/copilot/hunts.ts.
//
//   POST    { kind, query, area?, label?, origin? }  add a hunt; an agent hunt
//           also writes its mandate, as a draft the user grants on its sheet
//   PATCH   { id, status: 'active'|'paused' }        pause or resume
//           { id, rerun: true }                      hand an agent hunt over again
//   DELETE  ?id=                                     remove, setting aside what
//           it found that nobody answered

import { createHunt, removeHunt, rerunAgentHunt } from '@/lib/copilot/hunting';
import { loadHome, updateHunt } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  try {
    const { hunt, commissionId } = await createHunt(auth.pid, b, b.origin === 'suggested' ? 'suggested' : 'user');
    return json({ ok: true, hunt, commissionId, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not add that hunt', 400);
  }
}

export async function PATCH(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const id = typeof b.id === 'string' ? b.id : '';
  if (!id) return fail('Which hunt?');
  try {
    if (b.rerun === true) {
      const commissionId = await rerunAgentHunt(auth.pid, id);
      return json({ ok: true, commissionId, home: await loadHome(auth.pid) });
    }
    if (b.status !== 'active' && b.status !== 'paused') return fail('Pause or resume?');
    await updateHunt(auth.pid, id, { status: b.status });
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not change that hunt', 400);
  }
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Which hunt?');
  try {
    const { dropped } = await removeHunt(auth.pid, id);
    return json({ ok: true, dropped, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not remove that hunt', 500);
  }
}
