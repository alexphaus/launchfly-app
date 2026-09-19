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

import { answerAll } from '@/lib/copilot/ask';
import { CURRENCY } from '@/lib/copilot/plans';
import { RANKING_WINDOW, phraseFor } from '@/lib/copilot/call';
import { decisionReview } from '@/lib/copilot/decision';
import { loadAskRows, loadWorthLedger } from '@/lib/copilot/outcomes';
import { getProfile } from '@/lib/copilot/base';
import { loadDecisions, loadStandingRefusals } from '@/lib/copilot/store';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Whole months since the account was made, at least one. */
function monthsSince(iso: string | null | undefined): number {
  if (!iso) return 1;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 1;
  return Math.max(1, Math.floor((Date.now() - then) / (30 * 86_400_000)) || 1);
}

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  try {
    const [profile, decisions, rows, standing, worth] = await Promise.all([
      getProfile(auth.pid),
      loadDecisions(auth.pid, RANKING_WINDOW),
      loadAskRows(auth.pid),
      loadStandingRefusals(auth.pid),
      loadWorthLedger(auth.pid),
    ]);
    const { deadTopic } = decisionReview(decisions);

    return json({
      ok: true,
      answers: answerAll({
        decisions,
        segments: rows.segments,
        drafts: rows.drafts,
        standing: [...standing].map(phraseFor),
        dead: deadTopic ? [deadTopic] : [],
        worth,
        phraseFor,
        currency: profile?.finance?.currency || '',
        // The deployment's pricing currency, which is usually not the user's. See
        // AskInput.planCurrency for why the two are never silently added up.
        planCurrency: CURRENCY,
        plan: profile?.plan ?? 'free',
        monthsActive: monthsSince(profile?.created_at),
      }),
    });
  } catch (e) {
    // Surfaced. A questions screen that renders five empty cards on an error is
    // the exact shape of bug invariant 13 exists to end: the answer to "which
    // segment replies" would read as "nothing has replied", which is a different
    // and much worse claim than "this could not be counted".
    console.error('[copilot] ask failed', e);
    return fail(e instanceof Error ? e.message : 'Could not count that');
  }
}
