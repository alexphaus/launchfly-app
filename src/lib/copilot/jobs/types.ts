// src/lib/copilot/jobs/types.ts
// A Job goes and does one kind of work overnight, and returns finished Moves.
//
// This is the same shape as SupplyAdapter, widened. Supply answers "which
// businesses should I message"; a Job answers "what is worth doing", which
// includes that and seven other kinds. Adding one means adding a file that
// implements this and registering it in index.ts — deliberately the same
// ceremony, because the point is that new kinds of leverage are cheap to add.

import type { MoveDraft } from '../moves';
import type { Profile } from '../types';

export interface JobContext {
  profile: Profile;
  /** The profile's own date, so a job can reason about "today" in their tz. */
  today: string;
  now: Date;
  /** Wall-clock stop. A job past it must return what it has rather than start more. */
  deadline?: number;
}

export interface Job {
  key: string;
  label: string;
  /**
   * False when this job cannot run for this profile — a missing sensor, an
   * unlinked business, a key this deployment does not have. A job that cannot
   * see anything must say so rather than return an empty list, because those
   * two mean very different things to whoever reads the run log.
   */
  available(ctx: JobContext): boolean | Promise<boolean>;
  /** Do the work. Anything returned still has to pass the quality floor. */
  run(ctx: JobContext): Promise<MoveDraft[]>;
}
