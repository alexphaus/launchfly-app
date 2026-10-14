// src/lib/copilot/linkcheck.ts
// Whether the links a worker delivered open.
//
// The first thing a person does with a list of five places is tap one, and a
// list whose second link is a 404 has told them the rest is not worth checking
// either. So the app taps them first. Three answers, because two would lie:
// `ok` (it answered), `dead` (404, 410, or the host does not exist) and
// `unknown` — a site that refuses a robot with 403, rate-limits it, or times out
// is not a dead link, and contract.ts never fails a delivery on an unknown.
//
// This fetches addresses a worker chose, from inside the deployment, so it is
// held tight: http(s) only, no address that resolves to a private range, no
// redirect followed (a 3xx counts as opening, and is never chased to wherever it
// points), HEAD first, and a short budget for the lot.

import { lookup } from 'node:dns/promises';
import type { LinkResult } from './contract';

const PER_LINK_MS = 6_000;
const AT_ONCE = 4;
const UA = 'Mozilla/5.0 (compatible; CopilotLinkCheck/1.0)';

const PRIVATE_V4 = /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const privateAddress = (a: string) => PRIVATE_V4.test(a) || a === '::1' || /^f[cd]/i.test(a) || /^fe80/i.test(a) || a.startsWith('::ffff:127.') || a === '::';

/**
 * Whether the host is somewhere this deployment may knock: public, resolvable.
 * `dead` when it does not exist. Shared with the account connect (accountlink.ts),
 * which fetches addresses a person typed.
 */
export async function hostState(host: string): Promise<'ok' | 'private' | 'dead' | 'unknown'> {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return 'private';
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length) return 'dead';
    return addrs.some((a) => privateAddress(a.address)) ? 'private' : 'ok';
  } catch (e) {
    const code = (e as { code?: string }).code;
    return code === 'ENOTFOUND' || code === 'ENODATA' ? 'dead' : 'unknown';
  }
}

const classify = (status: number): LinkResult['state'] =>
  status >= 200 && status < 400 ? 'ok' : status === 404 || status === 410 ? 'dead' : 'unknown';

async function one(url: string, f: typeof fetch): Promise<LinkResult> {
  let u: URL;
  try { u = new URL(url); } catch { return { url, state: 'dead', code: null }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { url, state: 'dead', code: null };
  const where = await hostState(u.hostname.replace(/^\[|\]$/g, ''));
  if (where === 'dead') return { url, state: 'dead', code: null };
  if (where !== 'ok') return { url, state: 'unknown', code: null };
  const ask = async (method: 'HEAD' | 'GET') => {
    const res = await f(url, {
      method, redirect: 'manual', signal: AbortSignal.timeout(PER_LINK_MS),
      headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8', ...(method === 'GET' ? { range: 'bytes=0-0' } : {}) },
    });
    // Nothing is read: whether it opens is the whole question.
    await res.body?.cancel().catch(() => {});
    return res.status;
  };
  try {
    let status = await ask('HEAD');
    // Plenty of servers refuse HEAD and serve GET.
    if (status === 405 || status === 501 || status === 403 || status === 404) status = await ask('GET');
    return { url, state: classify(status), code: status };
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    return { url, state: code === 'ENOTFOUND' || code === 'ECONNREFUSED' ? 'dead' : 'unknown', code: null };
  }
}

/**
 * Each link, opened. Never throws: a check that could not run is `unknown`, and
 * an unknown never fails a delivery. COPILOT_LINKCHECK=off makes every link
 * unknown — for a deployment with no way out — and the screen then says the
 * links were not checked, rather than that they open.
 */
export async function checkLinks(urls: string[], o: { deadline?: number; fetchImpl?: typeof fetch } = {}): Promise<LinkResult[]> {
  if (process.env.COPILOT_LINKCHECK === 'off') return urls.map((url) => ({ url, state: 'unknown', code: null }));
  const f = o.fetchImpl ?? fetch;
  const out: LinkResult[] = new Array(urls.length);
  let next = 0;
  const lane = async () => {
    while (next < urls.length) {
      const i = next++;
      if (o.deadline && Date.now() > o.deadline - PER_LINK_MS) { out[i] = { url: urls[i], state: 'unknown', code: null }; continue; }
      out[i] = await one(urls[i], f).catch(() => ({ url: urls[i], state: 'unknown' as const, code: null }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, urls.length) }, lane));
  return out;
}
