// src/app/api/copilot/money/route.ts
// The person's answers about their statements.
//
// GET is what the screen polls while a PDF or a screenshot is being read: the
// statements alone, since it runs every few seconds.
// POST carries the five things only the person can say:
//
//   confirm  a reading that could not prove itself: the totals match, use it
//   discard  this statement goes, and every row it brought in
//   currency the money a file is in, when the file never said
//   name     who a payer or payee is — a client, their job, their own account,
//            something else — and, for a client, which business
//   forget   every row read off their bank, gone
import { PAYEE_ROLES, type PayeeRole } from '@/lib/copilot/money/ledger';
import { MoneyRefusal, confirmImport, discardImport, forgetMoney, loadImports, nameCounterparty, setImportCurrency } from '@/lib/copilot/money/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { loadHome } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Said on purpose rather than tapped by accident: this removes a year of somebody's records. */
const FORGET_WORD = 'DELETE';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  try {
    return json({ ok: true, imports: await loadImports(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not check on your statements.', 500);
  }
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  try {
    if (b.action === 'confirm' || b.action === 'discard') {
      if (typeof b.id !== 'string' || !b.id) return fail('Which statement?');
      if (b.action === 'confirm') await confirmImport(auth.pid, b.id);
      else await discardImport(auth.pid, b.id);
      return json({ ok: true, home: await loadHome(auth.pid) });
    }
    if (b.action === 'currency') {
      if (typeof b.id !== 'string' || !b.id) return fail('Which statement?');
      if (typeof b.currency !== 'string') return fail('Which currency?');
      await setImportCurrency(auth.pid, b.id, b.currency);
      return json({ ok: true, home: await loadHome(auth.pid) });
    }
    if (b.action === 'name') {
      if (typeof b.key !== 'string' || !b.key) return fail('Which payer?');
      const role = b.role == null ? null : PAYEE_ROLES.find((r) => r === b.role);
      if (role === undefined) return fail('That is not one of the answers.');
      const opp = typeof b.opportunity_id === 'string' && b.opportunity_id ? b.opportunity_id : null;
      const r = await nameCounterparty(auth.pid, b.key, role as PayeeRole | null, opp);
      return json({ ok: true, recorded: r.recorded, attached: r.attached, home: await loadHome(auth.pid) });
    }
    if (b.action === 'forget') {
      if (typeof b.confirm !== 'string' || b.confirm.trim().toUpperCase() !== FORGET_WORD) return fail(`Type ${FORGET_WORD} to confirm`);
      await forgetMoney(auth.pid);
      return json({ ok: true, home: await loadHome(auth.pid) });
    }
    return fail('Unknown action');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that', e instanceof MoneyRefusal ? 400 : 500);
  }
}
