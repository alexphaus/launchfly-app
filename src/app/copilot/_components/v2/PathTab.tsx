'use client';
// Path: a plan, not a log. One line runs down the left of the screen, outside
// the cards. Above "you are here" is the evidence — what came back, what a call
// turned out to be worth, the hours you put in: only what teaches something.
// Below it is the one move to make now, sized to the time you set, and then the
// plan: this week's steps, the milestones between you and the goal you put
// first with what each takes, the point where the guesses become numbers, the
// goal, and the goals beyond it.
//
// Why it was rebuilt. The stream before this put everything on one time axis
// and weighted the axis evenly, so the part a person opens it for — what now,
// and where is this going — was a short list under a long log. Its owner:
// "mostly a log of what already happened … it does not feel like a forward-
// looking path." The rules for what goes where are in lib/copilot/plan.ts (the
// forward half) and lib/copilot/pathway.ts (the evidence); every number on
// either side is counted from rows, and a number the rows cannot give is said
// to be missing rather than filled in.
//
// The plan below the move is drawn for the person when the server has a model
// (PathPlan.tsx, lib/copilot/roadmap.ts): phases from this week to the next
// few months, milestones with what makes them done, quick wins first, redrawn
// as things work or do not. Without a model it is the funnel plan it replaced,
// unchanged, and nothing on screen mentions a plan it cannot draw.
//
// The call stays the call: while it waits, it is the move, with its own card.
// Once answered it is a receipt at the foot of the evidence, and the move is the
// next thing — the answered card had the centre of the screen to itself before,
// which is how the one thing the tab exists for ended up below the fold.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ASK_LABEL, type AskRow } from '@/lib/copilot/today';
import { agoLabel } from '@/lib/copilot/machine';
import type { MatchStage } from '@/lib/copilot/matches';
import { VERDICT_LABEL, metricLabel, metricWords, verdictOf, type Decision } from '@/lib/copilot/decision';
import {
  REACHED, parseSeenPlan, planChanges, quietEvidence, snapshotPlan, swapKept,
  type NextStep, type PathDay, type PathEvent, type PathSwap, type PathTarget, type PlanChanges, type SeenPlan,
} from '@/lib/copilot/pathway';
import { RATE_SAMPLE, type NowMove, type Stop } from '@/lib/copilot/plan';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { CallCard, FirstRun } from '../views/NowView';
import type { Derived } from './derive';
import { IconAlert, IconArrow, IconCheck, IconChevron, IconFlag, IconRedraw, IconStar, IconSwap, IconYou, PathGlyph } from './icons2';
import { planServesOneGoal } from '@/lib/copilot/roadmap';
import { AlsoThisWeek, DrawnPlanHead, ExperimentCard, GoalMarkers, IconMilestone, PhaseBlock, PlanPending, type Handed } from './PathPlan';

export default function PathTab({ home, d, actions, briefing, finding, openMatches }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean; finding: boolean; openMatches: (s: MatchStage) => void }) {
  const hereRef = useRef<HTMLDivElement>(null);
  const [allPast, setAllPast] = useState(false);
  const past = allPast ? d.path.pastAll : d.path.past;
  const memory = useDeviceMemory(home.profile.id);
  const redraw = usePlanRedraw(home, d, memory);
  const { swap, keep } = useSwap(home, d, memory);
  const away = useAway(hereRef);
  const cap = CAPACITY_META[home.profile.capacity];

  const open = (t: PathTarget) => {
    if (!t) return;
    if (t.kind === 'matches') openMatches(t.stage);
    else if (t.kind === 'project') actions.openSheet({ kind: 'commission', id: t.id });
    else if (t.kind === 'focus') actions.openSheet({ kind: 'focus' });
    else if (t.kind === 'won') actions.openSheet({ kind: 'stage', stage: 'won' });
    else actions.openSheet({ kind: 'ask' });
  };
  const rows = pastRows(past.days, swap);
  const answered = home.decision && home.decision.response !== 'pending' ? home.decision : null;
  const { stops, beyond } = d.path.ahead;
  const next = d.path.next;
  const added = new Set(redraw?.added ?? []);
  const showRedraw = !!redraw && (redraw.added.length > 0 || redraw.gone.length > 0);
  // A step reached since this device last showed the path, named — never numbered.
  const reached = redraw?.stepUp ? d.path.ladder.steps[redraw.stepUp.to - 2] : null;
  const plan = d.path.plan;
  // A step handed to the worker is known by the project it wrote, whose objective is the step's title:
  // the row opens that project and says where it stands.
  const handed: Handed = new Map(home.commissions.filter((t) => t.commission.status !== 'stopped').map((t) => [t.commission.objective, { id: t.commission.id, status: t.commission.status }]));
  const experiment = plan.state === 'ready' ? plan.experiment : null;
  const experimentGoal = experiment?.exp.goalId ? home.goals.find((g) => g.id === experiment.exp.goalId)?.title ?? null : null;
  useAutoDraw(home, d, actions);

  // A brand new account has no evidence, no plan to speak of and nothing to
  // send; one card that says what is happening beats an empty line. That card
  // is about finding businesses, so it stands only where there is no plan to
  // draw: with a model, a new account's first screen is its plan being drawn
  // from its goals, whatever those goals are.
  if (d.nothingYet && !home.decision && plan.state === 'off') {
    return <div className="cp2-way"><FirstRun home={home} actions={actions} finding={finding} /><Tell home={home} actions={actions} briefing={briefing} /></div>;
  }

  return (
    <div className="cp2-way">
      <div className="cp-section"><span className="lead">Evidence</span><span className="count">what the last two weeks taught</span></div>
      <section className="cp2-way-past">
        {past.earlier > 0 && <button className="cp2-way-earlier" onClick={() => setAllPast(true)}>Show {past.earlier} earlier</button>}
        {/* Nothing came back is itself the finding, with the count that explains it. */}
        {!rows.length && (() => {
          const q = quietEvidence({ sentFortnight: d.path.fortnight, movedDays: d.path.week.moved, planned: plan.state !== 'off' });
          return (
            <div className="cp2-way-row">
              <span className="cp2-way-node sm quiet"><IconCheck /></span>
              <span className="cp2-way-t">{q.title}</span>
              <span className="cp2-way-s">{q.detail}</span>
            </div>
          );
        })()}
        {rows.map((r) => {
          if (r.t === 'day') return <div key={r.day.day} className="cp2-way-day">{r.day.label}</div>;
          if (r.t === 'swap') return <SwapRow key={r.swap.key} swap={r.swap} onAct={() => openMatches(r.swap.action.stage)} onKeep={keep} />;
          return <EventRow key={r.e.key} e={r.e} tz={home.profile.timezone} onOpen={open} />;
        })}
        {answered && <CallReceipt decision={answered} currency={d.currency} actions={actions} />}
        <WeekRow d={d} planned={plan.state !== 'off'} />
        <Notices home={home} d={d} actions={actions} />
      </section>

      <div ref={hereRef} className="cp2-way-here">
        <span className="cp2-way-node here"><IconYou /></span>
        <span className="cp2-way-eyebrow">You are here</span>
        <span className="cp2-way-heretitle">{d.path.here.title}</span>
        {d.path.here.line && <span className="cp2-way-s">{d.path.here.line}</span>}
        {d.path.here.counts && <span className="cp2-way-s">{d.path.here.counts}</span>}
        {/* Since this device last showed the path; the step itself is in the evidence, where it happened.
            Under the fact rather than over it, so the node stays level with "You are here". */}
        {reached && <span className="cp2-way-reached"><IconStar />Reached: {REACHED[reached.key]}</span>}
      </div>

      <section className="cp2-way-ahead">
        <div className="cp2-way-row cp2-way-nowrow">
          <span className="cp2-way-node now"><IconArrow /></span>
          {d.path.now.kind === 'call' && home.decision
            ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={d.noOffer} />
            : d.path.now.kind === 'rest' && !home.decision && !briefing
            ? <NoCallYet home={home} actions={actions} />
            : <NowCard now={d.path.now} actions={actions} openMatches={openMatches} />}
        </div>
        {d.path.also.length > 0 && (
          <div className="cp2-way-row cp2-way-also">
            <span className="cp2-way-alsolabel">Also</span>
            {d.path.also.map((a) => <AlsoChip key={a.key} ask={a} actions={actions} openMatches={openMatches} />)}
          </div>
        )}

        {plan.state !== 'off' ? (
          <>
            <DrawnPlanHead view={plan} now={d.now} onRedraw={() => void actions.drawRoadmap('manual')} unreadable={home.roadmap?.unreadable ?? null} actions={actions} outlook={d.path.outlook} />
            {/* Before the steps: the one thing worth trying that is not more of the same. */}
            {experiment && <ExperimentCard view={experiment} goalTitle={experimentGoal} today={home.recent.today} actions={actions} />}
            <button className="cp2-way-sized" onClick={() => actions.openSheet({ kind: 'capacity' })}>
              Sized for <b>{cap.label}</b>, {cap.minutes} min a day. It redraws when you change that, when you tell it something, and as results come back.
            </button>
            {plan.state === 'none' && <PlanPending view={plan} onDraw={() => void actions.drawRoadmap('manual')} />}
            {plan.state === 'ready'
              ? plan.phases.map((ph) => (
                  <PhaseBlock key={ph.key} phase={ph} actions={actions} workerConnected={home.workerConnected} handed={handed} showGoal={!planServesOneGoal(plan)}>
                    {ph.key === plan.phases[0].key && (
                      <AlsoThisWeek steps={next.steps} render={(s) => <NextRow key={s.key} step={s} actions={actions} isNew={added.has(s.key)} capMinutes={cap.minutes} />} />
                    )}
                  </PhaseBlock>
                ))
              : next.steps.map((s) => <NextRow key={s.key} step={s} actions={actions} isNew={added.has(s.key)} capMinutes={cap.minutes} />)}
            <GoalMarkers goals={d.path.goals} actions={actions} />
          </>
        ) : (
        <>
        <div className="cp2-way-head"><span>The plan</span><span className="note">its best guess</span></div>
        {/* Capacity, visibly: the move's size, a milestone's days and whether a step fits are all read from it. */}
        <button className="cp2-way-sized" onClick={() => actions.openSheet({ kind: 'capacity' })}>
          Sized for <b>{cap.label}</b>, {cap.minutes} min a day. It redraws when you change that, and as results come back.
        </button>
        {/* A browser that keeps nothing cannot mark what is new; said, so an unmarked plan is not read as an unchanged one. */}
        {memory.broken && <p className="cp2-way-memo">This browser is not keeping what you last saw here, so nothing below is marked as new.</p>}
        {showRedraw && <RedrawRow changes={redraw!} />}
        {next.steps.map((s) => <NextRow key={s.key} step={s} actions={actions} isNew={added.has(s.key)} capMinutes={cap.minutes} />)}
        {next.more > 0 && <div className="cp2-way-row cp2-way-more">{next.more} more after these, once they are done</div>}
        {stops.map((s, i) => (
          <StopRow key={s.key} stop={s} end={i === stops.length - 1} actions={actions}>
            {s.kind === 'goal' && beyond.length > 0 && (
              <div className="cp2-way-beyond">
                <span className="cp2-way-eyebrow muted">Beyond it, in your order</span>
                {beyond.map((b) => (
                  <span key={b.key} className="cp2-way-beyondrow"><span className="t cp2-clamp2">{b.title}</span><span className="s">{b.status}</span></span>
                ))}
                <span className="cp2-way-links">
                  <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'goal' })}>Add a goal</button>
                  <button className="cp2-link" onClick={() => actions.setTab('you')}>Reorder on You</button>
                </span>
              </div>
            )}
          </StopRow>
        ))}
        </>
        )}
      </section>

      <Tell home={home} actions={actions} briefing={briefing} />
      <BackToNow hereRef={hereRef} away={away} />
    </div>
  );
}

/* ─── The evidence ────────────────────────────────────────────────────────── */

type PastRow = { t: 'day'; day: PathDay } | { t: 'event'; e: PathEvent } | { t: 'swap'; swap: PathSwap };

/**
 * The evidence as one list, day by day, with the swap under the hours it is
 * about — or at the foot, when those hours are behind "Show earlier".
 */
function pastRows(days: PathDay[], swap: PathSwap | null): PastRow[] {
  const rows: PastRow[] = [];
  let placed = false;
  for (const day of days) {
    rows.push({ t: 'day', day });
    for (const e of day.events) {
      rows.push({ t: 'event', e });
      if (swap && e.key === swap.afterKey) { rows.push({ t: 'swap', swap }); placed = true; }
    }
  }
  if (swap && !placed && rows.length) rows.push({ t: 'swap', swap });
  return rows;
}

/**
 * One thing that came back. A step reached is the same row drawn as the moment
 * it is: a star in the path's own blue, the name in the display face, and which
 * step it was underneath.
 */
function EventRow({ e, tz, onOpen }: { e: PathEvent; tz: string; onOpen: (t: PathTarget) => void }) {
  const moment = !!e.rung;
  const inner = (
    <>
      <span className={`cp2-way-node sm ${moment ? 'moment' : e.actor}`}><PathGlyph icon={e.icon} /></span>
      <span className="cp2-way-top">
        <span className={`${moment ? 'cp2-way-name' : 'cp2-way-t'} cp2-clamp2`}>{e.title}</span>
        {e.timed && <span className="cp2-way-time">{clock(e.at, tz)}</span>}
      </span>
      {e.detail && <span className={moment ? 'cp2-way-stepdone' : 'cp2-way-s cp2-clamp2'}>{e.detail}</span>}
    </>
  );
  // A row that goes nowhere is text, not a button.
  return e.target
    ? <button className="cp2-way-row" onClick={() => onOpen(e.target)}>{inner}</button>
    : <div className="cp2-way-row">{inner}</div>;
}

/**
 * The one suggestion in the evidence, under the hours it is about: the hours
 * and what sending brought back, side by side. "Keep it" holds for the week.
 */
function SwapRow({ swap, onAct, onKeep }: { swap: PathSwap; onAct: () => void; onKeep: () => void }) {
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm swap"><IconSwap /></span>
      <span className="cp2-way-swap">
        <span className="cp2-way-t">{swap.title}</span>
        <span className="cp2-way-s">{swap.detail}</span>
        <span className="cp2-way-acts">
          <button className="cp-btn primary sm" onClick={onAct}>{swap.action.label}</button>
          <button className="cp-btn sm" onClick={onKeep}>Keep it</button>
        </span>
      </span>
    </div>
  );
}

/**
 * Today's call once it is answered: a receipt, with what it is measuring said
 * in the metric's own unit. Tapping it opens the record, where it is graded.
 */
function CallReceipt({ decision, currency, actions }: { decision: Decision; currency: string; actions: Actions }) {
  const v = verdictOf(decision);
  const m = decision.verify.metric;
  const value = (n: number) => metricLabel(m, n, currency);
  // Every verdict said as itself: a call done with nothing to measure fell through to "Turned down".
  const status = v === 'measuring' ? `Done · reading ${metricWords(m)} back in a few days — ${value(decision.verify.baseline)} when you decided`
    : v === 'worked' ? `Worked · ${metricWords(m)} ${value(decision.verify.baseline)} → ${value(decision.verify.after ?? decision.verify.baseline)}`
    : v === 'no_movement' ? `Done · ${metricWords(m)} did not move`
    : v === 'done' ? 'Done'
    : v === 'wrong' ? 'Marked wrong · it will not make this call the same way again'
    : v === 'rejected' ? 'You said no'
    : v === 'ignored' ? 'Not done'
    : VERDICT_LABEL[v];
  const did = v === 'measuring' || v === 'worked' || v === 'no_movement' || v === 'done';
  return (
    <button className="cp2-way-row" onClick={() => actions.openSheet({ kind: 'ask' })}>
      <span className={`cp2-way-node sm ${did ? 'you' : 'quiet'}`}><IconCheck /></span>
      <span className="cp2-way-eyebrow muted">Today&rsquo;s call</span>
      <span className="cp2-way-t cp2-clamp2">{decision.headline}</span>
      <span className="cp2-way-s">{status}</span>
    </button>
  );
}

/** The week at the foot of the evidence: which days you moved it forward. Sends, answers, Moves done — never opens. */
function WeekRow({ d, planned }: { d: Derived; planned: boolean }) {
  const w = d.path.week;
  return (
    <div className="cp2-way-row cp2-way-week" role="img" aria-label={`This week: moved forward on ${w.moved} of 7 days${w.streak >= 2 ? `, ${w.streak} in a row` : ''}`}>
      <span className="dots">
        {w.days.map((x) => <i key={x.day} className={`${x.moved ? 'moved' : ''} ${x.today ? 'today' : ''}`}>{x.letter}</i>)}
      </span>
      <span className="cp2-way-s">
        {w.streak >= 2 ? `${w.streak} days in a row` : w.moved ? `Moved it forward ${w.moved} of 7 days` : planned ? 'Tick off a step and today counts' : 'Send something and today counts'}
      </span>
    </div>
  );
}

/**
 * What broke, said at the foot of the evidence rather than folded into it: a
 * nightly job that never ran, a failed check, failing sources, a read that
 * failed. The state of things now, and a quiet screen over any of them is the
 * one invariant 13 is written against.
 */
function Notices({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const r = d.done;
  const warns = r.rows.filter((x) => x.tone === 'warn');
  const unread = home.recent.unreadable;
  const row = (key: string, t: string, s: string, onTap?: () => void) => {
    const inner = (
      <>
        <span className="cp2-way-node sm warn"><IconAlert /></span>
        <span className="cp2-way-t">{t}</span>
        <span className="cp2-way-s">{s}</span>
      </>
    );
    return onTap ? <button key={key} className="cp2-way-row" onClick={onTap}>{inner}</button> : <div key={key} className="cp2-way-row">{inner}</div>;
  };
  return (
    <>
      {unread.length > 0 && row('unread', `Could not read your ${unread.join(', ')}`, 'Some of what came back is missing above, so a quiet stretch here is not a quiet week.')}
      {r.stale && row('stale', 'Nothing ran overnight', home.lastCronRun
        ? `The nightly job last finished ${agoLabel(home.lastCronRun, d.now)}. Until it runs again, this only changes when you open the app.`
        : 'The nightly job has never run, so nothing is found while you are away.')}
      {r.broke.length > 0 && row('broke', r.broke.length === 1 ? 'A check failed on the last run' : `${r.broke.length} checks failed on the last run`, r.broke.join(' · '))}
      {warns.map((w) => row(w.key, w.label, w.detail, () => actions.openSheet({ kind: 'watchlist' })))}
    </>
  );
}

/* ─── The move ────────────────────────────────────────────────────────────── */

/**
 * The one thing to do now, with its size against the time you set and the one
 * tap that does it. The size is the capacity made visible: the same drafts are
 * "5 of your 54" on a low day and "25" on a deep one.
 */
function NowCard({ now, actions, openMatches }: { now: NowMove; actions: Actions; openMatches: (s: MatchStage) => void }) {
  const go = () => {
    if (now.kind === 'offer') actions.openSheet({ kind: 'offer' });
    else if (now.kind === 'send') openMatches('to_send');
    else if (now.kind === 'find') openMatches('new');
    else if (now.kind === 'confirm') actions.openSheet({ kind: 'capture' });
    else if (now.kind === 'step' && now.item) void actions.markRoadmap(now.item, 'done');
    else if (now.kind === 'move' && now.id) actions.openSheet({ kind: 'move', id: now.id });
    else if (now.id) actions.openSheet({ kind: 'commission', id: now.id });
  };
  return (
    <div className="cp-card cp2-way-now">
      <span className="cp2-way-nowtop">
        <span className="cp2-way-eyebrow">Now</span>
        {now.size && <span className="cp2-way-size">{now.size}</span>}
      </span>
      <span className="cp2-way-nowtitle">{now.title}</span>
      {now.why && <p className="cp2-way-why">{now.why}</p>}
      {now.cta && <button className="cp-btn primary block cp2-way-go" onClick={go}>{now.cta}</button>}
    </div>
  );
}

/**
 * No call and nothing waiting on a day that is not a first run: the brief has
 * not run yet. The read is shown when there is one; otherwise, the way to get a
 * call.
 */
function NoCallYet({ home, actions }: { home: HomeData; actions: Actions }) {
  if (home.insight) {
    return (
      <div className="cp-card cp2-way-now">
        <span className="cp2-way-eyebrow">{home.insight.eyebrow}</span>
        <p className="cp2-way-why">{home.insight.body}</p>
      </div>
    );
  }
  return (
    <div className="cp-card cp2-way-now">
      <span className="cp2-way-eyebrow">Now</span>
      <span className="cp2-way-nowtitle">Nothing has been weighed yet today</span>
      <button className="cp-btn primary block cp2-way-go" onClick={() => void actions.runBrief('manual')}>Pick today&rsquo;s call</button>
    </div>
  );
}

const CHIP: Record<AskRow['kind'], (a: AskRow) => string> = {
  question: (a) => `Answer: ${a.detail}`,
  fix: (a) => `Retry: ${a.title}`,
  approve: (a) => `Approve: ${a.title}`,
  confirm: () => 'Where did the replies get to?',
  send: (a) => a.title,
};

/** Beside the move, the rest of what needs you — short, so the move stays one thing. */
function AlsoChip({ ask, actions, openMatches }: { ask: AskRow; actions: Actions; openMatches: (s: MatchStage) => void }) {
  const open = () => {
    if (ask.kind === 'confirm') actions.openSheet({ kind: 'capture' });
    else if (ask.kind === 'send') openMatches('to_send');
    else if (ask.id) actions.openSheet({ kind: 'commission', id: ask.id });
  };
  return (
    <button className={`cp2-way-chip ${ask.kind}`} onClick={open} aria-label={`${ASK_LABEL[ask.kind]}: ${ask.title}`}>
      <span className="cp2-clamp1">{CHIP[ask.kind](ask)}</span><IconChevron />
    </button>
  );
}

/* ─── The plan ────────────────────────────────────────────────────────────── */

/**
 * A step this week. Yours opens its work; a project under way opens its thread;
 * work the app offers to do itself opens in place, with the plan on screen and
 * one tap to hand it over — a plan is never approved unseen. A step bigger than
 * the time you set says so rather than quietly sitting there.
 */
function NextRow({ step, actions, isNew, capMinutes }: { step: NextStep; actions: Actions; isNew: boolean; capMinutes: number }) {
  const [openPlan, setOpenPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tap = () => {
    if (step.kind === 'offer') setOpenPlan((v) => !v);
    else if (step.kind === 'project') actions.openSheet({ kind: 'commission', id: step.id });
    else actions.openSheet({ kind: 'move', id: step.id });
  };
  const handOver = async () => {
    setBusy(true); setError(null);
    const r = await actions.handOverMove(step.id);
    setBusy(false);
    // Said here, where it was asked: three already running, a plan that did not survive.
    if (!r.ok) setError(r.error ?? 'Could not hand that over');
  };
  const notWorth = async () => {
    setBusy(true);
    try { await actions.answerMove(step.id, 'dismissed'); } finally { setBusy(false); }
  };
  const tooBig = step.minutes != null && step.minutes > capMinutes;
  return (
    <div className="cp2-way-row">
      <span className={`cp2-way-node step ${step.actor}`}><PathGlyph icon={step.icon} /></span>
      <button className="cp2-way-tap" onClick={tap} aria-expanded={step.kind === 'offer' ? openPlan : undefined}>
        <span className="cp2-way-top">
          <span className="cp2-way-t cp2-clamp2">{step.title}</span>
          <IconChevron />
        </span>
        {/* Its reason, in the planner's own words: a guess you can argue with. */}
        {step.because && <span className="cp2-way-s cp2-clamp2">{step.because}</span>}
        <span className="cp2-way-who">
          {isNew && <span className="cp2-way-pill new">New</span>}
          <span className={`cp2-owner ${step.actor === 'ai' ? 'ai' : 'you'}`}>{step.actor === 'ai' ? 'AI does it' : 'You'}</span>
          {tooBig && <span className="cp2-way-pill big">Bigger than today</span>}
          <span className="cp2-way-s cp2-clamp1">{step.detail}</span>
        </span>
      </button>
      {step.kind === 'offer' && openPlan && step.plan && (
        <>
          <span className="cp2-way-plan">{step.plan}</span>
          {error && <span className="cp2-way-s cp2-err">{error}</span>}
          <span className="cp2-way-acts">
            <button className="cp-btn primary sm" disabled={busy} onClick={() => void handOver()}>{busy ? 'Handing it over…' : 'Hand it over'}</button>
            <button className="cp-btn sm" disabled={busy} onClick={() => void notWorth()}>Not worth it</button>
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The redraw, said at the head of the plan: when it was last looked at, how
 * many steps are new, and each one that left with what happened to it.
 */
function RedrawRow({ changes }: { changes: PlanChanges }) {
  const n = changes.added.length;
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm redraw"><IconRedraw /></span>
      <span className="cp2-way-top">
        <span className="cp2-way-t">Redrawn {changes.since}</span>
        {n > 0 && <span className="cp2-way-newcount">{n} new</span>}
      </span>
      {changes.gone.map((g) => (
        <span key={g.key} className="cp2-way-gone cp2-clamp2"><s>{g.title}</s> · {g.why}</span>
      ))}
      {changes.goneMore > 0 && <span className="cp2-way-s">and {changes.goneMore} more</span>}
    </div>
  );
}

/**
 * A milestone, the checkpoint, or the goal: where it stands, what it takes at
 * your own rate, how long at the time you set, and — when the estimate stands on
 * fewer than RATE_SAMPLE sends — that it is an early guess.
 */
function StopRow({ stop, end, actions, children }: { stop: Stop; end: boolean; actions: Actions; children?: React.ReactNode }) {
  const pct = stop.progress && stop.progress.of > 0 ? Math.min(100, Math.round((stop.progress.done / stop.progress.of) * 100)) : null;
  const goalTap = stop.kind === 'goal' && (stop.title === 'Name your goal' || stop.takes?.startsWith('Reached') || stop.takes?.startsWith('There is no number'));
  return (
    <div className={`cp2-way-row cp2-way-stop ${stop.kind} ${end ? 'end' : ''}`}>
      <span className={`cp2-way-node ${stop.kind}`}>
        {stop.kind === 'goal' ? <IconFlag /> : stop.kind === 'check' ? '?' : <IconMilestone />}
      </span>
      {stop.kind === 'goal' && <span className="cp2-way-eyebrow muted">Your goal</span>}
      <span className="cp2-way-top">
        <span className="cp2-way-name">{stop.title}</span>
        {stop.status && <span className="cp2-way-frac">{stop.status}</span>}
      </span>
      {pct != null && <span className="cp2-way-track" aria-hidden><i style={{ width: `${pct}%` }} /></span>}
      {stop.takes && <span className="cp2-way-takes">{stop.takes}</span>}
      {stop.when && <span className="cp2-way-s">{stop.when}</span>}
      {stop.pace && <span className="cp2-way-pace">{stop.pace}</span>}
      {stop.early && <span className="cp2-way-pill early">Early guess — it firms up at {RATE_SAMPLE} sends</span>}
      {goalTap && (
        <button className="cp-connect cp2-way-act" onClick={() => actions.openSheet({ kind: 'goal' })}>
          {stop.title === 'Name your goal' ? 'Name it' : stop.takes?.startsWith('Reached') ? 'Set the next one' : 'Give it a number'}
        </button>
      )}
      {children}
    </div>
  );
}


/* ─── Around it ───────────────────────────────────────────────────────────── */

/** The one input in the app: what changed, in the person's own words. The plan is redrawn from it. */
function Tell({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), true);
    if (saved) { setNote(''); setOpen(false); }
    setSending(false);
  };
  if (!open) {
    return (
      <button className="cp-tell cp2-tell" onClick={() => setOpen(true)}>
        <span className="t">Something changed?</span>
        <span className="s">Tell it in your own words — {home.contextCount} things it knows · the plan redraws from it</span>
      </button>
    );
  }
  return (
    <div className="cp-composer cp2-tell">
      <textarea
        autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
        placeholder="Maria replied. Burn is down to 200. I have an interview Thursday…"
      />
      <div className="bar">
        <span className="hint">{home.roadmap?.enabled ? 'Redraws your plan and tomorrow’s call.' : 'Changes tomorrow’s call.'}</span>
        <button className="cp-btn" disabled={sending} onClick={() => { setOpen(false); setNote(''); }}>Cancel</button>
        <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => void submit()}>Add &amp; re-plan</button>
      </div>
    </div>
  );
}

/**
 * The way back to "you are here" while you are away from it, above the nav.
 * Put in the frame rather than the list, as the toast is: a sticky element is
 * held inside the list's padding, and the padding under a floating nav is
 * exactly where it would have to go — it landed on top of Tell.
 */
function BackToNow({ hereRef, away }: { hereRef: RefObject<HTMLDivElement | null>; away: 'up' | 'down' | null }) {
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  useEffect(() => { setFrame(hereRef.current?.closest('.cp-frame') as HTMLElement | null); }, [hereRef]);
  if (!frame) return null;
  return createPortal(
    <div className={`cp2-stream-backwrap ${away ? 'on' : ''}`}>
      <button className="cp2-stream-back" tabIndex={away ? 0 : -1} aria-hidden={!away} onClick={() => scrollToHere(hereRef.current, true)}>
        <IconArrow up={away === 'up'} />Back to now
      </button>
    </div>,
    frame,
  );
}

/**
 * Open on "you are here", with a little of the evidence showing above it so the
 * direction of the line is obvious.
 */
function scrollToHere(here: HTMLElement | null, smooth: boolean) {
  const main = here?.closest('.cp-content') as HTMLElement | null;
  if (!here || !main) return;
  const top = here.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top: Math.max(0, top - main.clientHeight * 0.18), behavior: smooth ? 'smooth' : 'auto' });
}

/** How much of the list the floating nav covers: a node behind it is not on screen. */
const NAV_COVER = 110;

/**
 * Where "you are here" is while you look elsewhere: null on screen, else which
 * way it is. Measured on scroll rather than observed: an observer fires only
 * when the node crosses the edge, so a fling from the plan to the top of the
 * past left the arrow pointing the way it came. Started after the first scroll
 * to it — the shell resets the scroll on every tab change, after this effect,
 * hence the frame — so the pill does not flash up on the way in.
 */
function useAway(ref: RefObject<HTMLDivElement | null>): 'up' | 'down' | null {
  const [away, setAway] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const here = ref.current;
    const root = here?.closest('.cp-content') as HTMLElement | null;
    if (!here || !root) return;
    let pending = 0;
    const measure = () => {
      pending = 0;
      const h = here.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      setAway(h.bottom < r.top ? 'up' : h.top > r.bottom - NAV_COVER ? 'down' : null);
    };
    const onScroll = () => { if (!pending) pending = requestAnimationFrame(measure); };
    const first = requestAnimationFrame(() => { scrollToHere(here, false); measure(); });
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(first);
      if (pending) cancelAnimationFrame(pending);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
  return away;
}

/**
 * Draw when opening the Path finds the person said something the plan has not
 * heard — a goal, a note, a changed day — or there is no plan yet. Once per
 * thing said: the key is what was due and the plan it was due against, so a
 * draw that fails to start is not retried on every render. roadmapDue already
 * holds off for an hour after a failed draw, and the route caps the day.
 */
function useAutoDraw(home: HomeData, d: Derived, actions: Actions) {
  const asked = useRef<string | null>(null);
  const due = d.path.planDue;
  const key = due ? `${due}:${home.roadmap?.current?.id ?? ''}:${home.roadmap?.latest?.id ?? ''}:${home.contextCount}:${home.goals.length}` : null;
  useEffect(() => {
    if (!due || !key || asked.current === key) return;
    asked.current = key;
    void actions.drawRoadmap(due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

type DeviceMemory = ReturnType<typeof useDeviceMemory>;

/**
 * What this device remembers about the screen: the plan as it was last shown,
 * and the swaps you said to keep. Conveniences, never facts — nothing is decided
 * from them, and losing them costs a mark, not a number. A browser that will
 * not keep them (a private window, storage switched off) is said on screen,
 * because an unmarked plan otherwise reads as one that never changes
 * (invariant 13).
 */
function useDeviceMemory(profileId: string) {
  const [broken, setBroken] = useState(false);
  const at = (name: string) => `cp2.path.${name}:${profileId}`;
  return {
    broken,
    read(name: string): unknown {
      let raw: string | null;
      try { raw = window.localStorage.getItem(at(name)); } catch { setBroken(true); return null; }
      // Unparseable is the same as the wrong shape: no memory, and this visit writes a good one.
      try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    },
    write(name: string, value: unknown) {
      try { window.localStorage.setItem(at(name), JSON.stringify(value)); } catch { setBroken(true); }
    },
  };
}

/**
 * What changed on the plan since this device last showed it. The snapshot is
 * read once per visit, so the marks hold while you look — including for what
 * you change yourself — and the plan on screen is written back as seen every
 * time it changes. In an effect, never during render: the server has no
 * storage, and a first paint that differed from its render would not hydrate.
 */
function usePlanRedraw(home: HomeData, d: Derived, memory: DeviceMemory): PlanChanges | null {
  const seen = useRef<SeenPlan | null | undefined>(undefined);
  const [changes, setChanges] = useState<PlanChanges | null>(null);
  const { all } = d.path.next;
  const { current } = d.path.ladder;
  // Keyed on what the plan is, not on the objects carrying it: a refresh with the same plan is no change.
  const signature = `${current}|${all.map((x) => x.key).join(',')}`;
  useEffect(() => {
    if (seen.current === undefined) seen.current = parseSeenPlan(memory.read('seen'));
    setChanges(planChanges(seen.current, {
      at: d.now, timezone: home.profile.timezone, all, current,
      answered: home.recent.answered, commissions: home.commissions, callMoveId: home.callMove?.id ?? null,
    }));
    memory.write('seen', snapshotPlan(home.generatedAt, current, all));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return changes;
}

/**
 * The swap, unless you said to keep what it is about: for a week, on this
 * device. Not shown until what the device kept has been read, so a kept one
 * does not flash up and vanish.
 */
function useSwap(home: HomeData, d: Derived, memory: DeviceMemory): { swap: PathSwap | null; keep: () => void } {
  const [kept, setKept] = useState<unknown>(undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setKept(memory.read('kept') ?? {}); }, []);
  const swap = d.path.swap;
  const today = home.recent.today;
  const keep = () => {
    if (!swap) return;
    const was = (kept && typeof kept === 'object' ? kept : {}) as Record<string, unknown>;
    // Only the ones still holding: a key a week old is never asked about again, so it is not kept either.
    const next: Record<string, string> = {};
    for (const k of Object.keys(was)) if (swapKept(was, k, today)) next[k] = was[k] as string;
    next[swap.key] = today;
    memory.write('kept', next);
    setKept(next);
  };
  return { swap: swap && kept !== undefined && !swapKept(kept, swap.key, today) ? swap : null, keep };
}

/** "5:02 PM" where the person lives — the same on the server render and the client. */
function clock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}
