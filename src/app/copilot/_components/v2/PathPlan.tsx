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
import { dateLabel } from '@/lib/copilot/due';
import { ANGLE_LABEL, type ExperimentState, type ExperimentView } from '@/lib/copilot/experiment';
import { VERDICT_WORDS, type GoalOutlook } from '@/lib/copilot/outlook';
import type { NextStep } from '@/lib/copilot/pathway';
import type { Actions } from '../shared';
import { IconAlert, IconCheck, IconFlag, IconFlask, IconGauge, IconRedraw } from './icons2';

/** A handed-over step's project, by the step's title: its id to open, and where it stands. */
export type Handed = Map<string, { id: string; status: string }>;

type Ready = Extract<RoadmapView, { state: 'ready' }>;

export function DrawnPlanHead({ view, now, onRedraw, unreadable, actions, outlook = [] }: { view: RoadmapView; now: Date; onRedraw: () => void; unreadable: string | null; actions: Actions; outlook?: GoalOutlook[] }) {
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
      {/* First, whether it can work: the order below is the plan's answer to it. */}
      {view.state === 'ready' && <WillItWork outlook={outlook} signals={view.signals} />}
      {view.state === 'ready' && view.direction && <p className="cp2-plan-direction"><span className="lbl">Why this order</span>{view.direction}</p>}
      {/* Said beside the plan it could not replace, so an old plan is never read as a fresh one (invariant 13). */}
      {failed && <WarnRow title={view.state === 'ready' ? 'The last redraw failed' : 'Could not draw your plan'} detail={view.state === 'ready' ? `${sentence(failed)} This is the plan from before.` : failed} />}
      {unreadable && <WarnRow title="Could not read your plan" detail={`${unreadable}. Ticks may be missing below.`} />}
      {/* The plan saved and the call could not follow it: said, so a card over the plan that disagrees with it is explained (invariant 13). */}
      {view.state === 'ready' && view.callError && <WarnRow title="Today's call was not updated for this plan" detail={sentence(view.callError)} />}
      {view.state === 'ready' && view.suggested.length > 0 && <SuggestedDone items={view.suggested} actions={actions} />}
      {view.state === 'ready' && view.changes && <ChangesRow changes={view.changes} />}
    </>
  );
}

/**
 * Will it work: each goal the plan works on, with the verdict its rows give it
 * (outlook.ts), then what the record said to stop or change when the plan was
 * drawn. Counted, never estimated — the planner was handed these same lines and
 * had to answer them, so the plan below is its answer.
 */
export function WillItWork({ outlook, signals }: { outlook: GoalOutlook[]; signals: string[] }) {
  if (!outlook.length && !signals.length) return null;
  return (
    <div className="cp2-way-row cp2-odds">
      <span className="cp2-way-node sm quiet"><IconGauge /></span>
      <span className="cp2-way-t">Will it work?</span>
      {outlook.map((o) => (
        <span key={o.goalId} className="cp2-odds-goal">
          <span className="cp2-odds-top">
            <span className="cp2-odds-name cp2-clamp2">{o.title}</span>
            <span className={`cp2-odds-verdict ${o.verdict}`}>{VERDICT_WORDS[o.verdict]}</span>
          </span>
          <span className="cp2-odds-line">{o.line}</span>
        </span>
      ))}
      {signals.length > 0 && <span className="cp2-odds-said">The record says</span>}
      {signals.map((line) => <span key={line} className="cp2-odds-signal">{line}</span>)}
    </div>
  );
}

/**
 * The plan's one experiment (experiment.ts): a move the person would probably
 * not have written, with the evidence for it, a test sized to a day, and what
 * would show it worked. Offered, it asks to be tried or set aside; being tried,
 * it asks how it went — hardest on its check date, but answerable any day.
 * Nothing here is graded for them: the verdict is their tap.
 */
export function ExperimentCard({ view, goalTitle, today, actions }: { view: ExperimentView; goalTitle: string | null; today: string; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const x = view.exp;
  const act = async (state: ExperimentState) => {
    setBusy(true);
    await actions.markExperiment(x.id, state);
    setBusy(false);
  };
  return (
    <div className="cp2-way-row cp2-exp">
      <span className="cp2-way-node sm cp2-exp-node"><IconFlask /></span>
      <span className="cp2-exp-card">
        <span className="cp2-exp-eyebrow">Experiment · {ANGLE_LABEL[x.angle]}</span>
        <span className="cp2-way-name">{x.title}</span>
        {goalTitle && <span className="cp2-plan-for cp2-clamp1">For {goalTitle}</span>}
        <span className="cp2-exp-why">{x.why}</span>
        <span className="cp2-exp-line"><b>Test</b>{x.test}</span>
        <span className="cp2-exp-line"><b>It worked if</b>{x.watch}</span>
        {view.stage === 'offered' ? (
          <span className="cp2-way-acts">
            <button className="cp-btn primary sm" disabled={busy} onClick={() => void act('started')}>Try it</button>
            <button className="cp-btn sm" disabled={busy} onClick={() => void act('dropped')}>Not for me</button>
          </span>
        ) : (
          <>
            <span className="cp2-exp-when">
              {view.due ? 'Its check date is here. Did it work?' : `Trying it · check on ${dateLabel(view.checkOn, today)}`}
            </span>
            <span className="cp2-way-acts">
              <button className={`cp-btn sm ${view.due ? 'primary' : ''}`} disabled={busy} onClick={() => void act('worked')}>It worked</button>
              <button className="cp-btn sm" disabled={busy} onClick={() => void act('failed')}>It didn&rsquo;t</button>
              <button className="cp-btn sm" disabled={busy} onClick={() => void act('unclear')}>Can&rsquo;t tell</button>
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * What the person told it that sounds like a step done, asked rather than
 * assumed. "Booked two markets for October" in the composer comes back as "Did
 * you finish: Contact market organizers?" — one tap ticks it, "Not yet" puts
 * the question away for this visit. The model only ever suggests; the tick is
 * the person's (roadmap.ts rule 2). Without this, telling the app something was
 * done left the step open until someone found it on the plan and ticked it too.
 */
function SuggestedDone({ items, actions }: { items: Array<{ id: string; title: string }>; actions: Actions }) {
  const [put, setPut] = useState<Set<string>>(new Set());
  const shown = items.filter((i) => !put.has(i.id));
  if (!shown.length) return null;
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm you"><IconCheck /></span>
      <span className="cp2-way-t">From what you told it — did you finish {shown.length === 1 ? 'this' : 'these'}?</span>
      {shown.map((i) => (
        <span key={i.id} className="cp2-plan-suggest">
          <span className="t cp2-clamp2">{i.title}</span>
          <span className="cp2-way-acts">
            <button className="cp-btn primary sm" onClick={() => void actions.markRoadmap(i.id, 'done')}>Yes, tick it</button>
            <button className="cp-btn sm" onClick={() => setPut((p) => new Set(p).add(i.id))}>Not yet</button>
          </span>
        </span>
      ))}
    </div>
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
export function PhaseBlock({ phase, actions, workerConnected, handed, showGoal, children }: { phase: PhaseView; actions: Actions; workerConnected: boolean; handed: Handed; showGoal: boolean; children?: React.ReactNode }) {
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

function MilestoneRow({ m, startOpen, actions, workerConnected, handed, showGoal }: { m: MilestoneView; startOpen: boolean; actions: Actions; workerConnected: boolean; handed: Handed; showGoal: boolean }) {
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
            {visible.map((s) => <StepItem key={s.id} s={s} actions={actions} workerConnected={workerConnected} project={handed.get(s.title) ?? null} />)}
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
 * shows the rest — set it aside.
 *
 * A step the plan gave the agent says so and carries its button in plain sight:
 * one tap hands it over and starts it (handOverStep). It used to sit behind a
 * tap on the step's words, write a draft with no goal and no plan, and wait to
 * be approved on Work and then for 21:00 — so work the plan had already judged a
 * machine could do waited a day unless somebody went looking. Once handed over,
 * the row says where the project stands and opens it. Handing over is not
 * doing: the tick stays the person's.
 */
const PROJECT_STATE: Record<string, string> = {
  draft: 'Waiting for your approval on Work',
  active: 'With your agent',
  blocked: 'Your agent needs you',
  done: 'Your agent finished it',
};

function StepItem({ s, actions, workerConnected, project }: { s: StepView; actions: Actions; workerConnected: boolean; project: { id: string; status: string } | null }) {
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = s.state === 'done';
  const toggle = (state: MarkState) => void actions.markRoadmap(s.id, state);
  const agents = s.who === 'ai' && workerConnected;
  const handOver = async () => {
    setBusy(true); setError(null);
    const r = await actions.handOverStep(s.id);
    setBusy(false);
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
          {!project && agents && <span className="cp2-owner ai">Your agent can do this</span>}
        </span>
        {project && !done && (
          <button className="cp2-plan-project" onClick={() => actions.openSheet({ kind: 'commission', id: project.id })}>
            {PROJECT_STATE[project.status] ?? 'Handed over'} · open
          </button>
        )}
        {agents && !project && !done && (
          <span className="cp2-plan-handoff">
            <button className="cp-btn primary sm" disabled={busy} onClick={() => void handOver()}>{busy ? 'Handing it over…' : 'Hand it over'}</button>
            <span className="cp2-plan-handoff-note">It starts now. It never contacts anyone or spends.</span>
          </span>
        )}
        {more && !done && (
          <span className="cp2-way-acts">
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
              {[g.verdict, g.horizon, g.toward ? `${g.toward} milestone${g.toward === 1 ? '' : 's'} on the plan lead here` : 'Nothing on the plan leads here yet'].filter(Boolean).join(' · ')}
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
