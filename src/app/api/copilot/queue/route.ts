// src/app/api/copilot/queue/route.ts
// "I am not sending these."
//
// cancelOpenDrafts has existed since the offer-change path and had no
// user-facing caller, so a queue of drafts somebody had decided against was
// permanent. It fed awaiting_approval, awaiting_approval fed the send_queue
// stake, and the Call proposed sending them every morning — which is the
// single thing this product's own author said he had learned to ignore.
//
// A backlog you have decided against is not a backlog. It is a dead asset
// holding the top of the screen, and until now there was no way to say so.

import { clearQueue } from '@/lib/copilot/execution';
import { loadHome } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));
  if (b.action !== 'clear') return fail('Unknown action');

  try {
    // Nothing is deleted: the executions move to `cancelled` with a reason, so
    // the funnel can still see that these were written and abandoned. That
    // matters — "44 drafted, 0 sent" is the most informative number this
    // account has ever produced and clearing the screen must not erase it.
    const { cancelled } = await clearQueue(auth.pid);
    return json({ ok: true, cancelled, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not clear the queue');
  }
}
