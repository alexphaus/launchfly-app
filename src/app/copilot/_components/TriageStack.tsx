'use client';
// One candidate at a time. Worth approaching, or not for you.
//
// Swipe is the fast path, not the only path: every gesture has a button beside
// it. A deck that can only be answered by dragging is unusable with one hand
// full, on a bad connection, or by anyone using assistive tech — and this is a
// screen meant to be cleared in sixty seconds on a phone.
//
// The buttons live INSIDE the card. Outside they belonged to the section rather
// than to the thing being judged: the card slid away under a row that stayed
// put, and on a pile two cards deep it read as one set of controls for three
// cards. Inside, they leave with the answer they gave.
//
// The stack is deliberately confined to this one judgement. See
// lib/copilot/triage.ts for why it is not the send queue.
import { useRef, useState } from 'react';
import { triageLabels, type TriageCard } from '@/lib/copilot/triage';
import type { Actions } from './shared';

/** Past this the drag counts as an answer rather than a fidget. */
const COMMIT_PX = 96;
/** Cards drawn behind the top one, purely so the pile reads as a pile. */
const PEEK = 2;

export default function TriageStack({ cards, held, actions }: { cards: TriageCard[]; held: 'queue' | null; actions: Actions }) {
  const [dx, setDx] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const top = cards[0];

  // Held and nothing left to ask about: say so once, quietly, instead of
  // rendering a section with no cards under it. Silence here reads as a bug.
  if (!top) {
    return held === 'queue' ? (
      <div className="cp-note" style={{ marginTop: 14 }}>
        New matches are on hold while the queue is deep. Send a few and judging opens back up.
      </div>
    ) : null;
  }

  const labels = triageLabels(top.source);

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
        <span className="lead">Worth approaching?</span>
        <span className="count">{cards.length} to judge</span>
      </div>

      <div className="cp-stack">
        {cards.slice(1, 1 + PEEK).reverse().map((c, i) => (
          // scaleX, never scale. A uniform scale shrinks the height as fast as
          // translateY pushes the card down — the two peeks landed within 2px of
          // each other and the pile rendered as one thin shelf. Width narrows,
          // height does not, so each card sits a clean step lower than the last.
          <div key={c.id} className="cp-stack-back" style={{ transform: `translateY(${(PEEK - i) * 11}px) scaleX(${1 - (PEEK - i) * 0.045})` }} />
        ))}

        <div
          className={`cp-card cp-stack-top${intent ? ` intent-${intent}` : ''}`}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 28}deg)`, transition: start.current === null ? 'transform .18s ease-out' : 'none' }}
          onPointerDown={(e) => onDown(e.clientX)}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* Sits on the card so it rides out with the answer it describes, and
              is keyed to the intent so the colour says which way you are going. */}
          {intent && <div className="cp-stack-intent">{intent === 'draft' ? labels.yes : labels.no}</div>}

          <div className="cp-stack-body">
            <div className="cp-eyebrow">{top.segment || (top.source === 'move' ? 'Found for you' : 'Match')}</div>
            <h2 className="cp-call-head">{top.title}</h2>
            {top.reason && <p className="cp-stack-reason">{top.reason}</p>}
          </div>

          <div className="cp-stack-meta">
            {top.source === 'move'
              ? 'From a source you watch'
              : top.contact.whatsapp ? 'WhatsApp' : 'Email'}
            {top.url ? <> · <a href={top.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>{top.source === 'move' ? 'Open it' : 'Look them up'}</a></> : null}
          </div>

          <div className="cp-stack-acts">
            <button className="cp-btn" disabled={busy} onPointerDown={(e) => e.stopPropagation()} onClick={() => void answer('skip')}>{labels.no}</button>
            <button className="cp-btn primary" disabled={busy} onPointerDown={(e) => e.stopPropagation()} onClick={() => void answer('draft')}>{labels.yes}</button>
          </div>
        </div>
      </div>

      <div className="cp-note" style={{ marginTop: 10 }}>
        {held === 'queue'
          ? 'New matches are on hold while the queue is deep — these are finds from sources you watch.'
          : 'Swipe or tap. What you keep decides what comes up first — it never changes what counts as a result.'}
      </div>
    </>
  );
}
