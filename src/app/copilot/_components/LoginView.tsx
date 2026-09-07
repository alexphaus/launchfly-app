'use client';
// Returning user on a new device: email → one-time link → back in.
// Rendered by /copilot/login and /lifeos/login; the shell decides the theme and
// where "New here?" goes back to.
import { useEffect, useState } from 'react';
import { post } from './api';
import { useShell } from './shell';

export default function LoginView() {
  const shell = useShell();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('error') === 'expired') setError('That link has expired or was already used. Request a new one.');
  }, []);
  const send = async () => {
    setState('sending'); setError(null);
    try { await post('/auth/magic-link', { email: email.trim() }); setState('sent'); }
    catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Could not send'); }
  };
  return (
    <div className="cp-frame">
      <div className="cp-ob">
        <div className="cp-ob-head"><div className="cp-wordmark">{shell === '/lifeos' ? 'LIFE OS' : 'COPILOT'}</div><a className="cp-textlink" href={shell}>New here?</a></div>
        <div className="cp-login">
          <h2>Sign in.</h2>
          <p className="sub">Enter the email you verified in your copilot. We send a one-time link, no password.</p>
          {error && <div className="cp-error">{error}</div>}
          {state === 'sent' ? (
            <div className="cp-card" style={{ margin: 0 }}><b>Check your inbox.</b><div className="cp-help" style={{ marginTop: 6 }}>The link works once and expires in 15 minutes. Open it on the device you want to use.</div></div>
          ) : (
            <>
              <div className="cp-field"><label className="cp-label">Email</label><input className="cp-input" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@')) void send(); }} /></div>
              <button className="cp-btn primary block" disabled={state === 'sending' || !email.includes('@')} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send sign-in link'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
