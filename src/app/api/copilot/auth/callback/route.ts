import { NextResponse } from 'next/server';
import { consumeMagicLink, peekMagicLink } from '@/lib/copilot/auth';
import { NO_STORE, fail, json, readJson } from '@/lib/copilot/http';
import { setSessionCookie } from '@/lib/copilot/session';
import { toShell } from '@/lib/copilot/shell';

export const runtime = 'nodejs';

/**
 * The link in the email lands here — and deliberately does NOT sign anyone in.
 *
 * Everything in an email follows its links before the recipient does: Gmail
 * scans them, and Resend rewrites them through its own click-tracking
 * redirector (resend-links.com). A one-time token spent by a GET is therefore
 * dead by the time the person taps it, which is what locked the live account
 * out. So the GET only checks the token and hands off to a page with a button;
 * the POST below is what actually spends it, behind a real click.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const shell = toShell(url.searchParams.get('shell'));
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), { headers: NO_STORE });

  const peek = await peekMagicLink(token);
  if (!peek.ok) return to(`${shell}/login?error=${peek.reason}`);
  return to(`${shell}/auth/confirm?token=${encodeURIComponent(token)}`);
}

/** The confirm page's button. This is the only thing that spends a token. */
export async function POST(req: Request) {
  const b = await readJson(req);
  const token = typeof b.token === 'string' ? b.token : '';
  const shell = toShell(b.shell);

  const result = await consumeMagicLink(token);
  if (result.kind === 'invalid') {
    return json({ error: 'That link no longer works.', reason: result.reason }, 400);
  }
  // A verified email with no profile behind it goes to onboarding with the
  // address already filled in, rather than to an empty sign-in form.
  if (result.kind === 'new') return json({ ok: true, redirect: `${shell}?email=${encodeURIComponent(result.email)}` });

  const res = json({ ok: true, redirect: shell });
  setSessionCookie(res, result.profileId);
  return res;
}

export function PUT() { return fail('Method not allowed', 405); }
