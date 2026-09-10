// src/lib/copilot/jobs/index.ts
// Runs every available job and persists what they produced.
//
// Mirrors supply/index.ts on purpose: same registry shape, same isolation, same
// "one failing source never takes the run down". Supply finds businesses to
// message; this finds anything worth doing, of which messaging is one kind.

import { copilotDb, todayIso } from '../db';
import { selectMoves, type MoveDraft } from '../moves';
import { getProfile, logEvent } from '../store';
import { capabilityGapJob } from './capability-gap';
import { clientDeliveryJob } from './client-delivery';
import { demandGapJob } from './demand-gap';
import { remoteJob } from './remote';
import { repeatCustomerJob } from './repeat-customer';
import { runwayGuardJob } from './runway-guard';
import { memoSense } from './sense';
import type { Profile } from '../types';
import type { Job, JobContext } from './types';

/**
 * Every kind of leverage the app can produce, in the order they are worth
 * having. This list is the product: for months it held exactly one entry — a
 * WhatsApp opener — and an app with one action type is that action's tool, not
 * a copilot, whatever the landing page says.
 *
 * earn / build   from the sales table: money already collected, and money left
 *                on the table by silence after it
 * decide / avoid / learn
 *                from the funnel, the demand read and the decision record —
 *                measured here, never asked of a model
 * anything       from an external workflow, because searching for a flight,
 *                quoting three suppliers or fixing an n8n node is not work a
 *                request handler can do, and pretending otherwise is how you
 *                get a Move nobody can act on
 */
export const JOBS: Job[] = [
  clientDeliveryJob,
  repeatCustomerJob,
  runwayGuardJob,
  demandGapJob,
  capabilityGapJob,
  remoteJob,
];

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
export async function runJobs(profileId: string, opts: { now?: Date; deadline?: number } = {}): Promise<JobsResult> {
  const out: JobsResult = { ran: 0, produced: 0, written: 0, perJob: {} };
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  const now = opts.now ?? new Date();
  // One sense read for the whole run, however many jobs ask for it.
  const ctx: JobContext = { profile, today: todayIso(profile.timezone), now, deadline: opts.deadline, sense: memoSense(profile, now) };

  for (const job of JOBS) {
    const entry = { produced: 0, written: 0 } as JobsResult['perJob'][string];
    out.perJob[job.key] = entry;
    try {
      if (opts.deadline && Date.now() > opts.deadline) { entry.skipped = 'no time left this run'; continue; }
      if (!(await job.available(ctx))) { entry.skipped = 'sensor not connected for this profile'; continue; }
      out.ran += 1;

      const drafts: MoveDraft[] = selectMoves(await job.run(ctx));
      entry.produced = drafts.length;
      out.produced += drafts.length;
      if (!drafts.length) continue;

      const rows = drafts.map((d) => ({
        profile_id: profileId, job: d.job, kind: d.kind, external_id: d.external_id,
        headline: d.headline, why: d.why, artifact: d.artifact,
        cost_label: d.cost_label ?? null, for_date: ctx.today,
      }));
      const { data, error } = await copilotDb()
        .from('copilot_moves')
        .upsert(rows, { onConflict: 'profile_id,job,external_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw error;
      entry.written = data?.length ?? 0;
      out.written += entry.written;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      console.error(`[copilot/jobs] ${job.key} failed:`, entry.error);
    }
  }

  if (out.written > 0) await logEvent(profileId, 'moves_written', { written: out.written, produced: out.produced });
  return out;
}
