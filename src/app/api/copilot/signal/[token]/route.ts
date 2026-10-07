// src/app/api/copilot/signal/[token]/route.ts
// The count link's door. A form, a landing page or Stripe posts here, and one
// sign-up, enquiry or sale is counted for the account the link names
// (lib/copilot/signal.ts says what the link is for and what it never keeps).
//
// No session: the link is the credential, signed over the account and the
// link's generation, so a link the person replaced from the app stops counting
// the moment they do. Any origin may post — a landing page's own script, a form
// tool's servers, Stripe — and nothing here reads a cookie.

import { readSignal, SIGNALS_PER_HOUR } from '@/lib/copilot/signal';
import { readSignalToken } from '@/lib/copilot/signalkey';
import { signalKey } from '@/lib/copilot/session';
import { recordSignal, signalGeneration } from '@/lib/copilot/store';
import { rateLimit } from '@/lib/copilot/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A form's post, a page's fetch, Stripe's event: none is larger than this, and a body that is was not sent to count one thing. */
const BODY_MAX = 64 * 1024;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
} as const;

const answer = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { ...CORS, 'cache-control': 'no-store' } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Opening the link counts nothing (invariant 8): a mail scanner, a chat's link
 * preview or a browser tab must never add a sign-up. It says what it is instead.
 */
export function GET() {
  return new Response('This is a count link from your Copilot app. Your form or checkout sends a POST to it, and each one is counted. Opening it counts nothing.', {
    status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** JSON, a form post or a multipart form: whatever a form tool sends. Only what readSignal reads of it is ever used. */
async function bodyOf(req: Request): Promise<unknown> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    const f = await req.formData();
    return Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string'));
  }
  const raw = await req.text();
  if (raw.length > BODY_MAX) throw new RangeError('too large');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let key: Buffer;
  try { key = signalKey(); } catch (e) { return answer({ ok: false, error: e instanceof Error ? e.message : 'Not set up' }, 503); }
  const who = readSignalToken(token, key);
  if (!who) return answer({ ok: false, error: 'Not a count link.' }, 404);

  // A 5xx where the record could not be read: the sender tries again, and Stripe does.
  let gen: string | null;
  try { gen = await signalGeneration(who.pid); } catch (e) { return answer({ ok: false, error: e instanceof Error ? e.message : 'Could not read the link' }, 503); }
  if (gen !== who.gen) return answer({ ok: false, error: 'This link was replaced by a newer one in the app, so it no longer counts.' }, 410);

  const url = new URL(req.url);
  let body: unknown;
  try { body = await bodyOf(req); } catch { return answer({ ok: false, error: 'That is more than a count link reads.' }, 413); }
  const read = readSignal(body, url.searchParams.get('kind'));
  if (read.ok === false) return answer({ ok: false, error: read.error }, read.status);
  // Accepted and not counted — a Stripe event that echoes a payment already
  // counted. Answered 200 with why, so the sender does not retry it and the
  // person setting it up sees the reason in the sender's own log.
  if (read.ok === 'skip') return answer({ ok: true, counted: false, why: read.why });

  const limit = await rateLimit(`signal:${who.pid}`, SIGNALS_PER_HOUR, 60 * 60);
  if (!limit.ok) return answer({ ok: false, error: `More than ${SIGNALS_PER_HOUR} in an hour: that is not people signing up. Try again later.` }, 429);

  let out: Awaited<ReturnType<typeof recordSignal>>;
  try { out = await recordSignal(who.pid, read.value); } catch (e) {
    return answer({ ok: false, error: e instanceof Error ? e.message : 'Could not count that' }, 500);
  }
  // A plain HTML form navigates to the answer; `then` sends the visitor on to
  // the page that thanks them. Only a web address, and only after counting.
  const then = url.searchParams.get('then');
  if (then && /^https?:\/\//i.test(then)) return new Response(null, { status: 303, headers: { ...CORS, location: then } });
  return answer({ ok: true, counted: out.status === 'counted', duplicate: out.status === 'duplicate', why: out.why });
}
