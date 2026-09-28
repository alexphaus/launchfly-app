// src/lib/copilot/review.ts
// The You tab's three questions — what created value, what was wasted, what has
// to change — answered by counting rows.
//
// What this replaces is the Working? tab: a funnel, the openings, a per-segment
// read, the log of calls and the findings, rendered as five sections of record.
// Every number on it was true and its owner opened it and saw a log: "static,
// without much value". The facts were not the problem; the questions were. A
// person looking back at a week asks whether anything paid, what they spent
// effort on for nothing, and what to do differently — so those are the three
// headings, and each line under them cites the rows that make it true.
//
// Line by line, and every line opens. The first version answered each question
// in sentences: "You did 2 things it put in front of you — Apply today to the
// Maintenance Coordinator role — it is scheduling and coordination for property
// maintenance, the same muscle as your booking automation work +1" was ONE line
// of the value card, six lines tall on a phone, and it named one of the two
// things. Now each thing done is a line of its own, a group (the wins, the
// replies, the hours) is one line with its rows behind it, and opening a line
// shows the rows it was counted from: the calls, the days, the drafts, the
// sources and why each failed.
//
// And the two cards under it move. Waste printed standing counts that changed
// only when the pile did, and the change printed one sentence per funnel stage,
// the same sentence every week the funnel stayed stuck — its owner's word for
// both was "static". So a waste line says what moved this week beside what is
// standing (sent this week, how many drafts have sat past the point of sending
// as written), and the change counts its own experiment off the rows: "2 of 5
// sent this week", then done, then what it asks next. The count is the ledger's.
// Nothing here ticks anything for anybody.
//
// Two rules the whole file keeps:
//
//   Invariant 2. Every line carries a number or a name that came off a row the
//   user created — a logged win, a draft that was written, a source that failed.
//   Nothing here is estimated and nothing is asked of a model.
//
//   Invariant 13. An empty block is never blank. `valueEmpty` says why there is
//   nothing, and a read that failed is named by the ledger (`unreadable`) so the
//   screen can say the week is incomplete rather than that it was quiet.
//
// Pure: no DB import. store.ts loads the ledger; the tab renders this.

import { decisionReview, metricLabel, metricWords, verdictOf, type Decision } from './decision';
import type { Finding, GrowthEdge } from './diagnose';
import type { FocusLog } from './focus';
import { focusWeek, hoursLabel, shiftDay } from './focus';
import type { MoveKind } from './moves';
import { phraseFor } from './phrase';
import { PROPOSE_JOB } from './propose';
import type { OutcomeKind } from './types';
import { WORTH_KINDS, worthSentence, type WorthKind } from './worth';

/** What loadHome reads back, in days. Twice the review, so a week that starts
 *  on a Wednesday still has its Monday. */
export const RECENT_DAYS = 14;
/** What the review covers. A week: long enough to have happened, short enough to still remember. */
export const REVIEW_DAYS = 7;
/** Below this many binned suggestions in a week it is taste, not a pattern worth a line. */
export const MIN_BINNED = 3;
/** A queue younger than this is today's work, not waste. Same floor as the triage gate. */
export const STALE_DRAFT_DAYS = 3;
/**
 * When a draft has sat long enough to stop being the message you would write
 * today: the two weeks send-queue.ts calls COLD_AFTER_DAYS, and a test holds the
 * two together. Not imported from there, because that file reads the database
 * and this one may not.
 */
export const COLD_DRAFT_DAYS = 14;
/** Rows a line shows when it opens. Enough to see the pattern; the sheet it links to has the rest. */
export const MAX_ITEMS = 5;
/** Things done that get a line each. Past this the rest are one line, "N more things you did", that opens. */
export const MAX_DID_LINES = 4;

export interface RecentOutcome {
  id: string;
  kind: OutcomeKind;
  amount: number | null;
  currency: string | null;
  note: string | null;
  /**
   * Who wrote the row. 'system' is a reply reconcileReplies matched on its own,
   * which is the only kind Today may report as done FOR you — a reply the user
   * typed in by hand is theirs, not the app's.
   */
  source: 'manual' | 'system' | 'webhook';
  occurred_at: string;
  opportunity_id: string | null;
  /** Null on an unapplied 20260921, and on every outcome that is not a mandate's. */
  commission_id: string | null;
  /** The business it was about, or the mandate's objective. Null when neither can be named. */
  who: string | null;
}

export interface AnsweredMove {
  id: string;
  job: string;
  kind: MoveKind;
  headline: string;
  status: 'done' | 'dismissed';
  acted_at: string;
}

/**
 * The recent record, as loadHome hands it over.
 *
 * `unreadable` is the part that makes the rest trustworthy. Each read degrades
 * to an empty list on failure — a missing column must not blank the screen — and
 * an empty list is exactly what a quiet week looks like. Naming the reads that
 * failed is the difference between "nothing happened" and "we could not see".
 */
export interface RecentLedger {
  /** The person's own today, YYYY-MM-DD in their timezone. */
  today: string;
  outcomes: RecentOutcome[];
  answered: AnsweredMove[];
  focus: FocusLog[];
  /**
   * When each message in the window went out, read by date. The pipeline holds
   * only the 200 best-scored businesses and each one's latest execution, so a
   * send to anything ranked below that was invisible to the week it happened
   * in. Absent on a payload from before this field existed.
   */
  sentAt?: string[];
  unreadable: string[];
}

/**
 * Where a line leads. `won`, `replied` and `waiting` open the business lists
 * they name — the wins sheet and the Matches pills — rather than the record
 * sheet, which answers questions and is not where a reply is followed up.
 */
export type ReviewTarget = 'queue' | 'sources' | 'projects' | 'matches' | 'focus' | 'record' | 'won' | 'replied' | 'waiting' | null;

/** What a line is about. The screen gives each its glyph, so the card reads at a glance. */
export type ReviewKind = 'money' | 'worth' | 'reply' | 'meeting' | 'did' | 'focus' | 'queue' | 'calls' | 'projects' | 'sources' | 'binned';

/** One row behind a line, shown when the line opens. */
export interface ReviewItem {
  text: string;
  /** "today", "Tue" — or an age, "18 days", for something that is still waiting. */
  when: string | null;
  /** A note logged with it, why it failed, where it came from. */
  note: string | null;
}

export interface ReviewLine {
  /** Stable across refreshes, so a line left open stays open when the data under it moves. */
  key: string;
  kind: ReviewKind;
  /** The line itself: one glance. */
  text: string;
  /** "today", "yesterday", "Tue" — or null for a standing fact like a stale queue. */
  when: string | null;
  /** Under the line, always in view: what moved this week. Null when there is nothing to add. */
  sub: string | null;
  /** Shown when the line opens: where it came from, and what came of it. */
  detail: string[];
  /** Shown when the line opens: the rows it was counted from. */
  items: ReviewItem[];
  /** Rows past the ones in `items`. */
  more: number;
  target: ReviewTarget;
}

/** The experiment, counted: this week's rows against the number it names. */
export interface ReviewProgress {
  done: number;
  of: number;
  met: boolean;
  /** "2 of 5 sent this week", then "5 sent this week — done". */
  label: string;
}

export interface ReviewChange {
  head: string;
  /** The count that makes it true. */
  because: string | null;
  /** The bounded thing to try. */
  body: string;
  /** Null where no row can count the experiment, or the ledger did not carry the rows. */
  progress: ReviewProgress | null;
  /** Once the count is met: what the experiment asks for next. */
  next: string | null;
  /** The one button, when a tap can act on it. */
  action: { label: string; target: ReviewTarget } | null;
}

export interface WeekReview {
  value: ReviewLine[];
  waste: ReviewLine[];
  change: ReviewChange | null;
  /** Said in place of an empty value block. Never blank. */
  valueEmpty: string;
}

export interface ReviewInput {
  now: Date;
  /** The person's today, YYYY-MM-DD. */
  today: string;
  timezone: string;
  outcomes: RecentOutcome[];
  answered: AnsweredMove[];
  focus: FocusLog[];
  commissions: Array<{ id: string; objective: string; status: string; closed_at: string | null; outcome: string | null }>;
  /** `drafts` are the waiting ones by name and age, for the line that opens; absent on an older caller. */
  queue: { count: number; oldestDays: number; drafts?: Array<{ who: string; createdAt: string }> };
  /** `failed` names each failing source and why, for the line that opens. */
  sources: { total: number; failing: number; failed?: Array<{ label: string; error: string; checkedAt: string | null }> };
  /**
   * The call record. Filtered to this week here, not by the caller: the tab is
   * headed "This week", and three ignored calls from last month are not this
   * week's waste.
   */
  decisions: Array<Pick<Decision, 'for_date' | 'headline' | 'topic' | 'response' | 'verify' | 'source_move_id'>>;
  edge: GrowthEdge | null;
  bottleneck: Finding | null;
  runwayMonths: number | null;
  /** For amounts logged without one. */
  currency: string;
  /**
   * When each message went out (RecentLedger.sentAt). Absent is not zero: a
   * payload from before the ledger carried sends says nothing about sending,
   * rather than "none sent this week" over a week that had some.
   */
  sentAt?: string[];
  /** The drawn plan's ticks — a step done is something the person did and said so. */
  marks?: Array<{ item: string; title: string; state: 'done' | 'dropped' | 'open'; at: string }>;
}

const DAY_MS = 86_400_000;

/** The calendar day an instant falls on, where the person lives. */
export function localDay(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

/** "today", "yesterday", or the weekday — how a person says when something in this week happened. */
export function whenLabel(day: string, today: string): string {
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${day}T00:00:00Z`).getUTCDay()];
}

export const FULL_DAY: Record<string, string> = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

/** "Monday's call" — how a person names a call they got earlier in the week. */
export function callName(forDate: string, today: string): string {
  const w = whenLabel(forDate, today);
  if (w === 'today') return 'Today’s call';
  if (w === 'yesterday') return 'Yesterday’s call';
  return `${FULL_DAY[w] ?? w}’s call`;
}

export function moneyLabel(amount: number, currency: string): string {
  return `${currency}${Math.round(amount).toLocaleString('en-US')}`;
}

/** "X Out Pest, Tubero +1" — enough to recognise, never a wall. */
function names(list: Array<string | null>, max = 2): string {
  const clean = [...new Set(list.map((n) => n?.trim()).filter((n): n is string => !!n))];
  if (!clean.length) return '';
  const shown = clean.slice(0, max);
  return clean.length > max ? `${shown.join(', ')} +${clean.length - max}` : shown.join(', ');
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isText = (s: string | null | undefined): s is string => !!s;

/** A note as the person wrote it, quoted, cut at a length a row can hold. */
function quote(note: string | null | undefined): string | null {
  const t = note?.trim();
  if (!t) return null;
  return `“${t.length > 120 ? `${t.slice(0, 119).trimEnd()}…` : t}”`;
}

/** How long something has waited, said as an age: "today", "1 day", "18 days". */
function ageLabel(days: number): string {
  return days <= 0 ? 'today' : plural(days, 'day');
}

/** The newest day in a set, as a label — a line about several rows is dated by its latest. */
function latestWhen(isos: string[], input: Pick<ReviewInput, 'today' | 'timezone'>): string | null {
  if (!isos.length) return null;
  const newest = isos.reduce((a, b) => (a >= b ? a : b));
  return whenLabel(localDay(newest, input.timezone), input.today);
}

/** The first MAX_ITEMS rows as items, and how many more there are. */
function listed<T>(rows: T[], map: (row: T) => ReviewItem): Pick<ReviewLine, 'items' | 'more'> {
  return { items: rows.slice(0, MAX_ITEMS).map(map), more: Math.max(0, rows.length - MAX_ITEMS) };
}

/**
 * A group of one opens to its note rather than to a list of one row that
 * repeats the line above it; a group of several opens to the rows.
 */
function grouped<T>(rows: T[], map: (row: T) => ReviewItem): Pick<ReviewLine, 'items' | 'more' | 'detail'> {
  if (rows.length === 1) {
    const only = map(rows[0]);
    return { items: [], more: 0, detail: only.note ? [only.note] : [] };
  }
  return { ...listed(rows, map), detail: [] };
}

const line = (l: Pick<ReviewLine, 'key' | 'kind' | 'text' | 'target'> & Partial<ReviewLine>): ReviewLine =>
  ({ when: null, sub: null, detail: [], items: [], more: 0, ...l });

/**
 * What a call answered "I did it" turned into, in its metric's own unit — the
 * same words the Path's receipt uses, so the two cannot read differently.
 */
function callResult(d: ReviewInput['decisions'][number], currency: string): string | null {
  const v = verdictOf(d);
  const m = d.verify.metric;
  const at = (n: number) => metricLabel(m, n, currency);
  if (v === 'measuring') return `Reading ${metricWords(m)} back in a few days — ${at(d.verify.baseline)} when you decided`;
  if (v === 'worked') return `It worked: ${metricWords(m)} ${at(d.verify.baseline)} → ${at(d.verify.after ?? d.verify.baseline)}`;
  if (v === 'no_movement') return `${capital(metricWords(m))} did not move`;
  return null;
}

/** How a call on the waste card ended, per call. */
const CALL_END: Partial<Record<ReturnType<typeof verdictOf>, string>> = {
  ignored: 'Left undone',
  rejected: 'You said no',
  open: 'Still open',
  no_movement: 'Done, and the number did not move',
  measuring: 'Done, still being read back',
  worked: 'Done, and it worked',
  done: 'Done',
  wrong: 'You marked it wrong',
};

/**
 * The experiment, counted. Said the same way for every experiment that has a
 * count, so the card reads as one meter rather than a sentence per stage.
 */
function progressOf(done: number, of: number, metric: 'sent' | 'replies'): ReviewProgress {
  const met = done >= of;
  const unit = metric === 'sent' ? 'sent' : done === 1 ? 'reply' : 'replies';
  return { done, of, met, label: met ? `${done} ${unit} this week — done` : `${done} of ${of} ${metric === 'sent' ? 'sent' : 'replies'} this week` };
}

/** Once the count is met: the half of the experiment the count cannot see. */
const NEXT: Record<'sent' | 'replies', string> = {
  sent: 'Now log what comes back as it arrives — the next read is only as good as what is logged.',
  replies: 'Now log which of them turned into a booked call.',
};

export function weekReview(input: ReviewInput): WeekReview {
  const since = input.now.getTime() - REVIEW_DAYS * DAY_MS;
  const inWeek = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= since && Date.parse(iso) <= input.now.getTime() + DAY_MS;
  const outcomes = input.outcomes.filter((o) => inWeek(o.occurred_at));
  const firstDay = shiftDay(input.today, -(REVIEW_DAYS - 1));
  const calls = input.decisions.filter((d) => d.for_date >= firstDay && d.for_date <= input.today);
  const dayOf = (iso: string) => whenLabel(localDay(iso, input.timezone), input.today);
  const newest = <T>(rows: T[], at: (row: T) => string) => [...rows].sort((a, b) => at(b).localeCompare(at(a)));
  const sentWeek = input.sentAt ? input.sentAt.filter((t) => inWeek(t)).length : null;

  /* ── What created value ─────────────────────────────────────────────── */
  const value: ReviewLine[] = [];

  // Money first: it is the only line here that is not a proxy for anything.
  // Grouped by currency, because adding pesos to dollars is an invented number.
  const wins = newest(outcomes.filter((o) => o.kind === 'won'), (o) => o.occurred_at);
  if (wins.length) {
    const byCurrency = new Map<string, number>();
    for (const w of wins) if (w.amount != null && w.amount > 0) {
      const c = w.currency || input.currency;
      byCurrency.set(c, (byCurrency.get(c) ?? 0) + w.amount);
    }
    const amounts = [...byCurrency].map(([c, a]) => moneyLabel(a, c)).join(' + ');
    // One win names its client on the line; several name theirs when opened.
    const who = wins.length === 1 ? wins[0].who?.trim() ?? '' : '';
    const paid = (w: RecentOutcome) => (w.amount != null && w.amount > 0 ? moneyLabel(w.amount, w.currency || input.currency) : null);
    value.push(line({
      key: 'money', kind: 'money', target: 'won',
      text: amounts
        ? `Won ${amounts}${wins.length > 1 ? ` across ${wins.length} deals` : ''}${who ? ` — ${who}` : ''}`
        : `${plural(wins.length, 'win')} logged${who ? ` — ${who}` : ''}`,
      when: latestWhen(wins.map((w) => w.occurred_at), input),
      ...grouped(wins, (w) => {
        const p = paid(w);
        const client = w.who?.trim() || 'A client';
        return { text: p ? `${client} paid ${p}` : `Won ${client}`, when: dayOf(w.occurred_at), note: quote(w.note) };
      }),
    }));
  }

  // What a mandate was worth, in the words the owner closed it with. A `won` on
  // a mandate is already in the wins above; this is the value that is not money.
  const worth = outcomes.filter((o) => o.commission_id && (o.kind === 'saved' || o.kind === 'delivered'));
  for (const w of worth.slice(0, 2)) {
    value.push(line({
      key: `worth:${w.id}`, kind: 'worth', target: 'projects',
      text: `${w.who ? `"${w.who}" — ` : ''}${w.kind === 'saved'
        ? (w.amount ? `saved you ${moneyLabel(w.amount, w.currency || input.currency)}` : 'saved you money or time')
        : 'produced something you can use'}`,
      when: latestWhen([w.occurred_at], input),
      detail: [quote(w.note)].filter(isText),
    }));
  }

  // Where a reply came from is part of what it is: one the app matched on its
  // own is the world's; one typed in is the person's own record.
  const replies = newest(outcomes.filter((o) => o.kind === 'reply'), (o) => o.occurred_at);
  if (replies.length) {
    const who = names(replies.map((r) => r.who));
    value.push(line({
      key: 'replies', kind: 'reply', target: 'replied',
      text: `${plural(replies.length, 'reply', 'replies')}${who ? ` — ${who}` : ''}`,
      when: latestWhen(replies.map((r) => r.occurred_at), input),
      ...grouped(replies, (r) => ({
        text: `${r.who?.trim() || 'A business'} replied`,
        when: dayOf(r.occurred_at),
        note: quote(r.note) ?? (r.source === 'system' ? 'Matched to what you sent' : 'You logged it'),
      })),
    }));
  }
  const meetings = newest(outcomes.filter((o) => o.kind === 'meeting' || o.kind === 'proposal'), (o) => o.occurred_at);
  if (meetings.length) {
    const who = names(meetings.map((m) => m.who));
    const met = meetings.filter((m) => m.kind === 'meeting').length;
    const proposed = meetings.length - met;
    const what = [met && plural(met, 'meeting'), proposed && plural(proposed, 'proposal')].filter(Boolean).join(' and ');
    value.push(line({
      key: 'meetings', kind: 'meeting', target: 'replied',
      text: `${what}${who ? ` — ${who}` : ''}`,
      when: latestWhen(meetings.map((m) => m.occurred_at), input),
      ...grouped(meetings, (m) => ({
        text: `${m.kind === 'meeting' ? 'Meeting with' : 'Proposal to'} ${m.who?.trim() || 'a business'}`,
        when: dayOf(m.occurred_at),
        note: quote(m.note),
      })),
    }));
  }

  // Things it put in front of you that you went and did, one line each. A call
  // answered "I did it" is the one reliable yes; a Move marked done usually is
  // too, with two exceptions that are not doing anything. On a feed find, "Keep"
  // and "Did it" both write done and cannot be told apart, so a kept gig post
  // would count as work somebody did. On a proposal, done means handed over, and
  // what that was worth is recorded when the mandate closes, not when it is
  // delegated. The Move behind a call is counted once, as the call. A step
  // ticked on the plan is the person's own word that it is done.
  const didCalls = calls.filter((d) => d.response === 'did');
  const viaCall = new Set(didCalls.map((d) => d.source_move_id).filter((id): id is string => !!id));
  const didMoves = input.answered.filter((a) =>
    a.status === 'done' && a.job !== 'watch' && a.job !== PROPOSE_JOB && !viaCall.has(a.id) && inWeek(a.acted_at));
  // The newest mark per item, and only a done one: a step ticked and put back was not done.
  const lastMark = new Map<string, NonNullable<ReviewInput['marks']>[number]>();
  for (const m of input.marks ?? []) {
    const was = lastMark.get(m.item);
    if (!was || Date.parse(m.at) >= Date.parse(was.at)) lastMark.set(m.item, m);
  }
  const ticks = [...lastMark.values()].filter((m) => m.state === 'done' && m.title?.trim() && inWeek(m.at));

  type Did = { key: string; headline: string; day: string; detail: string[] };
  const did: Did[] = [];
  const seen = new Set<string>();
  // One piece of work, one line. "I did it" on a call drawn from the plan also
  // ticks the step it came from (stepForCall), under the same words, so the call
  // and the tick are said once — as the call, which knows what came of it.
  const add = (x: Did) => {
    const k = x.headline.trim().toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    did.push(x);
  };
  for (const d of didCalls) {
    add({ key: `call:${d.for_date}`, headline: d.headline, day: d.for_date, detail: [`${callName(d.for_date, input.today)} — you answered “I did it”`, callResult(d, input.currency)].filter(isText) });
  }
  for (const a of didMoves) add({ key: `move:${a.id}`, headline: a.headline, day: localDay(a.acted_at, input.timezone), detail: ['A suggestion you marked done'] });
  for (const m of ticks) add({ key: `tick:${m.item}`, headline: m.title.trim(), day: localDay(m.at, input.timezone), detail: ['Ticked off on your plan'] });
  did.sort((a, b) => b.day.localeCompare(a.day));

  const own = did.length > MAX_DID_LINES ? did.slice(0, MAX_DID_LINES - 1) : did;
  for (const x of own) {
    value.push(line({ key: `did:${x.key}`, kind: 'did', target: null, text: x.headline, when: whenLabel(x.day, input.today), detail: x.detail }));
  }
  const rest = did.slice(own.length);
  if (rest.length) {
    value.push(line({
      key: 'did:more', kind: 'did', target: null,
      text: `${plural(rest.length, 'more thing')} you did`,
      when: whenLabel(rest[0].day, input.today),
      ...listed(rest, (x) => ({ text: x.headline, when: whenLabel(x.day, input.today), note: x.detail[0] ?? null })),
    }));
  }

  const week = focusWeek(input.focus, input.today);
  if (week.total > 0) {
    // The week before is the one comparison on this card: whether these hours
    // are more or fewer than usual is the thing a total alone cannot say.
    const before = focusWeek(input.focus, shiftDay(input.today, -REVIEW_DAYS)).total;
    const notes = new Map<string, Set<string>>();
    for (const f of input.focus) {
      const n = f.note?.trim();
      if (n) notes.set(f.on, (notes.get(f.on) ?? new Set<string>()).add(n));
    }
    value.push(line({
      key: 'focus', kind: 'focus', target: 'focus',
      text: `${hoursLabel(week.total)} of deep work over ${plural(week.loggedDays, 'day')}`,
      sub: before <= 0 ? null
        : week.total > before ? `Up from ${hoursLabel(before)} the week before`
        : week.total < before ? `Down from ${hoursLabel(before)} the week before`
        : 'The same as the week before',
      // Every day worked, newest first, with what it was on.
      items: [...week.days].reverse().filter((d) => d.minutes > 0)
        .map((d) => ({ text: hoursLabel(d.minutes), when: whenLabel(d.on, input.today), note: [...(notes.get(d.on) ?? [])].join(' · ') || null })),
    }));
  }

  /* ── What was wasted ─────────────────────────────────────────────────── */
  const waste: ReviewLine[] = [];

  // Written and never sent is the most expensive line this product can print:
  // the work was done and it earned nothing, and it is still earning nothing.
  // Its standing count moves only when the pile does, so the line under it says
  // what moved: what went out this week, and how many have sat long enough to
  // need rewriting rather than sending — a number that grows every day nothing
  // is sent, and shrinks the moment something is.
  if (input.queue.count > 0 && input.queue.oldestDays >= STALE_DRAFT_DAYS) {
    const age = (iso: string) => Math.max(0, Math.floor((input.now.getTime() - Date.parse(iso)) / DAY_MS));
    const drafts = [...(input.queue.drafts ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const cold = drafts.filter((d) => age(d.createdAt) >= COLD_DRAFT_DAYS).length;
    const sub = [
      sentWeek == null ? null : sentWeek > 0 ? `${sentWeek} sent this week` : 'none sent this week',
      cold > 0 ? `${cold} ${cold === 1 ? 'has' : 'have'} sat two weeks or more` : `the oldest has waited ${plural(input.queue.oldestDays, 'day')}`,
    ].filter(isText).join(' · ');
    waste.push(line({
      key: 'queue', kind: 'queue', target: 'queue',
      text: `${plural(input.queue.count, 'draft')} written and never sent`,
      sub: capital(sub),
      // Oldest first: the recipient closest to having moved on.
      items: drafts.slice(0, MAX_ITEMS).map((d) => ({ text: d.who, when: ageLabel(age(d.createdAt)), note: null })),
      more: drafts.length ? Math.max(0, input.queue.count - Math.min(drafts.length, MAX_ITEMS)) : 0,
    }));
  }

  const record = decisionReview(calls);
  const topicCalls = (topic: string) => calls.filter((d) => d.topic?.trim().toLowerCase() === topic)
    .sort((a, b) => b.for_date.localeCompare(a.for_date));
  const callItems = (topic: string) => listed(topicCalls(topic), (d) => ({ text: d.headline, when: whenLabel(d.for_date, input.today), note: CALL_END[verdictOf(d)] ?? null }));
  const avoided = record.avoidedTopic;
  if (avoided) {
    waste.push(line({
      // The topic is a job key; the screen says it the way a person would.
      key: 'calls:avoided', kind: 'calls', target: 'record',
      text: `${plural(avoided.count, 'call')} about ${phraseFor(avoided.topic)} and not one of them done`,
      sub: 'Either the call is wrong or something is in the way',
      ...callItems(avoided.topic),
    }));
  }
  const dead = record.deadTopic;
  if (dead) {
    waste.push(line({
      key: 'calls:dead', kind: 'calls', target: 'record',
      text: `${plural(dead.count, 'call')} about ${phraseFor(dead.topic)} carried out, and the number never moved`,
      sub: 'Doing the same thing harder is not the missing piece',
      ...callItems(dead.topic),
    }));
  }

  // Mandates closed with nothing to show: answered "worth nothing", or called off
  // with no answer at all. The verdict is read off the ledger row first — its
  // kind is structured — and off the sentence closeCommission writes only when
  // the ledger could not take the row, matched against worthSentence itself so
  // the two cannot drift. Called off with a real answer ("it produced
  // something") is not waste, whatever the button was.
  const verdict = new Map<string, WorthKind>();
  for (const o of [...input.outcomes].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (o.commission_id && (WORTH_KINDS as readonly string[]).includes(o.kind)) verdict.set(o.commission_id, o.kind as WorthKind);
  }
  const nothingSaid = worthSentence('nothing');
  const verdictOfProject = (c: ReviewInput['commissions'][number]) => verdict.get(c.id) ?? ((c.outcome ?? '').startsWith(nothingSaid) ? 'nothing' : null);
  const worthless = newest(input.commissions.filter((c) => {
    if (!inWeek(c.closed_at)) return false;
    const v = verdictOfProject(c);
    return v === 'nothing' || (v == null && c.status === 'stopped');
  }), (c) => c.closed_at!);
  if (worthless.length) {
    waste.push(line({
      key: 'projects', kind: 'projects', target: 'projects',
      text: `${plural(worthless.length, 'project')} closed with nothing to show`,
      when: latestWhen(worthless.map((c) => c.closed_at!), input),
      ...listed(worthless, (c) => ({
        text: c.objective,
        when: dayOf(c.closed_at!),
        note: verdictOfProject(c) === 'nothing' ? 'You said it was worth nothing' : 'Called off with no verdict',
      })),
    }));
  }

  if (input.sources.failing > 0) {
    const failed = input.sources.failed ?? [];
    waste.push(line({
      key: 'sources', kind: 'sources', target: 'sources',
      text: `${input.sources.failing} of ${plural(input.sources.total, 'source')} failed their last read`,
      sub: 'Each one is tried every night for nothing',
      // Each by name, with the reason it gave and when it last tried: what to fix, or to drop.
      items: failed.slice(0, MAX_ITEMS).map((s) => ({
        text: s.label,
        when: s.checkedAt ? dayOf(s.checkedAt) : null,
        note: s.error.length > 110 ? `${s.error.slice(0, 109).trimEnd()}…` : s.error,
      })),
      more: failed.length ? Math.max(0, input.sources.failing - Math.min(failed.length, MAX_ITEMS)) : 0,
    }));
  }

  const binned = newest(input.answered.filter((a) => a.status === 'dismissed' && inWeek(a.acted_at)), (a) => a.acted_at);
  if (binned.length >= MIN_BINNED) {
    waste.push(line({
      key: 'binned', kind: 'binned', target: null,
      text: `${plural(binned.length, 'suggestion')} you binned`,
      sub: 'Each one cost a read, and each no counts against its kind',
      when: latestWhen(binned.map((b) => b.acted_at), input),
      ...listed(binned, (b) => ({ text: b.headline, when: dayOf(b.acted_at), note: null })),
    }));
  }

  /* ── What has to change ──────────────────────────────────────────────── */
  let change: ReviewChange | null = null;
  if (input.edge) {
    const cap = input.edge.capability;
    const m = input.edge.measure ?? null;
    // Counted where the experiment names a count and the ledger carried the rows
    // behind it. Sends this week, not since some start date: the card says "try
    // this week", and a count that never resets is a total, not an experiment.
    const done = m ? (m.metric === 'sent' ? sentWeek : outcomes.filter((o) => o.kind === 'reply').length) : null;
    const progress = m && done != null ? progressOf(done, m.target, m.metric) : null;
    const queued = input.queue.count > 0;
    change = {
      head: capital(cap),
      because: input.edge.because[0] ?? null,
      body: input.edge.experiment,
      progress,
      next: progress?.met && m ? NEXT[m.metric] : null,
      action: progress?.met && m
        ? (m.metric === 'sent' ? { label: 'Log what came back', target: 'waiting' } : { label: 'See your replies', target: 'replied' })
        : m?.metric === 'replies' ? { label: 'See your replies', target: 'replied' }
        // Sending is done from the queue, and the one edge about writing that a
        // tap can act on is the queue too.
        : (m?.metric === 'sent' || /sending|written/i.test(cap)) && queued ? { label: 'Open the queue', target: 'queue' }
        : null,
    };
  } else if (input.bottleneck?.action) {
    change = { head: input.bottleneck.headline, because: null, body: input.bottleneck.action, progress: null, next: null, action: null };
  } else if (input.runwayMonths != null && input.runwayMonths < 3) {
    change = {
      head: `${input.runwayMonths} months of runway`,
      because: null,
      body: 'Under three months, work that pays this month beats work that pays next quarter. Pick the call that closes soonest.',
      progress: null,
      next: null,
      action: null,
    };
  }

  return {
    value,
    waste,
    change,
    valueEmpty: 'Nothing logged as value in the last 7 days. A reply, a win, a finished project or a block of deep work is what counts here.',
  };
}
