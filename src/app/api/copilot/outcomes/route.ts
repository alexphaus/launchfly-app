import { recordOutcome } from '@/lib/copilot/outcomes';
import { loadHome } from '@/lib/copilot/store';
import type { OutcomeKind } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

const KINDS: OutcomeKind[] = ['reply', 'meeting', 'proposal', 'won', 'lost', 'no_reply'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** The user tells us what happened: replied, meeting, won (with amount), lost. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  if (!KINDS.includes(b.kind as OutcomeKind)) return fail('Unknown outcome');
  const amount = num(b.amount);
  if (b.kind === 'won' && amount != null && amount < 0) return fail('Amount must be positive');
  try {
    const outcome = await recordOutcome(auth.pid, {
      kind: b.kind as OutcomeKind,
      opportunity_id: typeof b.opportunity_id === 'string' ? b.opportunity_id : null,
      action_id: typeof b.action_id === 'string' ? b.action_id : null,
      amount: amount ?? null,
      currency: typeof b.currency === 'string' ? b.currency.slice(0, 8) : null,
      note: typeof b.note === 'string' ? b.note.slice(0, 400) : null,
      source: 'manual',
    });
    return json({ ok: true, outcome, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not record outcome', 400);
  }
}
