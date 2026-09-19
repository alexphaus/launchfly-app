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

import { buildContextPack } from '@/lib/copilot/context';
import { renderHandoff } from '@/lib/copilot/handoff';
import { decisionReview } from '@/lib/copilot/decision';
import { RANKING_WINDOW, phraseFor } from '@/lib/copilot/call';
import { countOpenDrafts } from '@/lib/copilot/execution';
import { loadCommissions, loadDecisions, loadObligations, loadStandingRefusals, loadWorking } from '@/lib/copilot/store';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  try {
    // The four things buildContextPack does not carry, rather than widening it.
    // ContextPack is the agent's prompt and has a budget somebody tuned; this
    // export has a different reader and a different one, and conflating them is
    // how a prompt quietly grows by six sections.
    const [pack, working, standing, decisions, obligations, commissions, queueTotal] = await Promise.all([
      buildContextPack(auth.pid),
      loadWorking(auth.pid),
      loadStandingRefusals(auth.pid),
      loadDecisions(auth.pid, RANKING_WINDOW),
      loadObligations(auth.pid),
      loadCommissions(auth.pid),
      countOpenDrafts(auth.pid),
    ]);

    const { deadTopic } = decisionReview(decisions);
    const text = renderHandoff({
      pack,
      working,
      standing: [...standing].map(phraseFor),
      dead: deadTopic ? [{ phrase: phraseFor(deadTopic.topic), count: deadTopic.count }] : [],
      obligations,
      // Live only. A finished mandate is history and the decision record already
      // carries what came of it; what a reader needs is what is in flight.
      commissions: commissions
        .filter((c) => c.status === 'active' || c.status === 'blocked' || c.status === 'draft')
        .map((c) => ({ objective: c.objective, status: c.status, authority: c.authority, why: c.why })),
      queueTotal,
    });

    return json({ ok: true, text, chars: text.length });
  } catch (e) {
    // Surfaced, not swallowed. A copy button that silently hands over an empty
    // string is the worst version of this feature: the user pastes nothing into
    // a model, gets a generic answer, and concludes the context was worthless.
    console.error('[copilot] handoff failed', e);
    return fail(e instanceof Error ? e.message : 'Could not gather your context');
  }
}
