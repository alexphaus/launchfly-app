// src/lib/copilot/today.ts
// What the Today tab is made of, below the call: what was done for you, what
// needs you, and what else is worth doing.
//
// The old Now screen had nine blocks and three of them said "send the drafts".
// Its owner's verdict after living with it: too many things, nothing that
// stands out, the purpose lost. So Today is four parts and each has one job:
//
//   the call         one decision with the work attached (CallCard, unchanged)
//   done for you     what the app produced while you were not looking
//   needs you        the asks, one row each, nothing that merely reports
//   worth doing      at most three other Moves, as rows, each opening its work
//
// "Done for you" is the part that was missing. The product's promise is an app
// that works while you sleep, and the old screen never once said what it had
// done — the nearest thing was "In motion", which reported what YOU had in
// flight. Every row here is something the app did and a row proves it did.
//
// Pure: no DB import. The rows come from HomeData; the tab renders them.

import { blockedOn } from './commission';
import type { CaptureAsk } from './capture';
import type { MotionRow } from './motion';
import type { RecentOutcome } from './review';
import type { CommissionThread, JobsRunSummary, Move } from './types';

/** What "done for you" covers. A day, whoever started the run: night, tap or cron. */
export const DONE_WINDOW_HOURS = 24;
/**
 * Past this the nightly job is not late, it is not running. Same threshold the
 * old screen used: one missed night is not an alarm, a scheduled task that never
 * fires cannot hide.
 */
export const STALE_NIGHT_HOURS = 36;
/** Worth doing, below the call. Three is a morning; eight is a list nobody finishes. */
export const MAX_WORTH_DOING = 3;
/** Projects reported in done-for-you. The rest are one tap away on Work. */
export const MAX_PROJECT_ROWS = 2;
/**
 * How close closed_at and last_run_at are when the worker itself finished a
 * mandate — the same write stamps both. A close by hand is further apart.
 */
export const WORKER_CLOSE_MS = 60_000;

const HOUR_MS = 3_600_000;

export type DoneTarget = 'matches' | 'sources' | 'project' | 'moves' | 'replies';

export interface DoneRow {
  key: string;
  label: string;
  detail: string;
  /**
   * 'warn' when the row is reporting a failure — a watcher night where sources
   * failed. It is shown with a warning mark and is NOT counted as done: a
   * breakage under a green tick, counted in "N done for you", is the calm screen
   * over a failure that invariant 13 is written against.
   */
  tone: 'done' | 'warn';
  target: DoneTarget;
  /** The commission, for a project row. */
  id?: string;
}

export interface DoneReport {
  /** When the nightly run last finished — only while it is fresh. */
  nightlyAt: string | null;
  /** The nightly run never happened, or not for STALE_NIGHT_HOURS. Said on screen, never implied. */
  stale: boolean;
  rows: DoneRow[];
  /** Sensors that broke on the last run, as "key: reason". A breakage is not a quiet night. */
  broke: string[];
  /** Sensors that looked on the last run, for the one line a quiet night gets. */
  looked: number | null;
}

export interface DoneInput {
  now: Date;
  lastCronRun: string | null;
  jobsRun: JobsRunSummary | null;
  /** created_at of every sourced match in hand. */
  matchCreated: string[];
  /**
   * Of those, how many are still waiting on the Matches tab — the new,
   * undrafted, reachable ones. "Found" and "waiting" are different numbers, and
   * a row that said 12 above a tab that says 5 would be the 61-over-51 bug again.
   */
  matchesWaiting: number;
  /** The motion rows loadHome already computed — the watched-sources row is reused, not recomputed. */
  motion: MotionRow[];
  /**
   * Sources whose last read failed. Decides where the sources row leads — to
   * the list that can fix them, or to the finds — from the rows, not by
   * pattern-matching the sentence motion happened to write.
   */
  sourcesFailing: number;
  commissions: CommissionThread[];
  outcomes: RecentOutcome[];
  /** Open Moves that are not feed finds, with when they were written. */
  moves: Array<Pick<Move, 'job' | 'created_at'>>;
}

const within = (iso: string | null | undefined, now: Date, hours: number) =>
  !!iso && now.getTime() - Date.parse(iso) <= hours * HOUR_MS && Date.parse(iso) <= now.getTime() + HOUR_MS;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function doneForYou(input: DoneInput): DoneReport {
  const { now } = input;
  const fresh = within(input.lastCronRun, now, STALE_NIGHT_HOURS);
  const rows: DoneRow[] = [];

  // Supply first: it is the one thing here that came from outside the account.
  const found = input.matchCreated.filter((c) => within(c, now, DONE_WINDOW_HOURS)).length;
  if (found > 0) {
    const waiting = Math.min(input.matchesWaiting, found);
    rows.push({
      key: 'matches',
      label: `${plural(found, 'new match', 'new matches')} found`,
      detail: waiting === found ? 'Real listings, deduped — all waiting on Matches'
        : waiting > 0 ? `Real listings, deduped — ${waiting} still waiting on Matches`
        : 'Real listings, deduped — all already drafted or answered',
      tone: 'done',
      target: 'matches',
    });
  }

  // Replies the app matched to messages you sent. Only 'system' rows: a reply
  // typed in by hand is the user's work, and reporting it back to them as
  // something the app did is the screen taking credit.
  const replies = input.outcomes.filter((o) => o.kind === 'reply' && o.source === 'system' && within(o.occurred_at, now, DONE_WINDOW_HOURS));
  if (replies.length) {
    const who = [...new Set(replies.map((r) => r.who).filter((w): w is string => !!w))];
    rows.push({
      key: 'replies',
      tone: 'done',
      label: `${plural(replies.length, 'reply', 'replies')} came in`,
      detail: who.length ? `${who.slice(0, 2).join(', ')}${who.length > 2 ? ` +${who.length - 2}` : ''} — matched to what you sent` : 'Matched to messages you sent',
      target: 'replies',
    });
  }

  // The watcher, as motion already worded it — including a failure, which
  // leads that row whenever there is one.
  const watched = input.motion.find((m) => m.kind === 'watched');
  if (watched) {
    const failing = input.sourcesFailing > 0;
    rows.push({ key: 'sources', label: watched.label, detail: watched.detail, tone: failing ? 'warn' : 'done', target: failing ? 'sources' : 'matches' });
  }

  // Handed-over work that moved. Progress is the plan's own count, never the
  // worker's say-so; a finished one reports what its owner closed it with.
  const projects: DoneRow[] = [];
  for (const t of input.commissions) {
    const c = t.commission;
    if (c.status === 'done') {
      // Only a finish the WORKER posted. closeCommission sets the same status
      // and closed_at when the owner closes it by hand, and their own verdict is
      // not something the app did for them. recordCommissionWork stamps
      // last_run_at and closed_at in the same write; a close by hand leaves
      // last_run_at where the last run left it.
      const byWorker = !!c.closed_at && !!c.last_run_at && Math.abs(Date.parse(c.closed_at) - Date.parse(c.last_run_at)) < WORKER_CLOSE_MS;
      if (byWorker && within(c.closed_at, now, DONE_WINDOW_HOURS)) {
        projects.push({ key: `p:${c.id}`, label: `Finished: ${c.objective}`, detail: c.outcome?.slice(0, 140) || 'Open it to see what came back', tone: 'done', target: 'project', id: c.id });
      }
      continue;
    }
    if (c.status !== 'active' && c.status !== 'blocked') continue;
    const latest = t.report.did[0];
    if (!latest || !within(latest.at, now, DONE_WINDOW_HOURS)) continue;
    const { done, total } = t.report.progress;
    projects.push({
      key: `p:${c.id}`,
      tone: 'done',
      label: c.objective,
      detail: `${total ? `${done} of ${total} steps done — ` : ''}${latest.summary}`,
      target: 'project',
      id: c.id,
    });
  }
  rows.push(...projects.slice(0, MAX_PROJECT_ROWS));

  // Moves the jobs worked out from the account's own rows. Counted, not
  // listed — they are listed under Worth doing, and saying them twice is the
  // duplication this layout exists to remove.
  // Not a mandate's blocked question — that is an ask, and it is in Needs you —
  // and not a feed find, which is counted in the sources row above.
  const worked = input.moves.filter((m) => m.job !== 'commission' && m.job !== 'watch' && within(m.created_at, now, DONE_WINDOW_HOURS)).length;
  if (worked > 0) {
    rows.push({ key: 'moves', label: `${plural(worked, 'move')} worked out from your rows`, detail: 'Weighed against each other for today’s call', tone: 'done', target: 'moves' });
  }

  return {
    nightlyAt: fresh ? input.lastCronRun : null,
    stale: !fresh,
    rows,
    broke: input.jobsRun?.broke ?? [],
    looked: input.jobsRun?.ran ?? null,
  };
}

/* ─── Needs you ───────────────────────────────────────────────────────────── */

export type AskKind = 'question' | 'fix' | 'approve' | 'confirm' | 'send';

export const ASK_LABEL: Record<AskKind, string> = {
  question: 'Question',
  fix: 'Needs a fix',
  approve: 'Approve',
  confirm: 'Confirm',
  send: 'To send',
};

export interface AskRow {
  key: string;
  kind: AskKind;
  title: string;
  detail: string;
  /** The commission, for question / fix / approve. */
  id?: string;
}

export interface NeedsInput {
  commissions: CommissionThread[];
  capture: CaptureAsk | null;
  queue: { count: number; oldestDays: number };
  /** The queue already IS the call. Saying it again below is the same instruction twice. */
  queueIsCall: boolean;
  /** Invariant 1: with a blank offer the queue is not the next step, the offer is — and the call says so. */
  noOffer: boolean;
}

/**
 * Every ask, one row each, in the order a person should clear them: a worker
 * stopped on a question first (nothing on that mandate moves until it is
 * answered), then a breakage, then the counts the ledger needs repaired, then
 * approvals, then the queue.
 *
 * A breakage is `fix`, never `question`. They both arrive as status 'blocked',
 * and when both wore "Needs you" a morning of outages read as a morning of the
 * user's own unfinished business — see blockedOn.
 */
export function needsYou(input: NeedsInput): AskRow[] {
  const questions: AskRow[] = [];
  const fixes: AskRow[] = [];
  const approvals: AskRow[] = [];
  for (const t of input.commissions) {
    const c = t.commission;
    if (c.status === 'draft') {
      approvals.push({ key: `a:${c.id}`, kind: 'approve', title: c.objective, detail: 'Written and waiting — nothing runs until you approve it', id: c.id });
      continue;
    }
    const on = blockedOn(c, t.report);
    if (on === 'you') {
      questions.push({ key: `q:${c.id}`, kind: 'question', title: t.report.yours[0]?.summary ?? 'It stopped to ask you something', detail: c.objective, id: c.id });
    } else if (on === 'worker') {
      fixes.push({ key: `f:${c.id}`, kind: 'fix', title: c.objective, detail: 'The worker could not finish — one tap tries it again', id: c.id });
    }
  }

  const out: AskRow[] = [...questions, ...fixes];
  if (input.capture) out.push({ key: 'capture', kind: 'confirm', title: input.capture.headline, detail: input.capture.because });
  out.push(...approvals);
  if (input.queue.count > 0 && !input.queueIsCall && !input.noOffer) {
    out.push({
      key: 'queue',
      kind: 'send',
      title: `${plural(input.queue.count, 'draft')} ready to send`,
      detail: input.queue.oldestDays > 0 ? `The oldest has waited ${plural(input.queue.oldestDays, 'day')}` : 'Written today',
    });
  }
  return out;
}

/* ─── Worth doing ─────────────────────────────────────────────────────────── */

/**
 * The Moves that belong on Today, beside the call rather than somewhere else.
 *
 * Four kinds go elsewhere, each to exactly one place, so nothing renders twice:
 * watched-feed finds are Matches; the send queue is its own row in Needs you; a
 * blocked mandate's question is its row in Needs you too; a plan the app offers
 * to carry out is a project, on Work.
 */
export function worthDoing(moves: Move[], max = MAX_WORTH_DOING): { shown: Move[]; more: number } {
  const here = moves.filter((m) => m.job !== 'watch' && m.job !== 'send_queue' && m.job !== 'commission' && m.artifact?.kind !== 'plan');
  return { shown: here.slice(0, max), more: Math.max(0, here.length - max) };
}

/** The line under the greeting on Today: two counts, and nothing when both are zero. */
export function todayStatus(done: DoneReport, asks: AskRow[]): string | null {
  // A warning row is not something done for you, however it is listed.
  const doneCount = done.rows.filter((r) => r.tone === 'done').length;
  const parts = [
    doneCount ? `${doneCount} done for you` : null,
    asks.length ? `${asks.length} need${asks.length === 1 ? 's' : ''} you` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
