// src/lib/copilot/betplan.ts
// A bet's plan: the work that makes its count possible, split between the crew
// and you, approved by the same tap that starts the bet.
//
// The gap it closes. A bet was a belief and a line: "0 of 10 conversations" on
// day nine, over a free-text box that handed one project at a time to the agent.
// Its owner's record that week had four projects finished — guesthouses, an exit
// plan, a reusable reply — and none of them for the bet. Nothing said what the
// crew would do for a bet, and nothing did it unless somebody typed it in.
//
// So a bet starts with its plan, drawn from the play: the people to find, the
// thing to draft, the project to hand over, and what only you can do — answer
// people from your own account, put the page online, make a rewritten offer
// yours. The crew's steps start with the bet (planrun.ts) and are taken up again
// every night until its last day: a failure is tried again, and people are found
// again once everyone found has been answered or set aside.
//
// The rule that keeps it honest is the bet's own: the plan is the work, the
// count is the verdict. Every step done never passes a bet (invariant 10) —
// "the plan was done and nobody bought" is the result a bet exists to produce,
// and it would vanish if finishing the plan could pass one. A step's state is
// read from rows — people found (voices.ts), an asset made for the bet
// (assets.ts), the project tied to it, the page online, the offer in use — and
// never from what a worker says about itself.
//
// What it is drawn from is a rule, not a model: the play's prep, the bet's
// count, and what this server has connected. Which work a play needs does not
// get better with a better model, and a model choosing what to do is the
// morning brief a harness does better (DIRECTION.md). A step nobody connected
// can do is yours, said as yours (invariant 7).
//
// Pure: no DB import. planrun.ts runs the crew's steps; the lab route writes the plan.

import { ASSET_LABEL, OFFER_ASSET, type Asset, type AssetKind } from './assets';
import { commissionChip } from './commission';
import { jobKindOf } from './contract';
import {
  PLAN_ASK_MAX, PLAN_RUN_MS, PLAY_BY_KEY, dayIn, dayWords, singular, unitPage,
  type Bet, type BetPlan, type BetView, type PlanKind, type PlanRun, type PlanStep, type Talk, type Tally,
} from './lab';
import { offerIsEmpty } from './offer';
import { foundOf } from './proof';
import { unitSignal } from './signal';
import { betVoiced, betVoices, voiceRefusal, type BetVoices } from './voices';
import { takerOf, type WorkerCard } from './workers';
import type { CommissionThread, FoundBy, HomeData } from './types';

/* ─── What this server can do ─────────────────────────────────────────────── */

/**
 * What the crew can take on here. Read by the bet sheet before Start and by the
 * route at Start from the same home fields, so the plan the person reads is the
 * plan the crew is given.
 */
export interface PlanCaps {
  /** The app's own search for public posts (voices.ts): a key, and an offer to write it from (invariant 1). */
  search: boolean;
  /** The app's model, to draft an asset for the bet (proofai.ts): a model, and an offer to draft from. */
  draft: boolean;
  /** A worker that takes a writing job, or a research job, at "Research and draft". */
  write: boolean;
  research: boolean;
}

export function planCaps(i: { webReady: boolean; ai: boolean; offerEmpty: boolean; workers: Array<Pick<WorkerCard, 'name' | 'jobs' | 'maxRing' | 'agent'>> }): PlanCaps {
  return {
    search: i.webReady && !i.offerEmpty,
    draft: i.ai && !i.offerEmpty,
    write: !!takerOf(i.workers, 'write', 'read'),
    research: !!takerOf(i.workers, 'research', 'read'),
  };
}

/** The same, off the home payload: the fields the server filled from its own keys and registry. */
export function planCapsOf(home: Pick<HomeData, 'hunting' | 'ai' | 'profile' | 'workers'>): PlanCaps {
  return planCaps({ webReady: !!home.hunting?.webReady, ai: !!home.ai, offerEmpty: offerIsEmpty(home.profile.offer), workers: home.workers ?? [] });
}

/* ─── The plan, drawn ─────────────────────────────────────────────────────── */

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
const clampAsk = (s: string) => (s.length <= PLAN_ASK_MAX ? s : `${s.slice(0, PLAN_ASK_MAX - 1).replace(/[\s,;:—-]+\S*$/, '')}…`);

/**
 * The Researcher's search when the app's own cannot run. Eight, the number one
 * search of the app's own keeps (VOICES_PER_SEARCH): the app's check holds a
 * job to the count it names, with a link on every one (contract.ts).
 */
export function findAsk(problem: string | null, belief: string): string {
  return clampAsk(`Find eight recent public posts where people say they have this problem, each with its link: ${(problem?.trim() || belief).replace(/[.\s]+$/, '')}`);
}

/**
 * The steps a bet starts with. The crew's first: who finds the people a bet about
 * people needs, then what gets it ready — the play's asset, drafted, or its
 * project, handed over — each one yours where nothing here can do it. Then what
 * only you can do. How the count gets in is not a stored step (countStep): it
 * follows how the count is kept today.
 */
export function planFor(bet: Pick<Bet, 'part' | 'play' | 'idea' | 'metric' | 'unit' | 'tries' | 'belief'>, caps: PlanCaps, offer: { problem?: string | null } = {}): PlanStep[] {
  const steps: PlanStep[] = [];
  const cat = bet.play ? PLAY_BY_KEY.get(bet.play) ?? null : null;
  const prep = cat?.prep ?? null;
  // An idea's prep is an asset to make, never a project: that is all ideas.ts keeps.
  const asset: AssetKind | null = prep?.asset ?? (!cat ? bet.idea?.prep?.asset ?? null : null);
  const label = prep?.label ?? (!cat ? bet.idea?.prep?.label ?? null : null);

  if (betVoiced(bet)) {
    if (caps.search) steps.push({ kind: 'find', by: 'crew', who: 'Scout', do: 'Find people who say this problem in their own words' });
    else if (caps.research) {
      const ask = findAsk(offer.problem ?? null, bet.belief);
      steps.push({ kind: 'find', by: 'crew', who: 'Researcher', do: ask, ask });
    } else steps.push({ kind: 'find', by: 'you', who: 'You', do: 'Find people who have the problem, where they talk about it' });
  }

  if (asset && label) {
    // No ask on a draft: what a draft is asked for is read as the owner's words
    // (proofai.ts draftAsset), and a catalogue's sentence is not theirs
    // (invariant 12). The draft is written from the bet and its play, as "Draft
    // it with AI" on the card always was.
    steps.push(caps.draft
      ? { kind: 'draft', by: 'crew', who: 'Writer', do: `Draft ${lowerFirst(label)}`, asset }
      : { kind: 'draft', by: 'you', who: 'You', do: `Write ${lowerFirst(label)}`, asset });
  } else if (prep?.ask) {
    // Writing or research, as the job will be sorted when it is handed over (contract.ts).
    const job = jobKindOf(prep.ask).kind;
    const ask = clampAsk(prep.ask);
    steps.push((job === 'write' ? caps.write : caps.research)
      ? { kind: 'job', by: 'crew', who: job === 'write' ? 'Writer' : 'Researcher', do: ask, ask }
      : { kind: 'job', by: 'you', who: 'You', do: ask, ask });
  }

  // Answering is reach: from your own account, never the app's (invariant 4).
  if (steps.some((s) => s.kind === 'find' && s.who === 'Scout')) steps.push({ kind: 'reply', by: 'you', who: 'You', do: 'Answer them from your own account' });
  // Going online is publishing under your name: one tap, yours.
  if (asset === 'landing_page' || (bet.metric === 'logged' && unitPage(bet.unit))) steps.push({ kind: 'page', by: 'you', who: 'You', do: 'Put the page online: one tap, with your own button on it' });
  // A drafted offer is not the offer until you make it yours (assets.ts adopt).
  if (asset === 'offer') steps.push({ kind: 'adopt', by: 'you', who: 'You', do: 'Make the rewritten offer yours, or keep your own' });
  return steps;
}

/* ─── The plan, read ──────────────────────────────────────────────────────── */

export { PLAN_RUN_MS, planBusy } from './lab';

export type StepState = 'done' | 'working' | 'needs' | 'failed' | 'waiting' | 'stopped' | 'open';

export interface StepView {
  step: PlanStep;
  state: StepState;
  /** What the rows show, one short line. */
  line: string;
  /** The asset or project that is this step's work: what it opens, and what the bet's other work leaves out. */
  asset?: string;
  project?: string;
  /** A crew step that could be started now (dueSteps decides when it is). */
  runnable: boolean;
  /** Done, and its last go failed all the same: the Scout found people once and its newest search did not run. */
  trouble?: boolean;
}

export interface CountStep { do: string; line: string | null; auto: boolean }

export interface PlanView {
  steps: StepView[];
  /** How the count gets in: yours unless the app counts it by itself. Not stored: it follows how the count is kept now. */
  count: CountStep;
  crew: { done: number; of: number };
  /** Your steps that can be done, done. Ongoing ones — the count — are not a step to tick. */
  yours: { done: number; of: number };
  /** A crew step being worked on right now: what the screen follows until it lands. */
  busy: boolean;
}

export interface PlanInput {
  view: BetView;
  /** This bet's runs, newest first. */
  runs: PlanRun[];
  /** The people found for it (betVoices), when it is a bet about people. */
  voices: BetVoices | null;
  /** Why another search could not run (voiceRefusal), or null. */
  searchRefusal: string | null;
  assets: Asset[];
  /** The projects tied to the bet (lab.links). */
  projects: CommissionThread[];
  /** Whether a page is online; null when it could not be read. */
  pageLive: boolean | null;
  talks: Talk[];
  tallies: Tally[];
  found: FoundBy | null;
  /** Whether the count link or the page counts this bet's unit by itself. */
  counted: { link: boolean; page: boolean };
  timezone: string;
  now: Date;
}

/**
 * A plan's inputs off the home payload, for a bet. The card and the runner both
 * read through here, so the step the screen calls waiting is the step the runner
 * starts — and a search the card says cannot run is one the runner does not try.
 */
export function planInputOf(home: HomeData, view: BetView, now: Date): PlanInput {
  const bet = view.bet;
  const voiced = betVoiced(bet);
  const read = home.lab?.voices;
  const voices = voiced && read && !read.unreadable ? betVoices(read, bet, home.lab?.talks ?? []) : null;
  const searchRefusal = !voiced ? null
    // Unread, a search could bring back the people already on the card and charge for them twice.
    : read?.unreadable ? `The people already found could not be read just now: ${read.unreadable}`
    // A search worked out from nothing is not the person's (invariant 1).
    : offerIsEmpty(home.profile.offer) ? 'Say what you sell and who for first: the search is written from it.'
    : voiceRefusal({ running: view.state === 'running', voiced, searches: voices?.searches ?? 0, ready: !!home.hunting?.webReady, remaining: home.billing.matches.remaining });
  return {
    view,
    runs: (home.lab?.planRuns ?? []).filter((r) => r.bet === bet.id),
    voices,
    searchRefusal,
    assets: home.assets?.assets ?? [],
    projects: (home.lab?.links?.[bet.id] ?? [])
      .map((id) => home.commissions.find((t) => t.commission.id === id) ?? null)
      .filter((t): t is CommissionThread => !!t),
    pageLive: home.page ? (home.page.unreadable ? null : !!home.page.live) : null,
    talks: home.lab?.talks ?? [],
    tallies: home.lab?.tallies ?? [],
    found: foundOf(home).value,
    counted: { link: !!home.signals?.made && !!unitSignal(bet.unit), page: !!home.page?.live && !!unitPage(bet.unit) },
    timezone: home.profile.timezone,
    now,
  };
}

const STOPPED = 'It stopped before it finished';

/** The newest run of a step, and what it says now: still going, or gone quiet. */
function runOf(runs: PlanRun[], kind: PlanKind, now: Date): { run: PlanRun | null; going: boolean; failed: string | null } {
  const run = runs.find((r) => r.step === kind) ?? null;
  const age = run ? now.getTime() - Date.parse(run.at) : 0;
  const going = run?.state === 'asked' && age < PLAN_RUN_MS;
  const failed = run?.state === 'failed' ? run.why ?? 'no reason given' : run?.state === 'asked' && !going ? STOPPED : null;
  return { run, going, failed };
}

/** The project a step handed over: the one its run made, else the bet's project with its ask as the objective. */
function projectOf(step: PlanStep, runs: PlanRun[], projects: CommissionThread[]): CommissionThread | null {
  const made = runs.find((r) => r.step === step.kind && r.state === 'done' && r.ref)?.ref ?? null;
  return projects.find((t) => t.commission.id === made) ?? projects.find((t) => !!step.ask && t.commission.objective === step.ask) ?? null;
}

function projectView(step: PlanStep, i: PlanInput): StepView {
  const t = projectOf(step, i.runs, i.projects);
  if (t) {
    const c = t.commission;
    const p = t.report.progress;
    const base = { step, project: c.id, runnable: false };
    switch (c.status) {
      case 'draft': return { ...base, state: 'needs', line: 'Waiting for your OK' };
      case 'active': return { ...base, state: 'working', line: `Working on it${p.total ? ` · ${p.done} of ${p.total} steps` : ''}` };
      case 'blocked': return { ...base, state: 'needs', line: commissionChip(c, t.report).label };
      case 'done': return { ...base, state: 'done', line: 'Done, and checked' };
      // The person's stop is the last word: the crew does not hand it over again.
      default: return { ...base, state: 'stopped', line: 'You stopped it' };
    }
  }
  if (step.by === 'you') return { step, state: 'open', line: 'Nobody here can take it: ask Claude, with your record', runnable: false };
  const r = runOf(i.runs, step.kind, i.now);
  if (r.going) return { step, state: 'working', line: 'Handing it over…', runnable: false };
  if (r.failed) return { step, state: 'failed', line: `Not handed over: ${r.failed}`, runnable: true };
  return { step, state: 'waiting', line: 'Not started yet', runnable: true };
}

function findView(step: PlanStep, i: PlanInput): StepView {
  if (step.who === 'Researcher') return projectView(step, i);
  if (step.by === 'you') return { step, state: 'open', line: 'Yours: this server cannot search the web', runnable: false };
  const v = i.voices;
  const r = runOf(i.runs, 'find', i.now);
  if (r.going) return { step, state: 'working', line: 'Searching…', runnable: false };
  if (v && v.found > 0) {
    // Everyone found answered or set aside, and another search allowed: the Scout looks again.
    const again = v.open.length === 0 && !i.searchRefusal;
    const tail = r.failed ? ` · the last search failed: ${r.failed}` : again ? ' · looks for more tonight' : '';
    return { step, state: 'done', line: `${v.found} found${v.searches > 1 ? ` in ${v.searches} searches` : ''}${tail}`, runnable: again, trouble: !!r.failed };
  }
  // Said rather than retried: the allowance, the cap or the key is not a failure a second try fixes.
  if (i.searchRefusal) return { step, state: 'failed', line: i.searchRefusal, runnable: false };
  if (r.failed) return { step, state: 'failed', line: `Could not search: ${r.failed}`, runnable: true };
  if (v && v.searches > 0) return { step, state: 'waiting', line: 'Searched, and nobody new yet · tries again tonight', runnable: true };
  return { step, state: 'waiting', line: 'Not started yet', runnable: true };
}

function draftView(step: PlanStep, i: PlanInput): StepView {
  const bet = i.view.bet.id;
  const a = i.assets.find((x) => x.kind === step.asset && x.versions.some((v) => v.bet === bet)) ?? null;
  if (a) {
    // Versions are newest first: the newest made for this bet.
    const v = a.versions.find((x) => x.bet === bet)!;
    const day = v.at ? dayIn(v.at, i.timezone) : null;
    return { step, state: 'done', line: `${v.by === 'ai' ? 'Drafted' : 'Written by you'}${day ? `, ${dayWords(day)}` : ''}`, asset: a.id, runnable: false };
  }
  if (step.by === 'you') return { step, state: 'open', line: `Not written yet: ${ASSET_LABEL[step.asset!].toLowerCase()}, kept with this bet`, runnable: false };
  const r = runOf(i.runs, 'draft', i.now);
  if (r.going) return { step, state: 'working', line: 'Drafting…', runnable: false };
  if (r.failed) return { step, state: 'failed', line: `Could not draft: ${r.failed}`, runnable: true };
  return { step, state: 'waiting', line: 'Not started yet', runnable: true };
}

function replyView(step: PlanStep, i: PlanInput): StepView {
  const v = i.voices;
  if (!v || v.found === 0) return { step, state: 'open', line: 'Once the Scout finds them', runnable: false };
  if (v.open.length === 0) return { step, state: 'done', line: `${v.talked} of ${v.found} talked to, the rest set aside`, runnable: false };
  return { step, state: 'open', line: `${v.talked} of ${v.found} talked to · ${v.open.length} waiting`, runnable: false };
}

function pageView(step: PlanStep, i: PlanInput): StepView {
  if (i.pageLive) return { step, state: 'done', line: 'Online', runnable: false };
  if (i.pageLive === null) return { step, state: 'open', line: 'Your page could not be read just now', runnable: false };
  return { step, state: 'open', line: 'Not online yet', runnable: false };
}

function adoptView(step: PlanStep, i: PlanInput): StepView {
  const offer = i.assets.find((a) => a.id === OFFER_ASSET) ?? null;
  const v = offer?.versions.find((x) => x.bet === i.view.bet.id) ?? null;
  if (offer && v && offer.live === v.n) return { step, state: 'done', line: 'Your offer now', asset: offer.id, runnable: false };
  if (offer && v) return { step, state: 'open', line: 'Drafted, and not your offer yet', asset: offer.id, runnable: false };
  return { step, state: 'open', line: 'Once it is written', runnable: false };
}

/**
 * How the count gets in. The app counts sends, replies and projects finished by
 * itself, and a count link or a page counts its unit; everything else is the
 * person's to say, one tap at a time — and the line says when they last did, so a
 * week with nothing logged reads as one.
 */
export function countStep(bet: Pick<Bet, 'id' | 'metric' | 'unit' | 'start'>, i: Pick<PlanInput, 'talks' | 'tallies' | 'found' | 'counted'> & { last: string }): CountStep {
  const lastOf = (days: string[]) => {
    const d = days.filter((x) => x >= bet.start && x <= i.last).sort().pop();
    return d ? `Last on ${dayWords(d)}` : 'Nothing logged yet';
  };
  switch (bet.metric) {
    case 'talks':
    case 'committed':
      return { do: 'Say how each conversation ended: one tap', line: lastOf(i.talks.map((t) => t.on)), auto: false };
    case 'sent':
    case 'replied':
      return { do: 'Send from Swipe: each send counts by itself', line: null, auto: true };
    case 'handed':
      return { do: 'Hand a step over to your crew: it counts when it is done', line: null, auto: true };
    case 'meetings':
      return { do: i.found === 'outreach' ? 'Answer who replied, and log each meeting' : 'Log each meeting as it happens', line: null, auto: false };
    case 'paid':
    case 'paid_at_price':
      return { do: i.found === 'outreach' ? 'Answer who replied, and log each sale' : 'Log each sale as it comes in', line: null, auto: false };
    case 'logged': {
      const unit = bet.unit ?? 'count';
      if (i.counted.link || i.counted.page) return { do: `Your ${i.counted.link ? 'count link' : 'page'} counts ${unit} by itself`, line: null, auto: true };
      return { do: `Log each ${singular(unit)} as it comes in`, line: lastOf(i.tallies.filter((t) => t.bet === bet.id).map((t) => t.on)), auto: false };
    }
  }
}

/** The plan as the rows have it: each step's state and line, the crew's and yours counted apart, and the count's way in. */
export function planView(plan: BetPlan, i: PlanInput): PlanView {
  const steps = plan.steps.map((s): StepView => {
    switch (s.kind) {
      case 'find': return findView(s, i);
      case 'draft': return draftView(s, i);
      case 'job': return projectView(s, i);
      case 'reply': return replyView(s, i);
      case 'page': return pageView(s, i);
      case 'adopt': return adoptView(s, i);
    }
  });
  const crew = steps.filter((s) => s.step.by === 'crew');
  // A step only Claude can do here is not counted as yours: nothing in the rows can say it was done.
  const yours = steps.filter((s) => s.step.by === 'you' && !(s.step.kind === 'job' || s.step.kind === 'find'));
  return {
    steps,
    count: countStep(i.view.bet, { ...i, last: i.view.last }),
    crew: { done: crew.filter((s) => s.state === 'done').length, of: crew.length },
    yours: { done: yours.filter((s) => s.state === 'done').length, of: yours.length },
    busy: steps.some((s) => s.step.by === 'crew' && s.state === 'working' && !s.project),
  };
}

/**
 * The steps the bet's card shows, which is not all of them. Drawn whole, the plan
 * was a checklist under the count: on the owner's day nine a green tick for the
 * Scout's eight posts sat over "0 of 8 talked to", and both "answer them" and
 * "say how each ended" restated the people card and the count beside them — the
 * card of green ticks that feels like progress at 0 of 10 (DIRECTION.md). So the
 * card shows what needs a look or a tap: a crew step at work, failed, stopped or
 * not started; a crew step's result that is a thing to open, a draft or a
 * project's report; and a step of yours still to do that has no other place on
 * the card. Answering the people found is the people card itself. The Scout's
 * finished search is said only when it is news — it will look again tonight, or
 * its last look failed (invariant 13). Claude still reads the whole plan
 * (betPlanText): a chat has no card beside it.
 */
export function planShown(v: Pick<PlanView, 'steps'>): StepView[] {
  return v.steps.filter((s) => {
    if (s.step.kind === 'reply') return false;
    if (s.step.by === 'you') return s.state !== 'done';
    if (s.state !== 'done') return true;
    return !!(s.project || s.asset) || s.runnable || !!s.trouble;
  });
}

/** "Crew 2 of 3 done · yours 0 of 1": the plan in a line, for Claude, said beside the count, which is the verdict. */
export function planLine(v: Pick<PlanView, 'crew' | 'yours'>): string {
  return [
    v.crew.of ? `Crew ${v.crew.done} of ${v.crew.of} done` : null,
    v.yours.of ? `${v.crew.of ? 'yours' : 'Yours'} ${v.yours.done} of ${v.yours.of}` : null,
  ].filter(Boolean).join(' · ') || 'Yours to do';
}

/**
 * The plan for a reader that is not the screen — Claude, over the connector:
 * the line, then each step with who has it and what the rows show. Said to be the
 * work, so a chat does not read "crew 2 of 2 done" as the bet going well.
 */
export function betPlanText(v: PlanView): string {
  const cut = (s: string) => (s.length <= 70 ? s : `${s.slice(0, 69).replace(/\s+\S*$/, '')}…`);
  const steps = [...v.steps.map((s) => `${s.step.who}, ${lowerFirst(cut(s.step.do))}: ${s.line}`), `${v.count.auto ? 'The app' : 'You'}, ${lowerFirst(v.count.do)}${v.count.line ? `: ${v.count.line}` : ''}`];
  return `The plan, which is the work and not the verdict: ${planLine(v)}. ${steps.join('. ')}.`;
}

/* ─── When the crew's steps run ───────────────────────────────────────────── */

/**
 * Why the runner was called: the tap that started or planned the bet, the
 * nightly pass, or the person's "Try again" on a step that failed.
 */
export type PlanReason = 'start' | 'nightly' | 'retry';

/**
 * The crew's steps to start now. Every one that can run, when the bet starts; at
 * night, each at most once a day — a step that failed this morning waits for
 * tomorrow or for the person's own "Try again", so a broken key is one line a
 * day, not a loop spending a model call every hour. "Try again" is for what
 * failed and only that: a search that found nobody new is not a failure, and
 * running it again from that tap spent one of the bet's three searches.
 */
export function dueSteps(v: Pick<PlanView, 'steps'>, i: { runs: PlanRun[]; reason: PlanReason; today: string; timezone: string }): PlanKind[] {
  return v.steps
    .filter((s) => s.step.by === 'crew' && s.runnable && (i.reason !== 'retry' || s.state === 'failed'))
    .filter((s) => {
      if (i.reason !== 'nightly') return true;
      const last = i.runs.find((r) => r.step === s.step.kind);
      return !last || dayIn(last.at, i.timezone) !== i.today;
    })
    .map((s) => s.step.kind);
}

/** Whether one crew step is being worked on now: the Scout's search, so "Find people" is not tapped into a second one beside it. */
export function stepBusy(runs: PlanRun[], kind: PlanKind, now: Date): boolean {
  return runOf(runs, kind, now).going;
}

/** Said where "Find people" would be while the Scout searches: two searches at once would spend two of the bet's three. */
export const SCOUT_SEARCHING = 'Your Scout is looking for them now.';

