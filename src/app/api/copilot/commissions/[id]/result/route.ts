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
//   Authorization: Bearer $COPILOT_INBOUND_SECRET
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

import { copilotDb } from '@/lib/copilot/db';
import { loadCommissions, recordCommissionWork } from '@/lib/copilot/store';
import { logEvent } from '@/lib/copilot/base';
import { normalizeResult } from '@/lib/copilot/commission';
import { fail, json, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Fail closed, exactly as /moves/inbound does: an unconfigured secret must not
  // leave a write endpoint open to anyone who can guess the path.
  const secret = process.env.COPILOT_INBOUND_SECRET || process.env.COPILOT_JOBS_SECRET;
  if (!secret) return fail('COPILOT_INBOUND_SECRET is not configured; refusing to accept work.', 503);
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return fail('Unauthorized', 401);

  const { id } = await ctx.params;
  // The commission id is the address, so the profile is read from the row
  // rather than taken from the body. A worker holding the shared secret can
  // report against a commission; it cannot name which account to write to.
  const { data: row } = await copilotDb().from('copilot_commissions')
    .select('profile_id').eq('id', id).maybeSingle();
  if (!row) return fail('No such commission', 404);
  const profileId = (row as { profile_id: string }).profile_id;

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

  await recordCommissionWork(profileId, commission, result);
  await logEvent(profileId, 'commission_work', { commission_id: id, events: result.events.length });
  return json({ ok: true, accepted: result.events.length, planned: !!result.plan });
}
