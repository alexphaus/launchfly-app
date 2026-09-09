'use client';
// One match at a time. Draft it, or it is not for you.
//
// Swipe is the fast path, not the only path: every gesture has a button beside
// it. A deck that can only be answered by dragging is unusable with one hand
// full, on a bad connection, or by anyone using assistive tech — and this is a
// screen meant to be cleared in sixty seconds on a phone.
//
// The stack is deliberately confined to this judgement. See lib/copilot/triage.ts
// for why it is not the send queue.
import { useRef, useState } from 'react';
import type { TriageCard } from '@/lib/copilot/triage';
import type { Actions } from './shared';

/** Past this the drag counts as an answer rather than a fidget. */
const COMMIT_PX = 96;
/** Cards drawn behind the top one, purely so the pile reads as a pile. */
const PEEK = 2;

export default function TriageStack({ cards, actions }: { cards: TriageCard[]; actions: Actions }) {
  const [dx, setDx] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const top = cards[0];
  if (!top) return null;

  const answer = async (action: 'draft' | 'skip') => {
    if (busy) return;
    setBusy(true);
    // Fly the card out before the round trip, so the pile feels immediate even
    // though the server is what actually decides.
    setDx(action === 'draft' ? 600 : -600);
    try { await actions.triage(top.id, action); } finally { setDx(0); setBusy(false); }
  };

  const onDown = (x: number) => { if (!busy) start.current = x; };
  const onMove = (x: number) => { if (start.current !== null) setDx(x - start.current); };
  const onUp = () => {
    if (start.current === null) return;
    const moved = dx;
    start.current = null;
    if (moved > COMMIT_PX) void answer('draft');
    else if (moved < -COMMIT_PX) void answer('skip');
    else setDx(0);
  };

  const intent = dx > COMMIT_PX / 2 ? 'draft' : dx < -COMMIT_PX / 2 ? 'skip' : null;

  return (
    <>
      <div className="cp-section">
        <span className="lead">Worth messaging?</span>
        <span className="count">{cards.length} to judge</span>
      </div>

      <div className="cp-stack">
        {intent && <div className="cp-stack-intent">{intent === 'draft' ? 'Draft it' : 'Not for me'}</div>}
        {cards.slice(1, 1 + PEEK).reverse().map((c, i) => (
          <div key={c.id} className="cp-stack-back" style={{ transform: `translateY(${(PEEK - i) * 6}px) scale(${1 - (PEEK - i) * 0.03})` }} />
        ))}

        <div
          className="cp-card cp-stack-top"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 28}deg)`, transition: start.current === null ? 'transform .18s ease-out' : 'none' }}
          onPointerDown={(e) => onDown(e.clientX)}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="cp-eyebrow">{top.segment || 'Match'}</div>
          <h2 className="cp-call-head">{top.title}</h2>
          {top.reason && <p className="cp-stack-reason">{top.reason}</p>}
          <div className="cp-stack-meta">
            {top.contact.whatsapp ? 'WhatsApp' : 'Email'}
            {top.url ? <> · <a href={top.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>Look them up</a></> : null}
          </div>
        </div>
      </div>

      <div className="cp-btn-row">
        <button className="cp-btn" disabled={busy} onClick={() => void answer('skip')}>Not for me</button>
        <button className="cp-btn primary" disabled={busy} onClick={() => void answer('draft')}>Draft it</button>
      </div>
      <div className="cp-note" style={{ marginTop: 8 }}>
        Swipe or tap. What you keep decides what comes up first — it never changes what counts as a result.
      </div>
    </>
  );
}
