'use client';
// What Claude proposed, each to keep, change or drop (lib/copilot/proposals.ts).
//
// A proposal is a chat's draft of something the person said: a conversation to
// log, or a test for the shelf. It is not theirs until they keep it, so every
// one is shown with what it would write and who proposed it, and kept by a tap
// — as it stands, or changed first on the conversation sheet. Dropping one
// keeps nothing of it.
import { useState } from 'react';
import { betPrice } from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { proposalLine } from '@/lib/copilot/proposals';
import type { HomeData } from '@/lib/copilot/types';
import { relTime } from '../format';
import type { Actions } from '../shared';

export function ProposalsSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = home.proposals?.open ?? [];
  const { priceLabel } = betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals));

  const answer = async (id: string, action: 'keep' | 'drop') => {
    setBusy(`${action}:${id}`); setError(null);
    const r = await actions.answerProposal(id, action);
    setBusy(null);
    if (!r.ok) setError(r.error ?? 'Could not answer that');
  };

  return (
    <>
      <h3>From Claude</h3>
      <p className="desc">
        What Claude proposed from your chats. None of it is logged or kept until you say: keep it as it is, change it first,
        or drop it.
      </p>
      {error && <div className="cp-error">{error}</div>}
      {home.proposals?.unreadable && <div className="cp-error">Could not read what Claude proposed: {home.proposals.unreadable}</div>}
      {!open.length ? (
        <p className="cp2-cl-none">Nothing waiting.</p>
      ) : (
        <div className="cp2-cl-list">
          {open.map((p) => (
            <div key={p.id} className="cp2-pp-row">
              <div className="cp2-cl-main">
                <b>{proposalLine(p, priceLabel)}</b>
                {p.kind === 'talk' && p.talk?.said && <span>“{p.talk.said}”</span>}
                {p.kind === 'test' && p.test?.idea && <span>{p.test.idea.label}: {p.test.idea.how}</span>}
                <span>Proposed {relTime(p.at)}{p.why ? ` · ${p.why}` : ''}</span>
              </div>
              <div className="cp2-pp-do">
                <button className="cp-btn sm primary" disabled={busy !== null} onClick={() => void answer(p.id, 'keep')}>
                  {busy === `keep:${p.id}` ? 'Keeping…' : p.kind === 'talk' ? 'Log it' : 'Keep on my shelf'}
                </button>
                {p.kind === 'talk' && (
                  <button className="cp-btn sm" disabled={busy !== null} onClick={() => actions.swapSheet({ kind: 'talk', proposal: p.id })}>Change it first</button>
                )}
                <button className="cp-btn sm cp2-pp-drop" disabled={busy !== null} onClick={() => void answer(p.id, 'drop')}>{busy === `drop:${p.id}` ? 'Dropping…' : 'Drop'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="cp-note">
        Claude proposes only on a connection you let propose, under You → Claude. A test kept here waits on your shelf; only you
        start a bet.
      </p>
    </>
  );
}
