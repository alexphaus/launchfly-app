// src/app/api/copilot/money/book/export/route.ts
// Every row the money book reads, as a CSV the person saves (bookstore.ts
// exportBookCsv): the copy of their money that does not depend on this server.
import { MoneyRefusal } from '@/lib/copilot/money/store';
import { exportBookCsv } from '@/lib/copilot/money/bookstore';
import { fail, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  try {
    const { name, csv } = await exportBookCsv(auth.pid);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not export your book.', e instanceof MoneyRefusal ? 400 : 500);
  }
}
