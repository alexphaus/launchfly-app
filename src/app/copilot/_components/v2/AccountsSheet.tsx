'use client';
// Your own accounts: connected so work can go out under your name, one OK at a time.
//
// The gate on "Contact people" has said since the first version what opens it —
// "connect your own email or WhatsApp first" — and nothing could. This is that:
// an account of yours that speaks MCP (your mail, your calendar, your CRM),
// connected through its own consent screen, its token kept in a vault the app
// never reads (lib/copilot/accounts.ts). Every call through it waits for your
// OK on the job's card. Offered only where something can use it (invariant 7).
import { useState } from 'react';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

export function AccountsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const a = home.accounts;
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [token, setToken] = useState('');
  const [withToken, setWithToken] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!a?.canConnect) {
    return (
      <>
        <h3>Your accounts</h3>
        <p className="desc">Connecting an account needs the Claude agent on this server: it is what sends through your account, one message at a time with your OK. Nothing here can use one yet.</p>
      </>
    );
  }

  const connect = async () => {
    setBusy('connect'); setError(null);
    const r = withToken
      ? await actions.accountAction({ action: 'token', server: server.trim(), name: name.trim(), token: token.trim() })
      : await actions.accountAction({ action: 'start', server: server.trim(), name: name.trim() });
    if (!r.ok) { setBusy(null); return setError(r.error ?? 'Could not connect it'); }
    // Off to the account's own consent screen; it sends you back here.
    if (r.go) { window.location.assign(r.go); return; }
    setBusy(null); setName(''); setServer(''); setToken('');
  };
  const remove = async (id: string) => {
    setBusy(id); setError(null);
    const r = await actions.accountAction({ action: 'remove', id });
    setBusy(null);
    if (!r.ok) setError(r.error ?? 'Could not remove it');
  };

  return (
    <>
      <h3>Your accounts</h3>
      <p className="desc">
        A job you let contact people sends from these — your own address, never this app&rsquo;s — and every message waits for your OK on the job before it goes.
        The sign-in stays in a vault the app cannot read.
      </p>
      {a.unreadable && <div className="cp-note">Your accounts could not be read just now: {a.unreadable}</div>}
      {a.list.length > 0 && (
        <div className="cp-sheet-embed"><div className="cp-list cp2-rows">
          {a.list.map((x) => (
            <div key={x.id} className="cp2-row">
              <span className="cp2-row-main">
                <span className="t">{x.name}</span>
                <span className="s">{x.server.replace(/^https?:\/\//, '')} · {x.how === 'token' ? 'with a token' : 'signed in'}</span>
              </span>
              <button className="cp-connect ghost" disabled={busy !== null} onClick={() => void remove(x.id)}>{busy === x.id ? 'Removing' : 'Remove'}</button>
            </div>
          ))}
        </div></div>
      )}

      <div className="cp-section"><span className="lead">Connect one</span></div>
      <div className="cp-field">
        <label className="cp-label" htmlFor="cp-acct-name">What you call it</label>
        <input id="cp-acct-name" className="cp-input sm" maxLength={40} value={name} placeholder="My work email" onChange={(e) => { setName(e.target.value); setError(null); }} />
      </div>
      <div className="cp-field">
        <label className="cp-label" htmlFor="cp-acct-server">Its MCP server address</label>
        <input id="cp-acct-server" className="cp-input sm" inputMode="url" value={server} placeholder="https://mcp.example.com/mcp" onChange={(e) => { setServer(e.target.value); setError(null); }} />
        <p className="cp-help">The address the service gives for connecting AI tools to your account.</p>
      </div>
      {withToken && (
        <div className="cp-field">
          <label className="cp-label" htmlFor="cp-acct-token">Its token</label>
          <input id="cp-acct-token" className="cp-input sm" type="password" autoComplete="off" value={token} onChange={(e) => { setToken(e.target.value); setError(null); }} />
        </div>
      )}
      {error && <div className="cp-note">{error}</div>}
      <button className="cp-btn primary block" disabled={busy !== null || !name.trim() || !server.trim() || (withToken && !token.trim())} onClick={() => void connect()}>
        {busy === 'connect' ? 'Connecting…' : withToken ? 'Connect with this token' : 'Sign in to connect it'}
      </button>
      <button className="cp-btn ghost block" style={{ marginTop: 8 }} disabled={busy !== null} onClick={() => setWithToken(!withToken)}>
        {withToken ? 'Sign in instead' : 'It gave me a token instead'}
      </button>
    </>
  );
}
