// src/lib/copilot/jobs/betplan.ts
// The running bet's plan, taken up again every night until its last day
// (betplan.ts, planrun.ts): a step that failed is tried again, a project that
// found no slot is handed over when there is one, and the Scout looks for more
// people once everyone found has been answered or set aside. The bet ending is
// what stops it — no rule to turn off, no repeat outliving the bet.
//
// It writes no Moves. What it did is on the bet's card, a row per step, and a
// run that broke is in the night's report like any job's (invariant 13).

import { resolveLlmConfig } from '../agent/llm';
import { registry } from '../hands';
import { runBetPlan } from '../planrun';
import { exaConfigured } from '../watch/exa';
import type { Job } from './types';

export const betPlanJob: Job = {
  key: 'bet_plan',
  label: 'Your bet’s plan',

  /** Cheap, as the contract requires: something on this server can do a crew step, or nothing here can. */
  available: () => exaConfigured() || !!resolveLlmConfig() || registry().workers.length > 0,

  async run(ctx) {
    const r = await runBetPlan(ctx.profile.id, { reason: 'nightly', deadline: ctx.deadline, now: ctx.now });
    // Every step's failure is already its own row on the card; one that could not even be recorded is the run's.
    if (r.unrecorded.length) throw new Error(`the bet's plan: ${r.unrecorded.join('; ')}`);
    return [];
  },
};
