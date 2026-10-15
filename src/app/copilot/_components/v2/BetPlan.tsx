'use client';
// A bet's plan on the screen (lib/copilot/betplan.ts): on the bet's card, the
// steps that need a look or a tap (planShown); for a bet started before plans,
// what planning it would start; and on the bet sheet, what Start starts besides
// the bet.
//
// It sits under the count and is never the verdict: the count above it decides
// the bet, and every step done passes nothing (invariant 10). That is why a done
// step leaves the card rather than staying as a tick — a column of ticks under
// "0 of 3" said the opposite of the count. A step is tapped through to the thing
// that is its work — the project, the draft, the page — so the plan is a way in,
// not a second copy of what those already show.
import { useRef, useState, type ReactNode } from 'react';
import type { AssetKind } from '@/lib/copilot/assets';
import { planShown, type PlanView, type StepState, type StepView } from '@/lib/copilot/betplan';
import type { BetView, PlanStep } from '@/lib/copilot/lab';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { IconCheck, IconChevron } from './icons2';
import { MoveNote, type Brief } from './MoveKit';

const MARK: Record<StepState, string> = { done: 'done', working: 'working', needs: 'needs', failed: 'failed', waiting: 'waiting', stopped: 'stopped', open: 'open' };

/** The step's mark: a tick for done, a ring for working, an exclamation for what waits on a fix or on you. */
function Mark({ state, by }: { state: StepState; by: PlanStep['by'] }) {
  return (
    <span className={`cp2-bplan-mark ${MARK[state]} ${by}`} aria-hidden>
      {state === 'done' ? <IconCheck /> : state === 'failed' || state === 'needs' ? '!' : state === 'stopped' ? '–' : null}
    </span>
  );
}

/** The landing page this bet's page step opens: the one made for it, else any in use, else a new one for it. */
function pageTarget(home: HomeData, view: BetView): { id?: string; assetKind?: AssetKind; bet?: string } {
  const pages = (home.assets?.assets ?? []).filter((a) => a.kind === 'landing_page' && !a.retired);
  const mine = pages.find((a) => a.versions.some((v) => v.bet === view.bet.id)) ?? pages[0] ?? null;
  return mine ? { id: mine.id } : { assetKind: 'landing_page', bet: view.bet.id };
}

function Row({ s, open, busy }: { s: StepView; open: (() => void) | null; busy: boolean }) {
  const body = (
    <>
      <Mark state={s.state} by={s.step.by} />
      <span className="cp2-bplan-main">
        <span className="cp2-bplan-who">{s.step.who}</span>
        <b className="cp2-clamp2">{s.step.do}</b>
        <span className={`cp2-bplan-state ${MARK[s.state]}`}>{busy ? 'Gathering…' : s.line}</span>
      </span>
      {open && <IconChevron />}
    </>
  );
  return open
    ? <li><button className="cp2-bplan-row" onClick={open} disabled={busy}>{body}</button></li>
    : <li><div className="cp2-bplan-row">{body}</div></li>;
}

/**
 * The running bet's plan, under its count: only what planShown keeps, and
 * nothing at all once the crew is done and the people card holds the rest.
 * "Try again" only where a crew step failed and another go could change that —
 * never for a refusal a second try cannot fix.
 */
export function BetPlan({ home, view, pv, actions, brief }: { home: HomeData; view: BetView; pv: PlanView; actions: Actions; brief: Brief }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; text: string; bad: boolean; claude: boolean } | null>(null);
  const shown = planShown(pv);
  const retryable = pv.steps.some((s) => s.step.by === 'crew' && s.state === 'failed' && s.runnable);
  // Disabling the button is a render away, and a second tap can land before it:
  // two retries would draft twice or spend two of the bet's searches.
  const going = useRef(false);

  const retry = async () => {
    if (going.current) return;
    going.current = true;
    setBusy('retry'); setError(null);
    const r = await actions.lab({ action: 'plan_run' });
    going.current = false;
    setBusy(null);
    if (!r.ok) setError(r.error ?? 'Could not start it again');
  };
  const ask = async (s: StepView) => {
    setBusy(s.step.kind); setNote(null);
    const r = await brief.copy(s.step.ask ?? s.step.do);
    setBusy(null);
    setNote({ key: s.step.kind, text: r.note, bad: false, claude: r.ok });
  };
  /** Where a step leads: its own work where there is some, else the place the step is done. */
  const opener = (s: StepView): (() => void) | null => {
    if (s.project) return () => actions.openSheet({ kind: 'commission', id: s.project! });
    if (s.asset) return () => actions.openSheet({ kind: 'asset', id: s.asset! });
    switch (s.step.kind) {
      case 'page': return () => actions.openSheet({ kind: 'asset', ...pageTarget(home, view) });
      case 'draft': return s.step.by === 'you' && s.step.asset ? () => actions.openSheet({ kind: 'asset', assetKind: s.step.asset!, bet: view.bet.id }) : null;
      // Nobody here takes it: the same ask, with the whole record, for a chat.
      case 'job': return s.step.by === 'you' ? () => void ask(s) : null;
      default: return null;
    }
  };

  // The count's way in is not a row: the card's own buttons and the people card are it.
  if (!shown.length) return null;
  return (
    <div className="cp2-bplan" aria-label="The plan for this bet">
      <ol className="cp2-bplan-list">
        {shown.map((s) => <Row key={s.step.kind} s={s} open={opener(s)} busy={busy === s.step.kind} />)}
      </ol>
      {note && <MoveNote note={note} />}
      {retryable && (
        <button className="cp2-link cp2-bplan-retry" disabled={busy === 'retry'} onClick={() => void retry()}>
          {busy === 'retry' ? 'Starting…' : 'Try the crew’s steps again'}
        </button>
      )}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/**
 * What starts with a bet, before it starts: the crew's steps, then yours, read
 * off the same planFor the server writes when Start is tapped. On the bet sheet,
 * and on a bet started before plans, with the tap that plans it.
 */
export function PlanPreview({ steps, lead, children }: { steps: PlanStep[]; lead?: string; children?: ReactNode }) {
  if (!steps.length) return null;
  const crew = steps.filter((s) => s.by === 'crew');
  const scout = crew.some((s) => s.kind === 'find' && s.who === 'Scout');
  return (
    <div className="cp2-bplan preview" aria-label="What starts with this bet">
      <div className="cp2-bplan-top"><span className="cp2-pf-k">{crew.length ? 'What starts with it' : 'The plan'}</span></div>
      {lead && <p className="cp2-bplan-lead">{lead}</p>}
      <ol className="cp2-bplan-list">
        {steps.map((s) => (
          <li key={s.kind}>
            <div className="cp2-bplan-row">
              <Mark state="waiting" by={s.by} />
              <span className="cp2-bplan-main">
                <span className="cp2-bplan-who">{s.who}</span>
                <b className="cp2-clamp2">{s.do}</b>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="cp2-bplan-foot">
        {crew.length
          ? `The crew’s part starts now and goes on every night until the last day. Nothing is sent or posted for you${scout ? ', and each post the Scout keeps uses one of your matches' : ''}.`
          : 'Nothing connected here can take a step of it, so every step is yours.'}
      </p>
      {children}
    </div>
  );
}

/**
 * A bet started before plans: what planning it would start, and the tap that
 * does. Only where the crew has a step — a plan of yours alone is the play,
 * already under the bet.
 */
export function PlanIt({ view, steps, actions }: { view: BetView; steps: PlanStep[]; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // As on Start: a second tap before the button greys out would start the crew twice.
  const going = useRef(false);
  if (!steps.some((s) => s.by === 'crew')) return null;
  const plan = async () => {
    if (going.current) return;
    going.current = true;
    setBusy(true); setError(null);
    const r = await actions.lab({ action: 'plan', bet: view.bet.id });
    going.current = false;
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not plan it');
  };
  return (
    <PlanPreview steps={steps} lead="This bet started before bets had plans. Plan it, and the crew starts its part now.">
      <button className="cp-btn sm primary cp2-bplan-go" disabled={busy} onClick={() => void plan()}>{busy ? 'Planning…' : 'Plan it and start the crew'}</button>
      {error && <p className="cp-help cp2-err">{error}</p>}
    </PlanPreview>
  );
}
