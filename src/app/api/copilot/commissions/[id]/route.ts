// src/app/api/copilot/commissions/[id]/route.ts
// Grant authority, call it off, or mark the thread read.

import { approveCommission, closeCommission, loadHome, markCommissionSeen, unblockCommission } from '@/lib/copilot/store';
import { WORTH, WORTH_NOTE_MAX, isWorthKind } from '@/lib/copilot/worth';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const b: Record<string, unknown> = await readJson(req).catch(() => ({}));

  try {
    switch (b.action) {
      case 'approve': {
        const c = await approveCommission(auth.pid, id);
        // Null means it was not a draft. Re-approving would reset approved_at
        // and lose when the mandate was actually granted, which is the one
        // timestamp that matters if anybody asks what the app was allowed to do.
        if (!c) return fail('That one is already running.');
        return json({ ok: true, commission: c, home: await loadHome(auth.pid) });
      }
      case 'unblock': {
        // The answer is optional because not every needs_you is a question —
        // "the site wants a login I do not have" is cleared by going and fixing
        // it, not by typing. When there IS one it goes out with the next brief,
        // which is the only reason the worker can stop asking.
        const c = await unblockCommission(auth.pid, id, typeof b.answer === 'string' ? b.answer : null);
        if (!c) return fail('That one is not waiting on you.');
        return json({ ok: true, commission: c, home: await loadHome(auth.pid) });
      }
      case 'stop':
      case 'done': {
        const w = worthFrom(b);
        const { recorded, reason } = await closeCommission(
          auth.pid, id, b.action === 'done' ? 'done' : 'stopped',
          w ? { kind: w.worth, amount: w.amount, note: w.note } : undefined,
        );
        // `note` rather than `error`: the mandate did close, so failing the
        // request would be a lie in the other direction — the sheet would stay
        // open over a commission that is no longer running. It says what did not
        // happen instead, which is the only honest report of a half-success.
        return json({ ok: true, recorded, note: reason ?? null, home: await loadHome(auth.pid) });
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
