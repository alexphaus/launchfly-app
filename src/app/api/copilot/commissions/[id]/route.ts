// src/app/api/copilot/commissions/[id]/route.ts
// Grant authority, answer it, call it off, choose who does it, set it to repeat,
// say OK to a call through your own account, or mark the thread read.

import { after } from 'next/server';
import { runJobs } from '@/lib/copilot/jobs';
import { EVENTS_PER_COMMISSION, approveCommission, closeCommission, insertAnswered, loadCommissionEvents, loadCommissions, loadHome, markCommissionSeen, unblockCommission } from '@/lib/copilot/store';
import { WORTH, WORTH_NOTE_MAX, isWorthKind } from '@/lib/copilot/worth';
import { jobKindOf } from '@/lib/copilot/contract';
import { registry } from '@/lib/copilot/hands';
import { answerAsk, stopSession } from '@/lib/copilot/managed';
import { REPEAT_OFF, REPEAT_ON, isRepeatEvery } from '@/lib/copilot/repeats';
import { canTake } from '@/lib/copilot/workers';
import { WORK_ASSIGNED, lastDispatch } from '@/lib/copilot/worklog';
import { loadRepeats, loadWork, recordWork } from '@/lib/copilot/workstore';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
/** Room for the dispatch that approving starts in after(). */
export const maxDuration = 120;
/** The commission job's own synchronous ceiling for a worker's reply. */
const DISPATCH_BUDGET_MS = 90_000;

/**
 * The close-out answer, or undefined when the user skipped it.
 *
 * Skipping is allowed and has to be: a required field on this question would be
 * answered by whichever button is nearest the thumb, and a ledger of taps is
 * worse than an empty one because it looks like evidence. An unrecognised kind is
 * dropped rather than coerced — closing with a worth nobody chose would put a
 * verdict in the ranker the user never gave.
 */
function worthFrom(b: Record<string, unknown>) {
  if (!isWorthKind(b.worth)) return undefined;
  const raw = Number(b.amount);
  // Only the two kinds that ask for a number may carry one, so an amount left in
  // a stale form state cannot ride out attached to `nothing`.
  const takesAmount = WORTH[b.worth].amount === 'optional';
  const amount = takesAmount && Number.isFinite(raw) && raw > 0 ? raw : null;
  return {
    worth: b.worth,
    amount,
    note: typeof b.note === 'string' ? b.note.trim().slice(0, WORTH_NOTE_MAX) || null : null,
  };
}

/**
 * One project's log, for its sheet. The home carries the log of live projects
 * only (loadHome), so a closed one's sheet reads it here when it opens — without
 * this, what a finished project produced was on no screen at all: the Writer
 * posts its draft and closes in one call, and the person saw "Written: Landing
 * page copy" over an empty sheet. Scoped to the person's own rows by the query.
 * A failed read is an error, never an empty log (invariant 13).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  try {
    return json({ ok: true, events: await loadCommissionEvents(auth.pid, [id], EVENTS_PER_COMMISSION, { strict: true }) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not read what it did', 500);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));

  try {
    switch (b.action) {
      case 'approve': {
        // The running bet's own slot (commission.ts roomToStart) and the
        // person's day, read off the record rather than the request.
        const before = await loadHome(auth.pid);
        const bet = before?.lab && !before.lab.unreadable ? before.lab.bets.find((x) => x.state === 'running') ?? null : null;
        const c = await approveCommission(auth.pid, id, { today: before?.recent.today, forBet: bet ? before?.lab?.links?.[bet.bet.id] ?? [] : undefined });
        // Null means it was not a draft. Re-approving would reset approved_at
        // and lose when the mandate was actually granted, which is the one
        // timestamp that matters if anybody asks what the app was allowed to do.
        if (!c) return fail('That one is already running.');
        // Started now rather than at 21:00: approved work that waits a day for
        // the nightly pass reads, from the phone, exactly like work nobody took.
        // after(), so the tap has its answer before a worker is heard from.
        const started = registry().workers.length > 0;
        if (started) {
          after(async () => {
            await runJobs(auth.pid, { deadline: Date.now() + DISPATCH_BUDGET_MS, only: ['commission'] })
              .catch((e: unknown) => console.error('[copilot/commissions] dispatch on approve failed; the nightly pass retries it', e));
          });
        }
        return json({ ok: true, commission: c, started, home: await loadHome(auth.pid) });
      }
      case 'unblock': {
        // The answer is optional because not every needs_you is a question —
        // "the site wants a login I do not have" is cleared by going and fixing
        // it, not by typing. When there IS one it goes out with the next brief,
        // which is the only reason the worker can stop asking.
        const answer = typeof b.answer === 'string' ? b.answer : null;
        // A call through the person's account still waiting for its OK keeps the
        // job where it is: clearing it would leave the agent's session waiting on
        // an OK nobody can give from a job marked as running. The answer is kept,
        // and goes out with the next hand-over.
        const pending = (await loadWork(auth.pid, [id])).log.asks.get(id)?.length ?? 0;
        if (pending) {
          if (answer?.trim()) await insertAnswered(auth.pid, id, answer);
          return json({ ok: true, started: false, note: `Kept. It still waits for your OK on ${pending === 1 ? 'a message' : `${pending} messages`} before it carries on.`, home: await loadHome(auth.pid) });
        }
        const c = await unblockCommission(auth.pid, id, answer);
        if (!c) return fail('That one is not waiting on you.');
        // An answer goes to the worker now, the way an approval does: a reply
        // typed on Work that then waits for 21:00 reads, from the phone, like a
        // reply nobody heard. Only with an answer — a retry with none hands the
        // work over itself (runCommissionsNow), and doing both would dispatch twice.
        const started = !!answer?.trim() && registry().workers.length > 0;
        if (started) {
          after(async () => {
            await runJobs(auth.pid, { deadline: Date.now() + DISPATCH_BUDGET_MS, only: ['commission'] })
              .catch((e: unknown) => console.error('[copilot/commissions] dispatch on answer failed; the nightly pass retries it', e));
          });
        }
        return json({ ok: true, commission: c, started, home: await loadHome(auth.pid) });
      }
      case 'stop':
      case 'done': {
        const w = worthFrom(b);
        const { recorded, reason } = await closeCommission(
          auth.pid, id, b.action === 'done' ? 'done' : 'stopped',
          w ? { kind: w.worth, amount: w.amount, note: w.note } : undefined,
        );
        // A Claude agent still on the job is told to stop: one left running on
        // a closed job spends on work nobody will read.
        const { log } = await loadWork(auth.pid, [id]);
        const d = lastDispatch(log, id);
        const unstopped = d?.session ? await stopSession(d.session) : null;
        // `note` rather than `error`: the mandate did close, so failing the
        // request would be a lie in the other direction — the sheet would stay
        // open over a commission that is no longer running. It says what did not
        // happen instead, which is the only honest report of a half-success.
        const note = [reason, unstopped ? `Closed here, but ${unstopped}.` : null].filter(Boolean).join(' ') || null;
        return json({ ok: true, recorded, note, home: await loadHome(auth.pid) });
      }
      case 'confirm': {
        // The person's OK, or no, on one call the Claude agent wants to make
        // through their own account. One call, one answer: the next message it
        // wants to send comes back for its own.
        const allow = b.allow === true;
        const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null;
        const { log, unreadable } = await loadWork(auth.pid, [id]);
        if (unreadable) return fail(`Your answer could not be passed on: ${unreadable}`);
        const waiting = log.asks.get(id) ?? [];
        const ask = waiting.find((a) => a.tool_use_id === b.call) ?? waiting[0];
        if (!ask) return fail('Nothing on this job is waiting for your OK.');
        const c = (await loadCommissions(auth.pid)).find((x) => x.id === id);
        if (!c) return fail('That job is gone.');
        await answerAsk(auth.pid, c, ask, allow, note, waiting.length - 1);
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'repeat': {
        // A standing grant: every run is written and approved by the nightly
        // pass without asking again. Research and draft only — a standing grant
        // to contact people, or to spend, is exactly what the rings refuse.
        const c = (await loadCommissions(auth.pid)).find((x) => x.id === id);
        if (!c) return fail('That job is gone.');
        // Set on the job the runs come from, whichever run it is set from: a
        // repeat turned off on this week's run must stop the next one too.
        const reps = await loadRepeats(auth.pid);
        if (reps.unreadable) return fail(`Your repeats could not be read just now: ${reps.unreadable}`);
        const template = reps.runs.find((r) => r.id === id)?.from ?? id;
        if (b.every === null || b.every === 'off') {
          await recordWork(auth.pid, REPEAT_OFF, { commission_id: template });
        } else {
          if (!isRepeatEvery(b.every)) return fail('Every day, week or month.');
          if (c.authority !== 'read') return fail('Only research-and-draft jobs repeat: a standing grant to contact people would send with nobody looking.');
          if (c.status === 'draft') return fail('Approve it first: a repeat is a standing yes to a job you have said yes to once.');
          await recordWork(auth.pid, REPEAT_ON, { commission_id: template, every: b.every });
        }
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'assign': {
        // Who does it, when the person would rather choose. Only a worker that
        // may take this job: the same rule routing applies (workers.ts canTake).
        const c = (await loadCommissions(auth.pid)).find((x) => x.id === id);
        if (!c) return fail('That job is gone.');
        const key = typeof b.worker === 'string' && b.worker ? b.worker : null;
        if (key) {
          const w = registry().workers.find((x) => x.key === key);
          if (!w) return fail('No worker by that name is connected.');
          if (!canTake(w, jobKindOf(c.objective).kind, c.authority)) return fail(`${w.name} does not take this kind of job.`);
        }
        await recordWork(auth.pid, WORK_ASSIGNED, { commission_id: id, worker: key });
        return json({ ok: true, home: await loadHome(auth.pid) });
      }
      case 'seen':
        // No home reload: this fires on opening the sheet, and rewriting the
        // whole screen underneath somebody who just tapped into it is how the
        // card they were reading moves out from under them.
        await markCommissionSeen(auth.pid, id);
        return json({ ok: true });
      default:
        return fail('Unknown action');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not update that commission');
  }
}
