'use client';
// What the market in front of you keeps asking for, then where you are losing.
// Every number here was computed from rows the user created — real matches,
// sends, replies, outcomes. Nothing is estimated, and when there is not enough
// data the tab says so rather than filling the space.

import { MIN_REVIEW, VERDICT_LABEL, decisionReview, movedBy, verdictOf } from '@/lib/copilot/decision';
import type { DemandTrend, Finding, FunnelStage } from '@/lib/copilot/diagnose';
import type { HomeData } from '@/lib/copilot/types';
import { shortDay } from '../format';
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
  // The record of calls this app made. Not advice — the ledger read back.
  const log = home.decisionLog;
  const review = decisionReview(log);

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
                  {/* "Steady" is the default, and a chip on every row that reads
                      the same is decoration. Only a move earns one. */}
                  {t.trend !== 'steady' && <span className={`cp-chip trend ${t.trend}`}>{TREND_LABEL[t.trend]}</span>}
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
            Recurring in your matches and missing from your offer. Tap one to add it, or to stop matching the segments that want it.
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
          <div className="cp-note">A segment that keeps wanting what you do not sell is a gap in the offer, or the wrong segment.</div>
        </>
      )}

      {log.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Your calls</span><span className="count">{log.length === 1 ? 'the first one' : `last ${log.length}`}</span></div>
          {review.line && <div className="cp-card cp-review"><p>{review.line}</p></div>}
          <div className="cp-list">
            {log.map((c) => {
              const v = verdictOf(c);
              const moved = movedBy(c);
              return (
                <div key={c.id} className="cp-crow">
                  <div className="cp-dmain">
                    <div className="t">{c.headline}</div>
                    <span className={`cp-chip verdict ${v}`}>{VERDICT_LABEL[v]}</span>
                  </div>
                  <div className="cp-dsub">
                    {shortDay(c.for_date)}
                    {c.topic ? ` · ${c.topic}` : ''}
                    {/* Movement is only attributed to a call the user says they made.
                        A number that moved while a call sat ignored proves nothing. */}
                    {c.response === 'did' && moved != null && c.verify.metric !== 'none'
                      ? ` · ${c.verify.metric.replace('_', ' ')} ${moved === 0 ? 'unchanged' : `${moved > 0 ? '+' : ''}${moved}`}`
                      : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {!review.line && (
            <div className="cp-note">
              {log.length < MIN_REVIEW
                ? `${MIN_REVIEW - log.length} more call${MIN_REVIEW - log.length === 1 ? '' : 's'} before there is a pattern worth naming.`
                : 'No pattern yet. A call that keeps being made and never works shows up here.'}
            </div>
          )}
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
