// src/app/p/[code]/route.ts
// A page made in Copilot, as a stranger opens it (lib/copilot/livepage.ts).
//
// A route, not a page: the app's root layout carries Launchfly's title, a form
// widget's script and a service worker, and none of them belong on somebody's
// landing page. This answers with the page's own HTML — the version online, its
// one button, and a script that counts the open and the tap — under a policy that
// lets nothing else run, load, frame it or post anywhere but here.

import { randomBytes } from 'node:crypto';
import { assetsFromEvents } from '@/lib/copilot/assets';
import { PAGE_UNREAD, goneHtml, livePageOf, pageHtml } from '@/lib/copilot/livepage';
import { readPageCode } from '@/lib/copilot/pagekey';
import { pageKey } from '@/lib/copilot/session';
import { getProfile, loadAssetEvents, loadPageState } from '@/lib/copilot/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;

/**
 * Not found, offline, or a version that is gone: one answer, so the address says
 * nothing about which. A read that failed says so instead, with a 503 so a link
 * preview tries again later — a page that could not be read is not a page that is gone.
 */
const gone = (status = 404) => new Response(goneHtml(status === 503 ? PAGE_UNREAD : undefined), {
  status, headers: { ...BASE_HEADERS, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" },
});

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  let key: Buffer;
  try { key = pageKey(); } catch { return gone(503); }
  const pid = readPageCode(code, key);
  if (!pid) return gone();
  try {
    const live = livePageOf(await loadPageState(pid));
    if (!live) return gone();
    const [profile, events] = await Promise.all([getProfile(pid), loadAssetEvents(pid)]);
    // A read that failed is not a page that is gone: 503, so a link preview tries again later.
    if (!profile || events.unreadable) return gone(503);
    const asset = assetsFromEvents(events.rows, profile.offer).find((a) => a.id === live.asset);
    const version = asset && !asset.retired ? asset.versions.find((v) => v.n === live.n) : null;
    if (!version?.body?.trim()) return gone();
    const nonce = randomBytes(16).toString('base64');
    const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    const html = pageHtml({ code, title: version.title, body: version.body, ask: live.ask, nonce, madeWith: origin ? `${origin}/copilot2` : null });
    return new Response(html, {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        'x-frame-options': 'DENY',
        'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      },
    });
  } catch (e) {
    // The stranger is told it could not be shown; the operator's log says why.
    console.error('[copilot/page] could not show a page', e instanceof Error ? e.message : e);
    return gone(503);
  }
}
