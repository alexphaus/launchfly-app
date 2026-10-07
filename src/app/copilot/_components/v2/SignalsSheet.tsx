'use client';
// You → Records → Sign-ups and sales: the count link (lib/copilot/signal.ts).
//
// One address per kind — a form tool posts its own payload, so the link says
// what each post counts — and Stripe's, which reads Stripe's own events. Then
// what it recorded lately, with what did not count and why, and the way to end
// a link that went somewhere it should not have.
import { useEffect, useState } from 'react';
import { SIGNAL_WORDS, signalLine } from '@/lib/copilot/signal';
import type { HomeData } from '@/lib/copilot/types';
import { relTime } from '../format';
import type { Actions, SignalLinks } from '../shared';

type Row = { key: keyof SignalLinks; label: string; how: string };

const ROWS: Row[] = [
  { key: 'signup', label: 'Sign-ups', how: 'Your sign-up form or waitlist posts here. Each post is one sign-up.' },
  { key: 'enquiry', label: 'Enquiries', how: 'Your contact form or booking page posts here. Each post is one enquiry.' },
  { key: 'stripe', label: 'Payments through Stripe', how: 'In Stripe: Developers → Webhooks → add this as an endpoint, with the events invoice.paid and checkout.session.completed.' },
  { key: 'sale', label: 'Any other payment', how: 'Post amount and currency with it, and an id if it may be sent twice.' },
];

export function SignalsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [links, setLinks] = useState<SignalLinks | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const s = home.signals;

  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await actions.signalLinks();
      if (!live) return;
      if (!r.ok) return setError(r.error ?? 'Could not read your link');
      setLinks(r.links ?? null);
    })();
    return () => { live = false; };
    // actions is rebuilt every render and this is a one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (k: string, url: string) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(k);
    } catch {
      // Said rather than ignored: the address is on screen to copy by hand.
      setError('This browser would not let the page copy. Press and hold the address to copy it.');
    }
  };

  const make = async () => {
    // Replacing a link ends the old one at once: asked twice, never by one stray tap.
    if (links && !sure) return setSure(true);
    setBusy(true); setError(null);
    const r = await actions.makeSignalLink();
    setBusy(false); setSure(false);
    if (!r.ok || !r.links) return setError(r.error ?? 'Could not make a link');
    setLinks(r.links); setCopied(null);
  };

  return (
    <>
      <h3>Sign-ups and sales</h3>
      <p className="desc">
        A private link your forms and checkout send to. Each sign-up, enquiry or payment it gets is counted where Proof counts
        how buyers hear and what they pay — measured, not typed. Nothing about who sent it is kept: no names, no emails.
      </p>
      {error && <div className="cp-error">{error}</div>}
      {s?.unreadable && <div className="cp-error">Could not read what your link recorded: {s.unreadable}</div>}

      {links === undefined ? (
        <p className="cp2-cl-none">Reading…</p>
      ) : links === null ? (
        <button className="cp-btn primary block" disabled={busy} onClick={() => void make()}>{busy ? 'Making it…' : 'Make my count link'}</button>
      ) : (
        <div className="cp2-sg-links">
          {ROWS.map((r) => (
            <div key={r.key} className="cp2-sg-link">
              <p className="cp-label cp2-cl-label">{r.label}</p>
              <span className="cp2-cl-url">
                <code>{links[r.key]}</code>
                <button className="cp-btn sm" onClick={() => void copy(r.key, links[r.key])}>{copied === r.key ? 'Copied' : 'Copy'}</button>
              </span>
              <p className="cp-help">{r.how}</p>
            </div>
          ))}
          <p className="cp-help">A plain form can send people on to your thank-you page: add <code>&amp;then=</code> and its address to the link.</p>
        </div>
      )}

      <p className="cp-label cp2-cl-label">What it recorded</p>
      {!s || !s.recent.length ? (
        <p className="cp2-cl-none">{links ? 'Nothing sent to it yet.' : 'No link yet.'}</p>
      ) : (
        <>
          {signalLine(s.counts ?? {}) && <p className="cp-help">{signalLine(s.counts ?? {})} counted so far.</p>}
          <div className="cp2-cl-list">
            {s.recent.map((x) => (
              <div key={x.id} className="cp2-cl-row">
                <div className="cp2-cl-main">
                  <b>
                    {SIGNAL_WORDS[x.kind][0].replace(/^./, (c) => c.toUpperCase())}
                    {x.amount != null ? <span> · {x.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}{x.currency ? ` ${x.currency}` : ''}</span> : null}
                  </b>
                  <span>{relTime(x.at)}{x.from === 'stripe' ? ' · from Stripe' : x.from === 'app' ? ' · a new account' : ''}</span>
                  {!x.counted && <span className="cp2-cl-err">Not counted. {x.why ?? ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {links && (
        <button className="cp-btn block cp2-sg-new" disabled={busy} onClick={() => void make()}>
          {busy ? 'Making it…' : sure ? 'Tap again: the link in use stops counting' : 'Make a new link'}
        </button>
      )}
      <p className="cp-note">
        Anyone with the link can add to your counts, so put it only where your own tools send from. Opening it in a browser
        counts nothing. A bet that counts sign-ups or enquiries counts what it records by itself.
      </p>
    </>
  );
}
