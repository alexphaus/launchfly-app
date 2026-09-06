'use client';
// What the market in front of you keeps asking for, then where you are losing.
// Every number here was computed from rows the user created — real matches,
// sends, replies, outcomes. Nothing is estimated, and when there is not enough
// data the tab says so rather than filling the space.

import type { DemandTrend, Finding, FunnelStage } from '@/lib/copilot/diagnose';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';

const KIND_LABEL: Record<Finding['kind'], string> = {
  bottleneck: 'Where you lose most',
  channel: 'Channel',
  source: 'Source',
  demand: 'Market demand',
  outside: 'Logged outside the app',
  insufficient: 'Not enough data yet',
};

export const TREND_LABEL: Record<DemandTrend, string> = { new: 'New this week', rising: 'Rising', steady: 'Steady', falling: 'Fading' };

export default function SignalsView({ home, actions }: { home: HomeData; actions: Actions }) {
  const d = home.diagnosis;
  const max = Math.max(...d.stages.map((s) => s.count), 1);
  const lesson = home.lessons[0];
  const sourced = home.metrics.pipeline.sourced;
  // The demand section IS the demand finding, so the card would repeat it.
  const findings = d.findings.filter((f) => f.kind !== 'demand');
  const offerSet = !!home.profile.offer?.sells;

  return (
    <>
      {home.weekly && (
        <div className="cp-card cp-insight" style={{ marginTop: 14 }}>
          <div className="cp-eyebrow">{home.weekly.eyebrow}</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{home.weekly.body}</p>
        </div>
      )}

      <div className="cp-section"><span className="lead">What they keep asking for</span><span className="count">{sourced ? `across ${sourced} real matches` : 'no real matches yet'}</span></div>
      {d.demand.length ? (
        <>
          <div className="cp-list">
            {d.demand.map((t) => (
              <button key={t.term} className="cp-drow" onClick={() => actions.openSheet({ kind: 'demand', term: t.term })}>
                <div className="cp-dmain">
                  <div className="t">{t.term}</div>
                  <span className={`cp-chip trend ${t.trend}`}>{TREND_LABEL[t.trend]}</span>
                </div>
                <div className="cp-dbar"><div className="cp-dfill" style={{ width: `${Math.round((t.count / d.demand[0].count) * 100)}%` }} /></div>
                <div className="cp-dsub">
                  {t.count} {t.count === 1 ? 'business' : 'businesses'}
                  {t.thisWeek > 0 && ` · ${t.thisWeek} found this week`}
                  {t.segments[0] && ` · mostly ${t.segments[0].segment}`}
                </div>
              </button>
            ))}
          </div>
          <div className="cp-note">
            Tags and pain signals recurring across the real businesses matched to you, that your offer does not mention. Tap one to add it to what you sell, or to stop matching the segments that need it.
            {!offerSet && ' Set your offer first and these become the gap between it and the market.'}
          </div>
        </>
      ) : (
        <div className="cp-empty">
          <b>Nothing recurring yet</b>
          Demand shows once several real matches share a need your offer does not cover. It is measured, never guessed — so an empty list means the market has not repeated itself yet, not that there is nothing to learn.
        </div>
      )}

      {d.segments.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">By segment</span><span className="count">{d.segments.length} you target</span></div>
          <div className="cp-list">
            {d.segments.map((s) => (
              <div key={s.segment} className="cp-srow">
                <div className="cp-dmain">
                  <div className="t">{s.segment}</div>
                  <span className="cp-dsub">{s.businesses} {s.businesses === 1 ? 'business' : 'businesses'}</span>
                </div>
                <div className="cp-wants">
                  {s.wants.length
                    ? s.wants.map((w, i) => <span key={w.term}>{i > 0 && ' · '}<b>{w.count}</b> {w.term}</span>)
                    : <span>nothing recurring your offer does not already cover</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="cp-note">A segment whose businesses keep wanting something you do not sell is either a gap in the offer or the wrong segment. Both are one tap away on the terms above.</div>
        </>
      )}

      <div className="cp-section"><span className="lead">Your funnel</span><span className="count">all time</span></div>
      <div className="cp-card">
        {d.stages.map((s) => (
          <Stage key={s.key} stage={s} max={max} isBottleneck={d.bottleneck?.key === s.key} />
        ))}
        <div className="cp-help" style={{ marginTop: 10 }}>
          Counted from your matches, drafts, sends and logged outcomes. A lead that replied twice counts once.
          {d.stages.some((s) => s.exceedsPrevious) && ' A dashed bar holds more than the stage above it, so those outcomes came from work you sent some other way — the count is real, the conversion is not.'}
        </div>
      </div>

      {findings.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">{d.thin ? 'What the numbers can tell you' : 'What the numbers say'}</span></div>
          {findings.map((f, i) => (
            <div key={i} className={`cp-card cp-finding ${f.kind === 'insufficient' ? 'thin' : ''}`}>
              <div className="cp-eyebrow">{KIND_LABEL[f.kind]}</div>
              <p className="cp-f-head">{f.headline}</p>
              {f.detail && <p className="cp-f-detail">{f.detail}</p>}
              {f.action && <p className="cp-f-action">→ {f.action}</p>}
            </div>
          ))}
        </>
      )}

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
    <div className={`cp-stage ${isBottleneck ? 'drop' : ''} ${stage.exceedsPrevious ? 'outside' : ''}`}>
      <div className="cp-stage-top">
        <span className="cp-stage-label">{stage.label}</span>
        <span className="cp-stage-count">
          {stage.count}
          {stage.rate !== null && !stage.exceedsPrevious && <span className="cp-stage-rate">{Math.round(stage.rate * 100)}%</span>}
          {stage.exceedsPrevious && <span className="cp-stage-rate">outside</span>}
        </span>
      </div>
      <div className="cp-stage-track"><div className="cp-stage-fill" style={{ width: `${width}%` }} /></div>
    </div>
  );
}
