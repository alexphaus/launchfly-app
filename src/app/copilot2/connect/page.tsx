// src/app/copilot2/connect/page.tsx
// The consent screen, which is the OAuth authorization endpoint: Claude sends
// the person here to let it read their record. Rendered on the server from the
// request alone, so it works in whatever browser Claude opened — a laptop that
// has never seen the app included.
//
// Who is asking is said from where the answer goes (oauth.ts askerOf), never
// from the name a client gave itself, and what it can and cannot do is said
// before the button. Signed in here, one tap allows it. Not signed in here — the
// usual case, since the app lives on a phone and Claude often on a laptop — the
// person types a code the app shows under You → Claude. The buttons post to
// api/copilot/oauth/authorize, which checks everything again.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appBaseUrlFrom } from '@/lib/copilot/auth';
import { getProfile } from '@/lib/copilot/base';
import { extraRedirects } from '@/lib/copilot/connector';
import { askerOf, checkAuthorize, consentToken, resourceUrl } from '@/lib/copilot/oauth';
import { currentProfileId, oauthKey } from '@/lib/copilot/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: { absolute: 'Connect Claude · Copilot' }, robots: { index: false, follow: false } };

/** Why the screen came back, in words (api/copilot/oauth/authorize). */
const ERRORS: Record<string, string> = {
  code: 'That code did not work. A code lasts ten minutes and works once — show a new one in the app.',
  tries: 'Too many codes tried from this network. Wait ten minutes, then try again.',
  again: 'This screen was opened for another account, or you signed out since. Check it, then decide again.',
  server: 'The app could not check that code just now. Try again in a moment.',
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="cp-frame">
      <div className="cp-ob">
        <div className="cp-ob-head"><div className="cp-wordmark">COPILOT</div></div>
        <div className="cp-login cp2-cn">{children}</div>
      </div>
    </div>
  );
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const master = oauthKey();
  const base = appBaseUrlFrom(await headers());
  const check = checkAuthorize(q, { master, resource: resourceUrl(base), extra: extraRedirects() });
  // A bad request with a good address to answer goes back there, as RFC 6749
  // asks; Claude shows the error. One without is said here, sending nothing.
  if (!check.ok && 'redirect' in check) redirect(check.redirect);
  if (!check.ok) {
    return (
      <Frame>
        <h2>This link cannot be used.</h2>
        <p className="sub">{'show' in check ? check.show : ''}</p>
      </Frame>
    );
  }
  const r = check.req;
  const pid = q.with === 'code' ? null : await currentProfileId();
  const profile = pid ? await getProfile(pid) : null;
  const asker = askerOf(r.redirect);
  const error = q.err ? ERRORS[q.err] ?? null : null;
  const hidden: Array<[string, string]> = [
    ['response_type', 'code'],
    ['client_id', r.client.id],
    ['redirect_uri', r.redirect],
    ['code_challenge', r.challenge],
    ['code_challenge_method', 'S256'],
    ...(r.state ? [['state', r.state] as [string, string]] : []),
    ...(q.scope ? [['scope', q.scope] as [string, string]] : []),
    ...(q.resource ? [['resource', q.resource] as [string, string]] : []),
  ];
  const codeHref = `?${new URLSearchParams({ ...Object.fromEntries(hidden), with: 'code' }).toString()}`;

  return (
    <Frame>
      <h2>{asker.local ? 'Let an app on this computer read your record?' : `Let ${asker.name} read your record?`}</h2>
      <p className="sub">
        {asker.local ? 'While you work with it' : `While you talk things over in ${asker.name}`}, it can read what this app keeps, and nothing more.
      </p>
      <ul className="cp2-cn-list">
        <li><b>It can read</b> your offer, goals and plan, your bets, the conversations you logged, and what your rows count.</li>
        <li><b>It cannot</b> send, log, change or delete anything.</li>
      </ul>
      {asker.local ? (
        <p className="cp2-cn-warn">
          Only allow this if you just started it from Claude Code here: any program on this computer can ask.
          It calls itself &ldquo;{r.client.n}&rdquo;.
        </p>
      ) : (
        <p className="cp2-cn-back">You will be sent back to <b>{asker.host}</b>.</p>
      )}
      {error && <div className="cp-error">{error}</div>}

      <form method="post" action="/api/copilot/oauth/authorize" className="cp2-cn-form">
        {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {profile ? (
          <>
            <input type="hidden" name="via" value="session" />
            <input type="hidden" name="consent" value={consentToken(profile.id, r, master)} />
            <p className="cp2-cn-who">
              As <b>{profile.name || 'you'}</b>{profile.email ? ` · ${profile.email}` : ''}.{' '}
              <a className="cp2-cn-link" href={codeHref}>Another account?</a>
            </p>
          </>
        ) : (
          <>
            <input type="hidden" name="via" value="code" />
            <label className="cp2-cn-label" htmlFor="cp2-cn-pair">The code from your app</label>
            <input
              id="cp2-cn-pair" name="pair" className="cp-input cp2-cn-pair" required autoFocus
              autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={12} placeholder="XXXX-XXXX"
            />
            <p className="cp2-cn-hint">Open Copilot on your phone, then You → Claude → Show a code.</p>
          </>
        )}
        <button className="cp-btn primary block" name="decision" value="allow">Allow</button>
        <button className="cp-btn block cp2-cn-no" name="decision" value="deny" formNoValidate>Not now</button>
      </form>
      <p className="cp2-cn-foot">Disconnect any time under You → Claude.</p>
    </Frame>
  );
}
