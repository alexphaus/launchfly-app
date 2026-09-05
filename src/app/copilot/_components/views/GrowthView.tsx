'use client';
// Where you're losing. Every number here was computed from rows the user
// created — sends, replies, outcomes, real matches. Nothing is estimated, and
// when there is not enough data the tab says so rather than filling the space.

import type { Finding, FunnelStage } from '@/lib/copilot/diagnose';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

const KIND_LABEL: Record<Finding['kind'], string> = {
  bottleneck: 'Biggest drop',
  channel: 'Channel',
  source: 'Source',
  demand: 'Market demand',
  insufficient: 'Not enough data yet',
};

export default function GrowthView({ home, actions }: { home: HomeData; actions: Actions }) {
  const d = home.diagnosis;
  const max = Math.max(...d.stages.map((s) => s.count), 1);
  const lesson = home.lessons[0];

  return (
    <>
      <div className="cp-section"><span className="lead">Your funnel</span><span className="count">all time</span></div>
      <div className="cp-card">
        {d.stages.map((s) => (
          <Stage key={s.key} stage={s} max={max} isBottleneck={d.bottleneck?.key === s.key} />
        ))}
        <div className="cp-help" style={{ marginTop: 10 }}>
          Counted from your matches, drafts, sends and logged outcomes. A lead that replied twice counts once.
        </div>
      </div>

      <div className="cp-section"><span className="lead">{d.thin ? 'What the numbers can tell you' : 'What the numbers say'}</span></div>
      {d.findings.map((f, i) => (
        <div key={i} className={`cp-card cp-finding ${f.kind === 'insufficient' ? 'thin' : ''}`}>
          <div className="cp-eyebrow">{KIND_LABEL[f.kind]}</div>
          <p className="cp-f-head">{f.headline}</p>
          {f.detail && <p className="cp-f-detail">{f.detail}</p>}
          {f.action && <p className="cp-f-action">→ {f.action}</p>}
        </div>
      ))}

      {lesson ? (
        <>
          <div className="cp-section"><span className="lead">Worth learning</span><span className="count">because of the above</span></div>
          <div className="cp-card" style={{ padding: 0 }}>
            <button className="cp-learn" onClick={() => actions.openSheet({ kind: 'lesson', id: lesson.id })}>
              <div className="cp-lnum">01</div>
              <div style={{ flex: 1 }}>
                <div className="cp-lt">{lesson.title}{lesson.minutes ? `, ${lesson.minutes} min` : ''}</div>
                {lesson.note && <div className="cp-ls">{lesson.note}</div>}
              </div>
            </button>
          </div>
          <div className="cp-note">One thing, tied to the stuck point above. If nothing is stuck, nothing appears here — that is the correct answer, not an empty state.</div>
        </>
      ) : (
        !d.thin && <div className="cp-note" style={{ marginTop: 14 }}>Nothing to learn right now. The gap above is something to change, not something to study.</div>
      )}
    </>
  );
}

function Stage({ stage, max, isBottleneck }: { stage: FunnelStage; max: number; isBottleneck: boolean }) {
  const width = Math.round((stage.count / max) * 100);
  return (
    <div className={`cp-stage ${isBottleneck ? 'drop' : ''}`}>
      <div className="cp-stage-top">
        <span className="cp-stage-label">{stage.label}</span>
        <span className="cp-stage-count">
          {stage.count}
          {stage.rate !== null && <span className="cp-stage-rate">{Math.round(stage.rate * 100)}%</span>}
        </span>
      </div>
      <div className="cp-stage-track"><div className="cp-stage-fill" style={{ width: `${width}%` }} /></div>
    </div>
  );
}
