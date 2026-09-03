'use client';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

export default function GrowthView({ home, actions }: { home: HomeData; actions: Actions }) {
  return (
    <>
      <div className="cp-section"><span className="lead">Skill gaps vs. matches</span></div>
      {home.skills.length ? home.skills.map((s) => (
        <div key={s.id} className="cp-card">
          <div className="cp-gtop"><span className="cp-gtitle">{s.title}</span><span className="cp-gpct">{s.level ?? 0}%</span></div>
          <div className="cp-gtrack"><div className="cp-fill" style={{ width: `${s.level ?? 0}%` }} /></div>
          {s.note && <div className="cp-gnote">{s.note}</div>}
          {s.cta && <button className="cp-gcta" onClick={() => actions.setTab('opps')}>{s.cta} →</button>}
        </div>
      )) : (
        <div className="cp-empty"><b>Skills map arrives with matches</b>The copilot compares what opportunities ask for with what you already do, and shows the gap.</div>
      )}

      <div className="cp-section"><span className="lead">Worth learning this week</span></div>
      {home.lessons.length ? home.lessons.map((l, i) => (
        <div key={l.id} className="cp-card" style={{ padding: 0 }}>
          <button className="cp-learn" onClick={() => actions.openSheet({ kind: 'lesson', id: l.id })}>
            <div className="cp-lnum">{String(i + 1).padStart(2, '0')}</div>
            <div style={{ flex: 1 }}>
              <div className="cp-lt">{l.title}{l.minutes ? `, ${l.minutes} min` : ''}</div>
              {l.note && <div className="cp-ls">{l.note}</div>}
            </div>
          </button>
        </div>
      )) : (
        <div className="cp-empty"><b>Nothing queued yet</b>Short, specific things to learn, each tied to an opportunity you missed or could land.</div>
      )}
    </>
  );
}
