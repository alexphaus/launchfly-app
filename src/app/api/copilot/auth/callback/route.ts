import { NextResponse } from 'next/server';
import { consumeMagicLink } from '@/lib/copilot/auth';
import { setSessionCookie } from '@/lib/copilot/session';

export const runtime = 'nodejs';

/** The link in the email lands here. Sets the session cookie and returns to the app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const result = await consumeMagicLink(token);
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), { headers: { 'cache-control': 'no-store' } });
  if (result.kind === 'invalid') return to('/copilot/login?error=expired');
  if (result.kind === 'new') return to(`/copilot?email=${encodeURIComponent(result.email)}`);
  const res = to('/copilot');
  setSessionCookie(res, result.profileId);
  return res;
}
