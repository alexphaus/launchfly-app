// src/app/api/copilot/page/[code]/route.ts
// The page's own count (lib/copilot/livepage.ts): one open or one tap, posted by
// the page's script from the page's own address. No session needed — the code is
// the account, signed — and nothing about who opened it is read or kept.
//
// Not counted: the person's own visits (their session rides along, same
// address), a page that is not online, and anything past PAGE_HITS_PER_HOUR in an
// hour, which is said once on the page's sheet rather than dropped quietly.

import { PAGE_CAPPED, PAGE_HIT, PAGE_HITS_PER_HOUR, livePageOf } from '@/lib/copilot/livepage';
import { readPageCode } from '@/lib/copilot/pagekey';
import { rateLimit } from '@/lib/copilot/limits';
import { currentProfileId, pageKey } from '@/lib/copilot/session';
import { insertPageEvent, loadPageState } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A count is a word; a body larger than this was not sent by the page. */
const BODY_MAX = 512;

const answer = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** Opening the address counts nothing (invariant 8's reasoning): only the page's own post does. */
export function GET() {
  return new Response('The count for a page made in Copilot. The page posts here; opening it counts nothing.', {
    status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  let key: Buffer;
  try { key = pageKey(); } catch (e) { return answer({ ok: false, error: e instanceof Error ? e.message : 'Not set up' }, 503); }
  const pid = readPageCode(code, key);
  if (!pid) return answer({ ok: false, error: 'Not a page.' }, 404);

  const raw = await req.text().catch(() => '');
  if (raw.length > BODY_MAX) return answer({ ok: false, error: 'Too large.' }, 413);
  let kind: unknown = null;
  try { kind = (JSON.parse(raw || '{}') as { kind?: unknown }).kind; } catch { kind = null; }
  if (kind !== 'open' && kind !== 'tap') return answer({ ok: false, error: 'An open or a tap.' }, 400);

  // The person looking at their own page is not somebody hearing about them.
  if ((await currentProfileId().catch(() => null)) === pid) return answer({ ok: true, counted: false, why: 'Your own visits are not counted.' });

  let live;
  try { live = livePageOf(await loadPageState(pid)); } catch (e) { return answer({ ok: false, error: e instanceof Error ? e.message : 'Could not read the page' }, 503); }
  if (!live) return answer({ ok: false, error: 'This page is not online.' }, 410);

  const limit = await rateLimit(`page:${pid}`, PAGE_HITS_PER_HOUR, 60 * 60);
  if (!limit.ok) {
    // Said once an hour on the page's sheet: a count that stopped is not a page nobody opened.
    const first = await rateLimit(`page-capped:${pid}`, 1, 60 * 60);
    if (first.ok) await insertPageEvent(pid, PAGE_CAPPED, {}).catch(() => undefined);
    return answer({ ok: false, error: `More than ${PAGE_HITS_PER_HOUR} in an hour: counting is paused for the hour.` }, 429);
  }
  try {
    await insertPageEvent(pid, PAGE_HIT, { kind, asset: live.asset, n: live.n });
  } catch (e) {
    return answer({ ok: false, error: e instanceof Error ? e.message : 'Could not count that' }, 500);
  }
  return answer({ ok: true, counted: true });
}
