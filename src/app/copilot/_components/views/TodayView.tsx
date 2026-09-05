'use client';
import { useState } from 'react';
import { PLANS } from '@/lib/copilot/plans';
import type { Execution, HomeData } from '@/lib/copilot/types';
import { money, pct } from '../format';
import type { Actions } from '../shared';

function execChip(e: Execution | null | undefined): { cls: string; label: string } | null {
  if (!e) return null;
  if (e.approval_state === 'sent') return { cls: 'sent', label: 'Sent' };
  if (e.approval_state === 'failed') return { cls: 'failed', label: 'Failed' };
  if (e.approval_state === 'cancelled') return null;
  return { cls: 'send', label: 'Ready to send' };
}

export default function TodayView({ home, actions, briefing, finding }: { home: HomeData; actions: Actions; briefing: boolean; finding: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const urgent = home.nudges.filter((n) => n.urgency === 'urgent').length;
  const m = home.metrics;
  const b = home.billing;
  const currency = home.goals.find((g) => g.metric === 'currency')?.unit || '$';

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

      <div className="cp-metrics" aria-label="Your numbers">
        <div className="cp-stat"><div className="v">{m.sent}</div><div className="l">Sent</div></div>
        <div className={`cp-stat ${m.replies ? 'hot' : ''}`}><div className="v">{m.replies}</div><div className="l">Replies</div></div>
        <div className="cp-stat"><div className="v">{pct(m.reply_rate)}</div><div className="l">Reply rate</div></div>
        <div className={`cp-stat ${m.won ? 'hot' : ''}`}><div className="v">{m.won_amount ? money(m.won_amount, currency) : m.won}</div><div className="l">Won</div></div>
      </div>
      <div className="cp-metrics-note">Last {m.window_days} days · real numbers from what you actually sent</div>

      {/* The wall is only useful where it is hit. A toast on the Find button
          disappears; this stays until they act on it or the month turns. */}
      {b.matches.remaining === 0 && (
        <div className="cp-card cp-wall">
          <div className="cp-eyebrow">Out of matches</div>
          <p>
            You have used all {b.matches.limit} matches on {PLANS[b.effective].name} this month. Your brief,
            drafts and funnel keep running on what you already have — only new supply stops.
          </p>
          {b.effective !== 'operator' && (
            <a className="cp-btn primary block" href="/copilot/pricing">
              See plans — {PLANS[b.effective === 'free' ? 'pro' : 'operator'].limits.matchesPerMonth.toLocaleString()} a month
            </a>
          )}
          <p className="cp-wall-sub">
            Resets on the 1st.{b.effective === 'operator' && ' If you are hitting 2,000 a month, get in touch and we will size something.'}
          </p>
        </div>
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

      <div className="cp-section">
        <span className="lead">Today&apos;s leverage plan</span>
        {home.planOverflow > 0 && <span className="count">{home.plan.filter((a) => a.status === 'open').length} of {home.plan.filter((a) => a.status === 'open').length + home.planOverflow}</span>}
      </div>
      {home.plan.length ? (
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
      ) : (
        <div className="cp-empty"><b>Plan arrives with the brief</b>Two to five moves that fit your capacity. Real matches get a drafted message you approve with one tap.</div>
      )}

      {home.planOverflow > 0 && (
        <div className="cp-note" style={{ marginTop: 8 }}>
          {home.planOverflow} more draft{home.planOverflow === 1 ? '' : 's'} waiting behind these. A plan you can finish beats a queue you cannot — clear these first and the next batch moves up.
        </div>
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
