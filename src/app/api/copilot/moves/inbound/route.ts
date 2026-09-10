// src/app/api/copilot/moves/inbound/route.ts
// The socket an external workflow posts finished work into.
//
// Why this exists, and why it is the most important route in the vertical.
//
// Every Move the app produced until now was derived from data it already had.
// The one thing that ever arrived from outside was reconcileReplies, and that
// only reads replies to messages the app itself sent — so inbound was gated on
// outbound, and outbound was the thing not happening. Nine sends in thirty days
// meant almost no replies, which meant the state at nine in the morning was the
// state at nine at night. A closed system cannot tell you anything you did not
// already know, however well it is laid out.
//
// This is the opening. An n8n workflow, an agent with browser access, a person —
// anything that finds something in the world can put it on tomorrow's screen:
// a job posting that matches "get a job, urgent money", the laptop at a price,
// three suppliers quoted, a complaint that turned up in a review.
//
//   POST /api/copilot/moves/inbound
//   Authorization: Bearer $COPILOT_INBOUND_SECRET
//   { "email": "you@example.com",        // or "profile_id"
//     "source": "n8n",                    // optional; namespaces the ids
//     "moves": [ { external_id, kind, headline, why, artifact, cost_label } ] }
//
// Nothing here is trusted. normalizeRemoteMove drops anything without a stable
// id, a known kind, a why line or an artifact with content, and isDeliverable
// applies the same floor again on the way to the table. A bad workflow can put
// nothing on the screen; it cannot write advice and it cannot crash a run.

import { todayIso } from '@/lib/copilot/db';
import { copilotDb } from '@/lib/copilot/db';
import { writeMoves } from '@/lib/copilot/jobs';
import { normalizeRemoteMove } from '@/lib/copilot/jobs/remote';
import { selectMoves, type MoveDraft } from '@/lib/copilot/moves';
import { fail, json, readJson } from '@/lib/copilot/http';
import { logEvent } from '@/lib/copilot/store';

export const runtime = 'nodejs';

/** One post cannot fill the screen. selectMoves caps the batch; this caps the body. */
const MAX_INBOUND = 20;

export async function POST(req: Request) {
  // Fail closed. An unconfigured secret must not leave a write endpoint open to
  // anyone who can guess the path.
  const secret = process.env.COPILOT_INBOUND_SECRET || process.env.COPILOT_JOBS_SECRET;
  if (!secret) return fail('COPILOT_INBOUND_SECRET is not configured; refusing to accept Moves.', 503);
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return fail('Unauthorized', 401);

  const body = await readJson(req);
  const rawMoves = Array.isArray(body.moves) ? body.moves : Array.isArray(body) ? body : null;
  if (!rawMoves) return fail('Expected { moves: [...] }', 400);

  // Addressed by email or id. Email is what a workflow author actually has.
  const db = copilotDb();
  const profileId = typeof body.profile_id === 'string' ? body.profile_id : null;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  if (!profileId && !email) return fail('Expected profile_id or email', 400);

  const q = db.from('copilot_profiles').select('id, timezone');
  const { data: profile } = await (profileId ? q.eq('id', profileId) : q.ilike('email', email!)).maybeSingle();
  if (!profile) return fail('No such profile', 404);

  const source = typeof body.source === 'string' ? body.source.slice(0, 40) : undefined;
  const drafts = selectMoves(
    (rawMoves as unknown[]).slice(0, MAX_INBOUND)
      .map((m) => normalizeRemoteMove(m, source))
      .filter((m): m is MoveDraft => !!m),
    MAX_INBOUND,
  );

  // A post that produced nothing is not an error — it is a workflow that looked
  // and found nothing worth sending, which is the behaviour we want from it.
  // But say how many were dropped, or a malformed payload debugs as silence.
  const received = (rawMoves as unknown[]).length;
  if (!drafts.length) {
    return json({ ok: true, received, accepted: 0, written: 0, note: received ? 'Nothing passed the quality floor: every Move needs a stable external_id, a known kind, at least one why line, and an artifact with content.' : undefined });
  }

  const written = await writeMoves(profile.id as string, drafts, todayIso((profile.timezone as string) || 'UTC'));
  await logEvent(profile.id as string, 'moves_inbound', { source: source ?? null, received, accepted: drafts.length, written });
  // written < accepted means the rest were already here — a workflow that reruns
  // over the same finding does not double up.
  return json({ ok: true, received, accepted: drafts.length, written });
}
