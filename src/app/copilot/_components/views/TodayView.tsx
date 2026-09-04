'use client';
import { useState } from 'react';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

export default function TodayView({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const urgent = home.nudges.filter((n) => n.urgency === 'urgent').length;

  const submit = async (regenerate: boolean) => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), regenerate);
    if (saved) setNote('');   // keep the user's text if the save failed
    setSending(false);
  };

  return (
    <>
      {briefing && <div className="cp-banner"><span className="dot" />Building today&apos;s brief</div>}

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

      <div className="cp-section"><span className="lead">Today&apos;s leverage plan</span></div>
      {home.plan.length ? (
        <div className="cp-list">
          {home.plan.map((a) => (
            <button key={a.id} className={`cp-row ${a.status === 'done' ? 'done' : ''}`} onClick={() => actions.openSheet({ kind: 'action', id: a.id })}>
              <span className={`cp-chip ${a.status === 'done' ? 'done' : a.owner}`}>{a.status === 'done' ? 'Done' : a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>
              <span className="txt">{a.minutes && a.owner === 'you' && a.status !== 'done' ? `${a.minutes} min — ` : ''}{a.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="cp-empty"><b>Plan arrives with the brief</b>Two to five moves that fit your capacity, some drafted for you.</div>
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
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed? A win, a number, a constraint, a person, a lead that went cold…"
          maxLength={2000}
        />
        <div className="bar">
          <span className="hint">Lands in your context. Sharpens the next brief.</span>
          <button className="cp-btn" disabled={sending || !note.trim()} onClick={() => submit(false)}>Add</button>
          <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => submit(true)}>Add &amp; re-plan</button>
        </div>
      </div>
    </>
  );
}
