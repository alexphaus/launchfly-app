'use client';
// Engine (key `proof`): the business as a machine of five parts, who works each
// one, and the one move that is the person's.
//
//   The engine    what it sells, whether it is proven — the count, drawn big —
//                 the five parts in a row with their states and the weakest
//                 marked, and the crew working them. One card, read at a glance
//   The part      the part opened (where your move is, else the weakest): its
//                 state and the rule behind it, your move when it is here, who
//                 works it and what would move it — and for the bet's part, the
//                 people found and the bet itself
//   Built so far  what the business has to show for itself: sales, bets passed,
//                 projects finished, the first version of anything made
//   More          conversations, assets and projects: a line each
//
// Why it is drawn this way. Its owner's verdict on the tab before it: hard to
// understand, run by the person rather than by the AI, and nothing that could
// stand beside what else is on the market — where the want was a startup built
// by a workforce with its owner steering, and a crew that will one day include
// newer models, people taken on for a part, and machines. So the chain that was
// five dots under the step is the screen's spine; each part says who works it
// (crew.ts); the one move sits on the part it moves; and what was built is the
// record of the engine running. The parts are tapped through in place, not in a
// sheet, because a sheet over the engine hides the engine.
//
// What it leaves to the other tabs: the plan and the day's move (Path), outreach
// (Swipe), runway and the bank (Money), the offer, goals and settings (You). A
// number shown here that is shown there is counted twice and will disagree.
//
// What it will not do: show a number nobody counted, mark a bet passed, or let a
// model's draft stand as the person's. A model proposes — ideas for a bet,
// drafts of an asset — and the rows judge. lib/copilot/proof.ts, lab.ts,
// engine.ts, crew.ts, assets.ts and history.ts have the rules.
import { useEffect, useRef, useState } from 'react';
import { ASSET_LABEL, OFFER_ASSET, type Asset, type AssetGap, type AssetKind } from '@/lib/copilot/assets';
import {
  LINK_LABEL, LINK_STATE_LABEL, changeLine, chainChanges, evidenceState, parseSeenChain, snapshotChain,
  type ChainChange, type LinkKey, type LinkMove, type SeenChain,
} from '@/lib/copilot/business';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX, commissionChip, splitThreads } from '@/lib/copilot/commission';
import { WORKER_STATE_LABEL, crewHeadline, crewOn, type Worker } from '@/lib/copilot/crew';
import { historyDay, type HistoryEntry } from '@/lib/copilot/history';
import {
  BET_STATE_LABEL, METRIC, NOTE_MAX, PLAY_BY_KEY, TALK_BACK_DAYS, suggestBelief,
  betPrice, countedFrom, dayWords, decisionWords, gradeWords, ideaRun, metricWords, overPlan, passLine, playLine, playOf, playsFor, talkCounts,
  type BetView, type Idea, type LabDecision, type Play,
} from '@/lib/copilot/lab';
import { assetMakers, betNext, betWork, ideasStale, nextBet, nextBetRequest, pivotWords, type BetNextGo, type BetWork, type NextBet } from '@/lib/copilot/proof';
import { hostOf, researchLine } from '@/lib/copilot/idearesearch';
import { readingLine, rungsOf, type Rung } from '@/lib/copilot/reading';
import { moneyLabel } from '@/lib/copilot/review';
import type { FoundBy, HomeData } from '@/lib/copilot/types';
import { COMMITMENT_LABEL, COMMITMENTS, dayIn, type Commitment } from '@/lib/copilot/lab';
import { VOICE_OPENER, VOICE_SEARCHES, betVoiced, betVoices, postedWords, voiceRefusal, voiceTalk, type Voice } from '@/lib/copilot/voices';
import {
  BUILT_SHOWN, OPENED_KEY, clearOpened, engineFigure, engineStep, markOpened, openPart, parseOpened, payoffGoal,
  type Step, type StepGo,
} from '@/lib/copilot/engine';
import { pageCounts, pageLine } from '@/lib/copilot/livepage';
import { SCOUT_SEARCHING, planCapsOf, planFor, planInputOf, planView, stepBusy } from '@/lib/copilot/betplan';
import type { Actions } from '../shared';
import type { Derived } from './derive';
import { AssetGlyph, IconCheck, IconChevron, IconCross, IconExternal, IconFlask, IconSwap, IconTarget, MatchGlyph, PathGlyph, WorkerGlyph } from './icons2';
import { MoveNote, MoveRow, agentIsFull, orChat, useBrief, useMove, type Brief } from './MoveKit';
import { BetPlan, PlanIt, PlanPreview } from './BetPlan';
import { newMoveId } from './bookLocal';

export default function ProofTab({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean }) {
  const changes = useSeen(home, d);
  const brief = useBrief(actions);
  const lab = d.proof.lab;
  const opened = useOpened(home.profile.id);
  const find = useFind(actions, lab.current?.bet.id ?? null);
  const { step, peopleShown } = useStep(home, d, opened);
  // A part tapped stays open until the next visit; until then the engine opens where the move is.
  const [picked, setPicked] = useState<LinkKey | null>(null);
  const part = picked ?? openPart(step, d.proof.chain.weak);
  const onBet = lab.current?.bet.part === part;
  return (
    <>
      <EngineHero home={home} d={d} actions={actions} part={part} pick={setPicked} changes={changes} />
      {/* A move about the whole business — the offer, the checkpoint — is no one part's, so it comes before them. */}
      {step && !step.part && (
        <div className="cp-card cp2-ns">
          <NextStep step={step} view={lab.current} actions={actions} brief={brief} find={find} opened={opened} peopleShown={peopleShown} />
        </div>
      )}
      {home.pivotLeft && <AfterPivot home={home} left={home.pivotLeft} actions={actions} />}
      {lab.unreadable ? (
        // Refused rather than shown empty: an unread record drawn as "no bet
        // running" would invite a second bet beside the one running (invariant 13).
        <div className="cp-card">
          <div className="cp-eyebrow">Your bets</div>
          <div className="cp-error">Could not read your bets just now: {lab.unreadable}</div>
          <p className="cp-help">Nothing is shown rather than an empty record, and a new bet cannot start until it reads. Open the tab again in a minute.</p>
        </div>
      ) : (
        <>
          {lab.checkpoint.due && <Checkpoint d={d} actions={actions} />}
          <Station home={home} d={d} actions={actions} part={part} step={step} pick={setPicked} brief={brief} find={find} opened={opened} peopleShown={peopleShown} />
          {lab.current
            ? (
              <>
                {/* The bet's part carries the bet: the people it found first — the move says to reply to one — then the bet they count toward. */}
                {onBet && <People home={home} view={lab.current} actions={actions} find={find} opened={opened} />}
                {/* The bet keeps a slot of its own: errands on the go do not grey out the work it exists to move (commission.ts roomForProject). */}
                {onBet && <ThisBet key={lab.current.bet.id} home={home} d={d} view={lab.current} actions={actions} brief={brief} full={agentIsFull(home, lab.links[lab.current.bet.id] ?? [])} />}
                <Shelf home={home} d={d} actions={actions} />
              </>
            )
            : (
              // The person's own kept tests before the generic ones: what they wrote down to run next is what they came back for.
              <>
                <Shelf home={home} d={d} actions={actions} />
                <PickABet home={home} d={d} actions={actions} part={part} />
              </>
            )}
        </>
      )}
      <Built home={home} d={d} actions={actions} />
      <More home={home} d={d} actions={actions} />
    </>
  );
}

/* ─── Since you last looked ───────────────────────────────────────────────── */

/**
 * What this device last saw of the chain: each part's verdict and when. Read
 * once per visit, so what moved stays said while you look; written back every
 * time the chain changes. In an effect, never during render — the server has no
 * storage, and a first paint that differed from its render would not hydrate.
 * A convenience about the screen: nothing is decided from it, so storage that
 * keeps nothing costs only the "moved" line. The key is Work's, so what a
 * device saw there carries over.
 */
function useSeen(home: HomeData, d: Derived): ChainChange[] {
  const key = `cp2.work.seen:${home.profile.id}`;
  const prior = useRef<SeenChain | null | undefined>(undefined);
  const [changes, setChanges] = useState<ChainChange[]>([]);
  const { links } = d.proof.chain;
  const signature = links.map((l) => `${l.key}:${l.state}`).join(',');
  useEffect(() => {
    if (prior.current === undefined) {
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(key); } catch { /* storage refused: no memory, said by nothing moving */ }
      try { prior.current = parseSeenChain(raw ? JSON.parse(raw) : null); } catch { prior.current = null; }
    }
    setChanges(chainChanges(prior.current ?? null, links));
    try { window.localStorage.setItem(key, JSON.stringify(snapshotChain(home.generatedAt, links))); } catch { /* as above */ }
    // Keyed on the verdicts and on when the read was made: a refresh with the
    // same verdicts still moves "last looked" on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, key, home.generatedAt]);
  return changes;
}

/* ─── The move ────────────────────────────────────────────────────────────── */

/**
 * Which posts this device opened and has not answered, kept on the device. A
 * convenience about the screen — what to ask "did they answer?" about — and
 * nothing is decided from it: storage that keeps nothing costs only the
 * question. Read in an effect, never during render, so the first paint is the
 * server's.
 */
function useOpened(profileId: string) {
  const key = OPENED_KEY(profileId);
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      setMap(parseOpened(raw ? JSON.parse(raw) : null));
    } catch { /* storage refused or unreadable: nothing remembered, so nothing is asked */ }
  }, [key]);
  const save = (next: Record<string, string>) => {
    setMap(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* as above */ }
  };
  return {
    map,
    ids: new Set(Object.keys(map)),
    mark: (id: string) => save(markOpened(map, id, new Date().toISOString())),
    clear: (id: string) => save(clearOpened(map, id)),
  };
}
type Opened = ReturnType<typeof useOpened>;

/**
 * The search for the running bet's people, run from whichever card asks: the
 * move, or "Find more" under the people already found. One state, so a search
 * started in one place is seen in the other and cannot be started twice.
 */
function useFind(actions: Actions, betId: string | null) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const run = async () => {
    if (!betId || busy) return;
    setBusy(true); setError(null); setWhy(null);
    const r = await actions.lab({ action: 'voices', bet: betId });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'The search did not run');
    // One of the two searches failing, or the model's words not used, is said beside what was found.
    if (r.why) setWhy(r.why);
  };
  return { busy, error, why, run };
}
type Find = ReturnType<typeof useFind>;

/** Scrolls to a card on this tab: the checkpoint, or the people found. */
function scrollToCard(id: string) {
  try { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* an older browser: the card is where it was */ }
}

/** The one move, read off the rows (engine.ts engineStep), and whether the people card is up to say what a search did. */
function useStep(home: HomeData, d: Derived, opened: Opened): { step: Step | null; peopleShown: boolean } {
  const { chain, found, lab } = d.proof;
  const view = lab.current;
  const b = view?.bet ?? null;
  const read = home.lab?.voices;
  const voices = view && b && betVoiced(b) ? betVoices(read, b, home.lab?.talks ?? []) : null;
  // Said the same way the route refuses it, so a button that could only be refused is not the step —
  // and not while the plan's Scout is searching, so a tap does not start a second search beside it.
  const searchRefusal = voices
    ? read?.unreadable
      ? 'The people found for this bet could not be read just now.'
      : stepBusy(lab.planRuns, 'find', d.now)
      ? SCOUT_SEARCHING
      : voiceRefusal({ running: true, voiced: true, searches: voices.searches, ready: !!home.hunting?.webReady, remaining: home.billing.matches.remaining })
    : null;
  const weak = chain.weak ? chain.links.find((l) => l.key === chain.weak) ?? null : null;
  const step = engineStep({
    today: home.recent.today, offerSet: !d.noOffer, unreadable: !!lab.unreadable,
    checkpoint: { due: lab.checkpoint.due, ended: lab.checkpoint.ended.length },
    current: view, talks: lab.talks, found: found.value, voices, opened: opened.ids, searchRefusal,
    shelf: lab.shelf, weak: weak ? { key: weak.key, label: weak.label, why: weak.why } : null,
    goal: payoffGoal(home.goals, home.recent.today),
  });
  return { step, peopleShown: !!voices && (voices.searches > 0 || !!read?.unreadable) };
}

function NextStep({ step, view, actions, brief, find, opened, peopleShown }: {
  step: Step; view: BetView | null; actions: Actions; brief: Brief; find: Find; opened: Opened; peopleShown: boolean;
}) {
  const move = useMove(actions, brief);
  const go = (g: StepGo) => {
    switch (g.to) {
      case 'offer': return actions.openSheet({ kind: 'offer' });
      case 'foundby': return actions.openSheet({ kind: 'foundby' });
      case 'checkpoint': return scrollToCard('cp2-checkpoint');
      case 'find': return void find.run();
      case 'people': return scrollToCard('cp2-people');
      // The one bet waits on this tab, ready to start: the move scrolls to it. The sheet is for when it is not drawn.
      case 'bet': return document.getElementById('cp2-nextbet') ? scrollToCard('cp2-nextbet') : actions.openSheet({ kind: 'bet', part: g.part });
      case 'shelf': return actions.openSheet({ kind: 'bet', shelf: g.id });
      case 'next': return view ? goTo(g.go, actions, view.bet.id) : undefined;
      case 'tab': return actions.setTab(g.tab);
      case 'post': return undefined;
    }
  };
  const p = step.primary;
  const searching = find.busy && p.go.to === 'find';
  const ask: LinkMove | null = step.claude ? { key: 'engine-ask', label: 'Think it through with Claude', by: 'claude', ask: step.claude } : null;
  // A search that failed or was cut short is said where it was asked — here, unless the people card is up to say it.
  const said = step.kind === 'find' && !peopleShown;
  return (
    <div className="cp2-ns-step">
      <div className="cp-eyebrow">{step.eyebrow}</div>
      <h2 className="cp2-ns-t">{step.title}</h2>
      {step.why && <p className="cp2-ns-why">{step.why}</p>}
      <div className="cp2-ns-do">
        {p.go.to === 'post' ? (
          // A real link, not a script's window.open: a popup blocker has no quarrel with a tap on an anchor.
          <a className="cp-btn primary" href={p.go.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => opened.mark((p.go as { voice: string }).voice)}>
            {p.label} <IconExternal />
          </a>
        ) : (
          <button className="cp-btn primary" disabled={searching} onClick={() => go(p.go)}>{searching ? 'Looking… about twenty seconds' : p.label}</button>
        )}
        {ask && (
          <button className="cp2-link muted" disabled={move.busy === ask.key} onClick={() => void move.run(ask)}>
            {move.busy === ask.key ? 'Gathering…' : 'Ask Claude'}
          </button>
        )}
      </div>
      {step.hint && <p className="cp-help">{step.hint}</p>}
      {said && find.error && <p className="cp-help cp2-err">{find.error}</p>}
      {said && find.why && <p className="cp-help">{find.why[0].toUpperCase() + find.why.slice(1)}.</p>}
      {ask && move.note?.key === ask.key && <MoveNote note={move.note} />}
      {step.payoff && (
        <p className="cp2-ns-pay">
          {step.payoff.line}
          {step.payoff.link && <> <button className="cp2-link" onClick={() => go(step.payoff!.link!.go)}>{step.payoff.link.label}</button></>}
        </p>
      )}
    </div>
  );
}

/* ─── The engine ──────────────────────────────────────────────────────────── */

/**
 * The business at a glance: what it sells, the count that proves it, the five
 * parts in order with the track lit through every part that works and stopping
 * at the first that does not — the constraint — and the crew working them. A
 * part is a tap: it opens below, in place.
 */
function EngineHero({ home, d, actions, part, pick, changes }: {
  home: HomeData; d: Derived; actions: Actions; part: LinkKey; pick: (k: LinkKey) => void; changes: ChainChange[];
}) {
  const { chain, count, crew, crewLine } = d.proof;
  const head = crewHeadline(crew);
  const sells = home.profile.offer?.sells?.trim() || null;
  const fig = engineFigure(chain.verdict, count, count.price != null ? moneyLabel(count.price, d.currency) : null, !d.noOffer);
  // Lit from the first part through each that works, up to the first that does not.
  const runs = chain.links.findIndex((l) => l.state !== 'works');
  const lit = runs === -1 ? chain.links.length - 1 : runs;
  return (
    <section className="cp2-er-hero" aria-label="Your engine">
      <div className="cp2-er-top">
        <span className="cp2-er-name cp2-clamp1">{sells ?? 'Your engine'}</span>
        <span className={`cp2-er-chip${fig.chip === 'Proven' ? ' proven' : ''}`}>{fig.chip}</span>
      </div>
      {fig.n != null && (
        <div className="cp2-er-fig">
          <b>{fig.n}</b>
          {fig.of != null && <span className="cp2-er-of">/{fig.of}</span>}
          <span className="cp2-er-unit">{fig.unit}</span>
        </div>
      )}
      <p className="cp2-er-line">{fig.line}</p>
      <ol className="cp2-er-parts" style={{ '--lit': `${lit * 20}%` } as React.CSSProperties} aria-label="The five parts of the business">
        {chain.links.map((l) => {
          const weak = chain.weak === l.key;
          return (
            <li key={l.key}>
              <button
                className={`cp2-er-part ${l.state}${weak ? ' weak' : ''}${part === l.key ? ' on' : ''}`}
                aria-pressed={part === l.key} onClick={() => pick(l.key)}
                aria-label={`${l.label}, ${LINK_STATE_LABEL[l.state]}${weak ? ', the weakest part' : ''}`}
              >
                <span className="cp2-er-flag" aria-hidden>{weak ? 'Weakest' : ''}</span>
                <i className="cp2-er-node" aria-hidden />
                <span className="cp2-er-pname">{l.label}</span>
                {/* The word travels with the dot — a colour alone is not a verdict. */}
                <span className="cp2-er-pstate">{LINK_STATE_LABEL[l.state]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* Past seven faces the line goes under them: beside ten, it was a column one word wide. */}
      <button className={`cp2-er-crew${crew.length > 7 ? ' wide' : ''}`} onClick={() => actions.openSheet({ kind: 'crew' })} aria-label={`Your crew: ${crewLine.line}`}>
        <span className="cp2-er-faces" aria-hidden>
          {crew.map((w) => <span key={w.key} className={`cp2-er-face ${w.kind} ${w.state}`}><WorkerGlyph w={w} /><i /></span>)}
        </span>
        {/* What runs without you, then what is not well — a line each beside the faces; the sheet names every one. */}
        <span className="cp2-er-crewline">
          <span>{head.working}</span>
          {head.trouble && <span className="bad">{head.trouble}</span>}
        </span>
        <IconChevron />
      </button>
      {/* The engine moving, said: a part whose verdict changed since this device last looked. */}
      {changes.length > 0 && (
        <p className="cp2-er-moved">
          Since you last looked: {changes.slice(0, 2).map(changeLine).join('; ')}{changes.length > 2 ? `; and ${changes.length - 2} more` : ''}.
        </p>
      )}
    </section>
  );
}

/**
 * The part opened: its state and the rule behind it, the move when the move is
 * here, who works it, and what would move it. The bet's own cards follow it
 * when the bet is on this part; a move on another part is one tap away.
 */
function Station({ home, d, actions, part, step, pick, brief, find, opened, peopleShown }: {
  home: HomeData; d: Derived; actions: Actions; part: LinkKey; step: Step | null; pick: (k: LinkKey) => void;
  brief: Brief; find: Find; opened: Opened; peopleShown: boolean;
}) {
  const { chain, crew, lab } = d.proof;
  const move = useMove(actions, brief);
  const l = chain.links.find((x) => x.key === part);
  if (!l) return null;
  const i = chain.links.indexOf(l);
  const weak = chain.weak === part;
  const here = step && step.part === part ? step : null;
  const there = step && step.part && step.part !== part ? step : null;
  const betHere = lab.current?.bet.part === part ? lab.current : null;
  const said = !!here?.why && l.why.startsWith(here.why.replace(/…$/, ''));
  const on = crewOn(crew, part);
  const full = agentIsFull(home);
  // The move above already is "Bet on how they hear"; the same words again under it read as a second thing to do.
  const moves = here ? l.moves.filter((m) => m.label !== here.title) : l.moves;
  return (
    <section className={`cp-card cp2-er-station ${l.state}`} style={{ '--frac': i * 0.2 + 0.1 } as React.CSSProperties} aria-label={l.label}>
      <div className="cp2-er-shead">
        <h2>{l.label}</h2>
        <span className={`cp2-bz-state ${l.state}`}><i />{LINK_STATE_LABEL[l.state]}</span>
      </div>
      {/* The move first when it is on this part: the tab is opened to act, and its button belongs above the fold. */}
      {here && <div className="cp2-er-move"><NextStep step={here} view={lab.current} actions={actions} brief={brief} find={find} opened={opened} peopleShown={peopleShown} /></div>}
      <div className="cp2-er-detail">
        <p className="cp2-er-why">
          {weak && <b>The weakest part. </b>}
          {/* A move that is "bet on this part" carries the part's own rule as its reason; said once is enough. */}
          {said ? (weak ? 'Nothing past it can be tested until it works.' : null) : l.why}
        </p>
        {l.what && <p className="cp2-er-what cp2-clamp2">{l.what}</p>}
        {/* Said once: the engine above already says where the count starts when it is the same pivot. */}
        {l.since && l.since !== chain.verdict.since && <p className="cp2-er-since">{l.since}</p>}
      </div>
      {there && (
        <button className="cp2-er-elsewhere" onClick={() => pick(there.part!)}>
          <span><b>Your move is on {LINK_LABEL[there.part!].toLowerCase()}:</b> {there.title}</span>
          <IconChevron />
        </button>
      )}
      {/* Who works it, each in their word. An agent that stopped is said on the part it stopped (invariant 13). */}
      {on.length > 0 && (
        <div className="cp2-er-oncrew">
          <span className="cp2-er-k">Who works it</span>
          <div className="cp2-er-chips">
            {on.map((w) => <CrewChip key={w.key} w={w} />)}
          </div>
          {l.runner.problem && <p className="cp2-bz-problem">{l.runner.problem}</p>}
        </div>
      )}
      {/* What would move it, while no bet is on it: the bet's own card holds the work for the part it is on. */}
      {!betHere && moves.length > 0 && (
        <div className="cp2-er-moves">
          <span className="cp2-er-k">What would move it</span>
          {moves.map((raw) => {
            const m = orChat(raw, full);
            return (
              <div key={m.key}>
                <MoveRow m={m} rerouted={m.by !== raw.by} busy={move.busy === m.key} onRun={() => void move.run(m, l.why)} />
                {move.note?.key === m.key && <MoveNote note={move.note} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** A worker as a chip: who, and in a word how it is. */
function CrewChip({ w }: { w: Worker }) {
  return (
    <span className={`cp2-er-chipw ${w.kind} ${w.state}`}>
      <span className={`cp2-er-face ${w.kind} ${w.state}`} aria-hidden><WorkerGlyph w={w} /><i /></span>
      <span>{w.name}</span>
      <em>{WORKER_STATE_LABEL[w.state]}</em>
    </span>
  );
}

/* ─── What a pivot on who buys left behind ────────────────────────────────── */

/** "a, b and c": a short list, said. */
const listWords = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');
const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The businesses, drafts and searches left over from the buyers the person
 * pivoted away from (era.ts pivotLeft), said once and answered by a tap: saving
 * the new offer rewrote every waiting draft from it, to the same old businesses,
 * and only the pivot says the buyers changed. Nothing is set aside for them.
 */
function AfterPivot({ home, left, actions }: { home: HomeData; left: NonNullable<HomeData['pivotLeft']>; actions: Actions }) {
  const [busy, setBusy] = useState<'aside' | 'keep' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = async (keep: boolean) => {
    setBusy(keep ? 'keep' : 'aside'); setError(null);
    const r = await actions.lab({ action: 'pivot_left', day: left.day, keep });
    setBusy(null);
    if (!r.ok) setError(r.error ?? 'Could not save that');
  };
  const forWho = home.profile.offer?.for_who?.trim();
  const said = [
    left.segments.length ? `Maps still searches for ${listWords(left.segments)} every night.` : null,
    left.businesses
      ? `${countOf(left.businesses, 'business', 'businesses')} found for those buyers ${left.businesses === 1 ? 'waits' : 'wait'} in Swipe${left.drafts ? `, ${countOf(left.drafts, 'draft', 'drafts')} written to them from your new offer` : ''}.`
      : null,
  ].filter(Boolean).join(' ');
  return (
    <div className="cp-card cp2-pv-left">
      <div className="cp-eyebrow">Since you pivoted who buys · {dayWords(left.day)}</div>
      <h2 className="cp2-lab-q">Still looking for the buyers you left</h2>
      <p className="cp2-pv-said">{said}</p>
      {forWho && <p className="cp2-pv-now">Your offer is for: <b>{forWho}</b></p>}
      <div className="cp2-pv-do">
        <button className="cp-btn primary" disabled={busy !== null} onClick={() => void answer(false)}>{busy === 'aside' ? 'Setting aside…' : 'Set them aside'}</button>
        <button className="cp2-link muted" disabled={busy !== null} onClick={() => void answer(true)}>{busy === 'keep' ? 'Saving…' : 'Keep them'}</button>
      </div>
      <p className="cp-help">
        {[left.drafts ? 'Those drafts are cancelled' : null, left.businesses ? 'those businesses leave Swipe' : null, left.segments.length ? 'Maps stops searching the old segments' : null]
          .filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase())}. What you sent, and what came back, stays in your history.
      </p>
      {error && <div className="cp-error">{error}</div>}
    </div>
  );
}

/* ─── Pivot or persevere ──────────────────────────────────────────────────── */

function Checkpoint({ d, actions }: { d: Derived; actions: Actions }) {
  const cp = d.proof.lab.checkpoint;
  const links = d.proof.chain.links;
  const [decision, setDecision] = useState<LabDecision | null>(null);
  const [part, setPart] = useState<LinkKey | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passed = cp.ended.filter((b) => b.state === 'passed').length;
  const back = cp.last ? gradeWords(cp.last, cp.grade) : null;

  const decide = async () => {
    if (!decision || (decision === 'pivot' && !part)) return;
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'checkpoint',
      // The chain as it stands, kept with the answer: the next checkpoint
      // reads the decision back against what the chain did after it — as
      // evidence, so a bet opened since is not read back as a step forward.
      checkpoint: { decision, part: decision === 'pivot' ? part : null, note: note.trim() || undefined, chain: Object.fromEntries(links.map((l) => [l.key, evidenceState(l)])) },
    });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not save that');
  };

  return (
    <div className="cp-card cp2-lab-check" id="cp2-checkpoint">
      <div className="cp-eyebrow">Checkpoint</div>
      <h2 className="cp2-lab-q">Pivot or persevere?</h2>
      <p className="cp2-lede">
        {cp.last ? `Since ${dayWords(cp.last.on)}` : 'So far'}, {cp.ended.length} {cp.ended.length === 1 ? 'bet' : 'bets'} ended and {passed} passed.
      </p>
      <div className="cp2-lab-check-list">
        {cp.ended.map((v) => (
          <div key={v.bet.id} className="cp2-lab-check-bet">
            <span className={`cp2-lab-verdict ${v.state}`}>{BET_STATE_LABEL[v.state]}</span>
            <span className="cp2-clamp2">{v.bet.belief}</span>
          </div>
        ))}
      </div>
      {cp.last && (
        <p className="cp2-lab-readback">
          <b>Last time, {dayWords(cp.last.on)}: {decisionWords(cp.last)}.</b>{back ? ` ${back}` : ''}
          {cp.last.note ? ` You wrote: “${cp.last.note}”` : ''}
        </p>
      )}
      {cp.moved.length > 0 && (
        <p className="cp2-lab-moved">
          Since then: {cp.moved.slice(0, 2).map(changeLine).join('; ')}{cp.moved.length > 2 ? `; and ${cp.moved.length - 2} more` : ''}.
        </p>
      )}

      <div className="cp2-lab-decide">
        <button className={`cp2-lab-opt${decision === 'persevere' ? ' on' : ''}`} aria-pressed={decision === 'persevere'} onClick={() => setDecision('persevere')}>
          <b>Persevere</b>
          <span>Keep the belief. The next bet tests it harder.</span>
        </button>
        <button className={`cp2-lab-opt${decision === 'pivot' ? ' on' : ''}`} aria-pressed={decision === 'pivot'} onClick={() => setDecision('pivot')}>
          <b>Pivot</b>
          <span>Change one part, and the next bet tests the change.</span>
        </button>
      </div>
      {decision === 'pivot' && (
        <div className="cp-field">
          <label className="cp-label">Which part changes</label>
          <div className="cp-chips">
            {links.map((l) => (
              <button key={l.key} className={`cp-fchip ${part === l.key ? 'active' : ''}`} aria-pressed={part === l.key} onClick={() => setPart(l.key)}>{l.label}</button>
            ))}
          </div>
          {part && <p className="cp-help">{pivotWords(part)} count from today. What came before stays in History and is said on its part.</p>}
        </div>
      )}
      {decision && (
        <div className="cp-field">
          <label className="cp-label" htmlFor="cp2-pf-why">Why, in a line — optional</label>
          <input id="cp2-pf-why" className="cp-input sm" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Pest control answered; salons never did" />
        </div>
      )}
      {error && <div className="cp-error">{error}</div>}
      {decision && (
        <button className="cp-btn primary block" disabled={busy || (decision === 'pivot' && !part)} onClick={() => void decide()}>
          {busy ? 'Saving…' : decision === 'persevere' ? 'Persevere' : part ? `Pivot ${LINK_LABEL[part].toLowerCase()}` : 'Pick the part'}
        </button>
      )}
    </div>
  );
}

/* ─── The bet running ─────────────────────────────────────────────────────── */

/** Where each count's next one happens, as a tap from the bet. */
function goTo(go: BetNextGo, actions: Actions, betId: string) {
  if (go === 'swipe') actions.setTab('swipe');
  else if (go === 'replied') actions.openSheet({ kind: 'outreach', stage: 'replied' });
  else if (go === 'talk') actions.openSheet({ kind: 'talk' });
  else if (go === 'sale') actions.openSheet({ kind: 'sale', outcome: 'won' });
  else if (go === 'meeting') actions.openSheet({ kind: 'sale', outcome: 'meeting' });
  else if (go === 'count') actions.openSheet({ kind: 'count', bet: betId });
  else actions.openSheet({ kind: 'projects' });
}

const pctOf = (n: number, of: number) => Math.min(100, Math.round((n / Math.max(1, of)) * 100));

function ThisBet({ home, d, view, actions, brief, full }: { home: HomeData; d: Derived; view: BetView; actions: Actions; brief: Brief; full: boolean }) {
  const b = view.bet;
  const today = home.recent.today;
  const found = d.proof.found.value;
  const play = playOf(b);
  // The plan, read off the rows (betplan.ts): the work under the count, never the count.
  const plan = d.proof.lab.plan;
  const pv = plan ? planView(plan, planInputOf(home, view, d.now)) : null;
  const work = betWork(view, { links: d.proof.lab.links, commissions: home.commissions, assets: d.proof.assets, talks: d.proof.lab.talks, tallies: d.proof.lab.tallies });
  // What a step of the plan already shows is not listed again under the work for the bet.
  const inPlan = new Set((pv?.steps ?? []).flatMap((s) => [s.project, s.asset]).filter((x): x is string => !!x));
  const workLeft = { ...work, projects: work.projects.filter((t) => !inPlan.has(t.commission.id)), assets: work.assets.filter((a) => !inPlan.has(a.id)) };
  const next = betNext(b.metric, found, b.unit);
  const over = overPlan(view);
  // The funnel up to the line, counted since the bet began: something to read on day one, when the bar is empty.
  const rungs = rungsOf(view, found);
  const planInRungs = rungs.length > 1 && rungs.some((r) => r.planned != null);
  // A bet decided by a sale but planned in conversations still needs its log one tap away.
  const logToo = b.tries?.metric === 'talks' && next.go !== 'talk';
  // Reached by outreach, a sale still comes in from outside the app sometimes — a referral, a walk-in.
  const saleToo = next.go === 'replied' && (b.metric === 'paid' || b.metric === 'paid_at_price');
  const [stopping, setStopping] = useState(false);
  // How it is counted, the play's method and the hand-over box: read once, and
  // between them the card ran two screens tall on a phone, with what to do next
  // at the very bottom. Folded under one line that names the play.
  const [more, setMore] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    setBusy(true); setError(null);
    const r = await actions.lab({ action: 'stop', id: b.id, note: note.trim() || undefined });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not call it off');
  };

  return (
    <div className="cp-card cp2-lab-bet">
      <div className="cp-call-top">
        <div className="cp-eyebrow">This bet · day {view.day} of {b.days}{view.last === today ? ' · last day' : ''}</div>
        <span className="cp2-lab-partname">{LINK_LABEL[b.part]}</span>
      </div>
      <h2 className="cp2-lab-belief">&ldquo;{b.belief}&rdquo;</h2>

      <div className="cp2-lab-score">
        <span className="cp2-lab-n"><b>{view.result}</b> of {b.target}</span>
        <span className="cp2-lab-unit">{metricWords(b.metric, b.target, b.priceLabel, b.unit)}</span>
      </div>
      <div className="cp2-lab-bar" role="progressbar" aria-label="Toward the pass line" aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={Math.min(view.result, b.target)}>
        <i style={{ width: `${pctOf(view.result, b.target)}%` }} />
      </div>
      {/* The rungs before the line. The line's own rung is the score above, and
          "0 of 3 commitments" over a "0/3 committed" chip said one count twice. */}
      {rungs.length > 1 && <Reading view={view} rungs={rungs.filter((r) => !r.line)} found={found} />}
      {/* The plan has its place on the ladder when the ladder holds it; shown twice it would read as two plans. */}
      {b.tries && view.tries != null && !planInRungs && (
        <div className="cp2-pf-tries">
          <span>{view.tries} of {b.tries.planned} {metricWords(b.tries.metric, b.tries.planned)}</span>
          <span className="cp2-pf-tries-bar" aria-hidden><i style={{ width: `${pctOf(view.tries, b.tries.planned)}%` }} /></span>
        </div>
      )}
      <p className="cp2-lab-pass"><b>Pass line:</b> {passLine(b, view.last)}.</p>
      {over && <p className="cp2-lab-over">{over}</p>}
      {pv
        ? <BetPlan home={home} view={view} pv={pv} actions={actions} brief={brief} />
        : !d.proof.lab.unreadable && <PlanIt view={view} steps={planFor(b, planCapsOf(home), home.profile.offer ?? {})} actions={actions} />}

      <button className="cp2-lab-more" onClick={() => setMore((v) => !v)} aria-expanded={more}>
        {/* The play's own name, which fits a line; its book is said inside. */}
        <span className="cp2-clamp1">{play ? play.label : 'How it is counted'}</span>
        <span className={`cp2-plan-chev${more ? ' open' : ''}`}><IconChevron /></span>
      </button>
      {more && (
        <div className="cp2-lab-morebody">
          <p className="cp2-lab-src">{countedFrom(b.metric, b.start, b.priceLabel, b.unit, !!home.signals?.made, !!home.page?.live)}</p>
          {play && (
            <div className="cp2-lab-playing">
              <span className="cp2-lab-book">From {play.from}</span>
              <p>{play.how}</p>
            </div>
          )}
          {home.workerConnected && <HandOver view={view} actions={actions} full={full} />}
          <BetWorkList view={view} work={workLeft} home={home} actions={actions} />
          {/* A plan's draft or project is this bet's "get it ready", already on the plan. */}
          {!plan && <Prep home={home} view={view} work={work} actions={actions} brief={brief} full={full} canDraft={!!home.ai && !d.noOffer} />}
        </div>
      )}

      {stopping ? (
        <div className="cp2-lab-stop">
          <p>Call it off? It stays in your history as called off, with what it counted until today.</p>
          <input className="cp-input sm" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="What you learned — optional" aria-label="What you learned, optional" />
          {error && <div className="cp-error">{error}</div>}
          <div className="cp-btn-row">
            <button className="cp-btn" disabled={busy} onClick={() => void stop()}>{busy ? 'Calling it off…' : 'Call it off'}</button>
            <button className="cp-btn primary" disabled={busy} onClick={() => { setStopping(false); setError(null); }}>Keep it running</button>
          </div>
        </div>
      ) : (
        <div className="cp2-lab-actions">
          {/* The step at the top of the tab is the one primary button on this screen; this one is the same count's way in, close to where the bet ends. */}
          <button className="cp-btn" onClick={() => goTo(next.go, actions, b.id)}>{next.label}</button>
          {logToo && <button className="cp-btn" onClick={() => actions.openSheet({ kind: 'talk' })}>Log a conversation</button>}
          {saleToo && <button className="cp-btn" onClick={() => actions.openSheet({ kind: 'sale', outcome: 'won' })}>Log a sale</button>}
          <button className="cp2-link muted" onClick={() => setStopping(true)}>Call it off</button>
        </div>
      )}
    </div>
  );
}

/**
 * What the funnel counted since the bet began, step by step to the line — so a
 * bet decided on a sale says something on day one. Not the verdict: the bar above
 * is that, and nothing here moves it (reading.ts).
 */
function Reading({ view, rungs, found }: { view: BetView; rungs: Rung[]; found: FoundBy | null }) {
  return (
    <ol className="cp2-rd" aria-label={readingLine(view, found) ?? 'Counted since the bet began'}>
      {rungs.map((r) => (
        <li key={r.metric} className={`cp2-rd-step ${r.state}${r.line ? ' line' : ''}`}>
          <b>{r.n}{r.target != null ? <i>/{r.target}</i> : r.planned != null ? <i>/{r.planned}</i> : null}</b>
          <span>{r.label}</span>
        </li>
      ))}
    </ol>
  );
}


/** The work done for the bet, from the rows that say so. Nothing here is a claim the app made about itself. */
function BetWorkList({ view, work, home, actions }: { view: BetView; work: BetWork; home: HomeData; actions: Actions }) {
  const b = view.bet;
  // Conversations are not listed here: the score above counts them, "Behind it"
  // lists them, and a row for one repeated both.
  if (!work.projects.length && !work.assets.length && !work.tallies) return null;
  return (
    <div className="cp2-pf-work">
      <span className="cp2-pf-k">Working on this bet</span>
      {work.projects.map((t) => {
        const chip = commissionChip(t.commission, t.report);
        const p = t.report.progress;
        return (
          <button key={t.commission.id} className="cp2-pf-wrow" onClick={() => actions.openSheet({ kind: 'commission', id: t.commission.id })}>
            <span className="cp2-pf-glyph ai"><MatchGlyph group="work" /></span>
            <span className="cp2-pf-wmain">
              <b className="cp2-clamp2">{t.commission.objective}</b>
              <span>Your agent · <i className={`cp2-pf-chip ${chip.tone}`}>{t.commission.status === 'draft' ? 'Waiting for your OK' : chip.label}</i>{p.total > 0 && t.commission.status !== 'draft' ? ` · ${p.done} of ${p.total} done` : ''}</span>
            </span>
            <IconChevron />
          </button>
        );
      })}
      {work.assets.map((a) => {
        // The version made for this bet, which is not always the one in use: an offer the AI rewrote for it waits on the person.
        const v = a.versions.find((x) => x.bet === b.id) ?? a.current;
        return (
          <button key={a.id} className="cp2-pf-wrow" onClick={() => actions.openSheet({ kind: 'asset', id: a.id })}>
            <span className={`cp2-pf-glyph ${v.by}`}><AssetGlyph kind={a.kind} /></span>
            <span className="cp2-pf-wmain">
              <b className="cp2-clamp2">{v.title}</b>
              <span>{ASSET_LABEL[a.kind]} · v{v.n} · {v.by === 'ai' ? 'by AI' : 'by you'}{a.kind === 'offer' ? (a.live === v.n ? ' · in use' : ' · not your offer yet') : ''}</span>
            </span>
            <IconChevron />
          </button>
        );
      })}
      {work.tallies && (
        <button className="cp2-pf-wrow" onClick={() => actions.openSheet({ kind: 'count', bet: b.id })}>
          <span className="cp2-pf-glyph"><IconCheck /></span>
          <span className="cp2-pf-wmain">
            <b>{work.tallies.total} {metricWords('logged', work.tallies.total, null, b.unit)} logged</b>
            <span>{work.tallies.last ? `Last on ${dayWords(work.tallies.last.on)}${home.recent.today === work.tallies.last.on ? ', today' : ''}` : 'None logged yet: your count, not the app’s'}</span>
          </span>
          <IconChevron />
        </button>
      )}
    </div>
  );
}

/** Posts shown before "more": three people is a morning's replies; the rest wait behind a tap. */
const VOICES_SHOWN = 3;

/**
 * People who said it (voices.ts): public posts where somebody says the bet's
 * problem in their own words, each with its link, for the person to answer from
 * their own account. Its own card, above the bet: the step at the top says to
 * reply to one, and the bet is what they count toward. Nothing is sent from
 * here (invariant 4).
 *
 * Each post goes through three states, each a tap. Not opened: Open, or Not a
 * fit. Opened — on this device — it asks "Did they answer?": one tap on how it
 * ended logs the conversation, named for the post, and the post leaves; no
 * answer is nothing to do. The full sheet is still there for the detail.
 */
function People({ home, view, actions, find, opened }: { home: HomeData; view: BetView; actions: Actions; find: Find; opened: Opened }) {
  const b = view.bet;
  const today = home.recent.today;
  const read = home.lab?.voices;
  const mine = betVoices(read, b, home.lab?.talks ?? []);
  // "Find more" stands down while the plan's Scout searches: two at once would spend two of the bet's three.
  const refusal = stepBusy(home.lab?.planRuns ?? [], 'find', new Date(home.generatedAt))
    ? SCOUT_SEARCHING
    : voiceRefusal({ running: true, voiced: betVoiced(b), searches: mine.searches, ready: !!home.hunting?.webReady, remaining: home.billing.matches.remaining });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // Which opened post is being asked how it ended: one at a time, so a stray tap cannot log the wrong one.
  const [ending, setEnding] = useState<string | null>(null);
  if (!betVoiced(b)) return null;
  // Nothing found and nothing said: the step above leads, and a card of nothing would only repeat it.
  if (mine.searches === 0 && !read?.unreadable) return null;

  const gone = async (v: Voice) => {
    setBusy(v.id); setError(null);
    const r = await actions.lab({ action: 'voice_gone', voice: v.id });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not set it aside');
    opened.clear(v.id);
  };
  // The conversation, kept with the one tap: who it was with is their post's name, and the ending is theirs.
  const logIt = async (v: Voice, commitment: Commitment) => {
    setBusy(v.id); setError(null);
    const r = await actions.lab({ action: 'talk', talk: voiceTalk(v, commitment) });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not log that');
    opened.clear(v.id);
    setEnding(null);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(VOICE_OPENER); setCopied('Copied. Change it to fit their post.'); }
    catch { setCopied('Your browser did not let it be copied. Select the words and copy them from there.'); }
  };
  // The ones opened and not answered come first: they are the ones waiting on this person.
  const rows = [...mine.open.filter((v) => opened.ids.has(v.id)), ...mine.open.filter((v) => !opened.ids.has(v.id))];
  const shown = all ? rows : rows.slice(0, VOICES_SHOWN);

  return (
    <div className="cp-card cp2-vox-card" id="cp2-people">
      <div className="cp2-vox-top">
        <div className="cp-eyebrow">People who said it</div>
        {mine.found > 0 && <span className="cp2-vox-count">{mine.talked ? `${mine.talked} of ${mine.found} talked to` : `${mine.found} found`}</span>}
      </div>
      {read?.unreadable && <p className="cp-help cp2-err">The people found for this bet could not be read just now: {read.unreadable}</p>}
      {mine.open.length > 0 && (
        <div className="cp2-vox-opener">
          <span>Open with their past, not your idea</span>
          <q>{VOICE_OPENER}</q>
          <button className="cp2-link" onClick={() => void copy()}>Copy it</button>
        </div>
      )}
      {copied && <p className="cp-help">{copied}</p>}
      {shown.map((v) => {
        const at = opened.map[v.id];
        const waiting = !!at;
        return (
          <div key={v.id} className={`cp2-vox-row${waiting ? ' waiting' : ''}`}>
            <b className="cp2-clamp2">{v.title}</b>
            {v.said && v.said !== v.title && <p className="cp2-vox-said">&ldquo;{v.said}&rdquo;</p>}
            <span className="cp2-vox-meta">{[v.where, postedWords(v.posted, today), v.author].filter(Boolean).join(' · ')}</span>
            {waiting && ending !== v.id && (
              <div className="cp2-vox-ask">
                <span>Opened {postedWords(dayIn(at, home.profile.timezone), today) ?? 'earlier'}. Did they answer?</span>
              </div>
            )}
            {ending === v.id && (
              <div className="cp2-vox-end" role="group" aria-label="How it ended">
                <span>How did it end?</span>
                <div className="cp-chips">
                  {COMMITMENTS.map((c) => (
                    <button key={c} className="cp-fchip" disabled={busy !== null} onClick={() => void logIt(v, c)}>{COMMITMENT_LABEL[c]}</button>
                  ))}
                </div>
                <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'talk', voice: v.id })}>Add detail instead</button>
              </div>
            )}
            <div className="cp2-vox-do">
              {waiting
                ? <button className="cp-btn sm primary" disabled={busy !== null} onClick={() => setEnding(ending === v.id ? null : v.id)}>They answered</button>
                : (
                  <a className="cp-btn sm primary" href={v.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open the post on ${v.where}`} onClick={() => opened.mark(v.id)}>
                    Open <IconExternal />
                  </a>
                )}
              {waiting && <a className="cp-btn sm" href={v.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open the post on ${v.where} again`}>Open again <IconExternal /></a>}
              <button className="cp2-link muted" disabled={busy !== null} onClick={() => void gone(v)}>{busy === v.id ? 'Saving…' : 'Not a fit'}</button>
            </div>
          </div>
        );
      })}
      {rows.length > VOICES_SHOWN && (
        <button className="cp2-pf-more" onClick={() => setAll((x) => !x)}>{all ? 'Fewer' : `${rows.length - VOICES_SHOWN} more`}</button>
      )}
      {mine.found > 0 && mine.open.length === 0 && <p className="cp-help">Everyone found is talked to or set aside.</p>}
      {mine.last && mine.last.kept === 0 && <p className="cp-help">The last search, {dayWords(mine.last.at.slice(0, 10))}, found nobody new.</p>}
      <div className="cp2-vox-go">
        {refusal
          ? <p className="cp-help">{refusal}</p>
          : <button className={`cp-btn sm${mine.open.length === 0 ? ' primary' : ''}`} disabled={find.busy} onClick={() => void find.run()}>
            {find.busy ? 'Looking… about twenty seconds' : `Find more · ${mine.searches} of ${VOICE_SEARCHES} searches`}
          </button>}
      </div>
      {find.why && <p className="cp-help">{find.why[0].toUpperCase() + find.why.slice(1)}.</p>}
      {find.error && <p className="cp-help cp2-err">{find.error}</p>}
      {error && <p className="cp-help cp2-err">{error}</p>}
      <p className="cp2-vox-src">Their words, from the post. Found by a web search for this bet; nothing is sent from the app.</p>
    </div>
  );
}

/**
 * What gets the bet ready, from the play or the idea behind it: an asset made
 * for this bet — drafted by AI or written by you, and kept with it — or a
 * project for the agent, or a chat. Gone once it exists, because it is then in
 * the work above.
 */
function Prep({ home, view, work, actions, brief, full, canDraft }: { home: HomeData; view: BetView; work: BetWork; actions: Actions; brief: Brief; full: boolean; canDraft: boolean }) {
  const b = view.bet;
  const move = useMove(actions, brief);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cat = b.play ? PLAY_BY_KEY.get(b.play) ?? null : null;
  const asset: AssetKind | null = cat?.prep?.asset ?? b.idea?.prep?.asset ?? null;
  const label = cat?.prep?.label ?? b.idea?.prep?.label ?? null;
  if (!label) return null;

  if (asset) {
    if (work.assets.some((a) => a.kind === asset)) return null;
    const draft = async () => {
      setBusy(true); setError(null);
      const r = await actions.assets({ action: 'draft', kind: asset, bet: b.id });
      setBusy(false);
      if (!r.ok) return setError(r.error ?? 'Could not draft it');
      if (r.id) actions.openSheet({ kind: 'asset', id: r.id });
    };
    const yours = () => (asset === 'offer' ? actions.openSheet({ kind: 'offer', bet: b.id }) : actions.openSheet({ kind: 'asset', assetKind: asset, bet: b.id }));
    return (
      <div className="cp2-lab-prep">
        <span className="cp2-lab-prep-k">Get it ready</span>
        <div className="cp2-pf-wrow static">
          <span className="cp2-pf-glyph"><AssetGlyph kind={asset} /></span>
          <span className="cp2-pf-wmain">
            <b>{label}</b>
            <span>{asset === 'offer' ? 'A version of your offer for this bet, kept in its history' : `${ASSET_LABEL[asset]}, made for this bet and kept with it`}</span>
          </span>
        </div>
        <div className="cp2-pf-prep-do">
          {/* No model, or no offer to write from (invariant 1): no button that could only be refused. */}
          {canDraft && <button className="cp-btn sm primary" disabled={busy} onClick={() => void draft()}>{busy ? 'Drafting…' : 'Draft it with AI'}</button>}
          <button className="cp-btn sm" disabled={busy} onClick={yours}>{asset === 'offer' ? 'Edit it yourself' : 'Write it yourself'}</button>
        </div>
        {error && <p className="cp-help cp2-err">{error}</p>}
      </div>
    );
  }

  const ask = cat?.prep?.ask ?? null;
  // The same work already handed over — tied to the bet, or by the Lab before ties were kept — said in place of the button.
  if (ask && home.commissions.some((t) => t.commission.objective === ask && t.commission.status !== 'stopped')) return null;
  const raw: LinkMove = { key: `prep-${b.id}`, label, by: cat?.prep?.by === 'ai' && home.workerConnected ? 'ai' : 'claude', ask: ask ?? label };
  const m = orChat(raw, full);
  const why = `For the bet "${b.belief}"${playOf(b) ? `, run as ${playOf(b)!.label} (${playOf(b)!.from})` : ''}.`;
  const tie = async (id: string) => {
    const r = await actions.lab({ action: 'link', bet: b.id, commission: id });
    if (!r.ok) setError(`Handed over, but not tied to this bet: ${r.error ?? 'it did not save'}. It is under Projects.`);
  };
  return (
    <div className="cp2-lab-prep">
      <span className="cp2-lab-prep-k">Get it ready</span>
      <MoveRow m={m} rerouted={m.by !== raw.by} busy={move.busy === m.key} onRun={() => void move.run(m, why, tie, b.id)} />
      {move.note?.key === m.key && <MoveNote note={move.note} />}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/** Part of the bet, handed to the agent as a project tied to it. Only where a worker can pick it up; the full box is under Projects. */
function HandOver({ view, actions, full }: { view: BetView; actions: Actions; full: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    const objective = text.trim();
    if (!objective) return;
    setBusy(true); setError(null);
    // As the bet's own: it takes the slot the bet keeps, and the server ties it to the bet.
    const r = await actions.createCommission({ objective, why: `For the bet "${view.bet.belief}".`.slice(0, 300), authority: 'read', bet: view.bet.id });
    setBusy(false);
    if (!r.ok || !r.id) return setError(r.error ?? 'Could not hand that over');
    setText('');
    // Said, not swallowed: a project the bet does not know about is still a project, under Projects.
    if (!r.tied) return setError(`Handed over, but not tied to this bet: ${r.untied ?? 'it did not save'}. It is under Projects.`);
    actions.openSheet({ kind: 'commission', id: r.id });
  };
  return (
    <div className="cp2-pf-hand">
      <div className="cp2-pf-hand-row">
        <input
          className="cp-input sm" value={text} maxLength={OBJECTIVE_MAX} placeholder="Hand part of this bet over…" aria-label="Hand part of this bet over"
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void go(); }}
        />
        <button className="cp-btn sm primary" disabled={!text.trim() || busy || full} onClick={() => void go()}>{busy ? 'Writing…' : 'Hand over'}</button>
      </div>
      {/* Full here means the bet's own slot is taken too: another project for it is already on the go. */}
      {full && <p className="cp-help">A project for this bet is already on the go, and so are {MAX_ACTIVE_COMMISSIONS} others. Finish or stop one to hand over another.</p>}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/* ─── The shelf ───────────────────────────────────────────────────────────── */

/**
 * Tests kept for later, each with its belief, its line and where its play came
 * from. They wait here, not in a chat: a test somebody wrote down is the cheapest
 * kind to start, and one bet runs at a time because two share every count — so
 * Start is only offered when the slot is free, and the card says why when it is
 * not. Nothing here is scored or ranked: an idea on the shelf is a test with a
 * line, and the rows are what judge it once it is started.
 *
 * While a bet runs this is the only way into the bet sheet — the picker is not
 * shown — and that is when new ideas arrive, so it carries its own way to keep
 * one: the sheet says one bet at a time, leaves Start off, and keeps Keep.
 */
function Shelf({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const shelf = d.proof.lab.shelf;
  const running = !!d.proof.lab.current;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!shelf.length && !running) return null;
  const { priceLabel } = betPrice(home.profile.offer?.price_band, d.currency);
  const keep = (
    <button className="cp2-lab-own" onClick={() => actions.openSheet({ kind: 'bet', part: d.proof.chain.weak ?? undefined })}>
      <span>{shelf.length ? 'Keep another idea for later' : 'Keep an idea for later'}</span>
      <IconChevron />
    </button>
  );
  // Nothing on it and a bet running: no card for an empty shelf, only the way to put something on it.
  if (!shelf.length) return <div className="cp2-shelf-solo">{keep}</div>;
  const off = async (id: string) => {
    setBusy(id); setError(null);
    const r = await actions.lab({ action: 'unshelve', id });
    setBusy(null);
    if (!r.ok) setError(r.error ?? 'Could not take it off');
  };
  return (
    <div className="cp-card cp2-shelf">
      <div className="cp-eyebrow">On your shelf · {shelf.length}</div>
      <p className="cp2-shelf-s">
        {running ? 'Each waits with its test written. One bet runs at a time, so the next starts when this one ends.' : 'Each waits with its test written. Start one, or write another below.'}
      </p>
      {shelf.map((e) => {
        const play = playOf(e);
        return (
          <div key={e.id} className="cp2-shelf-row">
            <span className="cp2-shelf-part">{LINK_LABEL[e.part]}</span>
            <b className="cp2-clamp2">{e.belief}</b>
            <span className="cp2-shelf-line">{playLine(e, priceLabel)}</span>
            {play && <span className="cp2-shelf-from">{play.from} · {play.label}</span>}
            <div className="cp2-shelf-do">
              {!running && <button className="cp-btn sm primary" disabled={busy === e.id} onClick={() => actions.openSheet({ kind: 'bet', shelf: e.id })}>Start it</button>}
              <button className="cp2-link muted" disabled={busy === e.id} onClick={() => void off(e.id)}>{busy === e.id ? 'Taking off…' : 'Take off'}</button>
            </div>
          </div>
        );
      })}
      {running && keep}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/* ─── No bet running ──────────────────────────────────────────────────────── */

/**
 * When no bet runs: one bet, ready to start — the best idea written for this
 * part, else the first play from the books (proof.ts nextBet) — with its line
 * set, what it tests, how it would work and what starts with it. One tap starts
 * it as it stands; "Change it first" opens the sheet. Every other idea, the
 * books' plays and a bet of your own wait behind "Show other bets": the list
 * this replaced was a reading assignment where a decision was wanted.
 */
function PickABet({ home, d, actions, part }: { home: HomeData; d: Derived; actions: Actions; part: LinkKey }) {
  const { found, lab } = d.proof;
  const [others, setOthers] = useState(false);
  // A part tapped in the engine is a new bet to offer, with the others folded again.
  useEffect(() => setOthers(false), [part]);
  const last = lab.learned[0] ?? null;
  const { priceLabel } = betPrice(home.profile.offer?.price_band, d.currency);
  const set = lab.ideas[part] ?? null;
  const top = nextBet({ part, set, found: found.value });
  const topKey = top ? (top.kind === 'idea' ? top.idea.key : top.play.key) : null;
  const plays = playsFor(part, found.value).filter((p) => p.key !== topKey);
  const moreIdeas = (set?.ideas ?? []).filter((x) => x.key !== topKey).length;
  const count = [moreIdeas ? `${moreIdeas} more ${moreIdeas === 1 ? 'idea' : 'ideas'}` : null, plays.length ? `${plays.length} from books` : null, 'your own'].filter(Boolean).join(' · ');
  return (
    <div className="cp-card cp2-pf-pick" id="cp2-nextbet">
      <div className="cp-eyebrow">No bet running · {LINK_LABEL[part]}</div>
      {last && (
        <p className="cp2-lab-lastbet">
          <span className={`cp2-lab-verdict ${last.state}`}>{BET_STATE_LABEL[last.state]}</span>
          <span>Last bet: {last.result} of {last.bet.target} {metricWords(last.bet.metric, last.bet.target, last.bet.priceLabel, last.bet.unit)}{last.ended ? `, ${dayWords(last.ended)}` : ''}</span>
        </p>
      )}
      {top
        ? <NextBetCard key={`${part}:${topKey}`} home={home} d={d} actions={actions} part={part} top={top} priceLabel={priceLabel} />
        : <h2 className="cp2-lab-q">What do you believe that you have not tested?</h2>}
      {/* Mounted while folded: it asks for ideas on opening, and says when they are being written or failed. */}
      <Ideas home={home} d={d} actions={actions} part={part} priceLabel={priceLabel} skip={topKey} open={others} />
      <button className="cp2-pf-more" onClick={() => setOthers((x) => !x)} aria-expanded={others}>
        {others ? 'Fewer bets' : `Show other bets · ${count}`}
      </button>
      {others && plays.length > 0 && <span className="cp2-pf-k cp2-pf-books">From books</span>}
      {others && plays.length > 0 && (
        <div className="cp2-pf-plays">
          {plays.map((p) => <PlayCard key={p.key} play={p} priceLabel={priceLabel} actions={actions} />)}
        </div>
      )}
      {others && (
        <button className="cp2-lab-own" onClick={() => actions.openSheet({ kind: 'bet', part })}>
          <span>Write your own bet on {LINK_LABEL[part].toLowerCase()}</span>
          <IconChevron />
        </button>
      )}
    </div>
  );
}

/**
 * The one bet, as it would start: what you would be testing, the line, how it
 * would work and what a fail would say, the pages it rests on, and what starts
 * with it (the same plan the bet sheet shows, from the same rule). Start sends
 * the request the sheet would send for it untouched (proof.ts nextBetRequest).
 */
function NextBetCard({ home, d, actions, part, top, priceLabel }: { home: HomeData; d: Derived; actions: Actions; part: LinkKey; top: NextBet; priceLabel: string | null }) {
  const offer = home.profile.offer ?? {};
  const found = d.proof.found.value;
  const belief = suggestBelief(part, offer, priceLabel, found);
  const req = nextBetRequest(top, part, belief);
  const p = top.kind === 'idea' ? top.idea : top.play;
  const idea = top.kind === 'idea' ? top.idea : null;
  const steps = planFor({ part, belief, play: req.play, idea: req.idea, metric: req.metric, unit: req.unit, tries: req.tries }, planCapsOf(home), offer);
  // A sale at your price with no price is refused at Start: said here, with the way to fix it, instead.
  const needsPrice = !!METRIC[req.metric].priced && priceLabel == null;
  // One word per card, sent with every try: the server answers a retry as it answered the tap (lab.ts openRace).
  const [nonce] = useState(newMoveId);
  const going = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (going.current) return;
    going.current = true;
    setBusy(true); setError(null);
    const r = await actions.lab({ action: 'open', nonce, bet: req });
    going.current = false;
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not start it');
  };
  const change = () => (top.kind === 'idea'
    ? actions.openSheet({ kind: 'bet', idea: top.idea.key, part })
    : actions.openSheet({ kind: 'bet', play: top.play.key }));
  return (
    <div className="cp2-nextbet">
      <span className="cp2-pf-src">
        {idea ? <><i className="cp2-owner ai">By AI</i>{idea.book ? <span>after {idea.book}</span> : null}</> : <span>{top.kind === 'play' ? top.play.book : ''}</span>}
      </span>
      <h2 className="cp2-lab-q">{p.label}</h2>
      <p className="cp2-lab-play-how">{p.how}</p>
      {idea && <IdeaReasons idea={idea} />}
      {top.kind === 'idea' && top.pick && <p className="cp2-pf-why"><b>Why this one first:</b> {top.pick}</p>}
      <div className="cp2-lab-preview">
        <span className="cp2-lab-preview-k">You would be testing</span>
        <b>&ldquo;{belief}&rdquo;</b>
        <span className="cp2-lab-preview-s">Pass line: {playLine(p, priceLabel)}. Only what happens after you start counts.</span>
      </div>
      <PlanPreview steps={steps} />
      {needsPrice ? (
        <div className="cp-note cp2-lab-warn">
          A sale at your price needs a price, and your offer does not name one.{' '}
          <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'offer' })}>Say what it costs</button>
        </div>
      ) : (
        <div className="cp2-nextbet-do">
          <button className="cp-btn primary" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start this bet'}</button>
          <button className="cp2-link" disabled={busy} onClick={change}>Change it first</button>
        </div>
      )}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/** How an idea would work, what a fail would say, and the pages it rests on — the model's reasoning, under its label. */
function IdeaReasons({ idea }: { idea: Idea }) {
  const sources = idea.sources ?? [];
  return (
    <>
      {idea.works && <p className="cp2-nextbet-r"><b>How it would work:</b> {idea.works}</p>}
      {idea.fails && <p className="cp2-nextbet-r"><b>If it does not pass:</b> {idea.fails}</p>}
      {sources.length > 0 && (
        <p className="cp2-nextbet-src">
          <span>Rests on</span>
          {sources.map((x) => (
            <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer nofollow" title={x.title}>{hostOf(x.url)} <IconExternal /></a>
          ))}
        </p>
      )}
    </>
  );
}

function PlayCard({ play: p, priceLabel, actions }: { play: Play; priceLabel: string | null; actions: Actions }) {
  return (
    <div className="cp2-pf-play">
      <span className="cp2-lab-book">{p.book}</span>
      <b className="cp2-lab-play-t">{p.label}</b>
      <p className="cp2-lab-play-how">{p.how}</p>
      <p className="cp2-lab-play-pass">Pass line: {playLine(p, priceLabel)}</p>
      <button className="cp-btn sm primary" onClick={() => actions.openSheet({ kind: 'bet', play: p.key })}>Make it my bet</button>
    </div>
  );
}

/** After a failed ask, opening the tab does not ask again on its own for this long. The button still does. */
const IDEAS_RETRY_MS = 60 * 60_000;

/**
 * Three ideas a model wrote for this part of this business, from its record
 * and a web search for what others did (idearesearch.ts). Asked for once a visit
 * when there are none, or when the record has moved since the last were written
 * (ideasStale) — so the tab is not the same every time it is opened — and again
 * on a tap. Without a model on the server there is no button: a button with
 * nothing behind it is a promise the app cannot keep. The first is the next bet
 * above (`skip`); the rest are shown when the others are (`open`).
 */
function Ideas({ home, d, actions, part, priceLabel, skip, open }: {
  home: HomeData; d: Derived; actions: Actions; part: LinkKey; priceLabel: string | null; skip: string | null; open: boolean;
}) {
  const set = d.proof.lab.ideas[part] ?? null;
  const can = !!home.ai && !d.noOffer;
  const stale = ideasStale(set, d.proof.bets, home.recent.today);
  // The ask, as the rows have it: being written in the background (the hook
  // watches it and reloads when it lands), or failed and why.
  const run = ideaRun(d.proof.lab.ideaRuns[part], d.now);
  const [asking, setAsking] = useState<LinkKey | null>(null);
  const [refused, setRefused] = useState<{ part: LinkKey; why: string } | null>(null);
  const asked = useRef(new Set<LinkKey>());
  const writing = asking === part || run?.state === 'writing';
  const failedWhy = refused?.part === part ? refused.why : run?.state === 'failed' ? run.why : null;
  // A failure an hour old is worth one more try on opening; a fresh one waits for the tap.
  const failedLately = run?.state === 'failed' && d.now.getTime() - Date.parse(run.at) < IDEAS_RETRY_MS;

  const ask = async (k: LinkKey) => {
    asked.current.add(k);
    setAsking(k); setRefused(null);
    // Returns once the ask is recorded; the writing goes on in the background.
    const r = await actions.lab({ action: 'ideas', part: k });
    setAsking((x) => (x === k ? null : x));
    if (!r.ok) setRefused({ part: k, why: r.error ?? 'No new ideas just now.' });
  };
  useEffect(() => {
    if (!can || !stale || writing || failedLately || asked.current.has(part)) return;
    void ask(part);
    // Once per part per visit: a failure is said, and asking again is a tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, stale, part]);

  if (!can && !set) return null;
  const rest = (set?.ideas ?? []).filter((x) => x.key !== skip);
  return (
    <div className="cp2-pf-ideas">
      <div className="cp2-pf-ideas-top">
        <span className="cp2-pf-k">Written for your business</span>
        {can && <button className="cp2-link" disabled={writing} onClick={() => void ask(part)}>{writing ? 'Writing…' : failedWhy ? 'Try again' : set ? 'New ideas' : 'Write some'}</button>}
      </div>
      {/* Said only where a search will run: without a key the set is written from the record and the model's knowledge (invariant 7). */}
      {writing && <p className="cp2-pf-wait">{home.hunting?.webReady ? 'Searching for what others did, then writing three from it and your record.' : 'Writing three from your record.'} A minute or two — this can stay open or close.</p>}
      {!writing && failedWhy && <p className="cp-help cp2-err">{/^No new ideas/.test(failedWhy) ? failedWhy : `No new ideas: ${failedWhy}`}</p>}
      {open && rest.map((idea) => <IdeaCard key={idea.key} idea={idea} priceLabel={priceLabel} actions={actions} />)}
      {set && (
        <p className="cp2-pf-ideas-s">
          By AI {researchLine(set.research)}, {dayWords(set.at)}. A page is a reason to try something, not proof it works for you; the pass lines are its proposal, and you set yours before the bet starts.
        </p>
      )}
    </div>
  );
}

function IdeaCard({ idea, priceLabel, actions }: { idea: Idea; priceLabel: string | null; actions: Actions }) {
  return (
    <div className="cp2-pf-play ai">
      <span className="cp2-pf-src"><i className="cp2-owner ai">By AI</i>{idea.book ? <span>after {idea.book}</span> : null}</span>
      <b className="cp2-lab-play-t">{idea.label}</b>
      <p className="cp2-lab-play-how">{idea.how}</p>
      {idea.why && <p className="cp2-pf-why">{idea.why}</p>}
      <IdeaReasons idea={idea} />
      <p className="cp2-lab-play-pass">Pass line: {playLine(idea, priceLabel)}</p>
      <button className="cp-btn sm primary" onClick={() => actions.openSheet({ kind: 'bet', idea: idea.key, part: idea.part })}>Make it my bet</button>
    </div>
  );
}

/* ─── What is missing ─────────────────────────────────────────────────────── */

/**
 * The assets the business lacks (assets.ts assetGaps): a landing page that is not
 * online, a script for the part the verdict calls weak. Only the gaps are here —
 * what exists is a row under More, and the full list its sheet. A gap stays on the
 * tab because it is the one thing in the assets that asks for something.
 */
function AssetGaps({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const { gaps, assetsUnreadable } = d.proof;
  const can = !!home.ai && !d.noOffer;
  const [busy, setBusy] = useState<AssetKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = async (g: AssetGap) => {
    setBusy(g.kind); setError(null);
    const r = await actions.assets({ action: 'draft', kind: g.kind });
    setBusy(null);
    if (!r.ok) return setError(r.error ?? 'Could not draft it');
    if (r.id) actions.openSheet({ kind: 'asset', id: r.id });
  };

  // A read that failed is not a business with nothing made (invariant 13).
  if (assetsUnreadable) return <div className="cp-note cp2-pf-note">Could not read your assets just now: {assetsUnreadable}. Nothing is shown rather than an empty list, and nothing new is written over them until they read.</div>;
  if (!gaps.length) return null;
  return (
    <>
      <div className="cp-list cp2-rows cp2-pf-assets">
        {gaps.slice(0, 1).map((g) => (
          <div key={g.kind} className="cp2-row cp2-pf-gap">
            <span className="cp2-pf-glyph gap"><AssetGlyph kind={g.kind} /></span>
            <span className="cp2-row-main">
              <span className="t">{g.title}</span>
              <span className="s">{g.why}</span>
            </span>
            {g.open
              ? <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'asset', id: g.open })}>Put it online</button>
              : can
              ? <button className="cp-connect" disabled={busy !== null} onClick={() => void draft(g)}>{busy === g.kind ? 'Drafting…' : 'Draft it'}</button>
              : <button className="cp-connect blue" onClick={() => actions.openSheet({ kind: 'asset', assetKind: g.kind })}>Add it</button>}
          </div>
        ))}
      </div>
      {error && <p className="cp-help cp2-err cp2-pf-note">{error}</p>}
    </>
  );
}

/** The bet an asset was made for: its version in use's, else the first version that names one. */
export const assetBet = (a: Asset): string | null => a.current.bet ?? a.versions.find((v) => v.bet)?.bet ?? null;

export function AssetRow({ a, bets, actions, page }: { a: Asset; bets: BetView[]; actions: Actions; page?: HomeData['page'] }) {
  const v = a.current;
  // The landing page online: what it counted since this version went up, on its row.
  const online = page?.live?.asset === a.id ? page.live : null;
  const counted = online && page ? pageLine(pageCounts(page.hits, { asset: a.id, n: online.n }), null) : '';
  const isOffer = a.id === OFFER_ASSET;
  const betOf = (id: string | null) => (id ? bets.find((x) => x.bet.id === id) ?? null : null);
  // The offer in use was made for a bet only if that version says so; a draft
  // the AI wrote for one is said on the line that says it is waiting.
  const bet = betOf(isOffer ? v.bet : assetBet(a));
  const newest = a.versions[0];
  // The offer's newest version, by AI and not the offer in use: waiting on the person.
  const waiting = isOffer && newest.by === 'ai' && a.live !== newest.n;
  const waitingFor = waiting ? betOf(newest.bet) : null;
  const sub = [
    isOffer ? 'Your offer' : ASSET_LABEL[a.kind],
    `v${v.n}`,
    isOffer && a.live === v.n ? 'in use' : null,
    v.at ? dayWords(v.at) : null,
    a.retired ? 'put away' : null,
  ].filter(Boolean).join(' · ');
  return (
    <button className={`cp2-row cp2-pf-asset${a.retired ? ' retired' : ''}`} onClick={() => actions.openSheet({ kind: 'asset', id: a.id })}>
      <span className={`cp2-pf-glyph ${v.by}`}><AssetGlyph kind={a.kind} /></span>
      <span className="cp2-row-main">
        <span className="t cp2-clamp2">{a.title}</span>
        <span className="s">{sub}</span>
        {bet && <span className={`cp2-pf-betlink ${bet.state}`}>{bet.state === 'running' ? 'For your bet' : `For a bet · ${BET_STATE_LABEL[bet.state]}`}: “{bet.bet.belief}”</span>}
        {waiting && <span className="cp2-pf-waiting">v{newest.n} by AI{waitingFor?.state === 'running' ? ', for your bet,' : ''} is waiting for you to keep or leave</span>}
        {online && <span className="cp2-pf-online">Online · v{online.n}{counted ? ` · ${counted}` : ' · nobody has opened it yet'}</span>}
      </span>
      <span className={`cp2-owner ${v.by}`}>{v.by === 'ai' ? 'By AI' : 'By you'}</span>
    </button>
  );
}

/** One glyph per kind of thing that happened: a bet is a target, the plan's experiment its flask, work handed over a case. */
function HistoryMark({ e }: { e: HistoryEntry }) {
  switch (e.kind) {
    case 'bet_end': return e.tone === 'good' ? <IconCheck /> : e.tone === 'bad' ? <IconCross /> : <IconTarget />;
    case 'bet_start': return <IconTarget />;
    case 'experiment': return <IconFlask />;
    case 'checkpoint': return <IconSwap />;
    case 'talk': return <PathGlyph icon="reply" />;
    case 'asset': return e.asset ? <AssetGlyph kind={e.asset} /> : <IconCheck />;
    case 'project': return <MatchGlyph group="work" />;
    case 'win': return <PathGlyph icon="money" />;
  }
}

/** One line of the history: what it was, the day, and who made it where that is the point. */
export function HistoryRow({ e, today, actions }: { e: HistoryEntry; today: string; actions: Actions }) {
  const open = e.open && 'asset' in e.open ? () => actions.openSheet({ kind: 'asset', id: (e.open as { asset: string }).asset })
    : e.open && 'commission' in e.open ? () => actions.openSheet({ kind: 'commission', id: (e.open as { commission: string }).commission })
    : null;
  const body = (
    <>
      <span className={`cp2-pf-hmark ${e.tone ?? ''}`}><HistoryMark e={e} /></span>
      <span className="cp2-row-main">
        <span className="t cp2-clamp2">{e.title}</span>
        <span className="s cp2-clamp2">{[historyDay(e.day, today), e.line].filter(Boolean).join(' · ')}</span>
      </span>
      {(e.kind === 'asset' || e.kind === 'project') && e.by && <span className={`cp2-owner ${e.by}`}>{e.by === 'ai' ? 'By AI' : 'By you'}</span>}
    </>
  );
  return open
    ? <button className="cp2-row cp2-pf-hrow" onClick={open}>{body}</button>
    : <div className="cp2-row cp2-pf-hrow">{body}</div>;
}

/* ─── Built so far ────────────────────────────────────────────────────────── */

/**
 * What the business has to show for itself, newest first (engine.ts builtSoFar):
 * a sale, a bet that passed, a project the agent finished, the first version of
 * anything made. The engine running is what it built, said with who built it;
 * everything else that happened is one tap away in the history.
 */
function Built({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const { built, history } = d.proof;
  return (
    <>
      <div className="cp-section cp2-er-h">
        <span>Built so far</span>
        {history.length > 0 && <button className="cp2-link" onClick={() => actions.openSheet({ kind: 'history' })}>All history</button>}
      </div>
      {built.length ? (
        <div className="cp-list cp2-rows cp2-er-built">
          {built.slice(0, BUILT_SHOWN).map((e) => <HistoryRow key={e.key} e={e} today={home.recent.today} actions={actions} />)}
        </div>
      ) : (
        <p className="cp2-er-none">The first sale, a bet that passes, a project finished and the first version of anything you make land here, each dated.</p>
      )}
    </>
  );
}

/* ─── More ────────────────────────────────────────────────────────────────── */

/**
 * The records the engine keeps, a line each and a tap to the sheet that has it
 * whole: the conversations, the assets and the page, the projects. None of it is
 * read to decide the move, so none of it sits above the engine. The agents are
 * the crew, on the engine itself; the history is under Built so far. A row
 * dropped here would be a sheet nobody can open.
 */
function More({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const talks = d.proof.lab.talks;
  const c = talkCounts(talks, home.recent.today);
  const intros = d.proof.intros;
  const jobs = splitThreads(home.commissions ?? []);
  const offered = home.moves.filter((m) => m.artifact?.kind === 'plan').length;
  const projects = [
    d.proof.waiting ? `${d.proof.waiting} ${d.proof.waiting === 1 ? 'needs' : 'need'} you` : null,
    d.proof.lapsed ? `${d.proof.lapsed} past ${d.proof.lapsed === 1 ? 'its' : 'their'} day` : null,
    jobs.running.length ? `${jobs.running.length} running` : null,
    offered ? `${offered} offered` : null,
    jobs.finished.length ? `${jobs.finished.length} finished` : null,
  ].filter(Boolean).join(' · ');
  const live = d.proof.assets.filter((a) => !a.retired);
  const online = home.page?.live ?? null;
  const counted = online && home.page ? pageLine(pageCounts(home.page.hits, { asset: online.asset, n: online.n }), null) : '';
  const assetsLine = online
    ? `Page online · v${online.n}${counted ? ` · ${counted}` : ' · nobody has opened it yet'}`
    : live.length ? assetMakers(d.proof.assets).line || `${live.length} made` : 'A demo, a script, a page, a price to test';
  return (
    <>
      <AssetGaps home={home} d={d} actions={actions} />
      <div className="cp-list cp2-rows cp2-team cp2-pf-behind">
        <button className="cp2-row" onClick={() => actions.openSheet({ kind: 'talks' })}>
          <span className="cp2-row-main">
            <span className="t">Conversations</span>
            <span className="s">
              {c.n
                ? `${c.n} in ${TALK_BACK_DAYS} days · ${c.committed} committed · ${c.have} have the problem`
                : talks.length ? `None in the last ${TALK_BACK_DAYS} days` : 'Who you talked to, and what they committed'}
            </span>
            {/* Said where the conversations are, as well as on the Path: an introduction is lost by waiting. */}
            {intros.length > 0 && (
              <span className="s cp2-pf-needs">
                {intros.length === 1 ? `The intro from ${intros[0].talk.who || 'someone'} waits on you` : `${intros.length} introductions wait on you`}
              </span>
            )}
          </span>
          <IconChevron />
        </button>
        <button className="cp2-row" onClick={() => actions.openSheet({ kind: 'assets' })}>
          <span className="cp2-row-main">
            <span className="t">Assets</span>
            <span className="s cp2-clamp1">{assetsLine}</span>
          </span>
          <IconChevron />
        </button>
        <button className="cp2-row" onClick={() => actions.openSheet({ kind: 'projects' })}>
          <span className="cp2-row-main">
            <span className="t">Projects</span>
            <span className={`s${d.proof.waiting ? ' cp2-pf-needs' : ''}`}>{projects || 'Research, comparisons and drafts, handed over'}</span>
          </span>
          <IconChevron />
        </button>
      </div>
    </>
  );
}
