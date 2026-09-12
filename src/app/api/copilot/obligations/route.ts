// src/app/api/copilot/obligations/route.ts
// Money owed, either way. Typed by hand, on purpose.
//
// No bank integration, no parsing, no OAuth. An invoice is one row somebody
// enters once, and the rows are the point: this is the sensor a general agent
// with a memory file cannot hold, because it needs a table it never collected.

import { deleteObligation, loadAllObligations, loadHome, saveObligation } from '@/lib/copilot/store';
import type { ObligationDirection, ObligationStatus } from '@/lib/copilot/obligations';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
/** A date, not a guess at one. Anything else is rejected rather than coerced. */
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`));

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  return json({ ok: true, obligations: await loadAllObligations(auth.pid) });
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);

  const id = typeof b.id === 'string' ? b.id : undefined;
  const status = (['open', 'settled', 'written_off'] as ObligationStatus[]).includes(b.status as ObligationStatus) ? (b.status as ObligationStatus) : undefined;
  const amount = num(b.amount);
  const counterparty = typeof b.counterparty === 'string' ? b.counterparty.trim() : undefined;

  if (!id) {
    if (!counterparty) return fail('Who is it with?');
    if (amount == null || amount <= 0) return fail('How much?');
    if (!isDate(b.due_on)) return fail('When is it due? Use a real date.');
  }
  if (amount != null && amount <= 0) return fail('An amount has to be more than nothing');

  try {
    await saveObligation(auth.pid, {
      id, status, amount, counterparty,
      direction: b.direction === 'out' ? 'out' : b.direction === 'in' ? 'in' : undefined as ObligationDirection | undefined,
      currency: typeof b.currency === 'string' ? b.currency.trim().slice(0, 8) || null : undefined,
      due_on: isDate(b.due_on) ? b.due_on : undefined,
      note: typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : undefined,
    });
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that');
  }
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Which one?');
  await deleteObligation(auth.pid, id);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
