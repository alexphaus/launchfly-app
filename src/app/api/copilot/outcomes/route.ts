import { todayIso } from '@/lib/copilot/db';
import { recordOutcome } from '@/lib/copilot/outcomes';
import { getProfile, loadHome } from '@/lib/copilot/store';
import { occurredOn } from '@/lib/copilot/tell';
import { OUTCOME_KINDS, type OutcomeKind } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

// Was a second hand-written copy of the list, which is how a kind gets accepted
// by the type system, rejected by this route, and permitted by the database all
// at once. One source.
const KINDS: readonly OutcomeKind[] = OUTCOME_KINDS;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** The user tells us what happened: replied, meeting, won (with amount), lost. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  if (!KINDS.includes(b.kind as OutcomeKind)) return fail('Unknown outcome');
  const amount = num(b.amount);
  if (b.kind === 'won' && amount != null && amount < 0) return fail('Amount must be positive');
  // A day, when one was said ("Pia paid me yesterday"): the person's own,
  // inside the month a conversation can be logged for. Read only when sent, so
  // every other caller is unchanged.
  let occurred_at: string | undefined;
  if (b.on != null && b.on !== '') {
    const profile = await getProfile(auth.pid);
    const day = occurredOn(b.on, todayIso(profile?.timezone ?? 'UTC'));
    if (!day.ok) return fail(day.error);
    occurred_at = day.at ?? undefined;
  }
  try {
    const outcome = await recordOutcome(auth.pid, {
      kind: b.kind as OutcomeKind,
      opportunity_id: typeof b.opportunity_id === 'string' ? b.opportunity_id : null,
      action_id: typeof b.action_id === 'string' ? b.action_id : null,
      amount: amount ?? null,
      currency: typeof b.currency === 'string' ? b.currency.slice(0, 8) : null,
      note: typeof b.note === 'string' ? b.note.slice(0, 400) : null,
      source: 'manual',
      occurred_at,
    });
    return json({ ok: true, outcome, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not record outcome', 400);
  }
}
