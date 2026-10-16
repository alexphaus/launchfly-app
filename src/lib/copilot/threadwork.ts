// src/lib/copilot/threadwork.ts
// One job's place in the work layer, as its card and sheet read it: who has
// it, who it would go to, what waits on the person, whether it repeats, and
// what it may spend.
//
// Pure: no DB import. loadHome reads the rows and calls this per job.

import type { Commission } from './commission';
import { jobKindOf } from './contract';
import { budgetCents, dollars, toolWords } from './managedwire';
import { repeatLine, ruleFor, type RepeatRule, type RepeatRun, type RepeatSkip } from './repeats';
import type { ThreadWork } from './types';
import { choosable, pickWorker, type Registry, type WorkerRecord } from './workers';
import { lastDispatch, type WorkLog } from './worklog';

export interface ThreadWorkInput {
  registry: Registry;
  log: WorkLog;
  records: Record<string, WorkerRecord>;
  repeats: { rules: RepeatRule[]; runs: RepeatRun[]; skips: RepeatSkip[] };
  /** When a job set to repeat was written, for its next-run line: it may be older than the jobs loaded. */
  createdOf: (id: string) => string | null;
  env: Record<string, string | undefined>;
}

export function threadWorkOf(c: Commission, i: ThreadWorkInput): ThreadWork {
  const job = jobKindOf(c.objective).kind;
  const ok = lastDispatch(i.log, c.id, true);
  // A hand-over that found no worker at all is said once, as `noWorker` below,
  // not again as a worker that could not be reached.
  const any = [...i.log.dispatches].reverse().find((d) => d.commission_id === c.id && d.worker !== 'none') ?? null;
  const spec = ok ? i.registry.workers.find((w) => w.key === ok.worker) ?? null : null;
  // A job with nobody yet: who routing would pick, so the person sees who
  // before they say yes, and why nobody, when nobody may.
  const pick = !ok && c.status !== 'done' && c.status !== 'stopped'
    ? pickWorker({ commission: c, job, registry: i.registry, assigned: i.log.assigned.get(c.id) ?? null, last: null, records: i.records })
    : null;
  const managed = spec?.via === 'managed' || (!!pick?.worker && pick.worker.via === 'managed');
  const rule = ruleFor(c.id, i.repeats.rules, i.repeats.runs);
  return {
    job,
    with: ok ? { key: ok.worker, name: spec?.name ?? ok.worker, kind: spec?.kind ?? 'agent' } : null,
    handedAt: ok?.at ?? null,
    unreached: any && !any.ok && (!ok || any.at > ok.at) ? (any.error ?? 'It did not answer') : null,
    wouldGo: pick?.worker?.name ?? null,
    noWorker: pick && !pick.worker ? pick.why : null,
    choosable: choosable(i.registry, job, c.authority).map((w) => ({ key: w.key, name: w.name })),
    assigned: i.log.assigned.get(c.id) ?? null,
    asks: (i.log.asks.get(c.id) ?? []).map((a) => ({ call: a.tool_use_id, tool: toolWords(a.tool), account: a.account, event: a.event_id })),
    repeat: rule ? { every: rule.every, template: rule.template, line: repeatLine(rule, i.repeats.runs, i.repeats.skips, i.createdOf(rule.template) ?? c.created_at) } : null,
    cap: managed ? dollars(budgetCents(c.budget_minutes, i.env)) : null,
  };
}
