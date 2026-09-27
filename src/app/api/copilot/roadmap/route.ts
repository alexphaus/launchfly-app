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
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';
import { roadmapInFlight, roadmapItem, type MarkState } from '@/lib/copilot/roadmap';
import { insertRoadmapMark, loadHome, loadRoadmapRuns } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Draws a day, per account. Each is one model call; opening the app draws only
 * when the person said something new, so a real day uses two or three. The cap
 * is for a loop nobody meant — a composer submitted over and over.
 */
const DRAWS_PER_DAY = 12;

const MARK_STATES: MarkState[] = ['done', 'dropped', 'open'];

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
    if (!r.ok) console.error('[copilot/roadmap] draw failed', r.error);
  });
  return json({ ok: true, run: started.run }, 202);
}
