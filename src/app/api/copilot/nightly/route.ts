// "Run again": tonight's pass, now, for the signed-in account only.
//
// It is the nightly cron's own code path (runNightlyPass), not a lighter copy.
// The request can't wait for it. A pass takes minutes and the proxy gives up
// in under one, so POST records a row, hands the pass to after(), and
// returns. The client polls GET for which step it is on and what came back.
import { after } from 'next/server';
import { runNightlyPass } from '@/lib/copilot/daily';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';
import { NIGHTLY_NOW, nightlyInFlight } from '@/lib/copilot/nightly';
import { limitsFor } from '@/lib/copilot/plans';
import { getProfile, loadLastNightly, startNightlyRun } from '@/lib/copilot/store';

export const runtime = 'nodejs';
// Honoured only on platforms that enforce it. On `next start` after() work
// runs to completion. That is why this works on Coolify, and why the row's
// staleness rule, not this number, is what catches a pass that died.
export const maxDuration = 300;

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { run, unreadable } = await loadLastNightly(auth.pid);
  // A failed read is an error, not "no run": the poller would otherwise take
  // it for a finished pass and stop watching one that is still going.
  if (unreadable) return fail(`Could not read the run: ${unreadable}`, 500);
  return json({ ok: true, run });
}

export async function POST() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);

  // A second tap, or a pass the schedule already has going, gets the run in
  // flight rather than a duplicate spending the same credits beside it.
  const last = await loadLastNightly(auth.pid);
  if (nightlyInFlight(last.run, new Date())) return json({ ok: true, run: last.run, already: true });

  // The same allowance as the brief route, on the same key. The pass ends in a
  // brief, and briefsPerDay exists to cap exactly this: re-runs on top of the
  // one the schedule gets. Paid supply needs no gate here, since runSupply
  // caps what it asks the paid finders for at the monthly allowance.
  const perDay = limitsFor(profile).briefsPerDay;
  const rl = await rateLimit(`copilot:brief:${auth.pid}`, perDay, 86400);
  if (!rl.ok) return fail(`That is today’s ${perDay} brief${perDay === 1 ? '' : 's'} used, and each run makes one. Try again tomorrow.`, 429);

  // No row, no pass. One nobody can watch reports nothing, which is the
  // silent kind this route exists to replace.
  const started = await startNightlyRun(auth.pid, NIGHTLY_NOW);
  if ('error' in started) return fail(`Could not start the run: ${started.error}`, 502);

  const runId = started.run.id;
  after(async () => {
    try {
      await runNightlyPass(auth.pid, { reason: NIGHTLY_NOW, runId });
    } catch (e) {
      // Already on the row: runNightlyPass records the failure before it
      // rethrows, and the screen reads it from there. This is the server log.
      console.error('[copilot/nightly] pass failed', e);
    }
  });
  return json({ ok: true, run: started.run }, 202);
}
