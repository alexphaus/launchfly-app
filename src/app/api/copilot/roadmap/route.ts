// The Path's plan: draw it now, watch the draw, and tick its steps.
//
// A draw is a model call that can take a minute, and the proxy gives up in
// under one, so POST { action: 'draw' } writes the row, hands the draw to
// after(), and returns — the same shape as "Run again". The client polls GET
// until the row finishes and reads the plan, or why there is none, from it.
//
// POST { action: 'mark', item, state } is the person saying a step is done,
// set aside, or back on. It is the only way anything on the plan becomes done:
// the model is shown these marks and can never write one (lib/copilot/roadmap.ts).
import { after } from 'next/server';
import { drawRoadmap, startRoadmap } from '@/lib/copilot/agent/roadmap';
import { refreshCallFromPlan } from '@/lib/copilot/brief';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';
import { roadmapInFlight, roadmapItem, roadmapStep, type MarkState } from '@/lib/copilot/roadmap';
import { PERSON_STATES } from '@/lib/copilot/experiment';
import { runJobs } from '@/lib/copilot/jobs';
import { handOverStep, insertExperimentMark, insertRoadmapMark, loadHome, loadRoadmapRuns, noteRoadmapRun } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Draws a day, per account. Each is one model call; opening the app draws only
 * when the person said something new, so a real day uses two or three. The cap
 * is for a loop nobody meant — a composer submitted over and over.
 */
const DRAWS_PER_DAY = 12;

const MARK_STATES: MarkState[] = ['done', 'dropped', 'open'];
/** A worker's reply, once handed a step: the commission job's own synchronous ceiling. */
const HANDOVER_BUDGET_MS = 90_000;

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const runs = await loadRoadmapRuns(auth.pid);
  // A failed read is an error, not "no draw": the poller would stop watching one still going.
  if (runs.unreadable) return fail(`Could not read the plan: ${runs.unreadable}`, 500);
  return json({ ok: true, run: runs.latest });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);

  if (b.action === 'mark') {
    const item = typeof b.item === 'string' ? b.item : '';
    const state = MARK_STATES.find((s) => s === b.state);
    if (!item || !state) return fail('Which step, and what happened to it?');
    const runs = await loadRoadmapRuns(auth.pid);
    if (runs.unreadable) return fail(`Could not read the plan: ${runs.unreadable}`, 500);
    // Named from the plan itself, never from the request: a mark is about something that is on it.
    const found = roadmapItem(runs.current?.roadmap ?? null, item);
    if (!found) return fail('That step is not on your plan any more. Pull to refresh.', 409);
    try {
      await insertRoadmapMark(auth.pid, { item, title: found.title, state });
      return json({ ok: true, home: await loadHome(auth.pid) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not save that', 500);
    }
  }

  // The experiment: tried, set aside, or how it went. Named from the plan itself,
  // never from the request, like a mark — and 'ignored' is not the person's to
  // post: it is inferred, never asked (invariant 5).
  if (b.action === 'experiment') {
    const state = PERSON_STATES.find((x) => x === b.state);
    if (!state || typeof b.id !== 'string') return fail('Which experiment, and what happened?');
    const runs = await loadRoadmapRuns(auth.pid);
    if (runs.unreadable) return fail(`Could not read the plan: ${runs.unreadable}`, 500);
    const exp = runs.current?.roadmap?.experiment ?? null;
    if (!exp || exp.id !== b.id) return fail('That experiment is not on your plan any more. Pull to refresh.', 409);
    try {
      await insertExperimentMark(auth.pid, { id: exp.id, title: exp.title, angle: exp.angle, state });
      return json({ ok: true, home: await loadHome(auth.pid) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not save that', 500);
    }
  }

  // A step the plan gave the agent, handed over and started in one tap: the
  // step, what it serves and what the agent may do are on screen when it is
  // tapped (handOverStep). Looked up on the plan, never taken from the request.
  if (b.action === 'handover') {
    if (typeof b.item !== 'string') return fail('Which step?');
    if (!process.env.COPILOT_JOBS_URL) return fail('No agent is connected to this deployment, so there is nothing to hand this to.');
    const runs = await loadRoadmapRuns(auth.pid);
    if (runs.unreadable) return fail(`Could not read the plan: ${runs.unreadable}`, 500);
    const found = roadmapStep(runs.current?.roadmap ?? null, b.item);
    if (!found) return fail('That step is not on your plan any more. Pull to refresh.', 409);
    if (found.step.who !== 'ai') return fail('That one is yours to do: the plan did not give it to the agent.');
    const { step, milestone } = found;
    try {
      const { started } = await handOverStep(auth.pid, {
        objective: step.title,
        why: [`A step toward: ${milestone.title}.`, milestone.why].filter(Boolean).join(' '),
        goalId: milestone.goalId,
        steps: [
          step.title,
          `Report back what you made or found, with links, so it can be checked against: ${milestone.doneWhen ?? milestone.title}`,
        ],
      });
      // Now, not at 21:00. In after(): the tap has its answer already, and a
      // worker that takes a minute to reply must not hold the screen.
      if (started) {
        after(async () => {
          const r = await runJobs(auth.pid, { deadline: Date.now() + HANDOVER_BUDGET_MS, only: ['commission'] }).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
          if ('error' in r && r.error) console.error('[copilot/roadmap] handover dispatch failed; the nightly pass retries it', r.error);
        });
      }
      return json({ ok: true, started, home: await loadHome(auth.pid) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not hand that over', 500);
    }
  }

  if (b.action !== 'draw') return fail('Unknown action');

  const runs = await loadRoadmapRuns(auth.pid);
  if (runs.unreadable) return fail(`Could not read the plan: ${runs.unreadable}`, 500);
  // A second tap, or the night already drawing, gets the draw in flight rather than a second one beside it.
  if (roadmapInFlight(runs.latest, new Date())) return json({ ok: true, run: runs.latest, already: true });

  const rl = await rateLimit(`copilot:roadmap:${auth.pid}`, DRAWS_PER_DAY, 86400);
  if (!rl.ok) return fail(`That is today’s ${DRAWS_PER_DAY} redraws. The plan redraws tonight on its own.`, 429);

  const reason = typeof b.reason === 'string' && /^[a-z_]{1,24}$/.test(b.reason) ? b.reason : 'manual';
  // No row, no draw: one nobody can watch reports nothing.
  const started = await startRoadmap(auth.pid, reason);
  if ('error' in started) return fail(started.error, 502);

  const runId = started.run.id;
  after(async () => {
    // drawRoadmap never throws: the outcome, failure included, is on the row the screen reads.
    const r = await drawRoadmap(auth.pid, runId);
    if (!r.ok) { console.error('[copilot/roadmap] draw failed', r.error); return; }
    // The call was picked before this plan existed. While it waits on an
    // answer it follows the plan, or the card over the plan contradicts it.
    // A failure is written on the plan's own row, where the Path reads it.
    const call = await refreshCallFromPlan(auth.pid);
    if (call.error) await noteRoadmapRun(runId, { callError: call.error });
  });
  return json({ ok: true, run: started.run }, 202);
}
