// src/app/api/copilot/ask/route.ts
// Five questions about your own rows, answered by counting.
//
// Not a chatbot, and lib/copilot/ask.ts says at length why not. The short version:
// a free-text question over this data has to be answered by a model, a model
// answering "which segment replies" will produce a plausible figure, and nobody
// will be able to tell which time it is wrong. Invariant 2 — the user's numbers
// are never invented — is not a rule about the UI, it is a rule about what this
// database is for.
//
// Every answer here is arithmetic over rows the user created. Dull, checkable,
// never wrong. The question that needs a guess belongs in /api/copilot/handoff,
// pasted into a model that will at least be visibly guessing.
//
// One GET returns all five, because they read the same three tables and five
// routes would be five round trips for one sheet.

import { answersFor } from '@/lib/copilot/readouts';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  try {
    // Counted in readouts.ts, which the Claude connector asks too.
    return json({ ok: true, answers: await answersFor(auth.pid) });
  } catch (e) {
    // Surfaced. A questions screen that renders five empty cards on an error is
    // the exact shape of bug invariant 13 exists to end: the answer to "which
    // segment replies" would read as "nothing has replied", which is a different
    // and much worse claim than "this could not be counted".
    console.error('[copilot] ask failed', e);
    return fail(e instanceof Error ? e.message : 'Could not count that');
  }
}
