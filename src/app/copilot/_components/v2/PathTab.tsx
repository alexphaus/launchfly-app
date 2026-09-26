'use client';
// Path: one stream. What moved is above, "you are here" is in the middle with
// the one thing to do now, and what comes next is below, down to the goal. It
// opens on "you are here" — the past is one flick up, the plan one flick down.
// The rules for what goes in each part are in lib/copilot/pathway.ts.
//
// Drawn in the language of the path to money it grew out of: a rail of iconed
// and numbered nodes inside white cards, names in the display face, who did it
// in a pill, counts on the right. The call between the two cards is the call
// card that already exists — the same component, the same answers — so the one
// decision a day did not change by moving.
//
// This replaced Today and Work. Every part of Today has a place: the call is the
// present, "done for you" is the recent past (a failure it reported is a notice
// above "you are here", never a quiet line), "needs you" sits under the call,
// and "worth doing" is the first of the next steps. Work's projects under way and
// the work it offers to take on are next steps too; the machine and the team are
// on You.
//
// What makes it a path rather than a list is that it moves, and says so: a rung
// reached is a moment in the stream where it happened; the plan marks what is
// new since you last looked and names what left it, with what happened to it;
// every next step carries the planner's reason; and hours that could buy more
// elsewhere get one suggestion, set beside the hours themselves.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ASK_LABEL, type AskRow } from '@/lib/copilot/today';
import { agoLabel } from '@/lib/copilot/machine';
import type { MatchStage } from '@/lib/copilot/matches';
import {
  parseSeenPlan, planChanges, snapshotPlan, swapKept,
  type NextStep, type PathDay, type PathEvent, type PathStep, type PathSwap, type PathTarget, type PlanChanges, type SeenPlan,
} from '@/lib/copilot/pathway';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { CallCard, FirstRun } from '../views/NowView';
import type { Derived } from './derive';
import { IconAlert, IconArrow, IconCheck, IconChevron, IconFlag, IconRedraw, IconStar, IconSwap, IconYou, PathGlyph } from './icons2';

export default function PathTab({ home, d, actions, briefing, finding, openMatches }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean; finding: boolean; openMatches: (s: MatchStage) => void }) {
  const hereRef = useRef<HTMLDivElement>(null);
  const [allPast, setAllPast] = useState(false);
  const past = allPast ? d.path.pastAll : d.path.past;
  const { steps, current } = d.path.ladder;
  // A rung dated in the stream is drawn where it happened, and not again up here.
  const doneSteps = steps.filter((s) => s.state === 'done' && s.n < current + 1 && !past.reached.includes(s.key));
  const laterSteps = steps.filter((s) => s.n > current + 1);
  const memory = useDeviceMemory(home.profile.id);
  const redraw = usePlanRedraw(home, d, memory);
  const { swap, keep } = useSwap(home, d, memory);
  const away = useAway(hereRef);

  const open = (t: PathTarget) => {
    if (!t) return;
    if (t.kind === 'matches') openMatches(t.stage);
    else if (t.kind === 'project') actions.openSheet({ kind: 'commission', id: t.id });
    else if (t.kind === 'focus') actions.openSheet({ kind: 'focus' });
    else if (t.kind === 'won') actions.openSheet({ kind: 'stage', stage: 'won' });
    else actions.openSheet({ kind: 'ask' });
  };
  const rows = doneRows(doneSteps, past.days, swap);
  const added = new Set(redraw?.added ?? []);
  const nextSteps = d.path.next.steps;
  const showRedraw = !!redraw && (redraw.added.length > 0 || redraw.gone.length > 0);

  return (
    <div className="cp2-stream-page">
      {rows.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Done</span><span className="count">counted from your rows</span></div>
          <div className="cp-card cp2-stream">
            {past.earlier > 0 && (
              <button className="cp2-stream-earlier" onClick={() => setAllPast(true)}>Show {past.earlier} earlier</button>
            )}
            {rows.map((r, i) => {
              const first = i === 0 && !past.earlier;
              const last = i === rows.length - 1;
              if (r.t === 'rung') return <RungRow key={r.step.key} step={r.step} first={first} last={last} />;
              if (r.t === 'day') {
                return (
                  <div key={r.day.day} className="cp2-stream-row">
                    {/* The rail runs through a day's label, except above the card's first row. */}
                    <span className="cp2-stream-rail">{!first && <i className="ln" />}</span>
                    <span className="cp2-stream-daylabel">{r.day.label}</span>
                  </div>
                );
              }
              if (r.t === 'swap') {
                return <SwapRow key={r.swap.key} swap={r.swap} last={last} onAct={() => openMatches(r.swap.action.stage)} onKeep={keep} />;
              }
              return <EventRow key={r.e.key} e={r.e} tz={home.profile.timezone} onOpen={open} last={last} />;
            })}
          </div>
        </>
      )}

      <Notices home={home} d={d} actions={actions} />

      <div ref={hereRef} className="cp2-stream-here">
        <span className="cp2-stream-node here"><IconYou /></span>
        <Here step={steps[current]} total={steps.length} d={d} actions={actions} hasCall={!!home.decision} stepUp={redraw?.stepUp ?? null} />
      </div>

      {home.decision
        ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={d.noOffer} />
        : d.nothingYet
        ? <FirstRun home={home} actions={actions} finding={finding} />
        : <NoCallYet home={home} actions={actions} briefing={briefing} />}

      {d.asks.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Also needs you</span><span className="count">{d.asks.length}</span></div>
          <div className="cp-list cp2-rows">
            {d.asks.map((a) => <AskLine key={a.key} ask={a} actions={actions} openMatches={openMatches} />)}
          </div>
        </>
      )}

      <div className="cp-section"><span className="lead">Next</span><span className="count">its best guess · redrawn every run</span></div>
      {/* A browser that keeps nothing cannot mark what is new; said, so an unmarked plan is not read as an unchanged one. */}
      {memory.broken && <p className="cp-note cp2-stream-memo">This browser is not keeping what you last saw here, so nothing below is marked as new.</p>}
      <div className="cp-card cp2-stream">
        {showRedraw && <RedrawRow changes={redraw!} last={!nextSteps.length && !d.path.next.more && !laterSteps.length} />}
        {nextSteps.map((s, i) => (
          <NextRow key={s.key} step={s} first={i === 0 && !showRedraw} actions={actions} isNew={added.has(s.key)}
            last={i === nextSteps.length - 1 && !d.path.next.more && !laterSteps.length} />
        ))}
        {d.path.next.more > 0 && (
          <div className="cp2-stream-row">
            <span className="cp2-stream-rail"><i className="ln dash" /></span>
            <span className="cp2-stream-s cp2-stream-more">{d.path.next.more} more after these, once they are done</span>
          </div>
        )}
        {laterSteps.map((s, i) => <RungRow key={s.key} step={s} first={i === 0 && !nextSteps.length && !showRedraw} last={i === laterSteps.length - 1} dash actions={actions} />)}
        {/* At the goal already: nothing further on the ladder, and nothing made up to fill it. */}
        {!laterSteps.length && !nextSteps.length && (
          <div className="cp2-stream-row">
            <span className="cp2-stream-rail">
              {showRedraw && <i className="ln top dash" />}
              <span className="cp2-stream-node goal"><IconFlag /></span>
            </span>
            <span className="cp2-stream-body"><span className="cp2-stream-s">Nothing planned past the call yet. The next run works it out from what comes back.</span></span>
          </div>
        )}
      </div>

      <Tell home={home} actions={actions} briefing={briefing} />
      <BackToNow hereRef={hereRef} away={away} />
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
 * Open on "you are here", with a little of the past showing above it so the
 * direction of the stream is obvious.
 */
function scrollToHere(here: HTMLElement | null, smooth: boolean) {
  const main = here?.closest('.cp-content') as HTMLElement | null;
  if (!here || !main) return;
  const top = here.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top: Math.max(0, top - main.clientHeight * 0.2), behavior: smooth ? 'smooth' : 'auto' });
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

type DoneRow =
  | { t: 'rung'; step: PathStep }
  | { t: 'day'; day: PathDay }
  | { t: 'event'; e: PathEvent }
  | { t: 'swap'; swap: PathSwap };

/**
 * The past as one list of rows, so the rail knows its first and last: the done
 * rungs, then each day and what moved in it, and the swap under the hours it is
 * about — or at the foot, just above "you are here", when those hours are
 * behind "Show earlier".
 */
function doneRows(rungs: PathStep[], days: PathDay[], swap: PathSwap | null): DoneRow[] {
  const rows: DoneRow[] = rungs.map((step) => ({ t: 'rung', step }));
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

/* ─── The past ────────────────────────────────────────────────────────────── */

/**
 * One thing that moved. A rung reached is the same row, drawn as the moment it
 * is: a star in the path's own blue, the name in the display face, and which
 * step it was underneath.
 */
function EventRow({ e, tz, onOpen, last }: { e: PathEvent; tz: string; onOpen: (t: PathTarget) => void; last: boolean }) {
  const moment = !!e.rung;
  const inner = (
    <>
      <span className="cp2-stream-rail">
        <i className="ln top" />
        <span className={`cp2-stream-node sm ${moment ? 'moment' : e.actor}`}><PathGlyph icon={e.icon} /></span>
        {!last && <i className="ln" />}
      </span>
      <span className="cp2-stream-body">
        <span className="cp2-stream-top">
          <span className={`${moment ? 'cp2-stream-name' : 'cp2-stream-t'} cp2-clamp2`}>{e.title}</span>
          {e.timed && <span className="cp2-stream-when">{clock(e.at, tz)}</span>}
        </span>
        {e.detail && <span className={moment ? 'cp2-stream-stepdone' : 'cp2-stream-s cp2-clamp2'}>{e.detail}</span>}
      </span>
    </>
  );
  // A row that goes nowhere is text, not a button.
  return e.target
    ? <button className={`cp2-stream-row ${moment ? 'moment' : ''}`} onClick={() => onOpen(e.target)}>{inner}</button>
    : <div className={`cp2-stream-row ${moment ? 'moment' : ''}`}>{inner}</div>;
}

/**
 * The one suggestion on the stream, under the hours it is about: the hours, and
 * what sending brought back, side by side. Both are rows; the app makes no
 * claim about what the hours were worth. "Keep it" is yours to say, and holds
 * for the week.
 */
function SwapRow({ swap, last, onAct, onKeep }: { swap: PathSwap; last: boolean; onAct: () => void; onKeep: () => void }) {
  return (
    <div className="cp2-stream-row">
      <span className="cp2-stream-rail">
        <i className="ln top" />
        <span className="cp2-stream-node sm swap"><IconSwap /></span>
        {!last && <i className="ln" />}
      </span>
      <span className="cp2-stream-body cp2-stream-swapbody">
        <span className="cp2-stream-swap">
          <span className="cp2-stream-t">{swap.title}</span>
          <span className="cp2-stream-s">{swap.detail}</span>
          <span className="cp2-stream-acts">
            <button className="cp-btn primary sm" onClick={onAct}>{swap.action.label}</button>
            <button className="cp-btn sm" onClick={onKeep}>Keep it</button>
          </span>
        </span>
      </span>
    </div>
  );
}

/* ─── The ladder ──────────────────────────────────────────────────────────── */

/**
 * One rung. Done ones sit at the top of the past, the ones ahead at the end of
 * the plan; the one you are on is the "you are here" block, never a row.
 */
function RungRow({ step, first, last, dash, actions }: { step: PathStep; first: boolean; last: boolean; dash?: boolean; actions?: Actions }) {
  const done = step.state === 'done';
  const goal = step.key === 'goal';
  // Ahead of you the rail is dashed: it is the plan, and the plan is a guess.
  const ln = dash ? 'ln dash' : 'ln';
  return (
    <div className={`cp2-stream-row ${done || goal ? '' : 'later'}`}>
      <span className="cp2-stream-rail">
        {/* Kept on the first row too, invisible: it is what puts the node level with its text. */}
        <i className={`${ln} top ${first ? 'blank' : ''}`} />
        <span className={`cp2-stream-node ${done ? 'done' : goal ? 'goal' : 'later'}`}>
          {done ? <IconCheck /> : goal ? <IconFlag /> : step.n}
        </span>
        {!last && <i className={ln} />}
      </span>
      <span className="cp2-stream-body">
        <span className="cp2-stream-top">
          <span className="cp2-stream-name">{step.title}</span>
          {!done && step.progress && <span className="cp2-stream-frac">{fraction(step)}</span>}
        </span>
        <span className="cp2-stream-s">{step.detail}</span>
        {!done && step.progress && <Track step={step} />}
        {/* A goal nobody named is the one rung with nothing to count — naming it is the step. */}
        {step.input === 'goal' && actions && (
          <button className="cp-connect cp2-stream-act" onClick={() => actions.openSheet({ kind: 'goal' })}>Name it</button>
        )}
      </span>
    </div>
  );
}

function Here({ step, total, d, actions, hasCall, stepUp }: { step: PathStep; total: number; d: Derived; actions: Actions; hasCall: boolean; stepUp: PlanChanges['stepUp'] }) {
  const w = d.path.week;
  return (
    <div className="cp2-stream-herebody">
      {/* Since this device last showed the path. The step itself is in the stream above, where it happened. */}
      {stepUp && <span className="cp2-stream-reached"><IconStar />Just reached step {stepUp.to}</span>}
      <span className="cp2-stream-top">
        <span className="cp2-stream-eyebrow">You are here · step {step.n} of {total}</span>
        {step.progress && <span className="cp2-stream-frac">{fraction(step)}</span>}
      </span>
      <span className="cp2-stream-herename">{step.title}</span>
      {step.progress && <Track step={step} />}
      <span className="cp2-stream-s">{step.detail}</span>
      {/* The rungs that are the user's to write, with the one tap that writes
          them. A blank offer's call already carries that tap; saying it twice,
          one card apart, is the duplication this tab replaced. */}
      {step.input === 'offer' && !hasCall && <button className="cp-connect cp2-stream-act" onClick={() => actions.openSheet({ kind: 'offer' })}>Say what you sell</button>}
      {step.input === 'goal' && <button className="cp-connect cp2-stream-act" onClick={() => actions.openSheet({ kind: 'goal' })}>Name it</button>}
      {step.input === 'next-goal' && <button className="cp-connect cp2-stream-act" onClick={() => actions.openSheet({ kind: 'goal' })}>Set the next one</button>}
      <span className="cp2-stream-week" role="img" aria-label={`This week: moved forward on ${w.moved} of 7 days${w.streak >= 2 ? `, ${w.streak} in a row` : ''}`}>
        <span className="dots">
          {w.days.map((x) => <i key={x.day} className={`${x.moved ? 'moved' : ''} ${x.today ? 'today' : ''}`}>{x.letter}</i>)}
        </span>
        <span className="cp2-stream-weekline">
          {w.streak >= 2 ? `${w.streak} days in a row` : w.moved ? `Moved it forward ${w.moved} of 7 days` : 'Send something and today counts'}
        </span>
      </span>
    </div>
  );
}

function Track({ step }: { step: PathStep }) {
  const p = step.progress!;
  const pct = p.of > 0 ? Math.min(100, Math.round((p.done / p.of) * 100)) : 0;
  return <span className="cp2-stream-track" aria-hidden><i style={{ width: `${pct}%` }} /></span>;
}

function fraction(step: PathStep): string {
  const p = step.progress!;
  // The goal is money; the other fractions are counts.
  return step.key === 'goal' ? `${Math.round((p.done / Math.max(1, p.of)) * 100)}%` : `${p.done} of ${p.of}`;
}

/* ─── What comes next ─────────────────────────────────────────────────────── */

/**
 * A step after the call. Yours opens its work; a project under way opens its
 * thread; work the app offers to do itself opens in place, with the plan on
 * screen and one tap to hand it over — a plan is never approved unseen.
 */
function NextRow({ step, first, last, actions, isNew }: { step: NextStep; first: boolean; last: boolean; actions: Actions; isNew: boolean }) {
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
  return (
    <div className="cp2-stream-row">
      <span className="cp2-stream-rail">
        <i className={`ln top dash ${first ? 'blank' : ''}`} />
        <span className={`cp2-stream-node next ${step.actor}`}>
          <PathGlyph icon={step.icon} />
        </span>
        {!last && <i className="ln dash" />}
      </span>
      <span className="cp2-stream-body">
        <button className="cp2-stream-tap" onClick={tap} aria-expanded={step.kind === 'offer' ? openPlan : undefined}>
          <span className="cp2-stream-top">
            <span className="cp2-stream-t cp2-clamp2">{step.title}</span>
            <IconChevron />
          </span>
          {/* Its reason, in the planner's own words: a guess you can argue with. */}
          {step.because && <span className="cp2-stream-s cp2-clamp2">{step.because}</span>}
          <span className="cp2-stream-who">
            {isNew && <span className="cp2-stream-new">New</span>}
            <span className={`cp2-owner ${step.actor === 'ai' ? 'ai' : 'you'}`}>{step.actor === 'ai' ? 'AI does it' : 'You'}</span>
            <span className="cp2-stream-s cp2-clamp1">{step.detail}</span>
          </span>
        </button>
        {step.kind === 'offer' && openPlan && step.plan && (
          <>
            <span className="cp2-stream-plan">{step.plan}</span>
            {error && <span className="cp2-stream-s cp2-err">{error}</span>}
            <span className="cp2-stream-acts">
              <button className="cp-btn primary sm" disabled={busy} onClick={() => void handOver()}>{busy ? 'Handing it over…' : 'Hand it over'}</button>
              <button className="cp-btn sm" disabled={busy} onClick={() => void notWorth()}>Not worth it</button>
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * The redraw, said at the head of the plan: when it was last looked at, how
 * many steps are new, and each one that left with what happened to it.
 */
function RedrawRow({ changes, last }: { changes: PlanChanges; last: boolean }) {
  const n = changes.added.length;
  return (
    <div className="cp2-stream-row">
      <span className="cp2-stream-rail">
        <i className="ln top dash blank" />
        <span className="cp2-stream-node sm redraw"><IconRedraw /></span>
        {!last && <i className="ln dash" />}
      </span>
      <span className="cp2-stream-body">
        <span className="cp2-stream-top">
          <span className="cp2-stream-t">Redrawn {changes.since}</span>
          {n > 0 && <span className="cp2-stream-newcount">{n} new</span>}
        </span>
        {changes.gone.map((g) => (
          <span key={g.key} className="cp2-stream-gone cp2-clamp2"><s>{g.title}</s> · {g.why}</span>
        ))}
        {changes.goneMore > 0 && <span className="cp2-stream-s">and {changes.goneMore} more</span>}
      </span>
    </div>
  );
}

/* ─── Around the call ─────────────────────────────────────────────────────── */

/**
 * What broke, said above "you are here" rather than folded into the past: a
 * nightly job that never ran and a check that failed are the state of things
 * now, and a stream that looked calm over them is the screen invariant 13 is
 * written against.
 */
function Notices({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const r = d.done;
  const warns = r.rows.filter((x) => x.tone === 'warn');
  // The stream above is built from these reads; one that failed renders as a quiet week unless it is said.
  const unread = home.recent.unreadable;
  if (!r.stale && !r.broke.length && !warns.length && !unread.length) return null;
  return (
    <div className="cp-list cp2-rows cp2-stream-notices">
      {unread.length > 0 && (
        <div className="cp2-row warn">
          <span className="cp2-mark warn"><IconAlert /></span>
          <span className="cp2-row-main">
            <span className="t">Could not read your {unread.join(', ')}</span>
            <span className="s">Some of what moved this week is missing above, so a quiet stream here is not a quiet week.</span>
          </span>
        </div>
      )}
      {r.stale && (
        <div className="cp2-row warn">
          <span className="cp2-mark warn"><IconAlert /></span>
          <span className="cp2-row-main">
            <span className="t">Nothing ran overnight</span>
            <span className="s">
              {home.lastCronRun
                ? `The nightly job last finished ${agoLabel(home.lastCronRun, d.now)}. Until it runs again, this only changes when you open the app.`
                : 'The nightly job has never run, so nothing is found while you are away. Everything here was worked out when you opened the app.'}
            </span>
          </span>
        </div>
      )}
      {r.broke.length > 0 && (
        <div className="cp2-row warn">
          <span className="cp2-mark warn"><IconAlert /></span>
          <span className="cp2-row-main">
            <span className="t">{r.broke.length === 1 ? 'A check failed on the last run' : `${r.broke.length} checks failed on the last run`}</span>
            <span className="s">{r.broke.join(' · ')}</span>
          </span>
        </div>
      )}
      {warns.map((row) => (
        <button key={row.key} className="cp2-row warn" onClick={() => actions.openSheet({ kind: 'watchlist' })}>
          <span className="cp2-mark warn"><IconAlert /></span>
          <span className="cp2-row-main"><span className="t">{row.label}</span><span className="s">{row.detail}</span></span>
          <IconChevron />
        </button>
      ))}
    </div>
  );
}

/**
 * No call on a day that is not a first run: the brief has not run yet, or ran
 * and wrote only a read. The read is shown when there is one, because it is the
 * only sentence the model wrote today; otherwise the way to get a call is here.
 */
function NoCallYet({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  if (briefing) return null;
  if (home.insight) {
    return (
      <div className="cp-card cp-insight">
        <div className="cp-eyebrow">{home.insight.eyebrow}</div>
        <p>{home.insight.body}</p>
      </div>
    );
  }
  return (
    <div className="cp-card">
      <div className="cp-eyebrow">Today&rsquo;s call</div>
      <p className="cp2-lede">Nothing has been weighed yet today.</p>
      <button className="cp-btn primary block cp-call-do" onClick={() => void actions.runBrief('manual')}>Pick today&rsquo;s call</button>
    </div>
  );
}

/** One ask. The chip says what kind of answer it wants before the words do. */
function AskLine({ ask, actions, openMatches }: { ask: AskRow; actions: Actions; openMatches: (s: MatchStage) => void }) {
  const open = () => {
    if (ask.kind === 'confirm') actions.openSheet({ kind: 'capture' });
    // The drafts are sent where they live, one tap each on Matches → To send.
    else if (ask.kind === 'send') openMatches('to_send');
    else if (ask.id) actions.openSheet({ kind: 'commission', id: ask.id });
  };
  return (
    <button className={`cp2-row ask ${ask.kind}`} onClick={open}>
      <span className="cp2-row-main">
        <span className={`cp2-kind ${ask.kind}`}>{ASK_LABEL[ask.kind]}</span>
        <span className="t cp2-clamp2">{ask.title}</span>
        <span className="s cp2-clamp1">{ask.detail}</span>
      </span>
      <IconChevron />
    </button>
  );
}

/** The one input in the app: what changed, in the person's own words. */
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
        <span className="t">Tell it what changed</span>
        <span className="s">{home.contextCount} things it knows · changes the next step</span>
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
        <span className="hint">Changes tomorrow&rsquo;s call.</span>
        <button className="cp-btn" disabled={sending} onClick={() => { setOpen(false); setNote(''); }}>Cancel</button>
        <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => void submit()}>Add &amp; re-plan</button>
      </div>
    </div>
  );
}

/** "5:02 PM" where the person lives — the same on the server render and the client. */
function clock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}
