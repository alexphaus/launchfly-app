// src/app/api/copilot/watch/run/route.ts
// Read the watched sources now, instead of at 21:00.
//
// Why this is its own route. The brief route gives every job a shared 8 second
// budget (JOBS_BUDGET_MS), because it is a tap somebody is waiting on and the
// brief behind it is the slow part. The watcher needs more than that for a
// single source — one feed fetch alone is allowed 20s — so it broke out of its
// own loop on every interactive run and only ever executed on the cron. "I have
// to wait a day" was not a feeling; it was the arithmetic.
//
// So: one route, one budget, one or two sources per tap. dueSources orders by
// oldest check first, so tapping again walks the rest of the list rather than
// re-reading the same feed.

import { runJobs } from '@/lib/copilot/jobs';
import { loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Under the proxy ceiling with room to spare. The interactive timeout in
 * agent/llm.ts is 30s against a limit nobody has measured, so a fetch plus a
 * judge call has to fit inside roughly that — which is one source, sometimes
 * two. Better to return what one feed found than to 504 holding three.
 */
const BUDGET_MS = 25_000;
/** Each tap costs a model call per source. Generous, but not a refresh button. */
const PER_DAY = 40;

export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  const rl = await rateLimit(`copilot:watch:${auth.pid}`, PER_DAY, 86400);
  if (!rl.ok) return fail('That is enough reading for today — the nightly run picks up the rest.', 429);

  try {
    const res = await runJobs(auth.pid, {
      deadline: Date.now() + BUDGET_MS,
      only: ['watch'],
      force: true,
      maxSources: 2,
    });
    const watch = res.perJob.watch;
    return json({
      ok: true,
      // What it actually did, so the button can say something true rather than
      // "done". A run that read two feeds and found nothing is a real answer.
      found: watch?.written ?? 0,
      skipped: watch?.skipped ?? null,
      error: watch?.error ?? null,
      home: await loadHome(auth.pid),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not read your sources');
  }
}
