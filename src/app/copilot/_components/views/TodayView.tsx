'use client';
// Today is a send queue. Everything else on this screen exists to get a message
// out of the door or to record what came back.
import { useState } from 'react';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { PLANS } from '@/lib/copilot/plans';
import { useShell } from '../shell';
import type { Execution, HomeData, QueueItem } from '@/lib/copilot/types';
import { money } from '../format';
import type { Actions } from '../shared';

/** How many queue rows show before the fold. A queue is a queue; it is not capped, only folded. */
const QUEUE_FOLD = 5;

function execChip(e: Execution | null | undefined): { cls: string; label: string } | null {
  if (!e) return null;
  if (e.approval_state === 'sent') return { cls: 'sent', label: 'Sent' };
  if (e.approval_state === 'failed') return { cls: 'failed', label: 'Failed' };
  if (e.approval_state === 'cancelled') return null;
  return { cls: 'send', label: 'Ready to send' };
}

export default function TodayView({ home, actions, briefing, finding }: { home: HomeData; actions: Actions; briefing: boolean; finding: boolean }) {
  const shell = useShell();
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [unfold, setUnfold] = useState(false);
  const urgent = home.nudges.filter((n) => n.urgency === 'urgent').length;
  const m = home.metrics;
  const b = home.billing;
  const currency = home.goals.find((g) => g.metric === 'currency')?.unit || '$';
  const noOffer = offerIsEmpty(home.profile.offer);
  const queue = home.queue;
  const visible = unfold ? queue : queue.slice(0, QUEUE_FOLD);

  const submit = async (regenerate: boolean) => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), regenerate);
    if (saved) setNote('');
    setSending(false);
  };

  return (
    <>
      {(briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s brief'}</div>}

      {/* Sent is the hero. The app has a supply surplus and a sending deficit, and
          the headline number should be on the side that needs to move. */}
      <div className="cp-metrics" aria-label="Your numbers">
        <div className={`cp-stat hero ${m.sent ? 'hot' : ''}`}><div className="v">{m.sent}</div><div className="l">Sent</div></div>
        <div className="cp-stat"><div className="v">{queue.length}</div><div className="l">To send</div></div>
        <div className={`cp-stat ${m.replies ? 'hot' : ''}`}><div className="v">{m.replies}</div><div className="l">Replies</div></div>
        <div className={`cp-stat ${m.won ? 'hot' : ''}`}><div className="v">{m.won_amount ? money(m.won_amount, currency) : m.won}</div><div className="l">Won</div></div>
      </div>
      <div className="cp-metrics-note">Last {m.window_days} days · real numbers from what you actually sent</div>

      {b.matches.remaining === 0 && (
        <div className="cp-card cp-wall">
          <div className="cp-eyebrow">Out of matches</div>
          <p>
            You have used all {b.matches.limit} matches on {PLANS[b.effective].name} this month. Your brief,
            drafts and funnel keep running on what you already have — only new supply stops.
          </p>
          {b.effective !== 'operator' && (
            <a className="cp-btn primary block" href={`${shell}/pricing`}>
              See plans — {PLANS[b.effective === 'free' ? 'pro' : 'operator'].limits.matchesPerMonth.toLocaleString()} a month
            </a>
          )}
          <p className="cp-wall-sub">
            Resets on the 1st.{b.effective === 'operator' && ' If you are hitting 2,000 a month, get in touch and we will size something.'}
          </p>
        </div>
      )}

      {noOffer ? (
        /* Nothing is drafted from a blank offer, so there is no queue to show.
           Say why, with the number that makes it concrete. */
        <div className="cp-card cp-wall cp-block">
          <div className="cp-eyebrow">Nothing sends yet</div>
          <p>
            <b>Nothing sends until you say what you sell.</b>{' '}
            {m.pipeline.sourced > 0
              ? `${m.pipeline.sourced} real ${m.pipeline.sourced === 1 ? 'business is' : 'businesses are'} waiting for an opener. Every one is written from your offer — two lines, in your words.`
              : 'Every opener is written from your offer — two lines, in your words. Set it and the copilot starts drafting.'}
          </p>
          <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'offer' })}>Set your offer</button>
          <p className="cp-wall-sub">Takes about three minutes. Drafts appear the moment you save.</p>
        </div>
      ) : (
        <>
          <div className="cp-section">
            <span className="lead">To send</span>
            <span className="count">{queue.length ? `${queue.length} waiting` : 'clear'}</span>
          </div>
          {queue.length ? (
            <>
              <div className="cp-list">
                {visible.map((q) => <QueueRow key={q.id} q={q} home={home} actions={actions} />)}
              </div>
              {queue.length > QUEUE_FOLD && (
                <button className="cp-textlink cp-fold" onClick={() => setUnfold((v) => !v)}>
                  {unfold ? 'Show fewer' : `Show ${queue.length - QUEUE_FOLD} more`}
                </button>
              )}
            </>
          ) : (
            <div className="cp-empty"><b>Queue is clear.</b>Every match with a contact has been messaged. Find new ones on Pipeline, or log what came back.</div>
          )}
        </>
      )}

      {home.insight ? (
        <div className="cp-card cp-insight">
          <div className="cp-eyebrow">{home.insight.eyebrow}</div>
          <p>{home.insight.body}</p>
          {home.insight.reasoning && (
            <>
              <button className="cp-go" onClick={() => setShowWhy((v) => !v)}>{showWhy ? 'Hide the reasoning' : 'See the reasoning →'}</button>
              {showWhy && <div className="cp-reasoning">{home.insight.reasoning}</div>}
            </>
          )}
        </div>
      ) : (
        <div className="cp-empty" style={{ marginTop: 14 }}>
          <b>No brief yet</b>
          The copilot writes one read of your day, every day. {briefing ? 'Building it now.' : <button className="cp-textlink" onClick={() => actions.runBrief('manual')}>Build it now</button>}
        </div>
      )}

      {(home.plan.length > 0 || home.planOverflow > 0) && (
        <>
          <div className="cp-section">
            <span className="lead">Also today</span>
            {home.planOverflow > 0 && <span className="count">{home.plan.filter((a) => a.status === 'open').length} of {home.plan.filter((a) => a.status === 'open').length + home.planOverflow}</span>}
          </div>
          <div className="cp-list">
            {home.plan.map((a) => {
              const ec = a.status !== 'done' ? execChip(a.execution) : null;
              return (
                <button key={a.id} className={`cp-row ${a.status === 'done' ? 'done' : ''}`} onClick={() => actions.openSheet({ kind: 'action', id: a.id })}>
                  <span className={`cp-chip ${a.status === 'done' ? 'done' : ec ? ec.cls : a.owner}`}>{a.status === 'done' ? 'Done' : ec ? ec.label : a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>
                  <span className="txt">{a.minutes && a.owner === 'you' && a.status !== 'done' ? `${a.minutes} min — ` : ''}{a.title}</span>
                </button>
              );
            })}
          </div>
          {home.planOverflow > 0 && (
            <div className="cp-note" style={{ marginTop: 8 }}>
              {home.planOverflow} more behind these. A plan you can finish beats a list you cannot.
            </div>
          )}
        </>
      )}

      <div className="cp-section"><span className="lead">Next actions</span>{urgent > 0 && <span className="count">{urgent} urgent</span>}</div>
      {home.nudges.length ? (
        <div className="cp-list">
          {home.nudges.map((n) => (
            <button key={n.id} className={`cp-nrow ${n.urgency}`} onClick={() => actions.openSheet({ kind: 'action', id: n.id })}>
              <div className="cp-ndot" />
              <div><div className="t">{n.title}</div>{n.due_label && <div className="s">{n.due_label}</div>}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="cp-empty"><b>Nothing pressing</b>Nudges show up here when something is about to go cold or needs a decision.</div>
      )}

      <div className="cp-section"><span className="lead">Tell the copilot</span><span className="count">{home.contextCount} in context</span></div>
      <div className="cp-composer">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? A win, a number, a constraint, a person, a lead that went cold…" maxLength={2000} />
        <div className="bar">
          <span className="hint">Lands in your context. Sharpens the next brief.</span>
          <button className="cp-btn" disabled={sending || !note.trim()} onClick={() => submit(false)}>Add</button>
          <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => submit(true)}>Add &amp; re-plan</button>
        </div>
      </div>
    </>
  );
}

/**
 * One draft, two taps. The primary action opens the message in the user's own
 * WhatsApp or mail app (or sends via API when this profile owns the channel);
 * "I sent it" records that it went. Tapping the text opens the full sheet to edit.
 */
function QueueRow({ q, home, actions }: { q: QueueItem; home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const e = q.execution;
  // The business is the identity; the contact's first name is detail. Two rows
  // both headed "Maria" told the user nothing.
  const who = q.opp?.title || q.title.replace(/^Opener to /, '').replace(/, ready to review$/, '');
  const apiSend = home.channels[e.channel];
  const label = e.channel === 'whatsapp' ? 'WhatsApp' : 'Email';
  const sub = [
    q.opp?.name, q.opp?.segment,
    e.approval_state === 'failed' ? 'send failed — retry' : q.title.startsWith('Follow-up') ? 'follow-up' : null,
  ].filter(Boolean).join(' · ') || label;
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <div className={`cp-qrow ${e.approval_state === 'failed' ? 'failed' : ''}`}>
      <button className="cp-qwho" onClick={() => actions.openSheet({ kind: 'action', id: q.id })}>
        <span className="name">{who}</span>
        <span className="sub">{sub}</span>
      </button>
      <div className="cp-qacts">
        {apiSend
          ? <button className="cp-btn primary sm" disabled={busy} onClick={() => act(() => actions.sendAction(q.id))}>{busy ? '…' : 'Send'}</button>
          : <a className="cp-btn primary sm" href={e.deep_link ?? '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }} title={`Open in ${label}`}>{label}</a>}
        <button className="cp-btn sm" disabled={busy} onClick={() => act(() => actions.markSent(q.id))}>I sent it</button>
      </div>
    </div>
  );
}
