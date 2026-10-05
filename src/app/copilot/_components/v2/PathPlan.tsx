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
//
// And one thing learned the hard way: everything above the steps is folded to
// a line until tapped. The head once stacked a verdict card per goal, the
// record's lines, the order's reasoning, a failed redraw's raw error, a
// "Redrawn" list and the experiment in full before the first step. Its owner
// called it heavy and overwhelming, and it was: each block was right, and
// together they buried the one thing the plan is for.
import { useState } from 'react';
import { agoLabel } from '@/lib/copilot/machine';
import {
  TAG_LABEL, SIZE_LABEL, goalLayout,
  type GoalMarker, type MarkState, type MilestoneView, type PhaseView, type RoadmapView, type StepView,
} from '@/lib/copilot/roadmap';
import { dateLabel } from '@/lib/copilot/due';
import { ANGLE_LABEL, type ExperimentState, type ExperimentView } from '@/lib/copilot/experiment';
import { resultLine, type BetView } from '@/lib/copilot/lab';
import { VERDICT_WORDS, type GoalOutlook } from '@/lib/copilot/outlook';
import type { NextStep } from '@/lib/copilot/pathway';
import type { Actions } from '../shared';
import { IconAlert, IconCheck, IconChevron, IconFlag, IconFlask, IconGauge, IconRedraw } from './icons2';

/** A handed-over step's project, by the step's title: its id to open, and where it stands. */
export type Handed = Map<string, { id: string; status: string }>;

type Ready = Extract<RoadmapView, { state: 'ready' }>;

export function DrawnPlanHead({ view, now, onRedraw, unreadable, actions }: { view: RoadmapView; now: Date; onRedraw: () => void; unreadable: string | null; actions: Actions }) {
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
      {view.state === 'ready' && view.direction && <Direction text={view.direction} />}
      {/* Said beside the plan it could not replace, so an old plan is never read as a fresh one (invariant 13).
          The reason is in view, two lines of it; a model's parse error runs to a paragraph, and the rest is a tap. */}
      {failed && (view.state === 'ready'
        ? <WarnRow title="The last redraw failed, so this is the plan from before" detail={sentence(failed)} onRetry={drawing ? undefined : onRedraw} />
        : <WarnRow title="Could not draw your plan" detail={sentence(failed)} />)}
      {unreadable && <WarnRow title="Could not read your plan" detail={`${unreadable}. Ticks may be missing below.`} />}
      {/* The plan saved and the call could not follow it: said, so a card over the plan that disagrees with it is explained (invariant 13). */}
      {view.state === 'ready' && view.callError && <WarnRow title="Today's call was not updated for this plan" detail={sentence(view.callError)} />}
      {view.state === 'ready' && view.signals.length > 0 && <RecordSays lines={view.signals} />}
      {view.state === 'ready' && view.suggested.length > 0 && <SuggestedDone items={view.suggested} actions={actions} />}
      {view.state === 'ready' && view.changes && <ChangesRow changes={view.changes} />}
    </>
  );
}

/**
 * Whether the goal the plan leads with gets there in time (outlook.ts), under
 * "you are here": the verdict in a word, the goal, and the counts behind it —
 * computed, never estimated, and the planner was handed the same line. A goal
 * with no date or no number opens its sheet, since that is what it is missing.
 */
export function HereVerdict({ o, actions }: { o: GoalOutlook; actions: Actions }) {
  const body = (
    <>
      <span className="cp2-odds-top">
        <span className={`cp2-odds-verdict ${o.verdict}`}>{VERDICT_WORDS[o.verdict]}</span>
        <span className="cp2-odds-name cp2-clamp1">{o.title}</span>
      </span>
      {/* "Reached." under a "Reached" pill is the word twice. */}
      {o.verdict !== 'reached' && <span className="cp2-odds-line">{o.line}</span>}
    </>
  );
  return o.verdict === 'no_date' || o.verdict === 'no_number'
    ? <button className="cp2-odds" onClick={() => actions.openSheet({ kind: 'goal', id: o.goalId })}>{body}</button>
    : <span className="cp2-odds">{body}</span>;
}

/** The fold used above the steps: a chevron that turns when the thing under it is open. */
const Fold = ({ open }: { open: boolean }) => <span className={`cp2-plan-chev ${open ? 'open' : ''}`}><IconChevron /></span>;

/** Characters of "why this order" that fit in two lines at 390px; past it, the rest is a tap. */
const DIRECTION_FOLD = 90;

/** The planner's reason for the order, labelled as its own, two lines until tapped. */
function Direction({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= DIRECTION_FOLD) return <p className="cp2-plan-direction"><span className="lbl">Why this order</span>{text}</p>;
  return (
    <button className="cp2-plan-direction" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <span className="lbl">Why this order<Fold open={open} /></span>
      <span className={open ? undefined : 'cp2-clamp2'}>{text}</span>
    </button>
  );
}

/**
 * What the record said to stop or change when this plan was drawn (outlook.ts's
 * signals). The planner had to answer each, so the plan below is the answer and
 * these are its evidence: the first in view, the rest a tap away.
 */
function RecordSays({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm quiet"><IconGauge /></span>
      <button className="cp2-way-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cp2-way-top">
          <span className="cp2-way-t">What the record says{lines.length > 1 ? ` · ${lines.length}` : ''}</span>
          <Fold open={open} />
        </span>
        {!open && <span className="cp2-way-s cp2-clamp2">{lines[0]}</span>}
      </button>
      {open && lines.map((line) => <span key={line} className="cp2-odds-signal">{line}</span>)}
    </div>
  );
}

/**
 * The plan's one experiment (experiment.ts): a move the person would probably
 * not have written, with the evidence for it, a test sized to a day, and what
 * would show it worked. Offered, it asks to be tried or set aside — or made a
 * bet on Proof, where the rows judge it instead of a tap. Being tried by hand,
 * it asks how it went, hardest on its check date. Made a bet, the bet decides
 * it, and the card says how the bet stands instead of asking.
 */
export function ExperimentCard({ view, goalTitle, today, actions, bet, canBet, onBet }: {
  view: ExperimentView; goalTitle: string | null; today: string; actions: Actions;
  /** The bet this experiment was made into, when it was: its verdict is the experiment's. */
  bet: BetView | null;
  /** No bet is running, so this one can become the bet. */
  canBet: boolean;
  onBet: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const x = view.exp;
  const act = async (state: ExperimentState) => {
    setBusy(true);
    await actions.markExperiment(x.id, state);
    setBusy(false);
  };
  // Folded to the line each stage turns on: offered, why it is worth a day;
  // being tried, what would show it worked. The rest is a tap on the card.
  const offered = view.stage === 'offered' && !bet;
  return (
    <div className="cp2-way-row cp2-exp">
      <span className="cp2-way-node sm cp2-exp-node"><IconFlask /></span>
      <span className="cp2-exp-card">
        <button className="cp2-exp-body" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="cp2-exp-eyebrow">Experiment · {ANGLE_LABEL[x.angle]}<Fold open={open} /></span>
          <span className="cp2-way-name">{x.title}</span>
          {(open || offered) && <span className={`cp2-exp-why ${open ? '' : 'cp2-clamp2'}`}>{x.why}</span>}
          {open && <span className="cp2-exp-line"><b>Test</b>{x.test}</span>}
          {(open || !offered) && <span className="cp2-exp-line"><b>It worked if</b>{x.watch}</span>}
          {open && goalTitle && <span className="cp2-plan-for">For {goalTitle}</span>}
        </button>
        {bet ? (
          // Made a bet: the rows decide it, so there is nothing to tap here but the way to the bet.
          <>
            <span className="cp2-exp-when">
              {bet.state === 'running'
                ? `A bet on Proof decides it · day ${bet.day} of ${bet.bet.days}, ${resultLine(bet)}`
                : `The bet ${bet.state === 'passed' ? 'passed' : bet.state === 'failed' ? 'did not pass' : 'was called off'}: ${resultLine(bet)}. The plan hears it when it is next drawn.`}
            </span>
            <span className="cp2-way-acts">
              <button className="cp-btn sm" onClick={() => actions.setTab('proof')}>See the bet</button>
            </span>
          </>
        ) : offered ? (
          <>
            <span className="cp2-way-acts">
              <button className="cp-btn primary sm" disabled={busy} onClick={() => void act('started')}>Try it</button>
              <button className="cp-btn sm" disabled={busy} onClick={() => void act('dropped')}>Not for me</button>
            </span>
            {canBet && <button className="cp2-exp-bet" onClick={onBet}>Or make it a bet, and let the rows judge it</button>}
          </>
        ) : (
          <>
            <span className="cp2-exp-when">
              {view.stage === 'trying' && view.due ? 'Its check date is here. Did it work?' : view.stage === 'trying' ? `Trying it · check on ${dateLabel(view.checkOn, today)}` : ''}
            </span>
            <span className="cp2-way-acts">
              <button className={`cp-btn sm ${view.stage === 'trying' && view.due ? 'primary' : ''}`} disabled={busy} onClick={() => void act('worked')}>It worked</button>
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

/**
 * Something that went wrong, said where it matters (invariant 13): what, in the
 * title, and why, in two lines of the error — tap for the whole of it. A
 * redraw that failed can be tried again from here.
 */
function WarnRow({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm warn"><IconAlert /></span>
      <button className="cp2-way-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cp2-way-t">{title}</span>
        <span className={`cp2-way-s ${open ? '' : 'cp2-clamp2'}`}>{detail}</span>
      </button>
      {onRetry && <span className="cp2-way-links"><button className="cp2-link" onClick={onRetry}>Try again</button></span>}
    </div>
  );
}

/** What the redraw changed: counts on one line, what left and the planner's note behind a tap. */
function ChangesRow({ changes }: { changes: NonNullable<Ready['changes']> }) {
  const [open, setOpen] = useState(false);
  const counts = [
    changes.added.length ? `${changes.added.length} new` : null,
    changes.dropped.length ? `${changes.dropped.length} gone` : null,
  ].filter(Boolean).join(' · ');
  const more = changes.dropped.length > 0 || !!changes.note;
  const head = (
    <span className="cp2-way-top">
      <span className="cp2-way-t">Redrawn{counts && <span className="cp2-way-newcount"> · {counts}</span>}</span>
      {more && <Fold open={open} />}
    </span>
  );
  return (
    <div className="cp2-way-row">
      <span className="cp2-way-node sm redraw"><IconRedraw /></span>
      {more ? <button className="cp2-way-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{head}</button> : head}
      {open && changes.dropped.map((t) => <span key={t} className="cp2-way-gone"><s>{t}</s></span>)}
      {open && changes.note && <span className="cp2-way-s"><i>In its words:</i> {changes.note}</span>}
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
export function PhaseBlock({ phase, actions, workerConnected, handed, showGoal, callTitle = null, children }: { phase: PhaseView; actions: Actions; workerConnected: boolean; handed: Handed; showGoal: boolean; callTitle?: string | null; children?: React.ReactNode }) {
  // One milestone open, the first still open this week: the rest of the week
  // folds to its count of steps. Every milestone this week open at once put
  // two reasons, two "done when"s and two checklists between the move and the
  // month — the week read as a wall, not a next step.
  const first = phase.key === 'week' ? phase.milestones.find((m) => m.state === 'open')?.id ?? null : null;
  return (
    <>
      <div className="cp2-plan-phase"><span>{phase.label}</span></div>
      {phase.milestones.filter((m) => m.state !== 'dropped').map((m) => (
        <MilestoneRow key={m.id} m={m} startOpen={m.id === first} actions={actions} workerConnected={workerConnected} handed={handed} showGoal={showGoal} callTitle={callTitle} />
      ))}
      {phase.milestones.filter((m) => m.state === 'dropped').map((m) => (
        <SetAsideRow key={m.id} m={m} actions={actions} />
      ))}
      {children}
    </>
  );
}

function MilestoneRow({ m, startOpen, actions, workerConnected, handed, showGoal, callTitle }: { m: MilestoneView; startOpen: boolean; actions: Actions; workerConnected: boolean; handed: Handed; showGoal: boolean; callTitle: string | null }) {
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
        {/* Its reason only while it is open: seven folded milestones each with a paragraph under them was most of the scroll. */}
        {open && !reached && m.why && <span className="cp2-way-s">{m.why}</span>}
        {!open && !reached && visible.length > 0 && (
          <span className="cp2-plan-fold">{m.open ? `${m.open} step${m.open === 1 ? '' : 's'} to go` : 'Every step done'}</span>
        )}
        {reached && <span className="cp2-way-stepdone">Reached</span>}
      </button>
      {open && !reached && (
        <>
          {m.doneWhen && <span className="cp2-plan-when"><b>Done when</b> {m.doneWhen}</span>}
          <ul className="cp2-plan-steps">
            {visible.map((s) => (s.state !== 'done' && callTitle && s.title === callTitle
              ? <CallStep key={s.id} title={s.title} />
              : <StepItem key={s.id} s={s} actions={actions} workerConnected={workerConnected} project={handed.get(s.title) ?? null} />))}
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
 * be approved under Projects and then for 21:00 — so work the plan had already judged a
 * machine could do waited a day unless somebody went looking. Once handed over,
 * the row says where the project stands and opens it. Handing over is not
 * doing: the tick stays the person's.
 */
const PROJECT_STATE: Record<string, string> = {
  draft: 'Waiting for your approval',
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
        </span>
        {project && !done && (
          <button className="cp2-plan-project" onClick={() => actions.openSheet({ kind: 'commission', id: project.id })}>
            {PROJECT_STATE[project.status] ?? 'Handed over'} · open
          </button>
        )}
        {/* Who does it, said once, on the button: a "Your agent can do this" pill over a
            "Hand it over" button was the same fact in two rows. */}
        {agents && !project && !done && (
          <span className="cp2-plan-handoff">
            <button className="cp-btn primary sm" disabled={busy} onClick={() => void handOver()}>{busy ? 'Handing it over…' : 'Hand it to your agent'}</button>
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

/**
 * The step that is today's call, in its place in the milestone but not a
 * second copy of the card above: the same words with their own tick and chips,
 * a screen below the call, read as two things to do. It is answered on the
 * call, whose "I did it" ticks this step (stepForCall), so it has no tick here.
 */
function CallStep({ title }: { title: string }) {
  return (
    <li className="cp2-plan-step iscall">
      <span className="cp2-plan-callmark" aria-hidden>↑</span>
      <span className="cp2-plan-stepbody">
        <span className="cp2-plan-steptext">{title}</span>
        <span className="cp2-plan-meta"><span className="cp2-plan-tag call">Today’s call — answer it above</span></span>
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
            {/* What the plan does toward it is said only when it does something: "Nothing on the plan
                leads here yet" under a goal the plan put first read as the plan ignoring it. */}
            <span className="cp2-way-s">
              {[g.verdict, g.horizon, g.toward ? `${g.toward} milestone${g.toward === 1 ? ' leads' : 's lead'} here` : null].filter(Boolean).join(' · ')}
            </span>
            {last && links}
          </div>
        );
      })}
      {waiting.length > 0 && (
        <div className="cp2-way-row cp2-way-stop goal end cp2-plan-waiting">
          <span className="cp2-way-node sm quiet"><IconFlag /></span>
          <button className="cp2-way-tap" onClick={() => setOpenWaiting((v) => !v)} aria-expanded={openWaiting}>
            <span className="cp2-way-top">
              <span className="cp2-way-t">{waiting.length === 1 ? '1 more goal waits' : `${waiting.length} more goals wait`}</span>
              <Fold open={openWaiting} />
            </span>
            <span className="cp2-way-s">The plan works on the ones above first.</span>
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
