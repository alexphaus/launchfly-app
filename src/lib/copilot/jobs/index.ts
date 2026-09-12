// src/lib/copilot/jobs/index.ts
// Runs every available job and persists what they produced.
//
// Mirrors supply/index.ts on purpose: same registry shape, same isolation, same
// "one failing source never takes the run down". Supply finds businesses to
// message; this finds anything worth doing, of which messaging is one kind.

import { copilotDb, todayIso } from '../db';
import { MAX_RESTATE_DISMISSALS, dismissedStreak, selectMoves, type MoveDraft } from '../moves';
import { getProfile, loadMoveAnswers, logEvent } from '../store';
import { capabilityGapJob } from './capability-gap';
import { clientDeliveryJob } from './client-delivery';
import { goalGapJob } from './goal-gap';
import { openingGapJob } from './opening-gap';
import { remoteJob } from './remote';
import { repeatCustomerJob } from './repeat-customer';
import { runwayGuardJob } from './runway-guard';
import { sendQueueJob } from './send-queue';
import { silenceJob } from './silence';
import { watcherJob } from './watcher';
import { memoSense } from './sense';
import type { Profile } from '../types';
import type { Job, JobContext } from './types';

/**
 * Every kind of leverage the app can produce, in the order they are worth
 * having. This list is the product: for months it held exactly one entry — a
 * WhatsApp opener — and an app with one action type is that action's tool, not
 * a copilot, whatever the landing page says.
 *
 * earn           the send queue, which is a Job like any other now. For as long
 *                as the brief owned the Call, outreach led the screen by
 *                construction rather than by winning
 * earn / build   from the sales table: money already collected, and money left
 *                on the table by silence after it
 * decide         the gap between a goal the user set and the rate that is
 *                actually closing it — the first thing here that reads what
 *                they said they were trying to do
 * decide         the openers that got nothing back, with the messages attached.
 *                It was a row in "Also today" saying "note why the 3 sent
 *                openers got silence" — an instruction about three messages the
 *                app was already holding
 * decide / avoid / learn
 *                from the funnel, the openings read and the decision record —
 *                measured here, never asked of a model
 * anything       from the feeds this person chose to watch — the first source
 *                of work in here that comes from outside the account at all,
 *                and the only reason today's Call can be something other than
 *                the queue. Everything above it is computed from rows the user
 *                already had; a closed system can only ever re-rank itself
 * anything       from an external workflow, because searching for a flight,
 *                quoting three suppliers or fixing an n8n node is not work a
 *                request handler can do, and pretending otherwise is how you
 *                get a Move nobody can act on
 */
export const JOBS: Job[] = [
  sendQueueJob,
  clientDeliveryJob,
  repeatCustomerJob,
  runwayGuardJob,
  goalGapJob,
  silenceJob,
  openingGapJob,
  capabilityGapJob,
  watcherJob,
  remoteJob,
];

/**
 * Persist a batch of Moves. Shared by the nightly jobs and by the inbound
 * endpoint an external workflow posts to, so a Move that arrives from n8n is
 * stored, deduped and capped exactly like one this app produced itself.
 *
 * Dedupe is on (profile, job, external_id) with ignoreDuplicates, so a job that
 * reruns over the same source row writes nothing — and a Move the user already
 * marked done or dismissed stays that way, which ignoring the conflict is what
 * guarantees.
 */
export async function writeMoves(profileId: string, drafts: MoveDraft[], today: string): Promise<number> {
  if (!drafts.length) return 0;
  const rows = drafts.map((d) => ({
    profile_id: profileId, job: d.job, kind: d.kind, external_id: d.external_id,
    headline: d.headline, why: d.why, artifact: d.artifact,
    cost_label: d.cost_label ?? null, for_date: today, stake: d.stake ?? null,
  }));
  const write = (rs: Array<Record<string, unknown>>) => copilotDb()
    .from('copilot_moves')
    .upsert(rs, { onConflict: 'profile_id,job,external_id', ignoreDuplicates: true })
    .select('id');
  let { data, error } = await write(rows);
  // `stake` ships in 20260911_copilot_arbitration.sql. Until it is applied a
  // Move without one is still a Move — it just cannot win the Call on evidence,
  // only on its kind prior. Losing the row entirely would be worse.
  if (error) ({ data, error } = await write(rows.map(({ stake: _s, ...rest }) => rest)));
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Which jobs can see anything for this profile. Separated from running them so
 * the UI can tell "nothing to do" apart from "nothing is plugged in" — those
 * looked identical on the screen, which is how the first Moves build appeared
 * broken when it was working exactly as written.
 */
export async function availableJobs(profile: Profile, now = new Date()): Promise<string[]> {
  // available() is contractually cheap and must not call sense(), so the
  // accessor here is real but never exercised — it exists to satisfy the type,
  // not to be paid for on every home load.
  const ctx: JobContext = { profile, today: todayIso(profile.timezone), now, sense: memoSense(profile, now) };
  const checked = await Promise.all(JOBS.map(async (j) => {
    try { return (await j.available(ctx)) ? j.key : null; } catch { return null; }
  }));
  return checked.filter((k): k is string => !!k);
}

export interface JobsResult {
  ran: number;
  produced: number;
  written: number;
  perJob: Record<string, { produced: number; written: number; skipped?: string; error?: string }>;
}

/**
 * Persist by (profile, job, external_id), ignoring duplicates. A job that sees
 * the same sale tomorrow must not produce a second card — and a Move the user
 * already marked done or dismissed must stay that way, which ignoring the
 * conflict is exactly what guarantees.
 */
export async function runJobs(
  profileId: string,
  opts: { now?: Date; deadline?: number; only?: string[]; force?: boolean; maxSources?: number } = {},
): Promise<JobsResult> {
  const out: JobsResult = { ran: 0, produced: 0, written: 0, perJob: {} };
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  const now = opts.now ?? new Date();
  // One sense read for the whole run, however many jobs ask for it.
  const ctx: JobContext = { profile, today: todayIso(profile.timezone), now, deadline: opts.deadline, sense: memoSense(profile, now), force: opts.force, maxSources: opts.maxSources };

  // One read of the answer history, used only to stop a standing state the user
  // keeps binning. Loaded here rather than in each job so there is one opinion
  // about it and one query.
  const answers = await loadMoveAnswers(profileId).catch(() => []);

  // `only` narrows the run to named jobs — the on-demand source read is one
  // job somebody asked for, not a nightly pass in miniature.
  const jobs = opts.only?.length ? JOBS.filter((j) => opts.only!.includes(j.key)) : JOBS;

  for (const job of jobs) {
    const entry = { produced: 0, written: 0 } as JobsResult['perJob'][string];
    out.perJob[job.key] = entry;
    try {
      if (opts.deadline && Date.now() > opts.deadline) { entry.skipped = 'no time left this run'; continue; }
      if (!(await job.available(ctx))) { entry.skipped = 'sensor not connected for this profile'; continue; }
      // A standing state is true until it is fixed, so it restates weekly — but
      // one binned twice running has been answered, and asking again is the app
      // not listening. Event-driven jobs are never suppressed this way: a
      // dismissed draft says nothing about tomorrow's different one.
      if (job.standing && dismissedStreak(answers, job.key) >= MAX_RESTATE_DISMISSALS) {
        entry.skipped = 'you have turned this down; it stays off until something changes';
        continue;
      }
      out.ran += 1;

      const drafts: MoveDraft[] = selectMoves(await job.run(ctx));
      entry.produced = drafts.length;
      out.produced += drafts.length;
      if (!drafts.length) continue;

      entry.written = await writeMoves(profileId, drafts, ctx.today);
      out.written += entry.written;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      console.error(`[copilot/jobs] ${job.key} failed:`, entry.error);
    }
  }

  // Logged on EVERY run, not only a productive one. An empty Moves list used to
  // render nothing at all, so a night when nine sensors looked and found nothing
  // was pixel-identical to a broken app — which is exactly how it was reported.
  // loadLastJobsRun reads this back so the screen can say what happened.
  await logEvent(profileId, 'jobs_ran', {
    ran: out.ran,
    produced: out.produced,
    written: out.written,
    // Only the keys, and only the ones that looked: a full perJob object is a
    // debug dump, and this is read to write one sentence.
    quiet: Object.entries(out.perJob).filter(([, v]) => !v.skipped && !v.produced).map(([k]) => k),
  });
  if (out.written > 0) await logEvent(profileId, 'moves_written', { written: out.written, produced: out.produced });
  return out;
}
