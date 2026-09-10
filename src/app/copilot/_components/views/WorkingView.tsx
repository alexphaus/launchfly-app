'use client';
// Working? — the only question this tab answers.
//
// The funnel is the navigation now, not a chart at the bottom of a scroll: every
// stage opens the businesses actually in it, which is where the Pipeline tab
// went. Its "to send" group was Today's send queue counted a second way, and the
// two disagreed on screen (40 against 42).
//
// The numbers moved here from Today for the same reason: a strip of funnel stats
// above the day's one decision told you every morning that this was an outreach
// tool, which is the one thing it must not be.
// Every number here was computed from rows the user created — real matches,
// sends, replies, outcomes. Nothing is estimated, and when there is not enough
// data the tab says so rather than filling the space.

import { MIN_REVIEW, VERDICT_LABEL, decisionReview, movedBy, verdictOf } from '@/lib/copilot/decision';
import type { OpeningTrend, Finding, FunnelStage } from '@/lib/copilot/diagnose';
import type { HomeData } from '@/lib/copilot/types';
import type { PipelineStage } from '@/lib/copilot/pipeline';
import { money, shortDay } from '../format';
import type { Actions } from '../shared';

const KIND_LABEL: Record<Finding['kind'], string> = {
  bottleneck: 'Where you lose most',
  channel: 'Channel',
  source: 'Source',
  opening: 'Where the opening is',
  outside: 'Logged outside the app',
  insufficient: 'Not enough data yet',
};

export const TREND_LABEL: Record<OpeningTrend, string> = { new: 'New this week', rising: 'Rising', steady: 'Steady', falling: 'Fading' };

/**
 * Funnel stages and pipeline stages are two vocabularies for the same board, so
 * the mapping lives in one place rather than being guessed at each call site.
 */
const STAGE_OF_FUNNEL: Record<FunnelStage['key'], PipelineStage> = {
  matched: 'not_drafted', drafted: 'to_send', sent: 'sent',
  replied: 'replied', meeting: 'meeting', won: 'won',
};

export default function WorkingView({ home, actions, finding }: { home: HomeData; actions: Actions; finding: boolean }) {
  const d = home.diagnosis;
  const m = home.metrics;
  const currency = home.goals.find((g) => g.metric === 'currency')?.unit || '$';
  const max = Math.max(...d.stages.map((s) => s.count), 1);
  const lesson = home.lessons[0];
  const edge = home.edge;
  const sourced = home.metrics.pipeline.sourced;
  // The openings section IS the opening finding, so the card would repeat it.
  const findings = d.findings.filter((f) => f.kind !== 'opening');
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

      {/* Moved off Today. Here they are an answer to "is it working"; there they
          were a headline about sending, every morning, above the one decision. */}
      <div className="cp-metrics" aria-label="Your numbers">
        <div className={`cp-stat hero ${m.sent ? 'hot' : ''}`}><div className="v">{m.sent}</div><div className="l">Sent</div></div>
        <div className="cp-stat"><div className="v">{home.queue.length}</div><div className="l">To send</div></div>
        <div className={`cp-stat ${m.replies ? 'hot' : ''}`}><div className="v">{m.replies}</div><div className="l">Replies</div></div>
        <div className={`cp-stat ${m.won ? 'hot' : ''}`}><div className="v">{m.won_amount ? money(m.won_amount, currency) : m.won}</div><div className="l">Won</div></div>
      </div>
      <div className="cp-metrics-note">Last {m.window_days} days, counted from what you actually did</div>

      <div className="cp-section">
        <span className="lead">Your funnel</span>
        <span className="count">tap to open</span>
        <button className="link" disabled={finding || home.billing.matches.remaining === 0} onClick={() => actions.findMatches()} style={{ marginLeft: 10 }}>
          {finding ? 'Finding…' : home.billing.matches.remaining === 0 ? 'None left' : 'Find new'}
        </button>
      </div>
      <div className="cp-card">
        {d.stages.map((s) => (
          <Stage
            key={s.key}
            stage={s}
            max={max}
            isBottleneck={d.bottleneck?.key === s.key}
            onOpen={() => actions.openSheet({ kind: 'stage', stage: STAGE_OF_FUNNEL[s.key] })}
          />
        ))}
        <div className="cp-help" style={{ marginTop: 10 }}>
          Counted from your matches, drafts, sends and logged outcomes. A lead that replied twice counts once.
          {d.stages.some((s) => s.exceedsPrevious) && ' A dashed bar holds more than the stage above it, so those outcomes came from work you sent some other way — the count is real, the conversion is not.'}
        </div>
      </div>

      <div className="cp-section"><span className="lead">Where the opening is</span><span className="count">{sourced ? `across ${sourced} real matches` : 'no real matches yet'}</span></div>
      {d.openings.length ? (
        <>
          <div className="cp-list">
            {d.openings.map((t) => (
              <button key={t.term} className="cp-drow" onClick={() => actions.openSheet({ kind: 'opening', term: t.term })}>
                <div className="cp-dmain">
                  <div className="t">{t.term}</div>
                  {/* No trend chip. These are conditions a scraper observed at a
                      prospect, so "Fading" only ever meant that fewer of this
                      week's scrapes carried it — which reads as market
                      intelligence and is not. The count and "found this week"
                      below say the same thing without the claim. */}
                </div>
                <div className="cp-dbar"><div className="cp-dfill" style={{ width: `${Math.round((t.count / d.openings[0].count) * 100)}%` }} /></div>
                <div className="cp-dsub">
                  {t.count} {t.count === 1 ? 'business' : 'businesses'}
                  {t.thisWeek > 0 && ` · ${t.thisWeek} found this week`}
                  {t.segments[0] && ` · mostly ${t.segments[0].segment}`}
                </div>
              </button>
            ))}
          </div>
          <div className="cp-note">
            What your matches have in common that nothing you send names — read off their listings, not asked for by anyone.
            Tap one to put it in your openers, or to stop matching the segments where it shows up.
            {!offerSet && ' Set your offer first; an opening is only worth naming next to what you sell.'}
          </div>
        </>
      ) : (
        <div className="cp-empty">
          <b>Nothing in common yet</b>
          An opening appears once several real matches share a weakness your offer does not already name. It is counted off their listings, never guessed — so an empty list means your matches have nothing in common yet, not that there is nothing to learn.
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
                  {s.openings.length
                    ? s.openings.map((w: { term: string; count: number }, i: number) => <span key={w.term}>{i > 0 && ' · '}<b>{w.count}</b> {w.term}</span>)
                    : <span>nothing in common that your offer does not already name</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="cp-note">A segment whose businesses all share a weakness you never mention is an opening you are wasting, or the wrong segment.</div>
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

      {/* The gap is computed from the funnel, the demand read and the decision
          record, so this section has something to say every day the app has any
          data at all. A lesson link is a bonus when a real one exists, never the
          reason the section is here. */}
      {edge ? (
        <>
          <div className="cp-section">
            <span className="lead">Get better at</span>
            <span className="count">{edge.source === 'decisions' ? 'from your calls' : edge.source === 'funnel' ? 'from your funnel' : 'from your matches'}</span>
          </div>
          <div className="cp-card cp-edge">
            <h3 className="cp-edge-head">{edge.capability}</h3>
            <ul className="cp-because">
              {edge.because.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <div className="cp-edge-try"><b>Try this week</b> {edge.experiment}</div>
          </div>
          {lesson && (
            <div className="cp-card" style={{ padding: 0 }}>
              <button className="cp-learn" onClick={() => actions.openSheet({ kind: 'lesson', id: lesson.id })}>
                <div className="cp-lnum">01</div>
                <div style={{ flex: 1 }}>
                  <div className="cp-lt">{lesson.title}{lesson.minutes ? `, ${lesson.minutes} min` : ''}</div>
                  {lesson.note && <div className="cp-ls">{lesson.note}</div>}
                </div>
              </button>
            </div>
          )}
        </>
      ) : (
        !d.thin && <div className="cp-note" style={{ marginTop: 14 }}>Nothing measured yet. Send something and this fills in.</div>
      )}
    </>
  );
}

/**
 * One funnel stage. A button, because the bar IS the way into the businesses at
 * that stage — that is where the Pipeline tab went, and it is what stops the
 * funnel being a picture you look at once.
 */
function Stage({ stage, max, isBottleneck, onOpen }: { stage: FunnelStage; max: number; isBottleneck: boolean; onOpen: () => void }) {
  const width = Math.round((stage.count / max) * 100);
  return (
    <button className={`cp-stage tappable ${isBottleneck ? 'drop' : ''} ${stage.exceedsPrevious ? 'outside' : ''}`} onClick={onOpen}>
      <div className="cp-stage-top">
        <span className="cp-stage-label">{stage.label}</span>
        <span className="cp-stage-count">
          {stage.count}
          {stage.rate !== null && !stage.exceedsPrevious && <span className="cp-stage-rate">{Math.round(stage.rate * 100)}%</span>}
          {stage.exceedsPrevious && <span className="cp-stage-rate">outside</span>}
          <svg className="cp-stage-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </span>
      </div>
      <div className="cp-stage-track"><div className="cp-stage-fill" style={{ width: `${width}%` }} /></div>
    </button>
  );
}
