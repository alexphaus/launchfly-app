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

import type { DecisionReview } from './decision';
import type { Finding, GrowthEdge } from './diagnose';
import type { FocusLog } from './focus';
import { focusWeek, hoursLabel } from './focus';
import type { MoveKind } from './moves';
import { phraseFor } from './phrase';
import type { OutcomeKind } from './types';

/** What loadHome reads back, in days. Twice the review, so a week that starts
 *  on a Wednesday still has its Monday. */
export const RECENT_DAYS = 14;
/** What the review covers. A week: long enough to have happened, short enough to still remember. */
export const REVIEW_DAYS = 7;
/** Below this many binned suggestions in a week it is taste, not a pattern worth a line. */
export const MIN_BINNED = 3;
/** A queue younger than this is today's work, not waste. Same floor as the triage gate. */
export const STALE_DRAFT_DAYS = 3;

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
  unreadable: string[];
}

export type ReviewTarget = 'queue' | 'sources' | 'projects' | 'matches' | 'focus' | 'record' | null;

export interface ReviewLine {
  text: string;
  /** "today", "yesterday", "Tue" — or null for a standing fact like a stale queue. */
  when: string | null;
  target: ReviewTarget;
}

export interface ReviewChange {
  head: string;
  /** The count that makes it true. */
  because: string | null;
  /** The bounded thing to try. */
  body: string;
  target: ReviewTarget;
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
  queue: { count: number; oldestDays: number };
  sources: { total: number; failing: number };
  review: Pick<DecisionReview, 'avoidedTopic' | 'deadTopic'>;
  edge: GrowthEdge | null;
  bottleneck: Finding | null;
  runwayMonths: number | null;
  /** For amounts logged without one. */
  currency: string;
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

/** The newest day in a set, as a label — a line about several rows is dated by its latest. */
function latestWhen(isos: string[], input: Pick<ReviewInput, 'today' | 'timezone'>): string | null {
  if (!isos.length) return null;
  const newest = isos.reduce((a, b) => (a >= b ? a : b));
  return whenLabel(localDay(newest, input.timezone), input.today);
}

export function weekReview(input: ReviewInput): WeekReview {
  const since = input.now.getTime() - REVIEW_DAYS * DAY_MS;
  const inWeek = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= since && Date.parse(iso) <= input.now.getTime() + DAY_MS;
  const outcomes = input.outcomes.filter((o) => inWeek(o.occurred_at));

  /* ── What created value ─────────────────────────────────────────────── */
  const value: ReviewLine[] = [];

  // Money first: it is the only line here that is not a proxy for anything.
  // Grouped by currency, because adding pesos to dollars is an invented number.
  const wins = outcomes.filter((o) => o.kind === 'won');
  if (wins.length) {
    const byCurrency = new Map<string, number>();
    for (const w of wins) if (w.amount != null && w.amount > 0) {
      const c = w.currency || input.currency;
      byCurrency.set(c, (byCurrency.get(c) ?? 0) + w.amount);
    }
    const amounts = [...byCurrency].map(([c, a]) => moneyLabel(a, c)).join(' + ');
    const who = names(wins.map((w) => w.who));
    value.push({
      text: amounts
        ? `Won ${amounts}${wins.length > 1 ? ` across ${wins.length} deals` : ''}${who ? ` — ${who}` : ''}`
        : `${plural(wins.length, 'win')} logged${who ? ` — ${who}` : ''}`,
      when: latestWhen(wins.map((w) => w.occurred_at), input),
      target: 'record',
    });
  }

  // What a mandate was worth, in the words the owner closed it with. A `won` on
  // a mandate is already in the wins above; this is the value that is not money.
  const worth = outcomes.filter((o) => o.commission_id && (o.kind === 'saved' || o.kind === 'delivered'));
  for (const w of worth.slice(0, 2)) {
    value.push({
      text: `${w.who ? `"${w.who}" — ` : ''}${w.kind === 'saved'
        ? (w.amount ? `saved you ${moneyLabel(w.amount, w.currency || input.currency)}` : 'saved you money or time')
        : 'produced something you can use'}`,
      when: latestWhen([w.occurred_at], input),
      target: 'projects',
    });
  }

  const replies = outcomes.filter((o) => o.kind === 'reply');
  if (replies.length) {
    const who = names(replies.map((r) => r.who));
    value.push({ text: `${plural(replies.length, 'reply', 'replies')}${who ? ` — ${who}` : ''}`, when: latestWhen(replies.map((r) => r.occurred_at), input), target: 'record' });
  }
  const meetings = outcomes.filter((o) => o.kind === 'meeting' || o.kind === 'proposal');
  if (meetings.length) {
    const who = names(meetings.map((m) => m.who));
    const met = meetings.filter((m) => m.kind === 'meeting').length;
    const proposed = meetings.length - met;
    const what = [met && plural(met, 'meeting'), proposed && plural(proposed, 'proposal')].filter(Boolean).join(' and ');
    value.push({ text: `${what}${who ? ` — ${who}` : ''}`, when: latestWhen(meetings.map((m) => m.occurred_at), input), target: 'record' });
  }

  // Things the app found that you went and did. Done, not merely read: a Move
  // marked done is the one answer in this app that means somebody acted.
  const done = input.answered.filter((a) => a.status === 'done' && inWeek(a.acted_at));
  if (done.length) {
    value.push({
      text: `You did ${plural(done.length, 'thing')} it found — ${done[0].headline}${done.length > 1 ? ` +${done.length - 1}` : ''}`,
      when: latestWhen(done.map((d) => d.acted_at), input),
      target: null,
    });
  }

  const week = focusWeek(input.focus, input.today);
  if (week.total > 0) {
    value.push({
      text: `${hoursLabel(week.total)} of deep work over ${plural(week.loggedDays, 'day')}`,
      when: null,
      target: 'focus',
    });
  }

  /* ── What was wasted ─────────────────────────────────────────────────── */
  const waste: ReviewLine[] = [];

  // Written and never sent is the most expensive line this product can print:
  // the work was done and it earned nothing, and it is still earning nothing.
  if (input.queue.count > 0 && input.queue.oldestDays >= STALE_DRAFT_DAYS) {
    waste.push({
      text: `${plural(input.queue.count, 'draft')} written and never sent — the oldest ${plural(input.queue.oldestDays, 'day')}`,
      when: null,
      target: 'queue',
    });
  }

  const avoided = input.review.avoidedTopic;
  if (avoided) {
    waste.push({
      // The topic is a job key; the screen says it the way a person would.
      text: `${plural(avoided.count, 'call')} about ${phraseFor(avoided.topic)} and not one of them done — either the call is wrong or something is in the way`,
      when: null,
      target: null,
    });
  }
  const dead = input.review.deadTopic;
  if (dead) {
    waste.push({
      text: `${plural(dead.count, 'call')} about ${phraseFor(dead.topic)} carried out, and the number each one named never moved`,
      when: null,
      target: null,
    });
  }

  // Mandates closed with nothing to show. Called off, or finished and answered
  // "worth nothing" — both are worker time that bought nothing, and the second
  // is the answer this app most needs to hear.
  const worthless = input.commissions.filter((c) =>
    inWeek(c.closed_at) && (c.status === 'stopped' || (c.outcome ?? '').startsWith('Worth nothing')));
  if (worthless.length) {
    waste.push({
      text: `${plural(worthless.length, 'project')} closed with nothing to show — ${worthless[0].objective}${worthless.length > 1 ? ` +${worthless.length - 1}` : ''}`,
      when: latestWhen(worthless.map((c) => c.closed_at!), input),
      target: 'projects',
    });
  }

  if (input.sources.failing > 0) {
    waste.push({
      text: `${input.sources.failing} of ${plural(input.sources.total, 'source')} failed their last read — each one is tried every night for nothing`,
      when: null,
      target: 'sources',
    });
  }

  const binned = input.answered.filter((a) => a.status === 'dismissed' && inWeek(a.acted_at));
  if (binned.length >= MIN_BINNED) {
    waste.push({
      text: `${plural(binned.length, 'suggestion')} you binned — each one cost a read, and each no is counted against its kind`,
      when: latestWhen(binned.map((b) => b.acted_at), input),
      target: null,
    });
  }

  /* ── What has to change ──────────────────────────────────────────────── */
  let change: ReviewChange | null = null;
  if (input.edge) {
    const cap = input.edge.capability;
    change = {
      head: cap.charAt(0).toUpperCase() + cap.slice(1),
      because: input.edge.because[0] ?? null,
      body: input.edge.experiment,
      // The one edge a tap can act on is the queue; the rest are ways of working.
      target: /sending|written/i.test(cap) ? 'queue' : null,
    };
  } else if (input.bottleneck?.action) {
    change = { head: input.bottleneck.headline, because: null, body: input.bottleneck.action, target: null };
  } else if (input.runwayMonths != null && input.runwayMonths < 3) {
    change = {
      head: `${input.runwayMonths} months of runway`,
      because: null,
      body: 'Under three months, work that pays this month beats work that pays next quarter. Pick the call that closes soonest.',
      target: null,
    };
  }

  return {
    value,
    waste,
    change,
    valueEmpty: 'Nothing logged as value in the last 7 days. A reply, a win, a finished project or a block of deep work is what counts here.',
  };
}
