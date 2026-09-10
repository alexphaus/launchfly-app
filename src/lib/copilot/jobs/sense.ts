// src/lib/copilot/jobs/sense.ts
// One read of everything the app already knows, shared by every Job in a run.
//
// Kept out of jobs/index.ts so the registry stays a list of jobs, and out of the
// jobs themselves so none of them can quietly issue its own queries: six jobs
// each loading the funnel is six times the cost of the screen they feed.

import { decisionReview } from '../decision';
import { diagnose, growthEdge } from '../diagnose';
import { loadMetrics } from '../outcomes';
import { loadDecisions, loadDiagnosisRows } from '../store';
import type { Profile } from '../types';
import type { JobSense } from './types';

export async function senseFor(profile: Profile, now = new Date()): Promise<JobSense> {
  const [rows, decisions, metrics] = await Promise.all([
    loadDiagnosisRows(profile.id),
    loadDecisions(profile.id),
    loadMetrics(profile.id, profile),
  ]);
  const diagnosis = diagnose({ ...rows, offer: profile.offer ?? {}, targetSegments: profile.target_segments, now });
  // Same two inputs loadHome uses, so a Move and the Signals tab can never
  // disagree about what the funnel says.
  return { diagnosis, edge: growthEdge(diagnosis, { deadTopic: decisionReview(decisions).deadTopic }), metrics };
}

/**
 * The accessor handed to jobs. Memoised on the promise rather than the result so
 * two jobs asking at once still share one read, and a failed read is not cached
 * as an empty one — it rejects for everybody, and runJobs isolates it per job.
 */
export function memoSense(profile: Profile, now: Date, load = senseFor): () => Promise<JobSense> {
  let pending: Promise<JobSense> | null = null;
  return () => (pending ??= load(profile, now));
}
