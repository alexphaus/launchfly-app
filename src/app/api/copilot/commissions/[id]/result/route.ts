// src/app/api/copilot/commissions/[id]/result/route.ts
// Where the worker posts what it got done.
//
// This is the return leg of the contract, and the half that has never existed.
// COPILOT_JOBS_URL has always been able to push a profile out and take Moves
// back — but that payload commissions nothing, names no objective and cannot be
// reported against, so whatever came back could only ever be a suggestion. A
// commission goes out with an id; this is what it reports to.
//
//   POST /api/copilot/commissions/<id>/result
//   Authorization: Bearer $COPILOT_INBOUND_SECRET   (or the worker's own inbound_secret_env)
//   {
//     "events": [
//       { "kind": "found", "step": 2, "summary": "Three suppliers quote under $400",
//         "artifact": { "kind": "link", "label": "The quotes", "value": "...", "href": "https://..." } },
//       { "kind": "needs_you", "summary": "Which of the three should I brief?" }
//     ],
//     "plan": [ { "n": 1, "do": "...", "state": "done" } ],   // optional, when the plan was wrong
//     "status": "blocked"                                      // parsed, never obeyed
//   }
//
// Nothing here is trusted, and the bar is higher than the Moves socket's. That
// one could pollute a section of one screen; this writes the log a person reads
// to decide whether a mandate is working — a worker that lies produces a false
// record of the app's own behaviour. So `status` is parsed and discarded:
// nextStatus decides from the events, because a worker must not mark its own
// homework, and reporting success would otherwise be the cheapest way to look
// successful.

import { loadCommissions } from '@/lib/copilot/store';
import { logEvent } from '@/lib/copilot/base';
import { normalizeResult } from '@/lib/copilot/commission';
import { acceptWork } from '@/lib/copilot/deliver';
import { inboundConfigured, registry, workerForBearer } from '@/lib/copilot/hands';
import { lastDispatch } from '@/lib/copilot/worklog';
import { commissionOwner, loadWork } from '@/lib/copilot/workstore';
import { fail, json, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Fail closed, exactly as /moves/inbound does: an unconfigured secret must not
  // leave a write endpoint open to anyone who can guess the path.
  const reg = registry();
  if (!inboundConfigured(reg)) return fail('COPILOT_INBOUND_SECRET is not configured; refusing to accept work.', 503);
  const who = workerForBearer(req.headers.get('authorization'), reg);
  if (!who) return fail('Unauthorized', 401);

  const { id } = await ctx.params;
  // The commission id is the address, so the profile is read from the row
  // rather than taken from the body. A worker holding the shared secret can
  // report against a commission; it cannot name which account to write to.
  const profileId = await commissionOwner(id);
  if (!profileId) return fail('No such commission', 404);

  // A worker with a key of its own reports only on work handed to it: a
  // person's key must not be able to write into a job the Claude agent holds.
  // The shared secret keeps its old reach — it is the n8n worker's, and every
  // worker set up before the registry carries it.
  const { log } = await loadWork(profileId, [id]);
  if (!who.shared && lastDispatch(log, id)?.worker !== who.worker) {
    return fail('That job was not handed to you.', 403);
  }

  const commission = (await loadCommissions(profileId, 50)).find((c) => c.id === id);
  if (!commission) return fail('No such commission', 404);
  // A mandate that was never granted, or that the user called off, does not
  // accept work. Otherwise "stop" is advisory and the approve button is a
  // suggestion.
  if (commission.status === 'draft' || commission.status === 'stopped') {
    return fail(`That one is ${commission.status} and is not taking work.`, 409);
  }

  const result = normalizeResult(await readJson(req).catch(() => ({})));
  if (!result.events.length && !result.plan) {
    // Not an error: a worker that looked and has nothing to report yet is
    // behaving correctly. But say why nothing landed, or a malformed payload
    // debugs as silence.
    return json({ ok: true, accepted: 0, note: 'Nothing passed the floor: every event needs a known kind and a summary.' });
  }

  // The one door every result comes in through: the ring guard, the app's own
  // check of a done, then the record (deliver.ts). The answer says what the
  // check found, so a worker posting a short list learns why it is not done.
  const acc = await acceptWork(profileId, commission, result, { log });
  await logEvent(profileId, 'commission_work', { commission_id: id, events: result.events.length, by: who.worker ?? 'shared' });
  return json({
    ok: true,
    accepted: acc.accepted,
    planned: !!result.plan,
    status: acc.status,
    checked: acc.verdict ? { passed: acc.verdict.passed, checks: acc.verdict.checks, send_back: acc.verdict.passed ? [] : acc.verdict.sendBack } : null,
    ...(acc.breaches ? { breaches: acc.breaches } : {}),
    ...(acc.note ? { note: acc.note } : {}),
  });
}
