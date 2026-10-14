// src/lib/copilot/worklog.ts
// The work layer's own rows: who each job went to, what the app checked, which
// calls wait on the person, and which of a worker's reports were already taken.
//
// All of it is `copilot_events`, keyed by `payload.commission_id`, so none of it
// waits on a migration — code and schema deploy separately here, and a worker
// registry that could not run until a table existed would be the dispatcher
// failing at 21:00 for a reason nobody can see.
//
// Pure: the parse. workstore.ts reads and writes the rows.

import type { CommissionCheck } from './commission';
import type { Check } from './contract';
import { JOB_KINDS, type JobKind } from './contract';
import type { Dispatch } from './workers';

/** A hand-over: which worker, which kind of job, whether it got there. */
export const WORK_DISPATCH = 'commission_dispatch';
/** The app's check of a done (contract.ts verdictOf). */
export const WORK_CHECK = 'commission_check';
/** A call through the person's account, waiting for their OK. */
export const WORK_TOOL_ASK = 'commission_tool_ask';
/** Their OK, or their no. */
export const WORK_TOOL_ANSWER = 'commission_tool_answer';
/** A report the Claude agent made, taken once: the reply is kept so a lost answer can be sent again without recording twice. */
export const WORK_REPORT = 'commission_report';
/** A session that stopped with the job unfinished, recorded once per stop. */
export const WORK_SESSION_END = 'commission_session_end';
/** The worker the person chose for a job. */
export const WORK_ASSIGNED = 'commission_assigned';
/** What the person did that resets the send-back count. Written by store.ts already. */
export const WORK_APPROVED = 'commission_approved';
export const WORK_UNBLOCKED = 'commission_unblocked';

export const WORK_EVENTS = [WORK_DISPATCH, WORK_CHECK, WORK_TOOL_ASK, WORK_TOOL_ANSWER, WORK_REPORT, WORK_SESSION_END, WORK_ASSIGNED, WORK_APPROVED, WORK_UNBLOCKED] as const;

export interface WorkRow { event_type: string; payload: unknown; created_at: string }

export interface ToolAsk {
  commission_id: string;
  session: string;
  /** The session event that paused: what the OK answers. */
  tool_use_id: string;
  /** The needs_you line the person reads it as. */
  event_id: string | null;
  tool: string;
  account: string | null;
  at: string;
}

export interface WorkLog {
  dispatches: Dispatch[];
  /** Per job, newest first. */
  checks: Map<string, CommissionCheck[]>;
  /** Per job, the calls still waiting on the person, oldest first. */
  asks: Map<string, ToolAsk[]>;
  /** Every call ever raised to the person, answered or not: one call is one question, once. */
  askIds: Set<string>;
  assigned: Map<string, string>;
  /** Report tool uses already taken, with the reply they were given. */
  reports: Map<string, string>;
  /** Session stops already recorded. */
  ends: Set<string>;
  /** When the person last gave the job a go: approved it or cleared it. Send-backs count from here. */
  touched: Map<string, string>;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

function checkFrom(p: Record<string, unknown>, at: string): CommissionCheck | null {
  if (typeof p.passed !== 'boolean') return null;
  const checks = (Array.isArray(p.checks) ? p.checks : [])
    .map(obj)
    .filter((c) => typeof c.key === 'string' && typeof c.line === 'string' && ['pass', 'fail', 'unknown'].includes(c.state as string))
    .map((c) => ({ key: c.key, state: c.state, line: (c.line as string).slice(0, 200) }) as Check);
  const sendBack = (Array.isArray(p.sendBack) ? p.sendBack : []).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 400));
  return { at, passed: p.passed, final: p.final === true, checks, sendBack };
}

/** The rows, as the work layer reads them. Unknown shapes are skipped, never guessed at. */
export function workOf(rows: WorkRow[]): WorkLog {
  const out: WorkLog = { dispatches: [], checks: new Map(), asks: new Map(), askIds: new Set(), assigned: new Map(), reports: new Map(), ends: new Set(), touched: new Map() };
  const answered = new Set<string>();
  const asks: ToolAsk[] = [];
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of sorted) {
    const p = obj(r.payload);
    const id = s(p.commission_id);
    if (!id) continue;
    switch (r.event_type) {
      case WORK_DISPATCH: {
        const worker = s(p.worker);
        if (!worker) break;
        const job = (JOB_KINDS as readonly string[]).includes(p.job as string) ? p.job as JobKind : 'research';
        out.dispatches.push({ commission_id: id, worker, job, ok: p.ok === true, error: s(p.error)?.slice(0, 300) ?? null, session: s(p.session), at: r.created_at });
        break;
      }
      case WORK_CHECK: {
        const c = checkFrom(p, r.created_at);
        if (c) out.checks.set(id, [c, ...(out.checks.get(id) ?? [])]);
        break;
      }
      case WORK_TOOL_ASK: {
        const tool = s(p.tool_use_id), session = s(p.session);
        if (tool) out.askIds.add(tool);
        if (tool && session) asks.push({ commission_id: id, session, tool_use_id: tool, event_id: s(p.event_id), tool: s(p.tool) ?? 'a tool', account: s(p.account), at: r.created_at });
        break;
      }
      case WORK_TOOL_ANSWER: { const tool = s(p.tool_use_id); if (tool) answered.add(tool); break; }
      case WORK_REPORT: { const tool = s(p.tool_use_id); if (tool) out.reports.set(tool, s(p.reply) ?? ''); break; }
      case WORK_SESSION_END: { const idle = s(p.idle_id); if (idle) out.ends.add(idle); break; }
      case WORK_ASSIGNED: { const w = s(p.worker); if (w) out.assigned.set(id, w); else out.assigned.delete(id); break; }
      case WORK_APPROVED: case WORK_UNBLOCKED: out.touched.set(id, r.created_at); break;
    }
  }
  for (const a of asks) if (!answered.has(a.tool_use_id)) out.asks.set(a.commission_id, [...(out.asks.get(a.commission_id) ?? []), a]);
  return out;
}

/** The newest hand-over of a job, or null: where it is now. */
export function lastDispatch(log: Pick<WorkLog, 'dispatches'>, commissionId: string, okOnly = true): Dispatch | null {
  for (let i = log.dispatches.length - 1; i >= 0; i--) {
    const d = log.dispatches[i];
    if (d.commission_id === commissionId && (!okOnly || d.ok)) return d;
  }
  return null;
}

/**
 * Which send-back this would be: failed checks since the person last gave the
 * job a go, plus this one. A retry the person asked for starts the count again,
 * or the first failure after it would stop the job at once.
 */
export function sendBackRound(log: Pick<WorkLog, 'checks' | 'touched'>, commissionId: string): number {
  const since = log.touched.get(commissionId) ?? '';
  return (log.checks.get(commissionId) ?? []).filter((c) => !c.passed && c.at > since).length + 1;
}

/** Jobs a done of which was sent back at least once: for each worker's record. */
export const sentBackIds = (log: Pick<WorkLog, 'checks'>) =>
  new Set([...log.checks].filter(([, cs]) => cs.some((c) => !c.passed)).map(([id]) => id));
