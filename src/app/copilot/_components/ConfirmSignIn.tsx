'use client';
// The click that actually signs you in.
//
// It exists because a one-time link cannot be spent by a GET: Gmail scans every
// URL in an email, and Resend rewrites them through its own click-tracking
// redirector, so the token was routinely dead before the recipient tapped it.
// A button is the cheapest thing a scanner will not press.
import { useEffect, useState } from 'react';
import { post } from './api';
import { useShell } from './shell';

export default function ConfirmSignIn() {
  const shell = useShell();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Read from location rather than useSearchParams so the page needs no
  // Suspense boundary and renders instantly from the static shell.
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token')); }, []);

  const signIn = async () => {
    setState('busy'); setError(null);
    try {
      const r = await post<{ redirect: string }>('/auth/callback', { token, shell });
      window.location.href = r.redirect || shell;
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'That link no longer works.');
    }
  };

  return (
    <div className="cp-frame">
      <div className="cp-ob">
        <div className="cp-ob-head">
          <div className="cp-wordmark">{shell === '/lifeos' ? 'LIFE OS' : 'COPILOT'}</div>
        </div>
        <div className="cp-login">
          <h2>One more tap.</h2>
          <p className="sub">
            Your link checked out. This last step is here because mail providers open every link in
            an email before you do — pressing a button is the only way to be sure it was you.
          </p>
          {error && <div className="cp-error">{error}</div>}
          {state === 'error' ? (
            <a className="cp-btn primary block" href={`${shell}/login`} style={{ textDecoration: 'none' }}>Request a new link</a>
          ) : (
            <button className="cp-btn primary block" disabled={state === 'busy' || !token} onClick={signIn}>
              {state === 'busy' ? 'Signing in…' : 'Sign me in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
