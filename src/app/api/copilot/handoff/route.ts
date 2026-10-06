// src/app/api/copilot/handoff/route.ts
// Everything this app knows about you, as text, in one request.
//
// See the note at the top of lib/copilot/handoff.ts for why a product whose whole
// claim is "your own rows beat a better model" should ship the button that tests
// that claim against a better model. Briefly: it is a claim, it was untestable,
// and the answer changes what gets built next.
//
// A GET, and that is safe here in a way it is not everywhere in this codebase —
// invariant 8 is about a one-time TOKEN being spent by a link preview, and this
// spends nothing and changes nothing. It is an idempotent read of the caller's own
// rows behind the same session check as every other route.

import { handoffFor } from '@/lib/copilot/readouts';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  try {
    // Loaded in readouts.ts, which the Claude connector reads too: a pasted
    // record and one Claude reads are the same record.
    const text = await handoffFor(auth.pid);

    return json({ ok: true, text, chars: text.length });
  } catch (e) {
    // Surfaced, not swallowed. A copy button that silently hands over an empty
    // string is the worst version of this feature: the user pastes nothing into
    // a model, gets a generic answer, and concludes the context was worthless.
    console.error('[copilot] handoff failed', e);
    return fail(e instanceof Error ? e.message : 'Could not gather your context');
  }
}
