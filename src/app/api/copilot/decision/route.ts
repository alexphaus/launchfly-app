import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { todayIso } from '@/lib/copilot/db';
import { getProfile, insertRoadmapMark, loadHome, loadRoadmapRuns, respondToDecision, setMoveStatus, standDownTopic } from '@/lib/copilot/store';
import { PLAN_TOPIC, stepForCall } from '@/lib/copilot/roadmap';
import { phraseFor } from '@/lib/copilot/call';

export const runtime = 'nodejs';

/**
 * What the user did about today's call.
 *
 * 'ignored' is deliberately not accepted: it is inferred by the sweep from a
 * call that was still pending when the next one arrived. A record that only
 * contains the outcomes someone chose to type in is a flattering record, and a
 * flattering record cannot tell you which of your calls were wrong.
 */
const RESPONSES = ['did', 'rejected', 'wrong'] as const;

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const response = RESPONSES.find((r) => r === b.response);
  if (!response) return fail('Unknown response', 400);

  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  const decision = await respondToDecision(auth.pid, todayIso(profile.timezone), response);
  if (!decision) return fail('No call recorded for today yet', 404);

  // A promoted call and the Move it came from are one thing on the screen, so
  // they are one thing to answer. Leaving the Move open would put it back in
  // the stack the moment the call was answered — the same work offered twice,
  // which is what promoting it was meant to stop.
  if (decision.source_move_id) {
    await setMoveStatus(auth.pid, decision.source_move_id, response === 'did' ? 'done' : 'dismissed');
  }

  // The same for a call drawn from the plan: "I did it" is the person's tap on
  // that step, so it ticks it (roadmap.ts rule 2 — done is a tap, and this is
  // one). A no is not "not for me": the step stays on the plan. A tick that did
  // not save is said, not swallowed (invariant 13): the call is recorded either way.
  let note: string | null = null;
  if (decision.topic === PLAN_TOPIC && response === 'did') {
    try {
      const runs = await loadRoadmapRuns(auth.pid);
      const step = stepForCall(runs.current?.roadmap ?? null, decision.headline);
      if (step) await insertRoadmapMark(auth.pid, { item: step.id, title: step.title, state: 'done' });
    } catch (e) {
      note = `Recorded, but the step on your plan did not tick: ${e instanceof Error ? e.message : 'unknown error'}`;
    }
  }

  // "Not today" versus "stop suggesting this". A plain refusal decays and
  // expires after REFUSAL_WINDOW decisions, which is right for a mood and wrong
  // for a conclusion — somebody who has decided outreach is no longer their
  // leverage should not be asked again in ten days. Only ever on a refusal: you
  // cannot stand down something you just said you did.
  if (b.permanent === true && response === 'rejected' && decision.topic) {
    await standDownTopic(auth.pid, decision.topic, phraseFor(decision.topic));
    return json({ ok: true, decision, stoodDown: decision.topic, home: await loadHome(auth.pid) });
  }
  return json({ ok: true, decision, note, home: await loadHome(auth.pid) });
}
