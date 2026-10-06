'use client';
// You → Claude: talk things over in Claude with the record in front of it.
//
// The address to paste, the three steps that get from here to a connected
// Claude, a code for the laptop the app is not open on, and every connection
// with when it last read and what — the person's only view of what Claude has
// read, so a failed read is said on its row (connector.ts markSeen) and a list
// that could not be loaded says so instead of reading as "nothing connected".
import { useEffect, useState } from 'react';
import { TOOLS } from '@/lib/copilot/mcp';
import type { Connection } from '@/lib/copilot/oauth';
import { relTime, shortDay } from '../format';
import type { Actions } from '../shared';

const TOOL_TITLE = new Map<string, string>(TOOLS.map((t) => [t.name, t.title]));

export function ClaudeSheet({ actions }: { actions: Actions }) {
  const [url, setUrl] = useState<string | null>(null);
  const [list, setList] = useState<Connection[] | null>(null);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await actions.connections();
      if (!live) return;
      if (!r.ok) return setError(r.error ?? 'Could not read your connections');
      setUrl(r.url ?? null);
      setList(r.connections ?? []);
      setUnreadable(r.unreadable ?? null);
    })();
    return () => { live = false; };
    // actions is rebuilt every render and this is a one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!url) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Said rather than ignored: the address is on screen to copy by hand.
      setError('This browser would not let the page copy. Press and hold the address to copy it.');
    }
  };

  const showCode = async () => {
    setBusy('code'); setError(null);
    const r = await actions.pairCode();
    setBusy(null);
    if (!r.ok || !r.code || !r.expiresAt) return setError(r.error ?? 'Could not make a code');
    setCode({ code: r.code, expiresAt: r.expiresAt });
  };

  const disconnect = async (grant: string) => {
    setBusy(grant); setError(null);
    const r = await actions.disconnect(grant);
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not disconnect that');
    setList(r.connections ?? []);
  };

  return (
    <>
      <h3>Claude</h3>
      <p className="desc">
        Talk things over in Claude with your record in front of it: your offer, goals, plan, bets, the conversations you
        logged and what your rows count. It reads. It cannot send, log, change or delete anything.
      </p>
      {error && <div className="cp-error">{error}</div>}

      <p className="cp-label cp2-cl-label">Connect</p>
      <ol className="cp2-cl-steps">
        <li>
          In Claude, open{' '}
          <a className="cp2-cl-a" href="https://claude.ai/customize/connectors" target="_blank" rel="noopener noreferrer">Customize → Connectors</a>
          {' '}and choose <b>Add custom connector</b>.
        </li>
        <li>
          Paste this address as its URL:
          <span className="cp2-cl-url">
            <code>{url ?? '…'}</code>
            <button className="cp-btn sm" disabled={!url} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
          </span>
        </li>
        <li>
          Claude opens a page to allow it. Where you are signed in to this app it is one tap; anywhere else it asks for a code:
          {code ? (
            <span className="cp2-cl-code">
              <b>{code.code}</b>
              <span>Works once, until {new Date(code.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</span>
            </span>
          ) : (
            <button className="cp-btn sm cp2-cl-codebtn" disabled={busy === 'code'} onClick={() => void showCode()}>{busy === 'code' ? 'Making one…' : 'Show a code'}</button>
          )}
        </li>
      </ol>

      <p className="cp-label cp2-cl-label">Connected</p>
      {unreadable ? (
        <p className="cp2-cl-none">Could not read your connections: {unreadable}</p>
      ) : list === null ? (
        <p className="cp2-cl-none">Reading…</p>
      ) : list.length === 0 ? (
        <p className="cp2-cl-none">Nothing connected yet.</p>
      ) : (
        <div className="cp2-cl-list">
          {list.map((c) => (
            <div key={c.grant} className="cp2-cl-row">
              <div className="cp2-cl-main">
                <b>{c.name}{c.host && c.name !== c.host ? <span> · {c.host}</span> : null}</b>
                <span>
                  Connected {shortDay(c.at.slice(0, 10))}
                  {c.seen
                    ? ` · last read ${relTime(c.seen.at)}${c.seen.tool ? `: ${TOOL_TITLE.get(c.seen.tool) ?? c.seen.tool}` : ''} · ${c.seen.n} ${c.seen.n === 1 ? 'read' : 'reads'}`
                    : ' · has not read anything yet'}
                </span>
                {c.seen?.error && <span className="cp2-cl-err">Its last read failed: {c.seen.error}</span>}
              </div>
              <button className="cp-btn sm" disabled={busy === c.grant} onClick={() => void disconnect(c.grant)}>{busy === c.grant ? 'Ending…' : 'Disconnect'}</button>
            </div>
          ))}
        </div>
      )}
      <p className="cp-note">Your email and payment details are not in what it reads. Claude cannot save anything here: what belongs in the record, you log in the app. Said into the mic, it opens filled in.</p>
    </>
  );
}
