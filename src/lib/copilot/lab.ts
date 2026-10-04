// src/lib/copilot/lab.ts
// The Lab: one bet at a time, a play from a book to run it with, and a verdict
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
//   which play    a catalogue from business books (PLAYS), each one something
//                 to DO with a number the app can count. The books that are
//                 ways of thinking are left to a chat, where they are free.
//   on what       the part of the business the chain calls weakest (business.ts)
//   did it work   a pass line written before the bet starts — this many of
//                 that, by this day — read off the rows: sends, replies,
//                 meetings, payments at the person's price, projects finished,
//                 and the conversations they log. Nobody marks a bet passed;
//                 it passes when the count reaches the line, for the reason a
//                 worker cannot mark its own homework (invariant 10).
//
// One bet at a time, like the plan's experiment. Small batches are the book's
// own rule, and two bets running at once share every send, so neither result
// would mean anything.
//
// The clock is the book's line that runway is the number of pivots left: the
// runway the bank statements give, divided by how long this person's bets
// actually take. Every couple of weeks a checkpoint asks the book's question —
// pivot or persevere — keeps the answer with the chain as it stood, and reads
// it back at the next one against what the chain did since.
//
// It passes DIRECTION.md's survival test for the usual reason. A chat can
// explain The Mom Test; it cannot read two weeks of your sends and payments and
// say that a guarantee moved nothing at your price.
//
// Stored without a migration, as copilot_events rows (LAB_EVENTS), the way deep
// work and the plan's ticks are. Pure: no DB import.

import { LINK_KEYS, LINK_LABEL, LINK_STATES, chainChanges, type BusinessLink, type ChainChange, type LinkKey, type LinkState } from './business';
import { isIsoDay, shiftDay } from './focus';
import { priceOf } from './plan';
import { moneyLabel } from './review';
import type { Offer } from './types';

/* ─── Storage ─────────────────────────────────────────────────────────────── */

export const LAB_BET = 'lab_bet';
export const LAB_STOP = 'lab_bet_stopped';
export const LAB_TALK = 'lab_talk';
export const LAB_CHECKPOINT = 'lab_checkpoint';
export const LAB_EVENTS = [LAB_BET, LAB_STOP, LAB_TALK, LAB_CHECKPOINT] as const;

/* ─── What a bet can count ────────────────────────────────────────────────── */

export const LAB_METRICS = ['sent', 'replied', 'meetings', 'paid', 'paid_at_price', 'talks', 'committed', 'handed'] as const;
export type LabMetric = (typeof LAB_METRICS)[number];

export interface MetricMeta {
  one: string;
  many: string;
  /**
   * Where the count comes from, said beside it: the app's own rows, or the
   * person's conversation log. A logged number must never read as a measured
   * one — the working file's two sources, kept apart for the same reason.
   */
  from: 'rows' | 'log';
  /** Held against the price the offer named when the bet began. */
  priced?: boolean;
}

export const METRIC: Record<LabMetric, MetricMeta> = {
  sent: { one: 'message sent', many: 'messages sent', from: 'rows' },
  replied: { one: 'reply', many: 'replies', from: 'rows' },
  meetings: { one: 'meeting', many: 'meetings', from: 'rows' },
  paid: { one: 'payment', many: 'payments', from: 'rows' },
  paid_at_price: { one: 'sale at your price', many: 'sales at your price', from: 'rows', priced: true },
  talks: { one: 'conversation', many: 'conversations', from: 'log' },
  committed: { one: 'commitment', many: 'commitments', from: 'log' },
  handed: { one: 'project finished', many: 'projects finished', from: 'rows' },
};

/** "sales at your $150", "1 reply" — the noun for a count, with the bet's own price where it has one. */
export function metricWords(m: LabMetric, n: number, priceLabel?: string | null): string {
  const w = n === 1 ? METRIC[m].one : METRIC[m].many;
  return METRIC[m].priced && priceLabel ? w.replace('your price', `your ${priceLabel}`) : w;
}

/**
 * What can stand as "what it takes" beside each count: the step before it in
 * the funnel. Replies out of payments would be a ratio with nothing to say,
 * and a count with no step before it — sends, projects — takes none.
 */
export const TRIES_FOR: Record<LabMetric, readonly LabMetric[]> = {
  sent: [],
  replied: ['sent'],
  meetings: ['replied', 'sent'],
  paid: ['sent', 'replied', 'meetings', 'talks'],
  paid_at_price: ['sent', 'replied', 'meetings', 'talks'],
  talks: ['sent'],
  committed: ['talks'],
  handed: [],
};

/**
 * Where a bet's count comes from, said under it, so a logged number never
 * reads as a measured one and nobody wonders why last month's sends are not in
 * it.
 */
export function countedFrom(m: LabMetric, start: string, priceLabel: string | null): string {
  const since = `since ${dayWords(start)}`;
  switch (m) {
    case 'sent': return `Counted from your sends ${since}. Nothing before the bet counts.`;
    case 'replied': return `Counted from replies ${since}, once per business.`;
    case 'meetings': return `Counted from the meetings you log ${since}.`;
    case 'paid': return `Counted from the wins you log ${since}. A promise to pay is not one.`;
    case 'paid_at_price': return `Counted from wins of ${priceLabel ?? 'your price'} or more ${since}. A cheaper sale does not count.`;
    case 'talks': return `From your conversation log ${since}: your count, not the app's.`;
    case 'committed': return `From your conversation log ${since}: the ones that ended in another call, an intro or money.`;
    case 'handed': return `Counted from the projects your agent finished ${since}.`;
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

export interface Bet {
  /** The event id of its opening. */
  id: string;
  part: LinkKey;
  /** What the person believes, in their words: "Pest control pays $150 for this". */
  belief: string;
  /** The play it runs, or null for one the person wrote. */
  play: string | null;
  /** What decides it, and the line it has to reach by its last day. */
  metric: LabMetric;
  target: number;
  /** What it takes, said beside the result for context. It never decides the verdict. */
  tries: { metric: LabMetric; planned: number } | null;
  days: number;
  /** The person's own day it began. Nothing before it counts. */
  start: string;
  /** The offer's price when it began, so changing the offer later cannot rewrite a verdict. */
  price: number | null;
  priceLabel: string | null;
  openedAt: string;
}
export type BetDraft = Omit<Bet, 'id' | 'openedAt'>;

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

export interface Talk {
  id: string;
  /** The day it happened, the person's. */
  on: string;
  who: string | null;
  problem: Problem;
  commitment: Commitment;
  /** Their words, when worth keeping — the best first line a message ever gets. */
  said: string | null;
  at: string;
}
export type TalkDraft = Omit<Talk, 'id' | 'at'>;

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

export const BELIEF_MAX = 160;
export const TARGET_MAX = 100;
export const PLANNED_MAX = 500;
export const BET_DAYS_MAX = 60;
export const WHO_MAX = 80;
export const SAID_MAX = 300;
export const NOTE_MAX = 300;
/** A week of calls logged on a Sunday is the usual case; a month is the edge of remembering one honestly. */
export const TALK_BACK_DAYS = 30;
/** The checkpoint's rhythm: every two weeks, once a bet has ended since the last one. */
export const CHECKPOINT_DAYS = 14;
/** A bet's length until the person has started two: two weeks, the usual size of a play here. */
export const DEFAULT_BET_DAYS = 14;
/** How much the screen and the payload carry. */
export const MAX_BETS = 40;
export const MAX_TALKS = 60;
export const MAX_CHECKPOINTS = 12;

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Oct" from a day's own digits, so it reads the same in every zone. */
export function dayWords(day: string): string {
  const [, m, d] = day.split('-').map(Number);
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
  const target = int(raw.target);
  if (!(target >= 1 && target <= TARGET_MAX)) return { ok: false, error: `The pass line is a count from 1 to ${TARGET_MAX}.` };
  const days = int(raw.days);
  if (!(days >= 1 && days <= BET_DAYS_MAX)) return { ok: false, error: `A bet runs from 1 to ${BET_DAYS_MAX} days.` };
  let tries: Bet['tries'] = null;
  if (raw.tries != null) {
    const t = obj(raw.tries);
    const planned = int(t.planned);
    if (!isMetric(t.metric) || t.metric === raw.metric || !(planned >= 1 && planned <= PLANNED_MAX)) {
      return { ok: false, error: `What it takes is a different count, from 1 to ${PLANNED_MAX}.` };
    }
    tries = { metric: t.metric, planned };
  }
  // A sale at your price with no price said would pass on any payment, which
  // is the one-dollar test the chain refuses to call a sale.
  if (METRIC[raw.metric].priced && ctx.price == null) return { ok: false, error: 'Say what it costs first: a sale at your price needs a price.' };
  const play = typeof raw.play === 'string' && PLAY_BY_KEY.has(raw.play) ? raw.play : null;
  return { ok: true, value: { part: raw.part, belief, play, metric: raw.metric, target, tries, days, start: ctx.today, price: ctx.price, priceLabel: ctx.priceLabel } };
}

export function normalizeTalk(raw: Record<string, unknown>, today: string): Result<TalkDraft> {
  const on = raw.on == null || raw.on === '' ? today : raw.on;
  if (!isIsoDay(on)) return { ok: false, error: 'That is not a day.' };
  if (on > today) return { ok: false, error: 'That day has not happened yet.' };
  if (on < shiftDay(today, -TALK_BACK_DAYS)) return { ok: false, error: `Only the last ${TALK_BACK_DAYS} days can be logged.` };
  const problem = (PROBLEMS as readonly string[]).includes(raw.problem as string) ? (raw.problem as Problem) : 'unasked';
  const commitment = (COMMITMENTS as readonly string[]).includes(raw.commitment as string) ? (raw.commitment as Commitment) : 'none';
  return { ok: true, value: { on, who: text(raw.who, WHO_MAX), problem, commitment, said: text(raw.said, SAID_MAX) } };
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

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface LabEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

export interface LabLedger {
  bets: Bet[];
  /** Bet id → when the person called it off, and what they wrote. */
  stopped: Map<string, { at: string; note: string | null }>;
  talks: Talk[];
  checkpoints: Checkpoint[];
}

/** A stored bet, reshaped rather than trusted. Null when it does not hold together. */
function storedBet(p: Record<string, unknown>, id: string, at: string): Bet | null {
  const target = int(p.target);
  const days = int(p.days);
  const belief = text(p.belief, BELIEF_MAX);
  if (!isPart(p.part) || !belief || !isMetric(p.metric) || !(target >= 1) || !(days >= 1) || !isIsoDay(p.start)) return null;
  const t = obj(p.tries);
  const planned = int(t.planned);
  const price = typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0 ? p.price : null;
  return {
    id, part: p.part, belief, metric: p.metric, target, days, start: p.start, openedAt: at,
    play: typeof p.play === 'string' && PLAY_BY_KEY.has(p.play) ? p.play : null,
    tries: isMetric(t.metric) && planned >= 1 ? { metric: t.metric, planned } : null,
    price, priceLabel: price != null ? text(p.priceLabel, 24) : null,
  };
}

export function labFromEvents(rows: LabEventRow[]): LabLedger {
  const out: LabLedger = { bets: [], stopped: new Map(), talks: [], checkpoints: [] };
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
        problem: (PROBLEMS as readonly string[]).includes(p.problem as string) ? (p.problem as Problem) : 'unasked',
        commitment: (COMMITMENTS as readonly string[]).includes(p.commitment as string) ? (p.commitment as Commitment) : 'none',
      });
    } else if (r.event_type === LAB_CHECKPOINT) {
      if (!isIsoDay(p.on) || !(LAB_DECISIONS as readonly string[]).includes(p.decision as string)) continue;
      const c = obj(p.chain);
      const chain: Partial<Record<LinkKey, LinkState>> = {};
      for (const k of LINK_KEYS) if ((LINK_STATES as readonly string[]).includes(c[k] as string)) chain[k] = c[k] as LinkState;
      out.checkpoints.push({ id, on: p.on, at: r.created_at, decision: p.decision as LabDecision, part: isPart(p.part) ? p.part : null, note: text(p.note, NOTE_MAX), chain });
    }
  }
  out.bets.reverse();
  out.talks.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
  out.checkpoints.reverse();
  return out;
}

/* ─── Counting ────────────────────────────────────────────────────────────── */

/** The rows a bet is read against, each already on the person's own day. */
export interface DayRows {
  sends: string[];
  outcomes: Array<{ kind: string; day: string; opportunity: string | null; amount: number | null }>;
  finished: string[];
  talks: Talk[];
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

/** How many of a thing happened from one day to another, both included. */
export function countIn(metric: LabMetric, from: string, to: string, rows: DayRows, price: number | null): number {
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
  }
}

export type BetState = 'running' | 'passed' | 'failed' | 'stopped';

export const BET_STATE_LABEL: Record<BetState, string> = { running: 'Running', passed: 'Passed', failed: 'Did not pass', stopped: 'Called off' };

export interface BetView {
  bet: Bet;
  state: BetState;
  result: number;
  /** What it took, when the bet says what it takes. */
  tries: number | null;
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
  const count = (m: LabMetric, to: string) => countIn(m, bet.start, to, rows, bet.price);
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
  };
  return {
    bets: bets.map((b) => {
      const stop = ledger.stopped.get(b.id);
      return { ...betView(b, stop ? dayIn(stop.at, i.timezone) : null, rows, i.today), note: stop?.note ?? null };
    }),
    talks: ledger.talks.slice(0, MAX_TALKS),
    checkpoints: ledger.checkpoints.slice(0, MAX_CHECKPOINTS),
    unreadable: i.unreadable,
  };
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
    const now = keys.reduce((n, k) => n + RANK[input.links.find((l) => l.key === k)?.state ?? 'missing'], 0);
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

/** The last month of conversations, counted: how many, how many ended in a commitment, how many had the problem. */
export function talkCounts(talks: Talk[], today: string): { n: number; committed: number; have: number } {
  const recent = talks.filter((t) => t.on > shiftDay(today, -TALK_BACK_DAYS) && t.on <= today);
  return { n: recent.length, committed: recent.filter((t) => t.commitment !== 'none').length, have: recent.filter((t) => t.problem === 'yes').length };
}

/* ─── Saying it ───────────────────────────────────────────────────────────── */

/**
 * "1 sale at your $150 by 14 Oct, from 10 messages sent". The line, said before
 * the bet starts. "From", not "out of the next": what it takes is the plan, said
 * beside the result, and the count does not stop at it — so the line does not
 * claim a window the verdict does not keep. Going past the plan is said on the
 * bet instead (overPlan).
 */
export function passLine(bet: Pick<Bet, 'metric' | 'target' | 'tries' | 'priceLabel'>, lastDay: string): string {
  const out = `${bet.target} ${metricWords(bet.metric, bet.target, bet.priceLabel)} by ${dayWords(lastDay)}`;
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
export function playLine(p: Pick<Play, 'metric' | 'target' | 'tries' | 'days'>, priceLabel: string | null): string {
  const out = `${p.target} ${metricWords(p.metric, p.target, priceLabel)} within ${spanWords(p.days)}`;
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

/** The line under the greeting on the Lab. */
export function labLine(current: BetView | null, due: boolean): string {
  if (due) return 'Checkpoint · pivot or persevere';
  if (!current) return 'No bet running';
  const b = current.bet;
  return `Day ${current.day} of ${b.days} · ${current.result} of ${b.target} ${metricWords(b.metric, b.target, b.priceLabel)}`;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * A first draft of the belief, from the offer, for the person to rewrite. It
 * is theirs to state — the app suggests the shape of a claim, never the claim's
 * numbers, which come from their own price or not at all.
 */
export function suggestBelief(part: LinkKey, offer: Offer, priceLabel: string | null): string {
  // The first of a list: a bet on "resorts, pest control, plumbing" cannot
  // fail for any one of them, and The Mom Test and Crossing the Chasm both
  // start from one kind of buyer. A name with an ampersand in it is one name.
  const who = offer.for_who?.split(/[,;/]|\s+(?:and|or)\s+/)[0].trim() || 'They';
  const one = offer.sells?.split(/[,;]/)[0].trim();
  const sells = one ? lowerFirst(one) : 'what I sell';
  const line = {
    who: `${who} have the problem I fix${offer.problem?.trim() ? `: ${lowerFirst(offer.problem.trim())}` : ''}`,
    reach: `${who} answer when I write to them about it`,
    close: 'A reply turns into a yes when I ask the right way',
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
  target: number;
  tries?: { metric: LabMetric; planned: number };
  days: number;
  /** The work an agent or a chat can do to get it ready. `ai` falls back to a chat where no agent can take it. */
  prep?: { label: string; by: 'ai' | 'claude'; ask: string };
}

/**
 * Plays from business books, each one something to do with a count the app can
 * read. A book that is a way of thinking — positioning, strategy, negotiation as
 * a stance — is not here: a chat explains it for free, and an entry with no
 * count behind it would be advice dressed as a test.
 */
export const PLAYS: Play[] = [
  {
    key: 'mom-test', book: 'The Mom Test', part: 'who', label: 'Ten problem conversations',
    how: 'Ask about the last time the problem cost them, not about your idea. A compliment is not a result: another call, an intro or money is.',
    metric: 'committed', target: 3, tries: { metric: 'talks', planned: 10 }, days: 14,
    prep: { label: 'Interview questions', by: 'ai', ask: 'Write five questions for a problem conversation with the businesses I sell to: about their past, not about my idea' },
  },
  {
    key: 'one-niche', book: 'Crossing the Chasm', part: 'who', label: 'One niche for two weeks',
    how: 'Write only to the kind of business that answered most, and to nobody else, until the two weeks are up.',
    metric: 'replied', target: 2, tries: { metric: 'sent', planned: 20 }, days: 14,
  },
  {
    key: 'bullseye', book: 'Traction', part: 'reach', label: 'A channel you have not tried',
    how: 'Go where they already gather — a group, a forum, an association — and log every lead it brings as a conversation.',
    metric: 'talks', target: 3, days: 7,
    prep: { label: 'Where they gather', by: 'ai', ask: 'Find five groups, forums or associations where the businesses I sell to talk to each other, with a link to each' },
  },
  {
    key: 'warm-first', book: '$100M Leads', part: 'reach', label: 'Warm before cold',
    how: 'Message twenty people who already know you. Ask who they know with the problem, not whether they want to buy. Log every lead as a conversation.',
    metric: 'talks', target: 3, days: 7,
  },
  {
    key: 'one-line', book: 'The Lean Startup', part: 'reach', label: 'Change one thing',
    how: 'Change only the first line of your message for the next ten. Keep the ask the same, so the result means something.',
    metric: 'replied', target: 2, tries: { metric: 'sent', planned: 10 }, days: 10,
    prep: { label: 'Three first lines', by: 'ai', ask: 'Write three new first lines for my opening message, each about something specific to the business it goes to' },
  },
  {
    key: 'ask-why-not', book: 'The Mom Test', part: 'close', label: 'Ask the ones who said no',
    how: 'Write to everyone you met who did not buy, with one question: what stopped you? Log each answer as a conversation.',
    metric: 'talks', target: 3, days: 7,
    prep: { label: 'The question', by: 'ai', ask: 'Write one short message asking someone I met, who did not buy, what stopped them, with no pitch in it' },
  },
  {
    key: 'ask-for-no', book: 'Never Split the Difference', part: 'close', label: 'Ask for a no',
    how: 'On the next five replies, ask a question they can comfortably say no to, such as whether Thursday would be a bad time to talk, instead of "worth a call?".',
    metric: 'meetings', target: 2, tries: { metric: 'replied', planned: 5 }, days: 14,
  },
  {
    key: 'guarantee', book: '$100M Offers', part: 'pay', label: 'A guarantee, and the price up front',
    how: 'Add a guarantee you can keep and say the price in the first message. Ask the next ten.',
    metric: 'paid_at_price', target: 1, tries: { metric: 'sent', planned: 10 }, days: 14,
    prep: { label: 'The offer, rewritten', by: 'claude', ask: 'Rewrite my offer with a guarantee I can keep and the price said up front, from what has closed and what has not.' },
  },
  {
    key: 'paid-48h', book: 'Million Dollar Weekend', part: 'pay', label: 'Paid within 48 hours',
    how: 'Before you build anything more, ask people who fit to pay now. Any real payment counts; a promise to pay later does not.',
    metric: 'paid', target: 3, days: 2,
  },
  {
    key: 'one-package', book: 'Built to Sell', part: 'pay', label: 'One package, one price',
    how: 'Sell one package at one fixed price, with no custom work, for two weeks.',
    metric: 'paid_at_price', target: 2, days: 14,
    prep: { label: 'The package', by: 'ai', ask: 'Write a one-page description of one fixed package of what I sell: what is in it, what is not, the price and how long it takes' },
  },
  {
    key: 'hand-a-step', book: 'The E-Myth Revisited', part: 'deliver', label: 'Hand one step over',
    how: 'Write down how you deliver, step by step, and hand the step you like least to your agent.',
    metric: 'handed', target: 1, days: 14,
    prep: { label: 'The steps, as a checklist', by: 'claude', ask: 'Turn how I deliver into a numbered checklist someone else could follow, and mark the step that is easiest to hand over.' },
  },
];

export const PLAY_BY_KEY = new Map(PLAYS.map((p) => [p.key, p]));

export function playsFor(part: LinkKey): Play[] {
  return PLAYS.filter((p) => p.part === part);
}

/* ─── The tab, derived ────────────────────────────────────────────────────── */

export interface LabView {
  current: BetView | null;
  /** Bets that ended, newest first. */
  learned: BetView[];
  talks: Talk[];
  clock: Clock;
  checkpoint: CheckpointView;
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
    line: labLine(current, checkpoint.due),
    unreadable: lab?.unreadable ?? null,
  };
}
