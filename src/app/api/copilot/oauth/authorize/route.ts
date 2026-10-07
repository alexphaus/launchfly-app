// src/app/api/copilot/oauth/authorize/route.ts
// The consent screen's buttons (copilot2/connect). The screen is the
// authorization endpoint; this is what it posts, so the code is issued by a
// real tap and never by a GET a link preview could make (invariant 8's reason,
// though nothing here is one-time until the tap).
//
// Everything is checked again: the request the page showed may have been
// edited on the way back. Who is allowing it is the signed-in account, with the
// form token proving the page was shown to that account, or the account whose
// app showed the code typed in. Either way the answer is a 303 to where the
// client asked, carrying a code or an error it can show.
import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/lib/copilot/auth';
import { claimPairCode, extraRedirects, PAIR_TRIES } from '@/lib/copilot/connector';
import { readForm } from '@/lib/copilot/http';
import { clientIp, rateLimit } from '@/lib/copilot/limits';
import { CONSENT_PATH, checkAuthorize, codeRedirect, consentTokenMatches, errorRedirect, grantedScope, issueCode, resourceUrl } from '@/lib/copilot/oauth';
import { currentProfileId, oauthKey } from '@/lib/copilot/session';

export const runtime = 'nodejs';

/** The request's own fields, the only ones carried back to the screen. */
const OAUTH_FIELDS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const;

const see = (url: string) => NextResponse.redirect(url, { status: 303, headers: { 'cache-control': 'no-store' } });

export async function POST(req: Request) {
  const form = await readForm(req);
  const base = appBaseUrl(req);
  const master = oauthKey();
  const check = checkAuthorize(form, { master, resource: resourceUrl(base), extra: extraRedirects() });
  // Back to the screen, which says what went wrong: with the request as it was
  // asked, and why, so the person can try again without starting over in Claude.
  const screen = (err?: string) => {
    const q = new URLSearchParams();
    for (const f of OAUTH_FIELDS) if (form[f]) q.set(f, form[f]);
    if (err) q.set('err', err);
    if (form.via === 'code') q.set('with', 'code');
    return see(`${base}${CONSENT_PATH}?${q.toString()}`);
  };
  if (!check.ok) return 'redirect' in check ? see(check.redirect) : screen();
  const r = check.req;

  if (form.decision !== 'allow') return see(errorRedirect(r.redirect, 'access_denied', 'The person said no.', r.state));

  let pid: string | null = null;
  if (form.via === 'code') {
    // A guess costs a try against this network's ten, so the 30^8 codes stay out of reach.
    const rl = await rateLimit(`copilot:mcp-pair-try:${clientIp(req)}`, PAIR_TRIES, 600);
    if (!rl.ok) return screen('tries');
    try {
      pid = await claimPairCode(form.pair);
    } catch (e) {
      console.error('[copilot] pairing code check failed', e);
      return screen('server');
    }
    if (!pid) return screen('code');
  } else {
    pid = await currentProfileId();
    // Signed out since the screen was shown, or the screen was shown to another
    // account: the person sees the screen again as it now is, and decides again.
    if (!pid || !consentTokenMatches(form.consent, pid, r, master)) return screen('again');
  }

  // Proposing is granted by the tick alone (oauth.ts grantedScope): a client asks
  // for every scope listed, and only the person widens a connection past reading.
  const code = issueCode({ ...r, scope: grantedScope(form.scope, form.propose === 'yes') }, pid, { master, nowS: Math.floor(Date.now() / 1000) });
  return see(codeRedirect(r.redirect, code, r.state));
}
