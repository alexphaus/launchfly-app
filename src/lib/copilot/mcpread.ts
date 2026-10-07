// src/lib/copilot/mcpread.ts
// What Claude reads: the connector's tools, written as text.
//
// The same counts the screens show, from the same derivation (the route runs
// derive() over loadHome, as the app does), so Claude and the Path cannot
// disagree about how many were sent. Written to the person, as every screen
// is: most lines here are the screens' own ("1 of the 1 possible buyer you
// talked to"), and a frame in another voice around them read as two people
// talking. The handoff export (get_record) keeps its first person, because it
// was written to be pasted as the person's own message.
//
// Every line says whose it is when that is not plain. The offer and the
// working file are the person's words; the chain's states and every count are
// the app's reading of their rows; the plan was drawn by a model and is marked
// as one (invariant 12 — two sources, and a third is labelled, never blended).
// Nothing is estimated here that the screens do not already show with its
// caveat, and the caveat comes with it.
//
// Pure — no DB import — so copilot-core.test.ts covers what each tool says.

import {
  COMMITMENT_LABEL, PROBLEM_LABEL, TALK_BACK_DAYS, TALK_ROLES, TALK_ROLE_LABEL,
  asksProblem, dayWords, roleOf, type Talk, type TalkCounts,
} from './lab';
import type { AskAnswer } from './ask';
import { committedLine, type CommittedKinds } from './business';

const bullet = (s: string) => `- ${s}`;
const clean = (s: string | null | undefined) => (s ?? '').trim();
/** The lines that have something in them. */
const lines = (...xs: Array<string | null | false | undefined>): string[] => xs.filter((x): x is string => !!x);
/** Blocks of lines, a blank line between the ones that are not empty. */
const blocks = (...bs: string[][]): string[] => bs.filter((b) => b.length).flatMap((b, k) => (k ? ['', ...b] : b));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Sections with nothing in them are left out rather than printed empty: a
 * heading over nothing reads as "none". What could not be read is said first,
 * so "No test running" is never what a failed read looks like (invariant 13).
 */
function doc(title: string, today: string, sections: Array<[string, string[]] | null>, foot?: string, missing: string[] = []): string {
  const out = [`# ${title}`, `As of ${today}. Counted by your Copilot app from your own rows; a line says when it is something you wrote or a model drafted.`, ''];
  if (missing.length) out.push(`Not in this read, because the app could not load it just now: ${missing.join('; ')}.`, '');
  for (const s of sections) {
    if (!s || !s[1].length) continue;
    out.push(`## ${s[0]}`, ...s[1], '');
  }
  if (foot) out.push(foot);
  return out.join('\n').trimEnd();
}

/* ─── Shared pieces ───────────────────────────────────────────────────────── */

export interface OfferIn { sells?: string | null; for_who?: string | null; problem?: string | null; price_band?: string | null }

/** The offer in the person's words, or that there is none — which is itself the most useful thing to know. */
export function offerLines(o: OfferIn | null, foundBy: string | null): string[] {
  if (!clean(o?.sells)) return ['You have not written down what you sell yet, so the app drafts nothing for you.'];
  return lines(
    bullet(`Sells: ${clean(o!.sells)}`),
    clean(o!.for_who) && bullet(`For: ${clean(o!.for_who)}`),
    clean(o!.problem) && bullet(`The problem it solves: ${clean(o!.problem)}`),
    clean(o!.price_band) && bullet(`Price: ${clean(o!.price_band)}`),
    foundBy && bullet(`How buyers find you: ${foundBy}`),
  );
}

/** Where I am, said as the Path says it: the fact, then the line under it. */
const hereLine = (h: { title: string; line?: string | null }) => `${h.title}${clean(h.line) ? ` — ${clean(h.line)}` : ''}`;

export interface NowIn { title: string; why: string | null; size: string | null }
export interface AskIn { kind: string; title: string; detail: string }

function nextLines(now: NowIn | null, asks: AskIn[]): string[] {
  return blocks(
    lines(now && `The move now: ${now.title}${now.size ? ` (${now.size})` : ''}`, now?.why),
    asks.length ? ['Also waiting on you:', ...asks.map((a) => bullet(`${a.kind}: ${a.title}${clean(a.detail) ? ` — ${clean(a.detail)}` : ''}`))] : [],
  );
}

export interface BetIn {
  belief: string;
  /** The part it bets on, as a label: "What they pay". */
  part: string;
  state: 'running' | 'passed' | 'failed' | 'stopped';
  /** "1 of 3 commitments" (lab.ts resultLine). */
  result: string;
  /** "3 commitments by 20 Oct" (lab.ts passLine). */
  pass: string;
  start: string;
  ended: string | null;
  day: number;
  days: number;
  note: string | null;
  /** The play it runs, and where the play is from. */
  play: string | null;
  /**
   * The funnel since it began, "Counted since 5 Oct: 11 messages sent, 1 reply…"
   * (reading.ts): what to answer "how is it going" from on day two, when the
   * count it is decided on is still nothing.
   */
  reading?: string | null;
}

const BET_STATE: Record<BetIn['state'], string> = { running: 'running', passed: 'passed', failed: 'did not pass', stopped: 'called off' };

function runningLine(b: BetIn): string {
  return `"${b.belief}" — on ${b.part.toLowerCase()}. Day ${b.day} of ${b.days}: ${b.result}. It passes at ${b.pass}.${b.play ? ` The play: ${b.play}.` : ''}${b.reading ? ` ${b.reading}` : ''}`;
}

/* ─── get_overview ────────────────────────────────────────────────────────── */

/** Parts of the record whose read failed, each with its reason. */
type Missing = { missing?: string[] };

export interface OverviewIn extends Missing {
  today: string;
  offer: OfferIn | null;
  foundBy: string | null;
  here: { title: string; line: string; counts: string | null };
  goals: Array<{ title: string; status: string | null; horizon: string | null; verdict?: string | null }>;
  /** The lead goal's verdict and the sentence behind it (outlook.ts), every number in it computed. */
  outlook: { title: string; verdict: string; line: string } | null;
  runwayMonths: number | null;
  verdict: { title: string; line: string };
  links: Array<{ label: string; state: string; why: string }>;
  weak: string | null;
  bet: BetIn | null;
  checkpointDue: boolean;
  now: NowIn | null;
  asks: AskIn[];
}

export function overviewText(i: OverviewIn): string {
  return doc('Your business, from your Copilot app', i.today, [
    ['What you sell, in your words', offerLines(i.offer, i.foundBy)],
    // The lead goal's sentence goes under its own line, not after the list as a second verdict.
    ['Goals', i.goals.flatMap((g) => [
      bullet(lines(g.title, g.status, g.horizon, g.verdict ?? (i.outlook?.title === g.title ? i.outlook.verdict : null)).join(' · ')),
      ...lines(i.outlook?.title === g.title && `  ${i.outlook.line}`),
    ])],
    ['Where you are', lines(hereLine(i.here), i.here.counts, i.runwayMonths != null && `Runway: ${i.runwayMonths} months.`)],
    ['Is it proven? Each part, as your rows read it', [
      `${i.verdict.title}. ${i.verdict.line}`,
      ...i.links.map((l) => bullet(`${l.label}: ${l.state}. ${l.why}`)),
      ...lines(i.weak && `Weakest part: ${i.weak}.`),
    ]],
    ['The test you are running', lines(
      i.bet ? runningLine(i.bet) : 'No test running.',
      i.checkpointDue && 'A checkpoint is due: a test has ended since the last one, and it is time to decide whether to keep going or change one part.',
    )],
    ['Next', nextLines(i.now, i.asks)],
  ], 'More: get_plan for the whole plan, get_proof for every part and test, get_conversations for who you talked to and what they said, get_record for everything as one document, get_counted_answers for what your rows say about replies and what worked.', i.missing);
}

/* ─── get_plan ────────────────────────────────────────────────────────────── */

export interface PlanStepIn { title: string; size: string; tag: string; who: 'you' | 'ai'; state: 'open' | 'done' | 'dropped' }
export interface PlanMilestoneIn { title: string; why: string | null; doneWhen: string | null; goal: string | null; state: 'open' | 'done' | 'dropped'; steps: PlanStepIn[] }

export interface PlanIn extends Missing {
  today: string;
  now: NowIn | null;
  asks: AskIn[];
  here: { title: string; line: string; counts: string | null };
  /** The drawn plan, when there is one. */
  plan: {
    here: { title: string; line?: string | null } | null;
    direction: string | null;
    done: number;
    total: number;
    drawnAt: string;
    /** The last redraw failed; this is the plan before it. */
    failed: string | null;
    phases: Array<{ label: string; milestones: PlanMilestoneIn[] }>;
  } | null;
  /** Without a drawn plan, the steps the funnel puts ahead, with what each takes. */
  ahead: Array<{ title: string; status: string | null; takes: string | null; when: string | null; early: boolean }>;
}

const MARK: Record<PlanStepIn['state'], string> = { open: 'to do', done: 'done', dropped: 'set aside' };

export function planText(i: PlanIn): string {
  const p = i.plan;
  return doc('What is next, from your Copilot app', i.today, [
    ['Next', nextLines(i.now, i.asks)],
    ['Where you are', lines(hereLine(i.here), i.here.counts)],
    p ? [`Your plan (drawn by a model from your record on ${p.drawnAt.slice(0, 10)}; what is done is what you ticked)`, blocks(
      lines(
        p.failed && `The last redraw failed (${p.failed}), so this is the plan before it.`,
        p.here && `Where the plan says you are: ${hereLine(p.here)}`,
        p.direction && `Direction: ${p.direction}`,
        `${p.done} of ${p.total} done.`,
      ),
      ...p.phases.filter((ph) => ph.milestones.length).map((ph) => [
        `### ${ph.label}`,
        ...ph.milestones.flatMap((m) => [
          bullet(`[${MARK[m.state]}] ${m.title}${m.goal ? ` (toward ${m.goal})` : ''}${m.why ? ` — ${m.why}` : ''}${m.doneWhen ? ` Done when: ${m.doneWhen}` : ''}`),
          ...m.steps.map((s) => `  - [${MARK[s.state]}] ${s.title} (${s.size.toLowerCase()}, ${s.tag.toLowerCase()}${s.who === 'ai' ? ', for your agent' : ''})`),
        ]),
      ]),
    )] : null,
    // The Path's own stops, each with what it takes and when, and the caveat it carries there.
    !p && i.ahead.length ? ['No plan drawn. What the funnel puts ahead, from your rows', i.ahead.map((s) => bullet(lines(
      `${s.title}${s.status ? ` (${s.status})` : ''}.`,
      s.takes,
      s.when,
      s.early && '(An estimate from too few sends to trust yet.)',
    ).join(' ')))] : null,
  ], undefined, i.missing);
}

/* ─── get_proof ───────────────────────────────────────────────────────────── */

export interface ProofIn extends Missing {
  today: string;
  verdict: { title: string; line: string };
  links: Array<{ label: string; state: string; what: string | null; facts: string; why: string }>;
  weak: string | null;
  bets: BetIn[];
  checkpoint: { due: boolean; last: { on: string; decision: string; grade: string | null } | null };
  /** Newest first, as the history shows it. */
  history: Array<{ day: string; title: string; line: string | null }>;
  /** Tests kept for later, newest first: not started, so nothing about them has been counted. */
  shelf?: Array<{ belief: string; part: string; line: string; from: string | null }>;
}

/** History entries returned: the newest, which are the ones a decision is made from. */
export const HISTORY_SHOWN = 30;

export function proofText(i: ProofIn): string {
  const running = i.bets.find((b) => b.state === 'running') ?? null;
  const past = i.bets.filter((b) => b.state !== 'running');
  // A count that only says again what the reason says is left out: "Nothing paid yet. Nothing paid yet."
  const sameAs = (a: string, b: string) => clean(a).replace(/\.$/, '') === clean(b).replace(/\.$/, '');
  return doc('Is your business proven? From your Copilot app', i.today, [
    ['The verdict', [`${i.verdict.title}. ${i.verdict.line}`]],
    ['Each part, as your rows read it', [
      ...i.links.map((l) => bullet(lines(`${l.label}: ${l.state}.`, l.what && `What it is, in your words: ${l.what}.`, clean(l.facts) && !sameAs(l.facts, l.why) && `Counted: ${clean(l.facts)}.`, l.why).join(' '))),
      ...lines(i.weak && `Weakest part: ${i.weak}.`),
    ]],
    ['Tests', blocks(
      [running ? `Running: ${runningLine(running)}` : 'No test running.'],
      past.length ? ['Earlier, newest first:', ...past.map((b) => bullet(`${b.start} · "${b.belief}" — on ${b.part.toLowerCase()}: ${BET_STATE[b.state]}${b.ended ? ` on ${b.ended}` : ''}, ${b.result} against ${b.pass}.${b.note ? ` You wrote: "${b.note}"` : ''}`))] : [],
    )],
    // doc() leaves out a section with no lines, so a record with no shelf reads as it always did.
    ['On the shelf: tests kept for later, not started', (i.shelf ?? []).map((e) => bullet(`"${e.belief}" — on ${e.part.toLowerCase()}. The test: ${e.line}.${e.from ? ` The play: ${e.from}.` : ''}`))],
    ['Pivot or persevere', lines(
      i.checkpoint.due && 'A checkpoint is due now.',
      i.checkpoint.last ? `Last decided on ${i.checkpoint.last.on}: ${i.checkpoint.last.decision}.${i.checkpoint.last.grade ? ` ${i.checkpoint.last.grade}` : ''}` : 'No checkpoint decided yet.',
    )],
    ['What was tried, newest first', i.history.slice(0, HISTORY_SHOWN).map((h) => bullet(`${h.day} · ${h.title}${clean(h.line) ? ` — ${clean(h.line)}` : ''}`))],
  ], undefined, i.missing);
}

/* ─── get_conversations ───────────────────────────────────────────────────── */

export interface ConversationsIn extends Missing {
  today: string;
  /** Every conversation logged, any order. */
  talks: Talk[];
  /** Introductions offered and not followed up (lab.ts openIntros). */
  intros: Array<{ talk: Talk; days: number }>;
  /** The last month, counted (lab.ts talkCounts). */
  counts: TalkCounts;
  /** All time, people who could buy only (ideas.ts talkTotals). */
  totals: { n: number; problem: number; committed: number; kinds?: CommittedKinds };
  limit: number;
}

/** One conversation, as the log keeps it. "Problem" only where it was theirs to have (lab.ts asksProblem). */
export function talkLine(t: Talk, byId: Map<string, Talk>): string {
  const role = roleOf(t);
  const via = t.via ? byId.get(t.via) : null;
  return [
    t.on,
    clean(t.who) || 'Someone',
    TALK_ROLE_LABEL[role].toLowerCase(),
    asksProblem(role) && t.problem !== 'unasked' ? PROBLEM_LABEL[t.problem].toLowerCase() : null,
    `ended in: ${COMMITMENT_LABEL[t.commitment].toLowerCase()}`,
    via ? `came through ${clean(via.who) || 'someone'}'s introduction` : null,
    t.said ? `said: “${t.said}”` : null,
  ].filter(Boolean).join(' · ');
}

export function conversationsText(i: ConversationsIn): string {
  const byId = new Map(i.talks.map((t) => [t.id, t]));
  const newest = [...i.talks].sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
  const c = i.counts;
  return doc('Conversations you logged, from your Copilot app', i.today, [
    ['Counted', lines(
      'Only the conversations you logged by hand: the app cannot hear calls or read chats.',
      c.n
        // Every kind, the empty ones too: who was never asked is the point.
        ? `Last ${TALK_BACK_DAYS} days: ${plural(c.n, 'conversation')} — ${TALK_ROLES.map((r) => `${c.by[r]} ${TALK_ROLE_LABEL[r].toLowerCase()}`).join(', ')}. ${c.committed} ended in a commitment: ${committedLine(c.kinds)}. ${c.have} had the problem.${c.introduced ? ` ${c.introduced} came through an introduction.` : ''}`
        : `None logged in the last ${TALK_BACK_DAYS} days.`,
      i.totals.n > 0 && `All time, with people who could buy: ${i.totals.n}; ${i.totals.problem} had the problem; ${i.totals.committed} committed to something${i.totals.kinds ? ` (${committedLine(i.totals.kinds)})` : ''}.`,
    )],
    ['Introductions offered and not followed up yet', i.intros.map((x) =>
      bullet(`${clean(x.talk.who) || 'Someone'} offered one ${plural(x.days, 'day')} ago (${dayWords(x.talk.on)})${x.talk.said ? `: “${x.talk.said}”` : ''}`))],
    [`Newest first${newest.length > i.limit ? ` (the ${i.limit} newest of ${newest.length})` : ''}`, newest.slice(0, i.limit).map((t) => bullet(talkLine(t, byId)))],
  ], undefined, i.missing);
}

/* ─── get_counted_answers ─────────────────────────────────────────────────── */

export function answersText(answers: AskAnswer[], today: string): string {
  return doc('What your rows say, counted by your Copilot app', today, answers.map((a) => [a.q, [
    a.headline,
    ...a.rows.map((r) => bullet(`${r.label}: ${r.value}${r.note ? ` (${r.note})` : ''}`)),
    ...lines(!a.rows.length && a.thin),
  ]] as [string, string[]]));
}
