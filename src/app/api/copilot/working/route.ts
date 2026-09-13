// src/app/api/copilot/working/route.ts
// Read, write and settle the working file.
//
// Two kinds of write land here and they are not the same act. Adding a line is
// the user stating something about their own business, which needs no evidence
// and is live immediately — they are the evidence. Confirming a proposal is the
// user agreeing with something the app computed from their rows, which is why
// it was not live already.
//
// Declining is a real outcome and is kept, not deleted: a reading the user said
// no to must not come back as a fresh proposal next week. That is the same
// failure REFUSAL_DECAY exists to stop one layer up.

import { deleteWorkingEntry, loadHome, loadWorking, saveWorkingEntry } from '@/lib/copilot/store';
import { BODY_MAX, isSection } from '@/lib/copilot/working';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  return json({ ok: true, working: await loadWorking(auth.pid) });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));
  const id = typeof b.id === 'string' ? b.id : undefined;

  try {
    // Settling a proposal: 'live' is yes, 'declined' is no and is remembered.
    if (id && (b.status === 'live' || b.status === 'declined')) {
      await saveWorkingEntry(auth.pid, { id, status: b.status });
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    const body = typeof b.body === 'string' ? b.body.trim().slice(0, BODY_MAX) : '';
    if (id) {
      if (!body) return fail('An empty line is a removal — use delete.');
      await saveWorkingEntry(auth.pid, { id, body });
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    if (!isSection(b.section)) return fail('Which part of the file?');
    if (!body) return fail('What should it say?');
    await saveWorkingEntry(auth.pid, { section: b.section, body });
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that');
  }
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Which line?');
  await deleteWorkingEntry(auth.pid, id);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
