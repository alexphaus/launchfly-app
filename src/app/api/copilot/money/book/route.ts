// src/app/api/copilot/money/book/route.ts
// The Money tab: the book of cash the person logs by hand (money/book.ts).
//
// GET  ?month=2026-09&view=EUR   the month's list and calendar, amounts shown
//                                in `view` (the book's own currency when absent)
// POST action=add      a move logged: kind in|out, amount, on, category, note, repeat
//      action=edit     one logged row changed (id + the same fields)
//      action=delete   one logged row gone (id); an upcoming repeat stops its series
//      action=balance  the balance the book starts from, said again to restart it
//
// Every POST answers with the book as it now is, for the month and view the
// screen was on, so the list never shows a row the server does not have.
import { MoneyRefusal } from '@/lib/copilot/money/store';
import { addEntry, deleteEntry, editEntry, loadBook, setBookBalance } from '@/lib/copilot/money/bookstore';
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
  try {
    if (b.action === 'add') {
      const r = await addEntry(auth.pid, b);
      return json({ ok: true, warning: r.warning, book: await loadBook(auth.pid, at) });
    }
    if (b.action === 'edit' || b.action === 'delete') {
      const id = str(b.id);
      if (!id) return fail('Which row?');
      const r = b.action === 'edit' ? { ...(await editEntry(auth.pid, id, b)), stopped: false } : await deleteEntry(auth.pid, id);
      return json({ ok: true, warning: r.warning, stopped: r.stopped, book: await loadBook(auth.pid, at) });
    }
    if (b.action === 'balance') {
      const r = await setBookBalance(auth.pid, b);
      return json({ ok: true, warning: r.warning, book: await loadBook(auth.pid, at) });
    }
    return fail('Unknown action');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save that.', e instanceof MoneyRefusal ? 400 : 500);
  }
}
