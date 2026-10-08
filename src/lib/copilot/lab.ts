// src/lib/copilot/lab.ts
// The bets behind Proof: one at a time, a play to run it with, and a verdict
// the rows give rather than the person.
//
// Why it exists. Its owner asked whether this could be the toolkit for someone
// who has just read The Lean Startup, and the honest answer was: not yet. The
// book starts from assumptions you bet on, tested against a pass line set in
// advance. The app started from an offer already being sold, and its one
// experiment was the planner's, graded by a tap. Somebody closes the book and
// does not know what to do on Monday: which play, on what, and did it work.
// This answers those three and nothing else:
//
//   which play    ideas the model writes for this business from its own record
//                 (ideas.ts), and a catalogue from business books (PLAYS) —
//                 each one something to DO with a number that can be counted.
//                 The books that are ways of thinking are left to a chat.
//   on what       the part of the business the chain calls weakest (business.ts)
//   did it work   a pass line written before the bet starts — this many of
//                 that, by this day — read off the rows: sends, replies,
//                 meetings, payments at the person's price, projects finished,
//                 the conversations they log, and any count they name and log
//                 themselves (sign-ups, enquiries, orders) for the ways in the
//                 app cannot see. Nobody marks a bet passed; it passes when the
//                 count reaches the line, for the reason a worker cannot mark its
//                 own homework (invariant 10).
//
// One bet at a time, like the plan's experiment. Small batches are the book's
// own rule, and two bets running at once share every send, so neither result
// would mean anything. The plan's experiment can become the bet (it then takes
// the bet's verdict), so the app runs one experiment, not two.
//
// The clock is the book's line that runway is the number of pivots left: the
// runway the bank statements give, divided by the pace this person keeps.
// Every couple of weeks a checkpoint asks the book's question — pivot or
// persevere — keeps the answer with the chain as it stood, and reads it back at
// the next one against what the chain did since.
//
// It passes DIRECTION.md's survival test for the usual reason. A chat can
// explain The Mom Test; it cannot read two weeks of your sends and payments and
// say that a guarantee moved nothing at your price.
//
// The conversations are the one place the person brings in what the rows
// cannot see, so they carry three things beyond the count. Who it was, to the
// business: alone, a founder's bottleneck is finding out, and the people around
// the money — who sells to the buyers, who runs the work, who already earns in
// it, who knows them — know what a buyer will not tell a stranger. Only a buyer
// counts as one; the chain's "who buys" never sees the rest. An introduction,
// which goes cold in days: offered, it is something to follow up on the Path
// until a conversation is logged through it or the person says how it went.
// And their words, which a model writing an idea or a draft is shown — the
// person's own rows, so a number in them is one they gave (invariant 2).
//
// Stored without a migration, as copilot_events rows (LAB_EVENTS), the way deep
// work and the plan's ticks are. Pure: no DB import.

import type { AssetKind } from './assets';
import { LINK_KEYS, LINK_LABEL, LINK_STATES, chainChanges, evidenceState, type BusinessLink, type ChainChange, type EraCounts, type LinkKey, type LinkState } from './business';
import { isIsoDay, shiftDay } from './focus';
import { priceOf } from './plan';
import { unitSignal } from './signal';
import { moneyLabel } from './review';
import type { FoundBy, Offer } from './types';

/* ─── Storage ─────────────────────────────────────────────────────────────── */

export const LAB_BET = 'lab_bet';
export const LAB_STOP = 'lab_bet_stopped';
export const LAB_TALK = 'lab_talk';
export const LAB_CHECKPOINT = 'lab_checkpoint';
/** A count the person logged for a bet whose metric is theirs to count. */
export const LAB_COUNT = 'lab_count';
/** A project handed over for a bet, so the bet shows the work done for it. */
export const LAB_LINK = 'lab_link';
/** Ideas a model wrote for one part of the business (ideas.ts). The newest per part is the one shown. */
export const LAB_IDEAS = 'lab_ideas';
/** How an introduction someone offered went, said by the person: asked for, or fell through. */
export const LAB_INTRO = 'lab_intro';
/** A test the person wrote and did not start: kept on the shelf, with its line, until it is their one bet. */
export const LAB_SHELF = 'lab_shelf';
/** A shelf entry taken off without being started: the last word on it. */
export const LAB_SHELF_GONE = 'lab_shelf_gone';
export const LAB_EVENTS = [LAB_BET, LAB_STOP, LAB_TALK, LAB_CHECKPOINT, LAB_COUNT, LAB_LINK, LAB_IDEAS, LAB_INTRO, LAB_SHELF, LAB_SHELF_GONE] as const;
/**
 * Ideas asked for, being written in the background (proofai.ts startIdeas):
 * a reasoning model needs longer than a tap can wait behind the proxy, so the
 * tap starts the writing and Proof watches for the set, or for why there is none.
 * Read on their own (store.ts loadLabEvents), never in LAB_EVENTS' window: a
 * day of asking must not push a month-old bet out of it.
 */
export const LAB_IDEAS_ASKED = 'lab_ideas_asked';
/** Ideas asked for and not written, with why: said on Proof, never shown as no ideas (invariant 13). */
export const LAB_IDEAS_FAILED = 'lab_ideas_failed';
/** Ideas still "being written" after this belong to a process that is gone: a redeploy kills after() work. */
export const IDEAS_STALE_MS = 5 * 60_000;

/**
 * Said beside a play that came in as words shared from another app (seed.ts):
 * a chat's reply, kept on the bet it was shared for and never shown to a model as
 * the person's words or numbers (invariants 2 and 12). Here rather than in seed.ts
 * so the code that writes prompts can recognise one without importing the reader.
 */
export const SHARED_FROM = 'Shared from another app';

/* ─── What a bet can count ────────────────────────────────────────────────── */

export const LAB_METRICS = ['sent', 'replied', 'meetings', 'paid', 'paid_at_price', 'talks', 'committed', 'handed', 'logged'] as const;
export type LabMetric = (typeof LAB_METRICS)[number];

export interface MetricMeta {
  one: string;
  many: string;
  /**
   * Where the count comes from, said beside it: the app's own rows, or the
   * person's log. A logged number must never read as a measured one — the
   * working file's two sources, kept apart for the same reason.
   */
  from: 'rows' | 'log';
  /** Held against the price the offer named when the bet began. */
  priced?: boolean;
  /** Only outreach the app sends can produce it; a business whose buyers find it cannot count it here. */
  outreach?: boolean;
}

export const METRIC: Record<LabMetric, MetricMeta> = {
  sent: { one: 'message sent', many: 'messages sent', from: 'rows', outreach: true },
  replied: { one: 'reply', many: 'replies', from: 'rows', outreach: true },
  meetings: { one: 'meeting', many: 'meetings', from: 'rows' },
  paid: { one: 'payment', many: 'payments', from: 'rows' },
  paid_at_price: { one: 'sale at your price', many: 'sales at your price', from: 'rows', priced: true },
  talks: { one: 'conversation', many: 'conversations', from: 'log' },
  committed: { one: 'commitment', many: 'commitments', from: 'log' },
  handed: { one: 'project finished', many: 'projects finished', from: 'rows' },
  // The word is the person's: "sign-ups", "enquiries", "orders". These are the
  // fallback for a bet stored before it had one.
  logged: { one: 'count', many: 'counts', from: 'log' },
};

/** "sign-ups" → "sign-up". Plain English plurals only; anything else is kept as written. */
export function singular(unit: string): string {
  if (/ies$/i.test(unit)) return unit.replace(/ies$/i, 'y');
  if (/(?:ss|us|is)$/i.test(unit)) return unit;
  if (/(?:ches|shes|xes|sses)$/i.test(unit)) return unit.replace(/es$/i, '');
  return unit.replace(/s$/i, '');
}

/** "sales at your $150", "1 reply", "3 sign-ups" — the noun for a count, with the bet's own price or word where it has one. */
export function metricWords(m: LabMetric, n: number, priceLabel?: string | null, unit?: string | null): string {
  if (m === 'logged' && unit) return n === 1 ? singular(unit) : unit;
  const w = n === 1 ? METRIC[m].one : METRIC[m].many;
  return METRIC[m].priced && priceLabel ? w.replace('your price', `your ${priceLabel}`) : w;
}

/**
 * What can stand as "what it takes" beside each count: the step before it in
 * the funnel. Replies out of payments would be a ratio with nothing to say,
 * and a count with no step before it — sends, projects, a count the person
 * names — takes none.
 */
export const TRIES_FOR: Record<LabMetric, readonly LabMetric[]> = {
  sent: [],
  replied: ['sent'],
  meetings: ['replied', 'sent', 'talks'],
  paid: ['sent', 'replied', 'meetings', 'talks'],
  paid_at_price: ['sent', 'replied', 'meetings', 'talks'],
  talks: ['sent'],
  committed: ['talks'],
  handed: [],
  logged: [],
};

/** The counts a business can use, by how buyers find it: outreach's own counts only where the app sends. */
export function metricsFor(foundBy: FoundBy | null): LabMetric[] {
  return LAB_METRICS.filter((m) => !METRIC[m].outreach || foundBy === 'outreach' || foundBy == null);
}

/**
 * Why a count cannot decide a test for this business, or null. Sends and replies
 * only where the app sends: a kept test can outlive the day buyers were found by
 * outreach, and its sheet hides the count picker for a book's play, so the rule is
 * held where the test is written, not only where the picker is.
 */
export function countRefusal(metric: LabMetric, tries: { metric: LabMetric } | null, foundBy: FoundBy | null): string | null {
  const allowed = metricsFor(foundBy);
  const off = !allowed.includes(metric) ? metric : tries && !allowed.includes(tries.metric) ? tries.metric : null;
  return off ? `The app cannot count ${metricWords(off, 2)} for a business whose buyers do not come through its sends. Pick a count you log.` : null;
}

/**
 * Where a bet's count comes from, said under it, so a logged number never
 * reads as a measured one and nobody wonders why last month's sends are not in
 * it.
 */
export function countedFrom(m: LabMetric, start: string, priceLabel: string | null, unit?: string | null, linked = false): string {
  const since = `since ${dayWords(start)}`;
  // Measured and typed, both said: the link's rows are the app's, the tallies are the person's.
  if (m === 'logged' && linked && unitSignal(unit)) return `From the ${unit} your count link records, and any you log, ${since}.`;
  switch (m) {
    case 'sent': return `Counted from your sends ${since}. Nothing before the bet counts.`;
    case 'replied': return `Counted from replies ${since}, once per business.`;
    case 'meetings': return `Counted from the meetings you log ${since}.`;
    case 'paid': return `Counted from the sales you log ${since}. A promise to pay is not one.`;
    case 'paid_at_price': return `Counted from sales of ${priceLabel ?? 'your price'} or more ${since}. A cheaper sale does not count.`;
    case 'talks': return `From your conversation log ${since}: your count, not the app's.`;
    case 'committed': return `From your conversation log ${since}: the ones that ended in another call, an intro or money.`;
    case 'handed': return `Counted from the projects your agent finished ${since}.`;
    case 'logged': return `From the ${unit ?? 'counts'} you log ${since}: your count, not the app's.`;
  }
}

/**
 * The price a bet is held to, and how it is written. One function for the
 * route that stores it and the sheet that shows it, so the line previewed is
 * the line kept.
 */
export function betPrice(priceBand: string | null | undefined, currency: string): { price: number | null; priceLabel: string | null } {
  const price = priceOf(priceBand);
  return { price, priceLabel: price != null ? moneyLabel(price, currency) : null };
}

/* ─── The records ─────────────────────────────────────────────────────────── */

/** A play the catalogue does not hold: one a model wrote, the plan's experiment, or the person's own words for it. */
export interface BetIdea {
  label: string;
  how: string;
  /** Where it came from, said beside it: a book's title, "AI, from your record", "Your plan". */
  from: string;
  /** The asset the idea said to make before it starts, kept so the bet can offer to draft it. */
  prep?: { label: string; asset: AssetKind } | null;
}

export interface Bet {
  /** The event id of its opening. */
  id: string;
  part: LinkKey;
  /** What the person believes, in their words: "Pest control pays $150 for this". */
  belief: string;
  /** The catalogue play it runs, or null for one from an idea or the person's own. */
  play: string | null;
  /** The play it runs when the catalogue does not hold it. */
  idea: BetIdea | null;
  /** What decides it, and the line it has to reach by its last day. */
  metric: LabMetric;
  /** The person's word for a count they log ("sign-ups"); null for every other metric. */
  unit: string | null;
  target: number;
  /** What it takes, said beside the result for context. It never decides the verdict. */
  tries: { metric: LabMetric; planned: number } | null;
  days: number;
  /** The person's own day it began. Nothing before it counts. */
  start: string;
  /** The offer's price when it began, so changing the offer later cannot rewrite a verdict. */
  price: number | null;
  priceLabel: string | null;
  /** The plan's experiment this bet tests (experiment.ts), which then takes the bet's verdict. */
  experiment: string | null;
  /** The shelf entry it was started from, which leaves the shelf with it. Optional: bets before the shelf have none. */
  shelf?: string | null;
  /** The tap that opened it (isOpenNonce): a retry of that tap is answered as the tap was, not with a second bet. */
  nonce?: string | null;
  openedAt: string;
}
export type BetDraft = Omit<Bet, 'id' | 'openedAt' | 'shelf' | 'nonce'>;

/**
 * A test kept for later: everything a bet is but the day it starts and the price
 * it is held to, both of which are decided the day it does. Written by the person
 * in the bet sheet, so it has their belief and their line; a model's idea or a
 * play from a book reaches the shelf only through that sheet, never straight.
 */
export interface ShelfEntry {
  /** The event id of its keeping. */
  id: string;
  at: string;
  part: LinkKey;
  belief: string;
  play: string | null;
  idea: BetIdea | null;
  metric: LabMetric;
  unit: string | null;
  target: number;
  tries: { metric: LabMetric; planned: number } | null;
  days: number;
}
export type ShelfDraft = Omit<ShelfEntry, 'id' | 'at'>;

/** What the shelf holds. Past it a shelf is a backlog, and a backlog is where tests go to be forgotten. */
export const SHELF_MAX = 10;

export const COMMITMENTS = ['none', 'time', 'intro', 'money'] as const;
export type Commitment = (typeof COMMITMENTS)[number];
/**
 * The Mom Test's three currencies, and their absence. A conversation that ended
 * in a compliment ended in nothing: that is the book's whole point, and the
 * reason "none" is an answer rather than a blank.
 */
export const COMMITMENT_LABEL: Record<Commitment, string> = { none: 'Nothing', time: 'Another call', intro: 'An intro', money: 'Money' };

export const PROBLEMS = ['yes', 'no', 'unasked'] as const;
export type Problem = (typeof PROBLEMS)[number];
export const PROBLEM_LABEL: Record<Problem, string> = { yes: 'They have it', no: 'They do not', unasked: 'Did not come up' };

export const TALK_ROLES = ['buyer', 'seller', 'operator', 'earner', 'connector'] as const;
export type TalkRole = (typeof TALK_ROLES)[number];
/**
 * Who a conversation was with, by what they know. A buyer knows their own
 * problem. Who sells to them knows what they already pay for; who runs the work
 * knows where it breaks; who already earns in it knows what sells; who knows
 * people can open the next door. A tap, never a field to fill: the point is to
 * see who you have not talked to, not to keep a file on anyone.
 */
export const TALK_ROLE_LABEL: Record<TalkRole, string> = {
  buyer: 'Could buy', seller: 'Sells to them', operator: 'Runs the work', earner: 'Already earns in it', connector: 'Knows people',
};

/**
 * Whether "do they have the problem?" is theirs to answer. Somebody who sells to
 * the buyers, or already earns from them, does not have the problem; their
 * buyers do, and that is what they say, in their words.
 */
export function asksProblem(role: TalkRole): boolean {
  return role === 'buyer' || role === 'operator';
}

export interface Talk {
  id: string;
  /** The day it happened, the person's. */
  on: string;
  who: string | null;
  /**
   * Who they were to the business. A conversation logged before there was a
   * choice reads as a buyer's: the sheet then said "one conversation with
   * someone who could buy", so that is what it was logged as.
   */
  role: TalkRole;
  problem: Problem;
  commitment: Commitment;
  /** Their words, when worth keeping — the best first line a message ever gets. */
  said: string | null;
  /** The conversation where somebody offered the introduction this one came through. */
  via: string | null;
  at: string;
}
export type TalkDraft = Omit<Talk, 'id' | 'at'>;

/**
 * Who a conversation was with, read defensively: a payload from before there
 * was a choice (a cached home, a server mid-deploy) has no role, and was a
 * buyer's.
 */
export const roleOf = (t: Pick<Talk, 'role'>): TalkRole => t.role ?? 'buyer';

/** Only a buyer is one: the chain's "who buys" and its conversations to close never count the people around the money. */
export const isBuyer = (t: Pick<Talk, 'role'>): boolean => roleOf(t) === 'buyer';

export const INTRO_OUTCOMES = ['asked', 'dropped'] as const;
export type IntroOutcome = (typeof INTRO_OUTCOMES)[number];
/** How the person closed an introduction: they asked for it, or it fell through. */
export interface IntroClose { outcome: IntroOutcome; at: string }

/** One logging of the person's own count for a bet: "3 sign-ups on 2 Oct". */
export interface Tally {
  id: string;
  bet: string;
  n: number;
  on: string;
  note: string | null;
  at: string;
}
export type TallyDraft = Omit<Tally, 'id' | 'at'>;

export const LAB_DECISIONS = ['persevere', 'pivot'] as const;
export type LabDecision = (typeof LAB_DECISIONS)[number];

export interface Checkpoint {
  id: string;
  on: string;
  decision: LabDecision;
  /** The part a pivot changes. Null for persevere. */
  part: LinkKey | null;
  note: string | null;
  /** The chain as it stood when the decision was made, so the next one can read it back. */
  chain: Partial<Record<LinkKey, LinkState>>;
  at: string;
}
export type CheckpointDraft = Omit<Checkpoint, 'id' | 'at'>;

/** A play a model wrote for this business (ideas.ts), kept as written once it passed the same rules a bet is held to. */
export interface Idea {
  key: string;
  part: LinkKey;
  label: string;
  how: string;
  metric: LabMetric;
  unit: string | null;
  target: number;
  tries: { metric: LabMetric; planned: number } | null;
  days: number;
  /** A book the play comes from, only one from the list the model was given; null for the model's own idea. */
  book: string | null;
  /** Why this, now, in a sentence held to the person's own numbers — or null where the model's reason failed that. */
  why: string | null;
  /** An asset to draft before it starts. */
  prep: { label: string; asset: AssetKind } | null;
}

export interface IdeaSet {
  part: LinkKey;
  ideas: Idea[];
  model: string | null;
  at: string;
}

/** The newest ask for ideas on a part that has not ended in a set: still being written, or failed and why. */
export interface IdeaRunRow { kind: 'asked' | 'failed'; at: string; why: string | null }
export type IdeaRun = { state: 'writing'; at: string } | { state: 'failed'; at: string; why: string };

/**
 * Per part, the newest of: a set written, an ask, a failure — kept only when it
 * is not a set. Rows in any order; the newest wins, so an ask after a failure is
 * writing again, and a set after an ask is done.
 */
export function ideaRunsOf(rows: LabEventRow[]): Partial<Record<LinkKey, IdeaRunRow>> {
  const newest = new Map<LinkKey, { at: string; row: IdeaRunRow | null }>();
  for (const r of rows) {
    if (r.event_type !== LAB_IDEAS && r.event_type !== LAB_IDEAS_ASKED && r.event_type !== LAB_IDEAS_FAILED) continue;
    const p = r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {};
    if (!isPart(p.part)) continue;
    const was = newest.get(p.part);
    if (was && was.at > r.created_at) continue;
    newest.set(p.part, {
      at: r.created_at,
      row: r.event_type === LAB_IDEAS ? null
        : r.event_type === LAB_IDEAS_ASKED ? { kind: 'asked', at: r.created_at, why: null }
        : { kind: 'failed', at: r.created_at, why: typeof p.error === 'string' && p.error.trim() ? p.error.trim().slice(0, 300) : null },
    });
  }
  const out: Partial<Record<LinkKey, IdeaRunRow>> = {};
  for (const [part, v] of newest) if (v.row) out[part] = v.row;
  return out;
}

/** What an ask is now: writing while it is fresh, failed once it is not or once it said so. */
export function ideaRun(row: IdeaRunRow | null | undefined, now: Date): IdeaRun | null {
  if (!row) return null;
  if (row.kind === 'failed') return { state: 'failed', at: row.at, why: row.why ?? 'no reason was recorded' };
  const age = now.getTime() - Date.parse(row.at);
  return Number.isFinite(age) && age <= IDEAS_STALE_MS
    ? { state: 'writing', at: row.at }
    : { state: 'failed', at: row.at, why: 'it stopped without an answer, most likely a restart of the server' };
}

export const BELIEF_MAX = 160;
export const TARGET_MAX = 100;
export const PLANNED_MAX = 500;
export const BET_DAYS_MAX = 60;
export const WHO_MAX = 80;
export const SAID_MAX = 300;
export const NOTE_MAX = 300;
export const UNIT_MAX = 30;
export const IDEA_LABEL_MAX = 80;
export const IDEA_HOW_MAX = 320;
export const IDEA_FROM_MAX = 60;
/** One logging of a count, at most. A thousand sign-ups in a day is a different business. */
export const TALLY_MAX = 1000;
/** A week of calls logged on a Sunday is the usual case; a month is the edge of remembering one honestly. */
export const TALK_BACK_DAYS = 30;
/**
 * How long an introduction waits on the Path: from the day after it was
 * offered — the day it was logged, it is news, not a chore — for a month. Past
 * that, whoever offered it has forgotten, and a nudge that cannot be acted on is
 * noise; the conversation keeps it.
 */
export const INTRO_WAIT_DAYS = 1;
export const INTRO_DAYS = 30;
/**
 * How long after an introduction a conversation can say it came through it.
 * Longer than the nudge: a slow intro still counts as an intro, and the
 * nudge's month is about remembering to ask, not about when the call happens.
 */
export const INTRO_LINK_DAYS = 60;
/** What a model is shown of what people said: the newest, enough to hear a pattern, short of a transcript. */
export const HEARD_MAX = 10;
/** The checkpoint's rhythm: every two weeks, once a bet has ended since the last one. */
export const CHECKPOINT_DAYS = 14;
/** A bet's length until the person has started two: two weeks, the usual size of a play here. */
export const DEFAULT_BET_DAYS = 14;
/** How much the screen and the payload carry. */
export const MAX_BETS = 40;
export const MAX_TALKS = 60;
export const MAX_CHECKPOINTS = 12;
export const MAX_TALLIES = 200;

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Oct" from a day's own digits, so it reads the same in every zone. */
export function dayWords(day: string): string {
  const [, m, d] = day.slice(0, 10).split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1] ?? ''}`.trim() : day;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

const minDay = (...days: string[]) => days.reduce((a, b) => (b < a ? b : a));

/* ─── What comes in ───────────────────────────────────────────────────────── */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const int = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);
const isPart = (v: unknown): v is LinkKey => typeof v === 'string' && (LINK_KEYS as readonly string[]).includes(v);
const isMetric = (v: unknown): v is LabMetric => typeof v === 'string' && (LAB_METRICS as readonly string[]).includes(v);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const ASSET_KIND_SET = new Set(['offer', 'demo', 'script', 'landing_page', 'workflow', 'price_test']);

/** The person's word for a count: letters, spaces and a hyphen, short. "sign-ups", "walk-ins", "orders". */
export function unitOf(v: unknown): string | null {
  const u = text(v, UNIT_MAX)?.toLowerCase() ?? null;
  return u && /^[\p{L}][\p{L} '&/-]*$/u.test(u) && u.length >= 2 ? u : null;
}

/** An experiment's id, as the plan writes them: a slug, nothing else. */
const experimentId = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);

/** A play from outside the catalogue, held to the same lengths a model's is. */
export function ideaOf(v: unknown): BetIdea | null {
  const o = obj(v);
  const label = text(o.label, IDEA_LABEL_MAX);
  const how = text(o.how, IDEA_HOW_MAX);
  if (!label || !how) return null;
  const idea: BetIdea = { label, how, from: text(o.from, IDEA_FROM_MAX) ?? 'Your own' };
  const prep = prepOf(o.prep);
  if (prep) idea.prep = prep;
  return idea;
}

/** An asset to make first, held to the kinds there are: anything else is no prep, never a guess. */
function prepOf(v: unknown): { label: string; asset: AssetKind } | null {
  const p = obj(v);
  const label = text(p.label, IDEA_LABEL_MAX);
  const asset = typeof p.asset === 'string' && ASSET_KIND_SET.has(p.asset) ? (p.asset as AssetKind) : null;
  return label && asset ? { label, asset } : null;
}

/**
 * A bet as the person wrote it, held to what a verdict needs: a part, a belief
 * in a sentence, something countable and a line to reach by a day. Anything
 * else is refused with what to fix, never coerced into a bet nobody wrote.
 */
export function normalizeBet(raw: Record<string, unknown>, ctx: { today: string; price: number | null; priceLabel: string | null }): Result<BetDraft> {
  if (!isPart(raw.part)) return { ok: false, error: 'Which part of the business is it about?' };
  const belief = text(raw.belief, BELIEF_MAX);
  if (!belief) return { ok: false, error: 'Say what you believe, in one sentence.' };
  if (!isMetric(raw.metric)) return { ok: false, error: 'What should it count?' };
  const unit = raw.metric === 'logged' ? unitOf(raw.unit) : null;
  if (raw.metric === 'logged' && !unit) return { ok: false, error: 'Say what you will count, in a word or two: "sign-ups", "enquiries", "orders".' };
  const target = int(raw.target);
  if (!(target >= 1 && target <= TARGET_MAX)) return { ok: false, error: `The pass line is a count from 1 to ${TARGET_MAX}.` };
  const days = int(raw.days);
  if (!(days >= 1 && days <= BET_DAYS_MAX)) return { ok: false, error: `A bet runs from 1 to ${BET_DAYS_MAX} days.` };
  let tries: Bet['tries'] = null;
  if (raw.tries != null) {
    const t = obj(raw.tries);
    const planned = int(t.planned);
    // What it takes is the step before what it counts (TRIES_FOR): sends out
    // of payments is no plan, and a count the person names has no step before it.
    if (!isMetric(t.metric) || !TRIES_FOR[raw.metric].includes(t.metric) || !(planned >= 1 && planned <= PLANNED_MAX)) {
      return { ok: false, error: `What it takes is a different count, from 1 to ${PLANNED_MAX}.` };
    }
    tries = { metric: t.metric, planned };
  }
  // A sale at your price with no price said would pass on any payment, which
  // is the one-dollar test the chain refuses to call a sale.
  if (METRIC[raw.metric].priced && ctx.price == null) return { ok: false, error: 'Say what it costs first: a sale at your price needs a price.' };
  const play = typeof raw.play === 'string' && PLAY_BY_KEY.has(raw.play) ? raw.play : null;
  return {
    ok: true,
    value: {
      part: raw.part, belief, play, idea: play ? null : ideaOf(raw.idea), metric: raw.metric, unit, target, tries, days,
      start: ctx.today, price: ctx.price, priceLabel: ctx.priceLabel, experiment: experimentId(raw.experiment),
    },
  };
}

/**
 * A test to keep, held to exactly what starting a bet holds it to — a part, a
 * belief in a sentence, something countable, a line and a length — because the
 * shelf is where tests wait to be bets and any entry has to be able to become one
 * as it stands. "No test, no entry" is this function, not a promise: it is
 * `normalizeBet`, less the day and price that belong to the day it starts. There
 * is no score and no market size to give it; a field it does not know is dropped.
 */
export function normalizeShelf(raw: Record<string, unknown>, ctx: { today: string; price: number | null; priceLabel: string | null }): Result<ShelfDraft> {
  const v = normalizeBet({ ...raw, experiment: null }, ctx);
  if (!v.ok) return v;
  const { part, belief, play, idea, metric, unit, target, tries, days } = v.value;
  return { ok: true, value: { part, belief, play, idea, metric, unit, target, tries, days } };
}

type TestKey = Pick<ShelfEntry, 'part' | 'belief' | 'metric' | 'play' | 'idea'>;
/**
 * The same test twice: the same part, belief, count and play. Not the belief
 * alone — every play and idea on a part opens the sheet with the same suggested
 * belief, so two different plays kept as they came would read as one.
 */
function sameTest(a: TestKey, b: TestKey): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
  const play = (e: TestKey) => e.play ?? (e.idea ? `idea:${norm(e.idea.label)}` : '');
  return a.part === b.part && a.metric === b.metric && norm(a.belief) === norm(b.belief) && play(a) === play(b);
}

/**
 * Why a test cannot be kept, or null: the same test twice, or a full shelf. In
 * that order: told the shelf is full, a person takes one off to make room and is
 * then told the test was on it all along.
 */
export function shelfRefusal(shelf: TestKey[], draft: TestKey): string | null {
  if (shelf.some((e) => sameTest(e, draft))) return 'That is already on your shelf.';
  if (shelf.length >= SHELF_MAX) return `The shelf holds ${SHELF_MAX}. Start one, or take one off, to keep another.`;
  return null;
}

const isRole = (v: unknown): v is TalkRole => typeof v === 'string' && (TALK_ROLES as readonly string[]).includes(v);
/** A stored event's id, as a conversation names the one it came through: digits from the table, or a test's slug. */
const talkRef = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);

/**
 * A conversation as the person logged it. `via` names the introduction it came
 * through, and has to be one in their record, offered on or before this
 * conversation's day: `known` is that record, which the caller reads only when
 * there is a `via` to check.
 */
export function normalizeTalk(raw: Record<string, unknown>, today: string, known: Array<Pick<Talk, 'id' | 'on' | 'commitment'>> = []): Result<TalkDraft> {
  const on = raw.on == null || raw.on === '' ? today : raw.on;
  if (!isIsoDay(on)) return { ok: false, error: 'That is not a day.' };
  if (on > today) return { ok: false, error: 'That day has not happened yet.' };
  if (on < shiftDay(today, -TALK_BACK_DAYS)) return { ok: false, error: `Only the last ${TALK_BACK_DAYS} days can be logged.` };
  // Missing is a buyer, as every conversation was before there was a choice;
  // anything else unknown is refused rather than filed as one.
  if (raw.role != null && raw.role !== '' && !isRole(raw.role)) return { ok: false, error: 'Who were they to the business?' };
  const role: TalkRole = isRole(raw.role) ? raw.role : 'buyer';
  let via: string | null = null;
  if (raw.via != null && raw.via !== '') {
    const intro = known.find((t) => t.id === talkRef(raw.via));
    if (!intro || intro.commitment !== 'intro') return { ok: false, error: 'That introduction is not in your record.' };
    if (intro.on > on) return { ok: false, error: 'That introduction was offered after this conversation.' };
    via = intro.id;
  }
  // Asked only of the people who could have it: a supplier's "yes" would read
  // as one more business with the problem.
  const problem = asksProblem(role) && (PROBLEMS as readonly string[]).includes(raw.problem as string) ? (raw.problem as Problem) : 'unasked';
  const commitment = (COMMITMENTS as readonly string[]).includes(raw.commitment as string) ? (raw.commitment as Commitment) : 'none';
  return { ok: true, value: { on, who: text(raw.who, WHO_MAX), role, problem, commitment, said: text(raw.said, SAID_MAX), via } };
}

/** How an introduction went, said once the person knows: only an introduction in their record. */
export function normalizeIntroClose(raw: Record<string, unknown>, talks: Array<Pick<Talk, 'id' | 'commitment'>>): Result<{ talk: string; outcome: IntroOutcome }> {
  const t = talks.find((x) => x.id === talkRef(raw.talk));
  if (!t || t.commitment !== 'intro') return { ok: false, error: 'That introduction is not in your record.' };
  if (!(INTRO_OUTCOMES as readonly string[]).includes(raw.outcome as string)) return { ok: false, error: 'Did you ask for it, or did it fall through?' };
  return { ok: true, value: { talk: t.id, outcome: raw.outcome as IntroOutcome } };
}

/**
 * One logging of a count the person keeps for a bet. The day is theirs and
 * inside the bet — before it began nothing counts, and a day not lived yet is
 * refused rather than counted early.
 */
export function normalizeTally(raw: Record<string, unknown>, bet: Pick<Bet, 'id' | 'start' | 'days' | 'metric'>, today: string): Result<TallyDraft> {
  if (bet.metric !== 'logged') return { ok: false, error: 'That bet counts something the app keeps itself.' };
  const n = int(raw.n);
  if (!(n >= 1 && n <= TALLY_MAX)) return { ok: false, error: `Log a count from 1 to ${TALLY_MAX}.` };
  const on = raw.on == null || raw.on === '' ? today : raw.on;
  if (!isIsoDay(on)) return { ok: false, error: 'That is not a day.' };
  if (on > today) return { ok: false, error: 'That day has not happened yet.' };
  const last = shiftDay(bet.start, bet.days - 1);
  if (on < bet.start || on > last) return { ok: false, error: `The bet ran from ${dayWords(bet.start)} to ${dayWords(last)}; only those days count.` };
  return { ok: true, value: { bet: bet.id, n, on, note: text(raw.note, NOTE_MAX) } };
}

export function normalizeCheckpoint(raw: Record<string, unknown>, today: string): Result<CheckpointDraft> {
  if (!(LAB_DECISIONS as readonly string[]).includes(raw.decision as string)) return { ok: false, error: 'Pivot or persevere?' };
  const decision = raw.decision as LabDecision;
  const part = isPart(raw.part) ? raw.part : null;
  if (decision === 'pivot' && !part) return { ok: false, error: 'Which part are you changing?' };
  const c = obj(raw.chain);
  const chain: Partial<Record<LinkKey, LinkState>> = {};
  for (const k of LINK_KEYS) if ((LINK_STATES as readonly string[]).includes(c[k] as string)) chain[k] = c[k] as LinkState;
  return { ok: true, value: { on: today, decision, part: decision === 'pivot' ? part : null, note: text(raw.note, NOTE_MAX), chain } };
}

/**
 * A stored test's line — what it counts, the person's word for it, the line, the
 * days and what it takes — reshaped rather than trusted. Null when it does not
 * hold together. One reader for ideas and kept tests, which are held to one line.
 */
function storedLine(o: Record<string, unknown>): Pick<Idea, 'metric' | 'unit' | 'target' | 'tries' | 'days'> | null {
  if (!isMetric(o.metric)) return null;
  const unit = o.metric === 'logged' ? unitOf(o.unit) : null;
  if (o.metric === 'logged' && !unit) return null;
  const target = int(o.target);
  const days = int(o.days);
  if (!(target >= 1 && target <= TARGET_MAX) || !(days >= 1 && days <= BET_DAYS_MAX)) return null;
  const t = obj(o.tries);
  const planned = int(t.planned);
  const tries = isMetric(t.metric) && TRIES_FOR[o.metric].includes(t.metric) && planned >= 1 && planned <= PLANNED_MAX ? { metric: t.metric, planned } : null;
  return { metric: o.metric, unit, target, tries, days };
}

/**
 * An idea as stored, reshaped rather than trusted: the same lengths, metrics
 * and lines a bet is held to, so an idea on screen can always become a bet.
 * Null when it does not hold together.
 */
export function ideaFromStored(v: unknown, part: LinkKey): Idea | null {
  const o = obj(v);
  const label = text(o.label, IDEA_LABEL_MAX);
  const how = text(o.how, IDEA_HOW_MAX);
  const line = storedLine(o);
  if (!label || !how || !line) return null;
  return {
    key: text(o.key, 64) ?? `ai-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    part, label, how, ...line,
    book: text(o.book, IDEA_FROM_MAX), why: text(o.why, 240),
    prep: prepOf(o.prep),
  };
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface LabEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

export interface LabLedger {
  bets: Bet[];
  /** Bet id → when the person called it off, and what they wrote. */
  stopped: Map<string, { at: string; note: string | null }>;
  talks: Talk[];
  checkpoints: Checkpoint[];
  /** The counts the person logged, newest first. */
  tallies: Tally[];
  /** Bet id → the projects handed over for it, in the order they were. */
  links: Map<string, string[]>;
  /** The newest ideas for each part. */
  ideas: Partial<Record<LinkKey, IdeaSet>>;
  /** Talk id → how the introduction offered in it went, as the person last said. */
  intros: Map<string, IntroClose>;
  /** Tests kept for later, newest first: not taken off, and not started. */
  shelf: ShelfEntry[];
}

/** A shelf entry as stored, reshaped rather than trusted: the lengths, counts and lines a bet is held to. */
function storedShelf(p: Record<string, unknown>, id: string, at: string): ShelfEntry | null {
  const belief = text(p.belief, BELIEF_MAX);
  const line = storedLine(p);
  if (!isPart(p.part) || !belief || !line) return null;
  const play = typeof p.play === 'string' && PLAY_BY_KEY.has(p.play) ? p.play : null;
  return { id, at, part: p.part, belief, play, idea: play ? null : ideaOf(p.idea), ...line };
}

/**
 * The shelf, from whichever rows are given: every test kept, less the ones taken
 * off and the ones a bet started from, newest first. A window of the newest rows
 * can only lose an entry, never bring a finished one back: a test's start or
 * take-off is always newer than its keeping.
 */
export function shelfFromEvents(rows: LabEventRow[]): ShelfEntry[] {
  const kept: ShelfEntry[] = [];
  const gone = new Set<string>();
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const p = obj(r.payload);
    if (r.event_type === LAB_SHELF) {
      const entry = storedShelf(p, String(r.id), r.created_at);
      if (entry) kept.push(entry);
    } else if (r.event_type === LAB_SHELF_GONE) {
      if (typeof p.entry === 'string') gone.add(p.entry);
    } else if (r.event_type === LAB_BET) {
      // A test leaves the shelf by being started or by being taken off, whichever came: neither is undone.
      const from = experimentId(p.shelf);
      if (from) gone.add(from);
    }
  }
  return kept.filter((e) => !gone.has(e.id)).reverse().slice(0, SHELF_MAX);
}

/** A stored bet, reshaped rather than trusted. Null when it does not hold together. */
function storedBet(p: Record<string, unknown>, id: string, at: string): Bet | null {
  const target = int(p.target);
  const days = int(p.days);
  const belief = text(p.belief, BELIEF_MAX);
  if (!isPart(p.part) || !belief || !isMetric(p.metric) || !(target >= 1) || !(days >= 1) || !isIsoDay(p.start)) return null;
  const unit = p.metric === 'logged' ? unitOf(p.unit) : null;
  const t = obj(p.tries);
  const planned = int(t.planned);
  const price = typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0 ? p.price : null;
  const play = typeof p.play === 'string' && PLAY_BY_KEY.has(p.play) ? p.play : null;
  return {
    id, part: p.part, belief, metric: p.metric, unit, target, days, start: p.start, openedAt: at,
    play, idea: play ? null : ideaOf(p.idea),
    tries: isMetric(t.metric) && planned >= 1 ? { metric: t.metric, planned } : null,
    price, priceLabel: price != null ? text(p.priceLabel, 24) : null,
    experiment: experimentId(p.experiment),
    shelf: experimentId(p.shelf),
    nonce: isOpenNonce(p.nonce) ? p.nonce : null,
  };
}

/** A tap's own word, sent with "Start the bet": the same on a retry of that tap, new on the next one. */
export const isOpenNonce = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{8,64}$/.test(v);

/** Written first: by when it was opened, then by the table's own order for two opened in the same instant. */
function openedBefore(a: Pick<Bet, 'id' | 'openedAt'>, b: Pick<Bet, 'id' | 'openedAt'>): boolean {
  if (a.openedAt !== b.openedAt) return a.openedAt < b.openedAt;
  const [x, y] = [Number(a.id), Number(b.id)];
  return Number.isFinite(x) && Number.isFinite(y) ? x < y : a.id < b.id;
}

/**
 * Whether the bet `mine`, just opened, lost a race to open. The route refuses
 * a second bet while one runs, but it reads the record before it writes: a
 * double tap, or a request the phone sent again, passes that read twice before
 * either write lands. The live account ended a day with the same bet opened
 * twice and one of the pair called off. So the write is read back, as the rows
 * judge it: when another bet runs that was opened before this one, this one is
 * the second and is withdrawn by the request that wrote it. `same` says the one
 * that stays came from the same tap — the second answer is then the first one's,
 * not a refusal.
 */
export function openRace(bets: Array<Pick<BetView, 'state'> & { bet: Pick<Bet, 'id' | 'openedAt' | 'nonce'> }>, mine: string): { first: string; same: boolean } | null {
  const own = bets.find((v) => v.bet.id === mine);
  if (!own || own.state !== 'running') return null;
  const first = bets
    .filter((v) => v.state === 'running' && v.bet.id !== mine && openedBefore(v.bet, own.bet))
    .sort((a, b) => (openedBefore(a.bet, b.bet) ? -1 : 1))[0];
  if (!first) return null;
  return { first: first.bet.id, same: !!own.bet.nonce && first.bet.nonce === own.bet.nonce };
}

export function labFromEvents(rows: LabEventRow[]): LabLedger {
  const out: LabLedger = { bets: [], stopped: new Map(), talks: [], checkpoints: [], tallies: [], links: new Map(), ideas: {}, intros: new Map(), shelf: shelfFromEvents(rows) };
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const p = obj(r.payload);
    const id = String(r.id);
    if (r.event_type === LAB_BET) {
      const bet = storedBet(p, id, r.created_at);
      if (bet) out.bets.push(bet);
    } else if (r.event_type === LAB_STOP) {
      const bet = typeof p.bet === 'string' ? p.bet : null;
      // The first call-off is the one: a second tap on a stopped bet changes nothing.
      if (bet && !out.stopped.has(bet)) out.stopped.set(bet, { at: r.created_at, note: text(p.note, NOTE_MAX) });
    } else if (r.event_type === LAB_TALK) {
      if (!isIsoDay(p.on)) continue;
      out.talks.push({
        id, on: p.on, at: r.created_at, who: text(p.who, WHO_MAX), said: text(p.said, SAID_MAX),
        role: isRole(p.role) ? p.role : 'buyer',
        problem: (PROBLEMS as readonly string[]).includes(p.problem as string) ? (p.problem as Problem) : 'unasked',
        commitment: (COMMITMENTS as readonly string[]).includes(p.commitment as string) ? (p.commitment as Commitment) : 'none',
        via: talkRef(p.via),
      });
    } else if (r.event_type === LAB_CHECKPOINT) {
      if (!isIsoDay(p.on) || !(LAB_DECISIONS as readonly string[]).includes(p.decision as string)) continue;
      const c = obj(p.chain);
      const chain: Partial<Record<LinkKey, LinkState>> = {};
      for (const k of LINK_KEYS) if ((LINK_STATES as readonly string[]).includes(c[k] as string)) chain[k] = c[k] as LinkState;
      out.checkpoints.push({ id, on: p.on, at: r.created_at, decision: p.decision as LabDecision, part: isPart(p.part) ? p.part : null, note: text(p.note, NOTE_MAX), chain });
    } else if (r.event_type === LAB_COUNT) {
      const n = int(p.n);
      if (typeof p.bet !== 'string' || !isIsoDay(p.on) || !(n >= 1 && n <= TALLY_MAX)) continue;
      out.tallies.push({ id, bet: p.bet, n, on: p.on, note: text(p.note, NOTE_MAX), at: r.created_at });
    } else if (r.event_type === LAB_LINK) {
      const bet = typeof p.bet === 'string' ? p.bet : null;
      const project = typeof p.commission === 'string' ? p.commission.slice(0, 64) : null;
      if (!bet || !project) continue;
      const held = out.links.get(bet) ?? [];
      if (!held.includes(project)) out.links.set(bet, [...held, project]);
    } else if (r.event_type === LAB_IDEAS) {
      if (!isPart(p.part)) continue;
      const part = p.part;
      const ideas = (Array.isArray(p.ideas) ? p.ideas : []).map((x) => ideaFromStored(x, part)).filter((x): x is Idea => !!x).slice(0, 3);
      // Newest wins: the rows arrive oldest first.
      if (ideas.length) out.ideas[part] = { part, ideas, model: text(p.model, 80), at: r.created_at };
    } else if (r.event_type === LAB_INTRO) {
      const talk = talkRef(p.talk);
      // The last word wins: asked for on Monday, fallen through by Friday.
      if (talk && (INTRO_OUTCOMES as readonly string[]).includes(p.outcome as string)) out.intros.set(talk, { outcome: p.outcome as IntroOutcome, at: r.created_at });
    }
  }
  out.bets.reverse();
  out.talks.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
  out.checkpoints.reverse();
  out.tallies.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
  return out;
}

/* ─── Counting ────────────────────────────────────────────────────────────── */

/** The rows a bet is read against, each already on the person's own day. */
export interface DayRows {
  sends: string[];
  outcomes: Array<{ kind: string; day: string; opportunity: string | null; amount: number | null }>;
  finished: string[];
  talks: Talk[];
  /** The person's own counts, by bet. */
  tallies?: Array<Pick<Tally, 'bet' | 'n' | 'on'>>;
  /** Sign-ups and enquiries the count link recorded (signal.ts), on the person's day. */
  signals?: Array<{ kind: 'signup' | 'enquiry'; on: string }>;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/**
 * The calendar day an instant falls on, where the person lives. One formatter
 * per zone: a bet is read against every send since it began, and building a
 * formatter per row is most of the cost of reading them.
 */
export function dayIn(iso: string | null | undefined, timezone: string): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  let f = formatters.get(timezone);
  if (!f) {
    try { f = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }); }
    formatters.set(timezone, f);
  }
  return f.format(new Date(t));
}

/**
 * How many of a thing happened from one day to another, both included. `bet`
 * names whose counts a logged metric reads, and `unit` its word for them: a bet
 * counting "sign-ups" or "enquiries" counts what the count link recorded too
 * (signal.ts unitSignal), so a person with the link does not type what it saw.
 */
export function countIn(metric: LabMetric, from: string, to: string, rows: DayRows, price: number | null, bet?: string, unit?: string | null): number {
  if (to < from) return 0;
  const inside = (day: string) => day >= from && day <= to;
  const won = () => rows.outcomes.filter((o) => o.kind === 'won' && inside(o.day));
  switch (metric) {
    case 'sent': return rows.sends.filter(inside).length;
    case 'replied': {
      // Once per business, as the funnel counts a reply: two messages back from
      // one prospect are one conversation started, not two.
      const seen = new Set<string>();
      let n = 0;
      for (const o of rows.outcomes) {
        if (o.kind !== 'reply' || !inside(o.day)) continue;
        if (o.opportunity) {
          if (seen.has(o.opportunity)) continue;
          seen.add(o.opportunity);
        }
        n += 1;
      }
      return n;
    }
    case 'meetings': return rows.outcomes.filter((o) => o.kind === 'meeting' && inside(o.day)).length;
    case 'paid': return won().length;
    case 'paid_at_price': return price == null ? 0 : won().filter((o) => o.amount != null && o.amount >= price).length;
    case 'talks': return rows.talks.filter((t) => inside(t.on)).length;
    case 'committed': return rows.talks.filter((t) => inside(t.on) && t.commitment !== 'none').length;
    case 'handed': return rows.finished.filter(inside).length;
    // Only this bet's own counts: two bets naming "sign-ups" a month apart are
    // two counts, never one tally read twice. The link's, by the bet's own word.
    case 'logged': {
      const typed = (rows.tallies ?? []).filter((t) => t.bet === bet && inside(t.on)).reduce((s, t) => s + t.n, 0);
      const kind = unitSignal(unit);
      return typed + (kind ? (rows.signals ?? []).filter((s) => s.kind === kind && inside(s.on)).length : 0);
    }
  }
}

/**
 * What the funnel counted from the day a bet began to the day it was read to:
 * every count, not only the one that decides it (reading.ts says what is made of
 * them). Counted by `countIn`, the function the verdict uses, so the two cannot
 * disagree about a single row.
 */
export type Reading = Partial<Record<LabMetric, number>>;

export function readingOf(bet: Pick<Bet, 'id' | 'start' | 'price'> & { unit?: string | null }, through: string, rows: DayRows): Reading {
  const out: Reading = {};
  for (const m of LAB_METRICS) out[m] = countIn(m, bet.start, through, rows, bet.price, bet.id, bet.unit);
  return out;
}

export type BetState = 'running' | 'passed' | 'failed' | 'stopped';

export const BET_STATE_LABEL: Record<BetState, string> = { running: 'Running', passed: 'Passed', failed: 'Did not pass', stopped: 'Called off' };

export interface BetView {
  bet: Bet;
  state: BetState;
  result: number;
  /** What it took, when the bet says what it takes. */
  tries: number | null;
  /**
   * Every count since it began, to today (readingOf) — on the running bet only.
   * Optional: a finished bet has none, and neither has a payload from before
   * readings, whose card shows what it always did. Never read for the verdict.
   */
  reading?: Reading;
  /** The bet's last day. */
  last: string;
  /** Day n of the bet, while it runs. */
  day: number;
  /** The day it crossed the line, was called off, or ran out. Null while it runs. */
  ended: string | null;
  /** What the person wrote when they called it off — kept, and shown where it ended up. */
  note: string | null;
}

/**
 * Where a bet stands, from the rows alone. It passes the day its count reaches
 * the line — early is fine, and a pass is not undone by calling it off after —
 * and it does not pass when its last day goes by short of the line. A stop is
 * the person's, and counts only what came before it.
 *
 * A pass closes the bet on the day it crossed, and its counts stop there. The
 * slot is free that day, so what comes after belongs to the next bet: counted
 * on to the old one's last day, a pass on day three read "23 sent against the
 * 10 planned" a week later, with the next bet's sends.
 */
export function betView(bet: Bet, stoppedOn: string | null, rows: DayRows, today: string): BetView {
  const last = shiftDay(bet.start, bet.days - 1);
  const through = minDay(today, last, stoppedOn ?? last);
  const count = (m: LabMetric, to: string) => countIn(m, bet.start, to, rows, bet.price, bet.id, bet.unit);
  const result = count(bet.metric, through);
  const tries = bet.tries ? count(bet.tries.metric, through) : null;
  const day = Math.min(bet.days, Math.max(1, daysBetween(bet.start, minDay(today, last)) + 1));
  const base = { bet, result, tries, last, day, note: null };
  if (result >= bet.target) {
    let crossed = through;
    for (let d = bet.start; d <= through; d = shiftDay(d, 1)) {
      if (count(bet.metric, d) >= bet.target) { crossed = d; break; }
    }
    return {
      ...base, state: 'passed', ended: crossed,
      result: count(bet.metric, crossed), tries: bet.tries ? count(bet.tries.metric, crossed) : null,
    };
  }
  if (stoppedOn) return { ...base, state: 'stopped', ended: stoppedOn };
  if (today > last) return { ...base, state: 'failed', ended: last };
  return { ...base, state: 'running', ended: null };
}

/* ─── The Lab, as the server hands it over ────────────────────────────────── */

export interface LabHome {
  /** Newest first. At most one is running. */
  bets: BetView[];
  /** Newest first. */
  talks: Talk[];
  /** Newest first. */
  checkpoints: Checkpoint[];
  /** The person's own counts, newest first. Optional: a payload from before them has none. */
  tallies?: Tally[];
  /** Bet id → the projects handed over for it. */
  links?: Record<string, string[]>;
  /** The newest ideas a model wrote, per part. */
  ideas?: Partial<Record<LinkKey, IdeaSet>>;
  /** Per part, an ask for ideas still being written or failed (ideaRunsOf). Optional: a payload from before has none. */
  ideaRuns?: Partial<Record<LinkKey, IdeaRunRow>>;
  /** Talk id → how the introduction offered in it went, where the person has said. */
  intros?: Record<string, IntroClose>;
  /** Tests kept for later, newest first. Optional: a payload from before the shelf has none. */
  shelf?: ShelfEntry[];
  /**
   * The funnel's counts from each pivot's day on (era.ts), keyed by the day:
   * what the chain judges a restarted part on. Optional: a payload from before
   * pivots restarted anything has none, and its chain reads all time, as it did.
   */
  eras?: Record<string, EraCounts>;
  /** The read's failure, said on the tab — never shown as an empty Lab (invariant 13). */
  unreadable: string | null;
}

export interface LabInput {
  events: LabEventRow[];
  unreadable: string | null;
  timezone: string;
  today: string;
  /** When each message went out. */
  sends: Array<string | null | undefined>;
  outcomes: Array<{ kind: string; opportunity_id: string | null; occurred_at?: string | null; amount?: number | null }>;
  /** When each project handed over was finished. */
  finished: Array<string | null | undefined>;
  /** What the count link recorded, already on the person's day (store.ts reads it). */
  signals?: Array<{ kind: 'signup' | 'enquiry'; on: string }>;
  /**
   * The shelf's own rows (store.ts loadLabEvents): kept tests wait for weeks, and
   * a window of the newest lab events in general would drop one silently once
   * enough counts and conversations came after it. Absent, the shelf is read from
   * `events`.
   */
  shelfEvents?: LabEventRow[];
  /** Asks for ideas and their failures (LAB_IDEAS_ASKED, LAB_IDEAS_FAILED), read on their own. */
  ideaRunEvents?: LabEventRow[];
}

/**
 * Every bet read against the rows. Only rows from the day before the oldest
 * bet onward are put on a day at all — a year of sends does not need reading
 * for a bet that began on Monday — and the day before, because an instant's day
 * depends on the zone and the cut is made in UTC.
 */
export function labHome(i: LabInput): LabHome {
  const ledger = labFromEvents(i.events);
  const bets = ledger.bets.slice(0, MAX_BETS);
  const oldest = bets.reduce<string | null>((a, b) => (!a || b.start < a ? b.start : a), null);
  const cut = oldest ? Date.parse(`${oldest}T00:00:00Z`) - DAY_MS : Number.POSITIVE_INFINITY;
  const keep = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= cut;
  const days = (xs: Array<string | null | undefined>) => xs.filter(keep).map((x) => dayIn(x, i.timezone)).filter((d): d is string => !!d);
  const rows: DayRows = {
    sends: days(i.sends),
    finished: days(i.finished),
    outcomes: i.outcomes.filter((o) => keep(o.occurred_at)).map((o) => ({
      kind: o.kind, day: dayIn(o.occurred_at, i.timezone) ?? '', opportunity: o.opportunity_id,
      amount: typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null,
    })).filter((o) => !!o.day),
    talks: ledger.talks,
    tallies: ledger.tallies,
    signals: i.signals ?? [],
  };
  return {
    bets: bets.map((b) => {
      const stop = ledger.stopped.get(b.id);
      const view = betView(b, stop ? dayIn(stop.at, i.timezone) : null, rows, i.today);
      // Only the running bet is read this way — the card and Claude show no other —
      // so forty finished bets do not cost nine counts each on every load. Read to
      // today, never past the last day: after it, the next bet's sends are not this one's.
      return view.state === 'running'
        ? { ...view, note: stop?.note ?? null, reading: readingOf(b, minDay(i.today, view.last), rows) }
        : { ...view, note: stop?.note ?? null };
    }),
    talks: ledger.talks.slice(0, MAX_TALKS),
    checkpoints: ledger.checkpoints.slice(0, MAX_CHECKPOINTS),
    tallies: ledger.tallies.slice(0, MAX_TALLIES),
    links: Object.fromEntries(ledger.links),
    ideas: ledger.ideas,
    ideaRuns: ideaRunsOf([...i.events, ...(i.ideaRunEvents ?? [])]),
    intros: Object.fromEntries(ledger.intros),
    shelf: i.shelfEvents ? shelfFromEvents(i.shelfEvents) : ledger.shelf,
    unreadable: i.unreadable,
  };
}

/**
 * The plan's experiments a bet has settled: an experiment made into a bet takes
 * the bet's verdict — passed is worked, did not pass is failed, called off is
 * could not tell — so the planner hears what the rows said, not a tap. Only
 * those with no verdict recorded since the bet opened; the caller writes them.
 */
export function experimentVerdicts(
  bets: BetView[],
  marks: Array<{ id: string; state: string; at: string }>,
): Array<{ id: string; title: string; state: 'worked' | 'failed' | 'unclear' }> {
  const out: Array<{ id: string; title: string; state: 'worked' | 'failed' | 'unclear' }> = [];
  for (const v of bets) {
    const id = v.bet.experiment;
    if (!id || v.state === 'running') continue;
    const said = marks.some((m) => m.id === id && ['worked', 'failed', 'unclear'].includes(m.state) && m.at >= v.bet.openedAt);
    if (said || out.some((o) => o.id === id)) continue;
    out.push({ id, title: v.bet.idea?.label ?? v.bet.belief, state: v.state === 'passed' ? 'worked' : v.state === 'failed' ? 'failed' : 'unclear' });
  }
  return out;
}

/* ─── The clock ───────────────────────────────────────────────────────────── */

export interface Clock {
  runwayMonths: number | null;
  /**
   * How long a bet takes this person: the median gap between one bet starting
   * and the next, or the default until there are two.
   */
  betDays: number;
  measured: boolean;
  /** Runway in bets: the book's pivots left, counted. Null without a runway. */
  betsLeft: number | null;
}

/**
 * Runway divided by the pace the person has actually kept. The pace is the gap
 * between bet starts, not how long each one ran: a bet called off on day three
 * and a pass on day eight would make bets look short, and the days between one
 * ending and the next beginning are spent all the same. A median, so one long
 * pause is a pause and not the new pace.
 */
export function labClock(runwayMonths: number | null, bets: BetView[]): Clock {
  const starts = bets.map((b) => b.bet.start).sort();
  const gaps = starts.slice(1).map((d, i) => Math.max(1, daysBetween(starts[i], d))).sort((a, b) => a - b);
  const mid = gaps.length ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : Math.round((gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)) : DEFAULT_BET_DAYS;
  const betDays = Math.max(1, mid);
  return {
    runwayMonths,
    betDays,
    measured: gaps.length > 0,
    betsLeft: runwayMonths != null && runwayMonths >= 0 ? Math.floor((runwayMonths * MONTH_DAYS) / betDays) : null,
  };
}

/* ─── Pivot or persevere ──────────────────────────────────────────────────── */

/** How far along a part is, for reading a decision back. A part that failed on its evidence has learned more than one never said. */
const RANK: Record<LinkState, number> = { missing: 0, untested: 1, stuck: 1, testing: 2, works: 3 };

export type Grade = 'better' | 'same' | 'worse';

export interface CheckpointView {
  due: boolean;
  last: Checkpoint | null;
  /** Bets that ended since the last checkpoint — or ever, before the first. */
  ended: BetView[];
  /** What the chain did since the last checkpoint. */
  moved: ChainChange[];
  /**
   * The last decision read back: the part a pivot changed, or every part for
   * persevere, against what it has done since. Null before there is a decision
   * to read, or a chain that was not kept with it.
   */
  grade: Grade | null;
  /** When the next one comes due by the calendar, once there has been one. */
  nextOn: string | null;
}

export function checkpointView(input: { checkpoints: Checkpoint[]; bets: BetView[]; links: BusinessLink[]; today: string }): CheckpointView {
  const last = input.checkpoints[0] ?? null;
  // A bet that ended on the checkpoint's own day was in front of the person
  // when they decided, so it counts toward that one and not the next.
  const ended = input.bets.filter((b) => b.state !== 'running' && !!b.ended && (!last || b.ended > last.on));
  const due = ended.length > 0 && (!last || daysBetween(last.on, input.today) >= CHECKPOINT_DAYS);
  const moved = last ? chainChanges({ at: last.at, states: last.chain }, input.links) : [];
  let grade: Grade | null = null;
  if (last) {
    const keys = last.decision === 'pivot' && last.part ? [last.part] : LINK_KEYS.filter((k) => last.chain[k]);
    const was = keys.reduce((n, k) => n + (last.chain[k] ? RANK[last.chain[k]!] : 0), 0);
    // As evidence: a bet opened on a part since is not the part moving forward
    // (business.ts evidenceState). A part bare now that was kept as Testing
    // reads as it was kept — a checkpoint from before `bare` kept the label.
    const now = keys.reduce((n, k) => {
      const l = input.links.find((x) => x.key === k);
      if (!l) return n + RANK.missing;
      return n + (l.bare && last.chain[k] === 'testing' ? RANK.testing : RANK[evidenceState(l)]);
    }, 0);
    if (keys.some((k) => last.chain[k])) grade = now > was ? 'better' : now < was ? 'worse' : 'same';
  }
  return { due, last, ended, moved, grade, nextOn: last ? shiftDay(last.on, CHECKPOINT_DAYS) : null };
}

/** "Pivot what they pay", "Persevere". */
export function decisionWords(c: Pick<Checkpoint, 'decision' | 'part'>): string {
  return c.decision === 'pivot' && c.part ? `Pivot ${LINK_LABEL[c.part].toLowerCase()}` : 'Persevere';
}

/** The decision read back, in a sentence: what it was about, and which way it went since. */
export function gradeWords(c: Pick<Checkpoint, 'decision' | 'part'>, grade: Grade | null): string | null {
  if (!grade) return null;
  const what = c.decision === 'pivot' && c.part ? LINK_LABEL[c.part] : 'The chain';
  return grade === 'better' ? `${what} has moved forward since.` : grade === 'worse' ? `${what} has slipped since.` : `${what} has not moved since.`;
}

export interface TalkCounts {
  n: number;
  committed: number;
  have: number;
  /** Who they were with: the gap a founder alone cannot see is the kind of person never asked. */
  by: Record<TalkRole, number>;
  /** How many came through somebody's introduction. */
  introduced: number;
}

/** The last month of conversations, counted: how many, how many ended in a commitment, how many had the problem, with whom, and through whom. */
export function talkCounts(talks: Talk[], today: string): TalkCounts {
  const recent = talks.filter((t) => t.on > shiftDay(today, -TALK_BACK_DAYS) && t.on <= today);
  const by = Object.fromEntries(TALK_ROLES.map((r) => [r, recent.filter((t) => roleOf(t) === r).length])) as Record<TalkRole, number>;
  return {
    n: recent.length,
    committed: recent.filter((t) => t.commitment !== 'none').length,
    have: recent.filter((t) => t.problem === 'yes').length,
    by,
    introduced: recent.filter((t) => t.via).length,
  };
}

/* ─── Introductions ───────────────────────────────────────────────────────── */

export type IntroState = 'open' | 'asked' | 'led' | 'dropped' | 'lapsed';

export const INTRO_STATE_LABEL: Record<IntroState, string> = {
  open: 'Intro to follow up', asked: 'Intro asked for', led: 'Intro led to a conversation', dropped: 'Intro fell through', lapsed: 'Intro not followed up',
};

/**
 * Where an introduction stands. A conversation logged through it is the
 * result, whatever was said about it before; then what the person last said;
 * then open for INTRO_DAYS, and lapsed after — read off the calendar, never
 * asked. Null for a conversation that offered none.
 */
export function introState(
  t: Pick<Talk, 'id' | 'on' | 'commitment'>, talks: Array<Pick<Talk, 'via'>>, closed: Record<string, IntroClose> | undefined, today: string,
): IntroState | null {
  if (t.commitment !== 'intro') return null;
  if (talks.some((x) => x.via === t.id)) return 'led';
  const c = closed?.[t.id];
  if (c) return c.outcome;
  return daysBetween(t.on, today) > INTRO_DAYS ? 'lapsed' : 'open';
}

export interface OpenIntro { talk: Talk; days: number }

/**
 * The introductions waiting on the person, oldest first: the one nearest to
 * going cold leads. Each from the day after it was offered (INTRO_WAIT_DAYS).
 */
export function openIntros(talks: Talk[], closed: Record<string, IntroClose> | undefined, today: string): OpenIntro[] {
  return talks
    .filter((t) => introState(t, talks, closed, today) === 'open')
    .map((t) => ({ talk: t, days: daysBetween(t.on, today) }))
    .filter((x) => x.days >= INTRO_WAIT_DAYS)
    .sort((a, b) => b.days - a.days || a.talk.at.localeCompare(b.talk.at));
}

/**
 * The introductions a conversation on `on` can say it came through, newest
 * first: offered on or before it, within INTRO_LINK_DAYS, and not fallen
 * through. One that already led somewhere stays — "I will put you in touch with
 * a couple of people" is two conversations.
 */
export function introSources(talks: Talk[], closed: Record<string, IntroClose> | undefined, on: string): Talk[] {
  return talks
    .filter((t) => t.commitment === 'intro' && t.on <= on && daysBetween(t.on, on) <= INTRO_LINK_DAYS && closed?.[t.id]?.outcome !== 'dropped')
    .sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
}

/* ─── What people said ────────────────────────────────────────────────────── */

/** A conversation's words, as a model is shown them. */
export interface Heard { who: string | null; role: TalkRole; commitment: Commitment; said: string }

/**
 * The newest words the person kept, at most `max`. What a model writing an idea
 * or a draft hears from outside the app: the person's own rows, so a number in
 * them is one they gave.
 */
export function heardFrom(talks: Talk[], max = HEARD_MAX): Heard[] {
  return [...talks]
    .sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at))
    .filter((t): t is Talk & { said: string } => !!t.said)
    .slice(0, max)
    .map((t) => ({ who: t.who, role: roleOf(t), commitment: t.commitment, said: t.said }));
}

const HEARD_ENDED: Record<Commitment, string> = { none: 'no commitment', time: 'agreed to another call', intro: 'offered an introduction', money: 'committed money' };

/**
 * "Maria — could buy, offered an introduction: “We lose two bookings a week”".
 * Without the day: its digits would pass as a number the person gave.
 */
export function heardLine(h: Heard): string {
  return `${h.who ?? 'Someone'} — ${TALK_ROLE_LABEL[h.role].toLowerCase()}, ${HEARD_ENDED[h.commitment]}: “${h.said}”`;
}

/** What each kind of person is, for a model reading heardLine's: the labels are short, and "sells to them" means nothing without it. */
export const HEARD_ROLES_NOTE =
  'Who each was: "could buy" is a possible buyer; "sells to them" sells something else to the same buyers; "runs the work" does the work the offer touches; "already earns in it" already makes money from these buyers; "knows people" knows them.';

/* ─── Saying it ───────────────────────────────────────────────────────────── */

type LineOf = Pick<Bet, 'metric' | 'target' | 'tries' | 'priceLabel'> & { unit?: string | null };

/**
 * "1 sale at your $150 by 14 Oct, from 10 messages sent". The line, said before
 * the bet starts. "From", not "out of the next": what it takes is the plan, said
 * beside the result, and the count does not stop at it — so the line does not
 * claim a window the verdict does not keep. Going past the plan is said on the
 * bet instead (overPlan).
 */
export function passLine(bet: LineOf, lastDay: string): string {
  const out = `${bet.target} ${metricWords(bet.metric, bet.target, bet.priceLabel, bet.unit)} by ${dayWords(lastDay)}`;
  return bet.tries ? `${out}, from ${bet.tries.planned} ${metricWords(bet.tries.metric, bet.tries.planned)}` : out;
}

/** "2 weeks", "1 week", "10 days": a bet's length the way a person plans one. */
export function spanWords(n: number): string {
  return n === 7 ? '1 week' : n % 7 === 0 && n <= 28 ? `${n / 7} weeks` : n === 1 ? '1 day' : `${n} days`;
}

/**
 * A play's line before it is anybody's bet: "3 payments within 2 days". A play
 * has no start, so it has no date — dated from today on a card, it named a day
 * the bet could not start on while another was running. The bet sheet dates it.
 */
export function playLine(p: Omit<LineOf, 'tries' | 'priceLabel'> & { days: number; tries?: Bet['tries'] }, priceLabel: string | null): string {
  const out = `${p.target} ${metricWords(p.metric, p.target, priceLabel, p.unit)} within ${spanWords(p.days)}`;
  return p.tries ? `${out}, from ${p.tries.planned} ${metricWords(p.tries.metric, p.tries.planned)}` : out;
}

/**
 * Said when a bet has taken more than it planned: two replies from ten sends
 * is a different finding from two replies from forty, and a pass should not
 * hide which one it was.
 */
export function overPlan(v: Pick<BetView, 'bet' | 'tries'>): string | null {
  const t = v.bet.tries;
  if (!t || v.tries == null || v.tries <= t.planned) return null;
  return `${v.tries} ${metricWords(t.metric, v.tries)} against the ${t.planned} planned, so a pass here says less than it looks.`;
}

/** The count a bet decides on, said: "0 of 1 sale at your $150", "3 of 10 sign-ups". */
export function resultLine(v: Pick<BetView, 'bet' | 'result'>): string {
  const b = v.bet;
  return `${v.result} of ${b.target} ${metricWords(b.metric, b.target, b.priceLabel, b.unit)}`;
}

/** The line under the greeting while a bet runs, or why none does. */
export function labLine(current: BetView | null, due: boolean): string {
  if (due) return 'Checkpoint · pivot or persevere';
  if (!current) return 'No bet running';
  return `Day ${current.day} of ${current.bet.days} · ${resultLine(current)}`;
}

/** What the play behind a bet is called, and where it came from: the catalogue's, the idea's, or nothing for the person's own. */
export function playOf(bet: Pick<Bet, 'play' | 'idea'>): { label: string; how: string; from: string } | null {
  const p = bet.play ? PLAY_BY_KEY.get(bet.play) : null;
  if (p) return { label: p.label, how: p.how, from: p.book };
  return bet.idea ? { label: bet.idea.label, how: bet.idea.how, from: bet.idea.from } : null;
}

/**
 * A play's name for a prompt, or null for one that came in as a shared reply: a
 * chat's words are never shown to a model as the person's, and a number in them
 * would pass the check that refuses numbers the person never gave (invariants 2
 * and 12). The play is still the bet's, on the screen and for Claude, marked.
 */
export function playForModel(bet: Pick<Bet, 'play' | 'idea'>): string | null {
  const p = playOf(bet);
  return p && p.from !== SHARED_FROM ? p.label : null;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * A first draft of the belief, from the offer, for the person to rewrite. It
 * is theirs to state — the app suggests the shape of a claim, never the claim's
 * numbers, which come from their own price or not at all.
 */
export function suggestBelief(part: LinkKey, offer: Offer, priceLabel: string | null, foundBy: FoundBy | null = null): string {
  // The first of a list: a bet on "resorts, pest control, plumbing" cannot
  // fail for any one of them, and The Mom Test and Crossing the Chasm both
  // start from one kind of buyer. A name with an ampersand in it is one name.
  const who = offer.for_who?.split(/[,;/]|\s+(?:and|or)\s+/)[0].trim() || 'They';
  const one = offer.sells?.split(/[,;]/)[0].trim();
  const sells = one ? lowerFirst(one) : 'what I sell';
  const reach: Record<FoundBy, string> = {
    outreach: `${who} answer when I write to them about it`,
    inbound: `${who} find me online and get in touch`,
    referrals: `My clients will introduce me to ${who === 'They' ? 'people like them' : lowerFirst(who)}`,
    marketplace: `${who} pick my listing over the others`,
    local: `${who} stop to ask about it when they see it`,
  };
  const line = {
    who: `${who} have the problem I fix${offer.problem?.trim() ? `: ${lowerFirst(offer.problem.trim())}` : ''}`,
    reach: reach[foundBy ?? 'outreach'],
    close: 'A conversation turns into a yes when I ask the right way',
    pay: `${who} pay ${priceLabel ?? 'my price'} for ${sells}`,
    deliver: `I can deliver ${sells} without doing every step myself`,
  }[part];
  return line.length <= BELIEF_MAX ? line : `${line.slice(0, BELIEF_MAX - 1).replace(/[\s,;:—-]+\S*$/, '')}…`;
}

/* ─── The plays ───────────────────────────────────────────────────────────── */

export interface Play {
  key: string;
  /** Where it comes from, named. The words are this app's, not the book's. */
  book: string;
  part: LinkKey;
  label: string;
  /** What you do, in a sentence or two. */
  how: string;
  metric: LabMetric;
  /** The person's word for a count they log, for a play that counts something the app cannot. */
  unit?: string;
  target: number;
  tries?: { metric: LabMetric; planned: number };
  days: number;
  /**
   * Where it works: every way in, or only these. A play about first lines of
   * messages means nothing to a shop that never sends one.
   */
  fits: 'any' | FoundBy[];
  /**
   * The work that gets it ready. `asset` drafts that asset in the app, for the
   * bet; otherwise `ai` is a project for the agent and `claude` a chat, and an
   * `ai` one falls back to a chat where no agent can take it.
   */
  prep?: { label: string; by: 'ai' | 'claude'; ask: string; asset?: AssetKind };
}

/**
 * Plays from business books, each one something to do with a count — the app's
 * own or the person's. A book that is a way of thinking — positioning, strategy,
 * negotiation as a stance — is not here: a chat explains it for free, and an
 * entry with no count behind it would be advice dressed as a test.
 */
export const PLAYS: Play[] = [
  {
    key: 'mom-test', book: 'The Mom Test', part: 'who', label: 'Ten problem conversations', fits: 'any',
    how: 'Ask about the last time the problem cost them, not about your idea. A compliment is not a result: another call, an intro or money is.',
    metric: 'committed', target: 3, tries: { metric: 'talks', planned: 10 }, days: 14,
    prep: { label: 'Interview questions', by: 'ai', ask: 'Write five questions for a problem conversation with the businesses I sell to: about their past, not about my idea' },
  },
  {
    // The buyers are not the only ones who know. Five kinds of people around
    // the money, one conversation each; judged, like the book's, by what they
    // committed to, and an introduction to the next person counts.
    key: 'money-five', book: 'The Mom Test', part: 'who', label: 'Five people close to the money', fits: 'any',
    how: 'Talk to one person who could buy, one who sells to them, one who runs the work, one who already earns in it and one who knows them. Ask what it costs them, what they pay for now, and who else to ask. An intro or another call counts.',
    metric: 'committed', target: 2, tries: { metric: 'talks', planned: 5 }, days: 7,
    prep: { label: 'The questions', by: 'ai', ask: 'Write questions for five people close to the money in my market: about what it costs them and what they pay for now, never about my idea' },
  },
  {
    key: 'one-niche', book: 'Crossing the Chasm', part: 'who', label: 'One niche for two weeks', fits: ['outreach'],
    how: 'Write only to the kind of business that answered most, and to nobody else, until the two weeks are up.',
    metric: 'replied', target: 2, tries: { metric: 'sent', planned: 20 }, days: 14,
  },
  {
    key: 'smoke-test', book: 'The Lean Startup', part: 'who', label: 'A page before the product', fits: 'any',
    how: 'Put up one page that says the offer and asks for one thing: a sign-up or a call booked. Share it where they are. Count who asks.',
    metric: 'logged', unit: 'sign-ups', target: 5, days: 14,
    prep: { label: 'The page', by: 'claude', ask: 'Write one landing page for my offer that asks for a single thing.', asset: 'landing_page' },
  },
  {
    key: 'bullseye', book: 'Traction', part: 'reach', label: 'A channel you have not tried', fits: 'any',
    how: 'Go where they already gather — a group, a forum, an association — and log every lead it brings as a conversation.',
    metric: 'talks', target: 3, days: 7,
    prep: { label: 'Where they gather', by: 'ai', ask: 'Find five groups, forums or associations where the businesses I sell to talk to each other, with a link to each' },
  },
  {
    key: 'warm-first', book: '$100M Leads', part: 'reach', label: 'Warm before cold', fits: 'any',
    how: 'Message twenty people who already know you. Ask who they know with the problem, not whether they want to buy. Log every lead as a conversation.',
    metric: 'talks', target: 3, days: 7,
  },
  {
    key: 'one-line', book: 'The Lean Startup', part: 'reach', label: 'Change one thing', fits: ['outreach'],
    how: 'Change only the first line of your message for the next ten. Keep the ask the same, so the result means something.',
    metric: 'replied', target: 2, tries: { metric: 'sent', planned: 10 }, days: 10,
    prep: { label: 'Three first lines', by: 'ai', ask: 'Write three new first lines for my opening message, each about something specific to the business it goes to' },
  },
  {
    key: 'clear-line', book: 'Building a StoryBrand', part: 'reach', label: 'One clear line', fits: ['inbound', 'marketplace', 'local'],
    how: 'Rewrite the first line people see — your page, listing or sign — as what they get and what it saves them. Change nothing else, and count the enquiries.',
    metric: 'logged', unit: 'enquiries', target: 3, days: 14,
    prep: { label: 'The new first line', by: 'claude', ask: 'Rewrite the first thing a buyer reads about my offer as what they get and what it saves them.', asset: 'landing_page' },
  },
  {
    key: 'ask-referrals', book: 'The Referral Engine', part: 'reach', label: 'Ask for one name', fits: 'any',
    how: 'Ask your last three happy clients for one person they know with the same problem, by name. An intro counts; "I will think of someone" does not.',
    metric: 'committed', target: 2, tries: { metric: 'talks', planned: 3 }, days: 7,
  },
  {
    key: 'free-audit', book: '$100M Leads', part: 'reach', label: 'Give something to get a name', fits: ['inbound', 'marketplace', 'local', 'referrals'],
    how: 'Offer something small and useful for free — a check, a template, a first fix — to anyone who leaves their contact. Count the contacts.',
    metric: 'logged', unit: 'leads', target: 5, days: 14,
    prep: { label: 'The free offer', by: 'claude', ask: 'Write a small free offer that shows what I do, for people to swap their contact for.', asset: 'script' },
  },
  {
    key: 'one-event', book: 'Traction', part: 'reach', label: 'One room full of buyers', fits: ['local', 'referrals', 'inbound'],
    how: 'Go to one event, market or meetup where the people you sell to are, and have five real conversations about their problem.',
    metric: 'talks', target: 5, days: 7,
  },
  {
    key: 'ask-why-not', book: 'The Mom Test', part: 'close', label: 'Ask the ones who said no', fits: 'any',
    how: 'Write to everyone you met who did not buy, with one question: what stopped you? Log each answer as a conversation.',
    metric: 'talks', target: 3, days: 7,
    prep: { label: 'The question', by: 'ai', ask: 'Write one short message asking someone I met, who did not buy, what stopped them, with no pitch in it' },
  },
  {
    key: 'ask-for-no', book: 'Never Split the Difference', part: 'close', label: 'Ask for a no', fits: ['outreach'],
    how: 'On the next five replies, ask a question they can comfortably say no to, such as whether Thursday would be a bad time to talk, instead of "worth a call?".',
    metric: 'meetings', target: 2, tries: { metric: 'replied', planned: 5 }, days: 14,
  },
  {
    key: 'sales-script', book: 'The Mom Test', part: 'close', label: 'The same five questions', fits: 'any',
    how: 'Use one written script for every conversation this week, so a yes or a no says something about the script and not your mood.',
    metric: 'meetings', target: 2, tries: { metric: 'talks', planned: 5 }, days: 7,
    prep: { label: 'The script', by: 'claude', ask: 'Write the five questions and the ask I use in every sales conversation this week.', asset: 'script' },
  },
  {
    key: 'guarantee', book: '$100M Offers', part: 'pay', label: 'A guarantee, and the price up front', fits: 'any',
    how: 'Add a guarantee you can keep and say the price in the first message. Ask the next ten.',
    metric: 'paid_at_price', target: 1, tries: { metric: 'sent', planned: 10 }, days: 14,
    prep: { label: 'The offer, rewritten', by: 'claude', ask: 'Rewrite my offer with a guarantee I can keep and the price said up front, from what has closed and what has not.', asset: 'offer' },
  },
  {
    key: 'paid-48h', book: 'Million Dollar Weekend', part: 'pay', label: 'Paid within 48 hours', fits: 'any',
    how: 'Before you build anything more, ask people who fit to pay now. Any real payment counts; a promise to pay later does not.',
    metric: 'paid', target: 3, days: 2,
  },
  {
    key: 'one-package', book: 'Built to Sell', part: 'pay', label: 'One package, one price', fits: 'any',
    how: 'Sell one package at one fixed price, with no custom work, for two weeks.',
    metric: 'paid_at_price', target: 2, days: 14,
    prep: { label: 'The package', by: 'ai', ask: 'Write a one-page description of one fixed package of what I sell: what is in it, what is not, the price and how long it takes', asset: 'price_test' },
  },
  {
    key: 'concierge', book: 'The Lean Startup', part: 'deliver', label: 'Do it by hand first', fits: 'any',
    how: 'Deliver it yourself, by hand, to the next three clients before automating anything, and write each step down as you go.',
    metric: 'logged', unit: 'clients served', target: 3, days: 21,
    prep: { label: 'The steps', by: 'claude', ask: 'Turn how I deliver into numbered steps I can follow by hand and improve after each client.', asset: 'workflow' },
  },
  {
    key: 'hand-a-step', book: 'The E-Myth Revisited', part: 'deliver', label: 'Hand one step over', fits: 'any',
    how: 'Write down how you deliver, step by step, and hand the step you like least to your agent.',
    metric: 'handed', target: 1, days: 14,
    prep: { label: 'The steps, as a checklist', by: 'claude', ask: 'Turn how I deliver into a numbered checklist someone else could follow, and mark the step that is easiest to hand over.', asset: 'workflow' },
  },
];

export const PLAY_BY_KEY = new Map(PLAYS.map((p) => [p.key, p]));

/** Every book the plays name, for checking a model's attribution against: a title not on it is not said. */
export const PLAY_BOOKS: string[] = [...new Set(PLAYS.map((p) => p.book))];

/**
 * A play as it runs for this business. Where buyers do not come through the
 * app's sends, a plan counted in sends is one the app cannot count, so it goes:
 * the play keeps its line and drops the plan.
 */
export function playFor(p: Play, foundBy: FoundBy | null): Play {
  if (!p.tries || foundBy == null || foundBy === 'outreach' || !METRIC[p.tries.metric].outreach) return p;
  const { tries: _drop, ...rest } = p;
  return rest;
}

/** The plays for one part that fit how buyers find this business, each as it runs here. */
export function playsFor(part: LinkKey, foundBy: FoundBy | null = null): Play[] {
  return PLAYS
    .filter((p) => p.part === part && (p.fits === 'any' || foundBy == null || p.fits.includes(foundBy)))
    .filter((p) => foundBy == null || foundBy === 'outreach' || !METRIC[p.metric].outreach)
    .map((p) => playFor(p, foundBy));
}

/* ─── The tab, derived ────────────────────────────────────────────────────── */

export interface LabView {
  current: BetView | null;
  /** Bets that ended, newest first. */
  learned: BetView[];
  talks: Talk[];
  clock: Clock;
  checkpoint: CheckpointView;
  /** The newest ideas a model wrote, per part. */
  ideas: Partial<Record<LinkKey, IdeaSet>>;
  /** Per part, an ask for ideas being written or failed: read with ideaRun against the clock. */
  ideaRuns: Partial<Record<LinkKey, IdeaRunRow>>;
  /** The running bet's own counts, newest first. */
  tallies: Tally[];
  /** Bet id → the projects handed over for it. */
  links: Record<string, string[]>;
  /** Talk id → how the introduction offered in it went, where the person has said. */
  intros: Record<string, IntroClose>;
  /** Tests kept for later, newest first. */
  shelf: ShelfEntry[];
  line: string;
  unreadable: string | null;
}

export function labView(lab: LabHome | undefined, ctx: { runwayMonths: number | null; links: BusinessLink[]; today: string }): LabView {
  const bets = lab?.bets ?? [];
  const current = bets.find((b) => b.state === 'running') ?? null;
  const checkpoint = checkpointView({ checkpoints: lab?.checkpoints ?? [], bets, links: ctx.links, today: ctx.today });
  return {
    current,
    learned: bets.filter((b) => b.state !== 'running'),
    talks: lab?.talks ?? [],
    clock: labClock(ctx.runwayMonths, bets),
    checkpoint,
    ideas: lab?.ideas ?? {},
    ideaRuns: lab?.ideaRuns ?? {},
    tallies: current ? (lab?.tallies ?? []).filter((t) => t.bet === current.bet.id) : [],
    links: lab?.links ?? {},
    intros: lab?.intros ?? {},
    shelf: lab?.shelf ?? [],
    line: labLine(current, checkpoint.due),
    unreadable: lab?.unreadable ?? null,
  };
}
