// src/app/api/copilot/money/book/route.ts
// The Money tab: the book of cash the person logs by hand (money/book.ts).
//
// GET  ?month=2026-09&view=EUR   the month's list and calendar, amounts shown
//                                in `view` (the book's own currency when absent)
// POST action=add      a move logged: id (the phone's uuid for it, so a retry is
//                      one row), kind in|out, amount, currency (typed in; the
//                      book's when absent), on, category, note, repeat
//      action=edit     one logged row changed (id + the same fields)
//      action=delete   one logged row gone (id); an upcoming repeat stops its series
//      action=balance  the balance the book starts from, said again to restart it
//      action=entry    the currency moves are typed in from now on
//
// Every POST answers with the book as it now is, for the month and view the
// screen was on, so the list never shows a row the server does not have — or,
// with `reply: 'balance'` (the Log money page, which draws no list), with the
// balance and what is safe to spend today: the book is a dozen reads that page
// would throw away.
import { MoneyRefusal } from '@/lib/copilot/money/store';
import { addEntry, balanceAndSafe, deleteEntry, editEntry, loadBook, setBookBalance, setEntryCurrency } from '@/lib/copilot/money/bookstore';
import { getProfile } from '@/lib/copilot/base';
import { todayIso } from '@/lib/copilot/db';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export async function GET(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const q = new URL(req.url).searchParams;
  try {
    return json({ ok: true, book: await loadBook(auth.pid, { month: q.get('month'), view: q.get('view') }) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not read your book.', e instanceof MoneyRefusal ? 400 : 500);
  }
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const at = { month: str(b.month), view: str(b.view) };
  const answer = async (extra: Record<string, unknown> = {}) => {
    if (b.reply === 'balance') {
      const profile = await getProfile(auth.pid);
      const snap = profile ? await balanceAndSafe(auth.pid, profile.finance, todayIso(profile.timezone)) : { balance: null, safe: null };
      return json({ ok: true, ...extra, ...snap });
    }
    return json({ ok: true, ...extra, book: await loadBook(auth.pid, at) });
  };
  try {
    if (b.action === 'add') {
      await addEntry(auth.pid, b);
      return await answer();
    }
    if (b.action === 'edit' || b.action === 'delete') {
      const id = str(b.id);
      if (!id) return fail('Which row?');
      if (b.action === 'edit') {
        await editEntry(auth.pid, id, b);
        return await answer();
      }
      return await answer(await deleteEntry(auth.pid, id));
    }
    if (b.action === 'balance') {
      await setBookBalance(auth.pid, b);
      return await answer();
    }
    if (b.action === 'entry') {
      return json({ ok: true, entry: await setEntryCurrency(auth.pid, b.currency) });
    }
    return fail('Unknown action');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that.', e instanceof MoneyRefusal ? 400 : 500);
  }
}
