// src/lib/copilot/supply/page.ts
// Opening a page somebody else pointed at. Used to read a found company's site
// for a contact, and to check that a link the agent reported actually opens.
//
// Every URL that reaches this file came from outside — a search index or a
// worker — so it is treated as hostile until shown otherwise. Three guards,
// because each of the cheaper ones has a known way round it:
//
//   isPublicHttpUrl   the name: scheme, credentials, private and local ranges
//   the DNS check     what the name resolves to — a public-looking domain can
//                     point at 169.254.169.254, and the name check cannot see it
//   manual redirects  every hop checked again, because a public page can 302 to
//                     an internal one, and `redirect: 'follow'` would go
//
// It reads at most PAGE_MAX_BYTES and gives up at the deadline. A page that will
// not open returns why, in words the hunts sheet can show — never a thrown
// error, because one slow site must not cost the whole run.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicHttpUrl } from '../hunts';

export const PAGE_TIMEOUT_MS = 6_000;
export const PAGE_MAX_BYTES = 400_000;
const MAX_REDIRECTS = 3;

export type PageResult = { ok: true; url: string; html: string } | { ok: false; reason: string };

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return /^(0|10|127)\./.test(ip) || /^169\.254\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe80:/.test(v6) || (v6.startsWith('::ffff:') && privateAddress(v6.slice(7)));
}

async function resolvesPublic(host: string): Promise<boolean> {
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateAddress(a.address));
  } catch {
    return false;
  }
}

/** Fetch a page as text, or say why not. `statusOnly` stops at the status line — the agent check only needs to know it opens. */
export async function openPage(url: string, opts: { deadline?: number; statusOnly?: boolean } = {}): Promise<PageResult> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpUrl(current)) return { ok: false, reason: 'not a public web address' };
    const host = new URL(current).hostname.replace(/^\[|\]$/g, '');
    if (!(await resolvesPublic(host))) return { ok: false, reason: 'the address does not resolve to a public site' };
    const left = opts.deadline ? Math.min(PAGE_TIMEOUT_MS, opts.deadline - Date.now()) : PAGE_TIMEOUT_MS;
    if (left < 800) return { ok: false, reason: 'out of time this run' };
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; LaunchflyCopilot/1.0; +https://launchfly.ai)', accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(left),
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: /abort|timeout/i.test(m) ? 'the site did not answer in time' : 'the site could not be reached' };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) return { ok: false, reason: `redirect with nowhere to go (${res.status})` };
      current = new URL(next, current).href;
      continue;
    }
    if (res.status >= 400) {
      // LinkedIn answers every script with 999; say so rather than "broken".
      return { ok: false, reason: res.status === 999 ? 'the site refuses automated checks' : `the page answered ${res.status}` };
    }
    if (opts.statusOnly) return { ok: true, url: current, html: '' };
    const type = res.headers.get('content-type') ?? '';
    if (!/html|xml|text\/plain/i.test(type)) return { ok: true, url: current, html: '' };
    return { ok: true, url: current, html: await readCapped(res) };
  }
  return { ok: false, reason: 'too many redirects' };
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < PAGE_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch { /* a page that stops half way still gave us its first half */ }
  finally { reader.cancel().catch(() => {}); }
  const buf = new Uint8Array(Math.min(size, PAGE_MAX_BYTES));
  let at = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, buf.byteLength - at);
    buf.set(c.subarray(0, take), at);
    at += take;
    if (at >= buf.byteLength) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}
