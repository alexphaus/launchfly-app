// src/app/api/copilot/commissions/run/route.ts
// Hand the live mandates out now, instead of at 21:00.
//
// Why this is its own route, which is the same reason /watch/run is. The brief
// route gives every job a shared 8 second budget (JOBS_BUDGET_MS) because it is
// a tap somebody is waiting on. commissionJob is the eleventh of twelve entries
// in JOBS and allows a worker 90 seconds, so on the interactive path it was
// either skipped for "no time left this run" or broke out of its own loop
// immediately. The only thing that could ever dispatch a commission was the
// nightly cron — which made the whole layer untestable without waiting a day,
// and made a misconfigured worker look identical to a quiet one.
//
// Exactly the arithmetic that starved the watcher, one layer up, and it needed
// exactly the same fix.

import { runJobs } from '@/lib/copilot/jobs';
import { loadCommissions, loadHome } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';
import { dueCommissions } from '@/lib/copilot/commission';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Under the proxy ceiling, and enough for one worker round trip. */
const BUDGET_MS = 25_000;
/** Each tap can cost a worker run per live mandate. Generous, not a refresh button. */
const PER_DAY = 30;

export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  // Say why nothing will happen BEFORE spending the rate limit on it. An
  // approved mandate and an unapproved one look the same from the card, and
  // "nothing happened" is the least useful thing this route could return.
  const due = dueCommissions(await loadCommissions(auth.pid));
  if (!due.length) {
    return fail('Nothing to run — a commission has to be approved before anything picks it up.');
  }
  if (!process.env.COPILOT_JOBS_URL) {
    return fail('No worker is connected to this deployment, so there is nothing to hand this to. Set COPILOT_JOBS_URL.');
  }

  const rl = await rateLimit(`copilot:commission-run:${auth.pid}`, PER_DAY, 86400);
  if (!rl.ok) return fail('That is enough runs for today — the nightly pass picks up the rest.', 429);

  try {
    const res = await runJobs(auth.pid, { deadline: Date.now() + BUDGET_MS, only: ['commission'] });
    const entry = res.perJob.commission;
    return json({
      ok: true,
      // What it actually did. A run that reached the worker and got nothing back
      // is a real answer, and a different one from a run that never got there.
      handed: due.length,
      asked: entry?.produced ?? 0,
      skipped: entry?.skipped ?? null,
      error: entry?.error ?? null,
      home: await loadHome(auth.pid),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not run it');
  }
}
