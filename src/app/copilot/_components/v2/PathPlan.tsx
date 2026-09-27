'use client';
// The drawn plan on the Path: phases from this week to after this quarter, each
// a few milestones with what makes them done and the steps under them, then the
// goals they lead to. The rules are in lib/copilot/roadmap.ts; this renders them.
//
// It replaced the funnel ladder under "The plan" — first message, first reply,
// three paying clients, the same rungs for everybody — which is still what
// renders when the server has no model to draw with (PathTab keeps it).
//
// Three things on purpose:
// - Only this week is open. Later phases show their milestones and fold their
//   steps, because a plan read in full every morning is a plan skimmed.
// - Done is a tap, here, and nowhere else. The model is shown the taps and never
//   writes one (invariant 10's shape), so a step is never "done" because the
//   planner decided it probably was.
// - What the model said about itself is labelled as its own: "why this order"
//   and "what changed" are its reasoning, not facts about the person.
import { useState } from 'react';
import { agoLabel } from '@/lib/copilot/machine';
import {
  TAG_LABEL, SIZE_LABEL, goalLayout,
  type GoalMarker, type MarkState, type MilestoneView, type PhaseView, type RoadmapView, type StepView,
} from '@/lib/copilot/roadmap';
import type { NextStep } from '@/lib/copilot/pathway';
import type { Actions } from '../shared';
import { IconAlert, IconCheck, IconFlag, IconRedraw } from './icons2';

type Ready = Extract<RoadmapView, { state: 'ready' }>;

export function DrawnPlanHead({ view, now, onRedraw, unreadable }: { view: RoadmapView; now: Date; onRedraw: () => void; unreadable: string | null }) {
  const drawing = view.state !== 'off' && view.drawing;
  const failed = view.state !== 'off' ? view.failed : null;
  return (
    <>
      <div className="cp2-way-head">
        <span>The plan</span>
        <button className="cp2-plan-redraw" onClick={onRedraw} disabled={drawing}>
          <IconRedraw />{drawing ? 'Redrawing…' : view.state === 'ready' ? `Drawn ${agoLabel(view.drawnAt, now)}` : 'Draw it'}
        </button>
      </div>
      {view.state === 'ready' && view.direction && <p className="cp2-plan-direction"><span className="lbl">Why this order</span>{view.direction}</p>}
      {/* Said beside the plan it could not replace, so an old plan is never read as a fresh one (invariant 13). */}
      {failed && <WarnRow title={view.state === 'ready' ? 'The last redraw failed' : 'Could not draw your plan'} detail={view.state === 'ready' ? `${sentence(failed)} This is the plan from before.` : failed} />}
      {unreadable && <WarnRow title="Could not read your plan" detail={`${unreadable}. Ticks may be missing below.`} />}
      {view.state === 'ready' && view.changes && <ChangesRow changes={view.changes} />}
    </>
  );
}

/** An error from a model or a driver rarely ends in a full stop; the sentence after it needs one. */
const sentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

function WarnRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm warn"><IconAlert /></span>
      <span className="cp2-way-t">{title}</span>
      <span className="cp2-way-s">{detail}</span>
    </div>
  );
}

function ChangesRow({ changes }: { changes: NonNullable<Ready['changes']> }) {
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm redraw"><IconRedraw /></span>
      <span className="cp2-way-top">
        <span className="cp2-way-t">Redrawn</span>
        {changes.added.length > 0 && <span className="cp2-way-newcount">{changes.added.length} new</span>}
      </span>
      {changes.dropped.map((t) => <span key={t} className="cp2-way-gone cp2-clamp2"><s>{t}</s></span>)}
      {changes.note && <span className="cp2-way-s"><i>In its words:</i> {changes.note}</span>}
    </div>
  );
}

/** Before the first plan lands: drawing, or the one tap that draws it. */
export function PlanPending({ view, onDraw }: { view: Extract<RoadmapView, { state: 'none' }>; onDraw: () => void }) {
  return (
    <div className="cp2-way-row">
      <span className={`cp2-way-node sm redraw ${view.drawing ? 'cp2-plan-spin' : ''}`}><IconRedraw /></span>
      {view.drawing ? (
        <>
          <span className="cp2-way-t">Drawing your plan</span>
          <span className="cp2-way-s">From your goals, what you told it and what has happened so far. About a minute.</span>
        </>
      ) : (
        <>
          <span className="cp2-way-t">A plan drawn for your goals</span>
          <span className="cp2-way-s">Milestones from this week to the next few months, quick wins first, redrawn as things work or do not.</span>
          <button className="cp-connect cp2-way-act" onClick={onDraw}>Draw it</button>
        </>
      )}
    </div>
  );
}

/**
 * One phase: its label on the line, then its milestones. The planner's own
 * steps (Moves, projects under way) sit under this week, where they compete for
 * the same hours.
 */
export function PhaseBlock({ phase, actions, workerConnected, handed, showGoal, children }: { phase: PhaseView; actions: Actions; workerConnected: boolean; handed: Set<string>; showGoal: boolean; children?: React.ReactNode }) {
  const open = phase.key === 'week';
  return (
    <>
      <div className="cp2-plan-phase"><span>{phase.label}</span></div>
      {phase.milestones.filter((m) => m.state !== 'dropped').map((m) => (
        <MilestoneRow key={m.id} m={m} startOpen={open} actions={actions} workerConnected={workerConnected} handed={handed} showGoal={showGoal} />
      ))}
      {phase.milestones.filter((m) => m.state === 'dropped').map((m) => (
        <SetAsideRow key={m.id} m={m} actions={actions} />
      ))}
      {children}
    </>
  );
}

function MilestoneRow({ m, startOpen, actions, workerConnected, handed, showGoal }: { m: MilestoneView; startOpen: boolean; actions: Actions; workerConnected: boolean; handed: Set<string>; showGoal: boolean }) {
  const [open, setOpen] = useState(startOpen && m.state === 'open');
  const reached = m.state === 'done';
  const visible = m.steps.filter((s) => s.state !== 'dropped');
  const allDone = visible.length > 0 && visible.every((s) => s.state === 'done');
  return (
    <div className={`cp2-way-row cp2-plan-ms ${reached ? 'reached' : ''}`}>
      <span className={`cp2-way-node ${reached ? 'you' : 'rung'}`}>{reached ? <IconCheck /> : <IconMilestone />}</span>
      <button className="cp2-way-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cp2-way-name">{m.title}</span>
        {/* Only where milestones serve different goals: Maria's plan said "For Property buy and renovation" under all seven. */}
        {showGoal && m.goalTitle && <span className="cp2-plan-for cp2-clamp1">For {m.goalTitle}</span>}
        {!reached && m.why && <span className="cp2-way-s">{m.why}</span>}
        {!open && !reached && visible.length > 0 && (
          <span className="cp2-plan-fold">{m.open ? `${m.open} step${m.open === 1 ? '' : 's'} to go` : 'Every step done'}</span>
        )}
        {reached && <span className="cp2-way-stepdone">Reached</span>}
      </button>
      {open && !reached && (
        <>
          {m.doneWhen && <span className="cp2-plan-when"><b>Done when</b> {m.doneWhen}</span>}
          <ul className="cp2-plan-steps">
            {visible.map((s) => <StepItem key={s.id} s={s} milestone={m} actions={actions} workerConnected={workerConnected} handedOver={handed.has(s.title)} />)}
          </ul>
          <span className="cp2-way-links">
            <button className={`cp2-link ${allDone ? 'strong' : ''}`} onClick={() => void actions.markRoadmap(m.id, 'done')}>{allDone ? 'Mark it reached' : 'Reached it already'}</button>
            <button className="cp2-link muted" onClick={() => void actions.markRoadmap(m.id, 'dropped')}>Not for me</button>
          </span>
        </>
      )}
      {reached && <button className="cp2-link muted cp2-plan-undo" onClick={() => void actions.markRoadmap(m.id, 'open')}>Undo</button>}
    </div>
  );
}

function SetAsideRow({ m, actions }: { m: MilestoneView; actions: Actions }) {
  return (
    <div className="cp2-way-row cp2-plan-aside">
      <span className="cp2-way-gone cp2-clamp1"><s>{m.title}</s> · set aside</span>
      <button className="cp2-link muted" onClick={() => void actions.markRoadmap(m.id, 'open')}>Put it back</button>
    </div>
  );
}

/**
 * A step: the tick, what it is, and what kind of step it is. Tapping the words
 * shows the rest — set it aside, or hand research to the worker, which writes a
 * draft project that still has to be approved (invariant 11's cousin: nothing
 * starts because a plan said so).
 */
function StepItem({ s, milestone, actions, workerConnected, handedOver }: { s: StepView; milestone: MilestoneView; actions: Actions; workerConnected: boolean; handedOver: boolean }) {
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = s.state === 'done';
  const toggle = (state: MarkState) => void actions.markRoadmap(s.id, state);
  const handOver = async () => {
    setBusy(true); setError(null);
    const r = await actions.createCommission({ objective: s.title, why: `A step toward: ${milestone.title}` });
    setBusy(false);
    // Not ticked: handing it over is not doing it. The project it wrote is how
    // the row knows (handedOver), and its result lands in the evidence itself.
    if (!r.ok) setError(r.error ?? 'Could not hand that over');
  };
  return (
    <li className={`cp2-plan-step ${done ? 'done' : ''}`}>
      <button className="cp2-plan-tick" onClick={() => toggle(done ? 'open' : 'done')} aria-pressed={done} aria-label={done ? `Not done: ${s.title}` : `Done: ${s.title}`}>
        {done && <IconCheck />}
      </button>
      <span className="cp2-plan-stepbody">
        <button className="cp2-plan-steptext" onClick={() => setMore((v) => !v)} aria-expanded={more}>{s.title}</button>
        <span className="cp2-plan-meta">
          <span className={`cp2-plan-tag ${s.tag}`}>{TAG_LABEL[s.tag]}</span>
          <span className="cp2-plan-size">{SIZE_LABEL[s.size]}{!s.fits && !done ? ' · bigger than today' : ''}</span>
          {handedOver ? <span className="cp2-owner ai">Handed over</span> : s.who === 'ai' && workerConnected && <span className="cp2-owner ai">AI can do it</span>}
        </span>
        {more && !done && (
          <span className="cp2-way-acts">
            {s.who === 'ai' && workerConnected && !handedOver && (
              <button className="cp-btn primary sm" disabled={busy} onClick={() => void handOver()}>{busy ? 'Handing it over…' : 'Hand it over'}</button>
            )}
            <button className="cp-btn sm" onClick={() => toggle('dropped')}>Not for me</button>
          </span>
        )}
        {error && <span className="cp2-way-s cp2-err">{error}</span>}
      </span>
    </li>
  );
}

/** The planner's own next steps under this week, one line each — what they are is on the step. */
export function AlsoThisWeek({ steps, render }: { steps: NextStep[]; render: (s: NextStep) => React.ReactNode }) {
  if (!steps.length) return null;
  return (
    <>
      <div className="cp2-plan-sub">Also in motion</div>
      {steps.map(render)}
    </>
  );
}

/**
 * Where the plan ends: the goals it is working on, in the person's order, and
 * one line for the ones it is not — tap it and they are listed. Folded rather
 * than hidden: a goal the plan set aside is one the person should be able to
 * see was set aside, and reorder if the plan got it wrong.
 */
export function GoalMarkers({ goals, actions }: { goals: GoalMarker[]; actions: Actions }) {
  const [openWaiting, setOpenWaiting] = useState(false);
  if (!goals.length) {
    return (
      <div className="cp2-way-row cp2-way-stop goal end">
        <span className="cp2-way-node goal"><IconFlag /></span>
        <span className="cp2-way-eyebrow muted">Your goals</span>
        <span className="cp2-way-name">Name what you are working toward</span>
        <span className="cp2-way-s">The plan is drawn from it. A job, a number, a move, a skill — in your words.</span>
        <button className="cp-connect cp2-way-act" onClick={() => actions.openSheet({ kind: 'goal' })}>Name it</button>
      </div>
    );
  }
  const { shown, waiting } = goalLayout(goals);
  const links = (
    <span className="cp2-way-links">
      <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'goal' })}>Add a goal</button>
      <button className="cp2-link" onClick={() => actions.setTab('you')}>Reorder on You</button>
    </span>
  );
  return (
    <>
      {shown.map((g, i) => {
        const pct = g.progress && g.progress.of > 0 ? Math.min(100, Math.round((g.progress.done / g.progress.of) * 100)) : null;
        const last = i === shown.length - 1 && !waiting.length;
        return (
          <div key={g.id} className={`cp2-way-row cp2-way-stop goal ${last ? 'end' : ''}`}>
            <span className="cp2-way-node goal"><IconFlag /></span>
            <span className="cp2-way-eyebrow muted">{i === 0 ? 'Your goal' : 'Then'}</span>
            <span className="cp2-way-top">
              <span className="cp2-way-name">{g.title}</span>
              {g.status && <span className="cp2-way-frac">{g.status}</span>}
            </span>
            {pct != null && <span className="cp2-way-track" aria-hidden><i style={{ width: `${pct}%` }} /></span>}
            <span className="cp2-way-s">
              {[g.horizon, g.toward ? `${g.toward} milestone${g.toward === 1 ? '' : 's'} on the plan lead here` : 'Nothing on the plan leads here yet'].filter(Boolean).join(' · ')}
            </span>
            {last && links}
          </div>
        );
      })}
      {waiting.length > 0 && (
        <div className="cp2-way-row cp2-way-stop goal end cp2-plan-waiting">
          <span className="cp2-way-node sm quiet"><IconFlag /></span>
          <button className="cp2-way-tap" onClick={() => setOpenWaiting((v) => !v)} aria-expanded={openWaiting}>
            <span className="cp2-way-t">{waiting.length === 1 ? '1 more goal waits' : `${waiting.length} more goals wait`}</span>
            <span className="cp2-way-s">Nothing on the plan leads to {waiting.length === 1 ? 'it' : 'them'} yet: it works on the ones above first. {openWaiting ? '' : 'Show them.'}</span>
          </button>
          {openWaiting && (
            <span className="cp2-plan-waitlist">
              {waiting.map((g) => (
                <span key={g.id} className="cp2-way-beyondrow"><span className="t cp2-clamp2">{g.title}</span><span className="s">{g.status ?? g.horizon ?? 'No target'}</span></span>
              ))}
            </span>
          )}
          {links}
        </div>
      )}
    </>
  );
}

/** A milestone ahead: a waypoint rather than a flag, which is the goal's. */
export const IconMilestone = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden><path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" /></svg>
);
