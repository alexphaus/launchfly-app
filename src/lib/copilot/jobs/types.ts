// src/lib/copilot/jobs/types.ts
// A Job goes and does one kind of work overnight, and returns finished Moves.
//
// This is the same shape as SupplyAdapter, widened. Supply answers "which
// businesses should I message"; a Job answers "what is worth doing", which
// includes that and seven other kinds. Adding one means adding a file that
// implements this and registering it in index.ts — deliberately the same
// ceremony, because the point is that new kinds of leverage are cheap to add.

import type { Diagnosis, GrowthEdge } from '../diagnose';
import type { MoveDraft } from '../moves';
import type { Goal, Metrics, Profile } from '../types';

/**
 * What the app has already worked out about this profile.
 *
 * Every number in here is computed from rows the user created — matches, sends,
 * replies, outcomes, the decision record. A Job that wants to say "three of your
 * own matches keep asking for this" must read it from here rather than ask a
 * model, which is the difference between a Move that cites evidence and one that
 * sounds like it does.
 */
export interface JobSense {
  /**
   * What the user said they are trying to do. The brief has always seen these
   * (ContextPack.goals) and the decision layer never did, so an app whose owner
   * had written "Get a job — urgent money" and "MacBook Air, $1,000" into it
   * could not produce or rank a single thing that referenced either.
   */
  goals: Goal[];
  diagnosis: Diagnosis;
  /** The one capability the funnel says is missing, or null on a new account. */
  edge: GrowthEdge | null;
  metrics: Metrics;
}

export interface JobContext {
  profile: Profile;
  /** The profile's own date, so a job can reason about "today" in their tz. */
  today: string;
  now: Date;
  /** Wall-clock stop. A job past it must return what it has rather than start more. */
  deadline?: number;
  /**
   * Lazy and memoised for the whole run: nothing is read until a job asks, and
   * six jobs asking still costs one pass. Jobs with their own sensor — a sales
   * table, an external workflow — never call it and never pay for it.
   */
  sense(): Promise<JobSense>;
  /**
   * Ignore per-source schedules. Set only by an on-demand run somebody asked
   * for: the nightly pass respects every_hours so it does not spend a model call
   * on a feed that has not moved, but a person looking at the screen and tapping
   * "Read them now" is not who that rule is for.
   */
  force?: boolean;
  /** Fewer sources than the nightly budget, when the caller has less time. */
  maxSources?: number;
}

export interface Job {
  key: string;
  label: string;
  /**
   * This job describes a STANDING STATE rather than an event.
   *
   * Runway under the line, the top opening still unnamed, the capability the
   * funnel says is missing — each is true until it is fixed, so its Move has to
   * be allowed to come back. Without this every one of them keyed itself once
   * and never fired again: `runway:${month}`, `edge:${capability}`,
   * `opening:${term}`. Two or three nights in, the only job still producing
   * anything daily was the send queue, which is the one thing already on the
   * screen twice, and Moves rendered empty for weeks.
   *
   * Absent means event-driven — a sale, a feed item, a queue — where the source
   * row already decides when there is something new to say.
   *
   * Restating is not unconditional: runJobs stops a standing state the user has
   * binned MAX_RESTATE_DISMISSALS times running.
   */
  standing?: boolean;
  /**
   * False when this job cannot run for this profile — a missing sensor, an
   * unlinked business, a key this deployment does not have. A job that cannot
   * see anything must say so rather than return an empty list, because those
   * two mean very different things to whoever reads the run log.
   *
   * Cheap on purpose: this is asked for every job on every home load, so it
   * reads the profile and the environment and nothing else. It must never call
   * ctx.sense().
   */
  available(ctx: JobContext): boolean | Promise<boolean>;
  /** Do the work. Anything returned still has to pass the quality floor. */
  run(ctx: JobContext): Promise<MoveDraft[]>;
}
