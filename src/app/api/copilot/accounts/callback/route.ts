// src/app/api/copilot/accounts/callback/route.ts
// Back from an account's consent screen: exchange the code, put the credential
// in the person's vault, and land them on the sheet they started from.
//
// A GET, and it spends a one-time code — which invariant 8 forbids for links in
// emails, because a scanner opens them first. This one is not a link anybody
// can scan: it is the provider's redirect, bound to a PKCE verifier sealed in
// this browser's own cookie and to a state only this browser holds, so a
// scanner that followed it would have neither and spend nothing.

import { NextResponse } from 'next/server';
import { credentialFromTokens, unsealConnect } from '@/lib/copilot/accounts';
import { ensureVault, exchange, keep } from '@/lib/copilot/accountlink';
import { accountsKey, currentProfileId } from '@/lib/copilot/session';
import { loadAccounts } from '@/lib/copilot/workstore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CONNECT_COOKIE = 'cp_acct';

function back(req: Request, said: string): NextResponse {
  const to = new URL('/copilot2', process.env.NEXT_PUBLIC_APP_URL || req.url);
  to.searchParams.set('tab', 'you');
  to.searchParams.set('account', said);
  const res = NextResponse.redirect(to, 303);
  res.cookies.set(CONNECT_COOKIE, '', { path: '/api/copilot/accounts', maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const pid = await currentProfileId();
  if (!pid) return back(req, 'Sign in again, then connect it again.');
  const q = new URL(req.url).searchParams;
  const cookie = req.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${CONNECT_COOKIE}=`))?.slice(CONNECT_COOKIE.length + 1);
  const p = unsealConnect(cookie ? decodeURIComponent(cookie) : null, accountsKey(), Math.floor(Date.now() / 1000), pid);
  if (!p) return back(req, 'That took too long or came from another browser. Start connecting it again.');
  if (q.get('state') !== p.state) return back(req, 'That sign-in did not match the one started here. Start again.');
  if (q.get('error')) return back(req, `The account said no: ${(q.get('error_description') || q.get('error') || '').slice(0, 120)}`);
  const code = q.get('code');
  if (!code) return back(req, 'The account sent no sign-in code back. Start again.');
  try {
    const tokens = await exchange(p, code);
    const cred = credentialFromTokens(p, tokens, Math.floor(Date.now() / 1000));
    if (!cred.ok) return back(req, `Not connected: ${cred.why}`);
    const current = await loadAccounts(pid);
    if (current.unreadable) return back(req, `Not connected: your accounts could not be read (${current.unreadable}).`);
    const vault = await ensureVault(pid, current.vault);
    await keep(pid, vault, cred.params, { server: p.server, name: p.name, how: 'oauth', taken: new Set(current.accounts.map((a) => a.slug)), refreshes: cred.refreshes });
    return back(req, 'connected');
  } catch (e) {
    return back(req, `Not connected: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
  }
}
