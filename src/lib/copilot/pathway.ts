// src/lib/copilot/pathway.ts
// The Path tab: one stream on one axis. What was done is above, "you are here"
// is in the middle with the one thing to do now, and what comes next is below,
// down to the goal.
//
// Why one stream. Work drew the business as a machine and Today listed what to
// do; each was right on its own, and together they were two screens answering
// halves of one question — where am I, and what moves it. Three drafts of Work
// after that (an honest take with tests, a live machine, a milestone path, a
// weekly quota) were each "static sections that compete for attention and
// nothing changes", in their owner's words. Put on a time axis, the same rows
// stop competing: the past is what moved, the present is the call, the future is
// the plan, and the only thing that changes where you are is doing something.
//
// Three rules, each an invariant in another form:
//
//   Only what moved something is in the past. A find, a draft, a send, a reply,
//   a payment, a finished project, a call the ledger graded, hours you logged.
//   Never "the agent ran" — the Working? tab that listed runs was "a log", and
//   a stream of runs is a longer log (invariant 13 is served by the notices,
//   which say what broke, not by listing what did not).
//
//   The ladder is measured, never estimated. Each step is done when a count the
//   funnel already keeps says so; nothing here is a model's view of progress,
//   and a step the app cannot observe is not a step (invariant 2).
//
//   What comes next is the planner's, not a curriculum: the Moves the nightly
//   pass ranked, the work it offers to take on, the projects it is running —
//   then the ladder's next rungs, then the goal the user named. It is redrawn
//   every run because the Moves are.
//
// Pure: no DB import. The tab renders what these return.

import { verdictOf, type Decision } from './decision';
import type { FocusLog } from './focus';
import { dayLetter, hoursLabel, shiftDay } from './focus';
import { belowBar } from './matches';
import { KIND_LABEL } from './moves';
import { localDay, moneyLabel, whenLabel, type AnsweredMove, type RecentOutcome } from './review';
import { METRIC_LABEL } from './stake';
import { WORKER_CLOSE_MS, worthDoing } from './today';
import type { CommissionThread, Move, PipelineRow, QueueItem } from './types';

/** How far back the stream reaches. A week is what a person remembers doing. */
export const PATH_DAYS = 7;
/** Events shown before "Show earlier". Enough for a busy week, short enough to scroll past. */
export const MAX_PAST = 14;
/** Next steps before the ladder takes over. The call is the first; these are the rest of the week. */
export const MAX_NEXT = 4;
/** Wins before a result is something you can repeat rather than luck. */
export const REPEAT_WINS = 3;

const DAY_MS = 86_400_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (list: Array<string | null | undefined>, max = 2) => {
  const u = [...new Set(list.filter((x): x is string => !!x))];
  return u.length ? `${u.slice(0, max).join(', ')}${u.length > max ? ` +${u.length - max}` : ''}` : '';
};

/* ─── The past ────────────────────────────────────────────────────────────── */

/** Who did it: the app's agents, you, or somebody outside answering. */
export type PathActor = 'ai' | 'you' | 'world';
export type PathIcon = 'scout' | 'watcher' | 'writer' | 'send' | 'reply' | 'meeting' | 'money' | 'lost' | 'research' | 'call' | 'focus' | 'done';
export type PathTarget =
  | { kind: 'matches'; stage: 'new' | 'to_send' | 'waiting' | 'replied' }
  | { kind: 'project'; id: string }
  | { kind: 'focus' }
  | { kind: 'won' }
  | { kind: 'record' }
  | null;

export interface PathEvent {
  key: string;
  /** When it happened; for a day's roll-up, the latest of them. */
  at: string;
  /** The calendar day it belongs to, where the person lives. */
  day: string;
  actor: PathActor;
  icon: PathIcon;
  title: string;
  detail: string;
  target: PathTarget;
  /** False where the instant is not when it happened: hours are typed in after the fact. */
  timed: boolean;
}

export interface PathDay { day: string; label: string; events: PathEvent[] }

export interface PastInput {
  now: Date;
  timezone: string;
  pipeline: PipelineRow[];
  queue: QueueItem[];
  outcomes: RecentOutcome[];
  answered: AnsweredMove[];
  focus: FocusLog[];
  commissions: CommissionThread[];
  decisions: Decision[];
  /** Open feed finds, for the watcher's line. */
  watchMoves: Array<Pick<Move, 'id' | 'job' | 'created_at'>>;
}

const inWindow = (iso: string | null | undefined, now: Date) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now.getTime() - t <= PATH_DAYS * DAY_MS && t <= now.getTime() + 3_600_000;
};

/** "Monday's call" — how a person names a call they got earlier in the week. */
export function callName(forDate: string, today: string): string {
  const w = whenLabel(forDate, today);
  if (w === 'today') return 'Today’s call';
  if (w === 'yesterday') return 'Yesterday’s call';
  const full: Record<string, string> = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  return `${full[w] ?? w}’s call`;
}

/** Everything that moved in the last week, oldest first, as the rows prove it. */
export function pathEvents(input: PastInput): PathEvent[] {
  const { now, timezone: tz } = input;
  const today = localDay(now.toISOString(), tz);
  const out: PathEvent[] = [];

  // Rolled up per day, because "Scout found 12" is one thing that happened and
  // twelve rows saying "found" is the log this stream must not become.
  const perDay = <T,>(rows: T[], at: (r: T) => string): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const day = localDay(at(r), tz);
      m.set(day, [...(m.get(day) ?? []), r]);
    }
    return m;
  };
  const latest = (xs: string[]) => xs.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));

  // Finds. A day that looked at listings and kept none still did the looking,
  // and says so rather than showing a count the Matches tab will not.
  const found = input.pipeline.filter((r) => inWindow(r.opportunity.created_at, now));
  for (const [day, rows] of perDay(found, (r) => r.opportunity.created_at)) {
    const worth = rows.filter((r) => !belowBar(r.opportunity)).length;
    out.push({ timed: true,
      key: `find:${day}`, day, at: latest(rows.map((r) => r.opportunity.created_at)), actor: 'ai', icon: 'scout',
      title: `Scout found ${plural(rows.length, 'business', 'businesses')}`,
      detail: worth ? `${worth} worth a message` : 'None worth your time',
      target: { kind: 'matches', stage: 'new' },
    });
  }

  const watched = input.watchMoves.filter((m) => m.job === 'watch' && inWindow(m.created_at, now));
  for (const [day, rows] of perDay(watched, (m) => m.created_at)) {
    out.push({ timed: true,
      key: `watch:${day}`, day, at: latest(rows.map((m) => m.created_at)), actor: 'ai', icon: 'watcher',
      title: `Watcher flagged ${plural(rows.length, 'post')}`,
      detail: 'From the sources you follow',
      target: { kind: 'matches', stage: 'new' },
    });
  }

  // Drafts and sends, from both places an execution can be: the queue (not
  // sent yet) and the pipeline (the latest one for each business). One id, once.
  const executions = new Map<string, { created_at: string; sent_at: string | null; who: string | null }>();
  for (const q of input.queue) executions.set(q.execution.id, { created_at: q.execution.created_at, sent_at: q.execution.sent_at, who: q.opp?.title ?? null });
  for (const r of input.pipeline) if (r.execution) executions.set(r.execution.id, { created_at: r.execution.created_at, sent_at: r.execution.sent_at, who: r.opportunity.title });
  const all = [...executions.values()];

  const drafted = all.filter((e) => inWindow(e.created_at, now));
  for (const [day, rows] of perDay(drafted, (e) => e.created_at)) {
    out.push({ timed: true,
      key: `draft:${day}`, day, at: latest(rows.map((e) => e.created_at)), actor: 'ai', icon: 'writer',
      title: `Writer drafted ${plural(rows.length, 'opener')}`,
      detail: names(rows.map((e) => e.who)) || 'From your offer',
      target: { kind: 'matches', stage: 'to_send' },
    });
  }

  const sent = all.filter((e) => inWindow(e.sent_at, now));
  for (const [day, rows] of perDay(sent, (e) => e.sent_at!)) {
    out.push({ timed: true,
      key: `sent:${day}`, day, at: latest(rows.map((e) => e.sent_at!)), actor: 'you', icon: 'send',
      title: `You sent ${plural(rows.length, 'message')}`,
      detail: names(rows.map((e) => e.who)) || 'From your own WhatsApp or email',
      target: { kind: 'matches', stage: 'waiting' },
    });
  }

  // What came back, one row each: these are the rows the whole app is for.
  // A mandate's own ledger rows are its project's story, told below.
  for (const o of input.outcomes) {
    if (!inWindow(o.occurred_at, now) || o.commission_id) continue;
    const who = o.who ?? null;
    const base = { day: localDay(o.occurred_at, tz), at: o.occurred_at, actor: 'world' as const };
    const note = o.note?.trim() ? `“${o.note.trim().slice(0, 90)}${o.note.trim().length > 90 ? '…' : ''}”` : null;
    if (o.kind === 'reply') {
      out.push({ timed: true, ...base, key: `o:${o.id}`, icon: 'reply', title: `${who ?? 'A business'} replied`, detail: note ?? (o.source === 'system' ? 'Matched to what you sent' : 'You logged it'), target: { kind: 'matches', stage: 'replied' } });
    } else if (o.kind === 'meeting' || o.kind === 'proposal') {
      out.push({ timed: true, ...base, key: `o:${o.id}`, icon: 'meeting', title: `${o.kind === 'meeting' ? 'Meeting with' : 'Proposal to'} ${who ?? 'a business'}`, detail: note ?? 'Logged', target: { kind: 'matches', stage: 'replied' } });
    } else if (o.kind === 'won') {
      const paid = o.amount != null && o.amount > 0 ? moneyLabel(o.amount, o.currency || '$') : null;
      out.push({ timed: true, ...base, key: `o:${o.id}`, icon: 'money', title: paid ? `${who ?? 'A client'} paid ${paid}` : `Won ${who ?? 'a client'}`, detail: note ?? 'Logged as won', target: { kind: 'won' } });
    } else if (o.kind === 'lost') {
      out.push({ timed: true, ...base, key: `o:${o.id}`, icon: 'lost', title: `${who ?? 'A business'} said no`, detail: note ?? 'Logged as lost', target: null });
    } else if (o.kind === 'delivered') {
      out.push({ timed: true, ...base, actor: 'you', key: `o:${o.id}`, icon: 'done', title: `Delivered for ${who ?? 'a client'}`, detail: note ?? 'Logged', target: null });
    }
  }

  // Handed-over work. A finish only when the worker posted it — a close by hand
  // is the owner's own verdict, not something the app did — and progress by the
  // plan's own count, rolled up per project per day.
  for (const t of input.commissions) {
    const c = t.commission;
    if (c.status === 'done') {
      const byWorker = !!c.closed_at && !!c.last_run_at && Math.abs(Date.parse(c.closed_at) - Date.parse(c.last_run_at)) < WORKER_CLOSE_MS;
      if (byWorker && inWindow(c.closed_at, now)) {
        out.push({ timed: true, key: `pdone:${c.id}`, day: localDay(c.closed_at!, tz), at: c.closed_at!, actor: 'ai', icon: 'research', title: `Finished: ${c.objective}`, detail: c.outcome?.slice(0, 120) || 'Open it to see what came back', target: { kind: 'project', id: c.id } });
      }
      continue;
    }
    const did = t.report.did.filter((e) => inWindow(e.at, now));
    for (const [day, evs] of perDay(did, (e) => e.at)) {
      const last = evs.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a));
      out.push({ timed: true, key: `p:${c.id}:${day}`, day, at: last.at, actor: 'ai', icon: 'research', title: c.objective, detail: last.summary.slice(0, 120), target: { kind: 'project', id: c.id } });
    }
  }

  // A call the ledger graded. Only once it has been read back: until then the
  // call is a claim, and the stream is for what happened.
  for (const d of input.decisions) {
    if (!d.verify.verifiedAt || !inWindow(d.verify.verifiedAt, now)) continue;
    const v = verdictOf(d);
    if (v !== 'worked' && v !== 'no_movement') continue;
    const label = METRIC_LABEL[d.verify.metric];
    out.push({ timed: true,
      key: `call:${d.id}`, day: localDay(d.verify.verifiedAt, tz), at: d.verify.verifiedAt, actor: 'ai', icon: 'call',
      title: `${callName(d.for_date, today)} ${v === 'worked' ? 'worked' : 'did not move it'}`,
      detail: `“${d.headline.slice(0, 70)}”${label ? ` · ${label} ${d.verify.baseline} → ${d.verify.after}` : ''}`,
      target: { kind: 'record' },
    });
  }

  // Hours, on the day they were worked rather than the day they were typed in.
  for (const f of input.focus) {
    if (!inWindow(f.at, now) && !inWindow(`${f.on}T12:00:00Z`, now)) continue;
    out.push({ timed: false,
      key: `f:${f.id}`, day: f.on, at: f.at, actor: 'you', icon: 'focus',
      title: f.note ? `${hoursLabel(f.minutes)} on ${f.note}` : `${hoursLabel(f.minutes)} of deep work`,
      detail: 'Logged by you', target: { kind: 'focus' },
    });
  }

  // Moves you marked done. Not a feed find: Keep and Did it write the same
  // status there and cannot be told apart.
  for (const a of input.answered) {
    if (a.status !== 'done' || a.job === 'watch' || !inWindow(a.acted_at, now)) continue;
    out.push({ timed: true, key: `m:${a.id}`, day: localDay(a.acted_at, tz), at: a.acted_at, actor: 'you', icon: 'done', title: a.headline, detail: `Done · ${KIND_LABEL[a.kind] ?? 'Move'}`, target: null });
  }

  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The last `max` events, grouped by day, oldest first — and how many are held back. */
export function pathPast(input: PastInput, max = MAX_PAST): { days: PathDay[]; earlier: number } {
  const events = pathEvents(input);
  const shown = events.slice(Math.max(0, events.length - max));
  const today = localDay(input.now.toISOString(), input.timezone);
  // Grouped by the day it belongs to, not by position: hours logged on Friday
  // for a Tuesday sort by when they were typed and still belong to Tuesday.
  const byDay = new Map<string, PathEvent[]>();
  for (const e of shown) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, evs]): PathDay => {
    const w = whenLabel(day, today);
    return { day, label: w === 'today' ? 'Today' : w === 'yesterday' ? 'Yesterday' : w, events: evs };
  });
  return { days, earlier: events.length - shown.length };
}

/* ─── The ladder ──────────────────────────────────────────────────────────── */

export type StepState = 'done' | 'current' | 'next';
export type StepKey = 'offer' | 'sent' | 'reply' | 'paid' | 'repeat' | 'goal';

export interface PathStep {
  key: StepKey;
  n: number;
  title: string;
  detail: string;
  state: StepState;
  /** A fraction only where there is a count to be a fraction of. */
  progress: { done: number; of: number } | null;
  /**
   * The rung is the user's to write, not to earn: the offer, and a goal nobody
   * named. The screen puts the one tap that writes it on the rung itself.
   */
  input: 'offer' | 'goal' | null;
}

export interface LadderInput {
  offerSet: boolean;
  /** The funnel's own counts — the same numbers the path to money shows. */
  sent: number;
  replied: number;
  won: number;
  /** `money` when the goal is a currency one; any other goal counts in its own unit. */
  goal: { title: string; target: number | null; current: number | null; money: boolean; unit: string | null } | null;
  currency: string;
}

/**
 * Six rungs from nothing to the goal. Generic on purpose: it is the order every
 * outbound business goes through — say what it is, reach somebody, get an
 * answer, get paid, get paid again — and every rung is a count the app already
 * keeps. The last one is the user's own goal; with none set, naming it IS the
 * step, because the stream has nowhere to point.
 */
export function pathLadder(input: LadderInput): { steps: PathStep[]; current: number } {
  const g = input.goal;
  const goalMet = !!g?.target && (g.current ?? 0) >= g.target;
  const done: Record<StepKey, boolean> = {
    offer: input.offerSet,
    sent: input.sent > 0,
    reply: input.replied > 0,
    paid: input.won > 0,
    repeat: input.won >= REPEAT_WINS,
    goal: goalMet,
  };
  // The first rung not reached is where you are, even when a later one counts
  // something: a reply that came in before the offer was written does not make
  // the offer optional.
  const order: StepKey[] = ['offer', 'sent', 'reply', 'paid', 'repeat', 'goal'];
  const firstOpen = order.findIndex((k) => !done[k]);
  const current = firstOpen === -1 ? order.length - 1 : firstOpen;

  // "$1,800 of $12,000", but "1 of 10 clients": money carries its sign on both
  // sides, a count names its unit once.
  const ofTarget = (cur: number, target: number) => (g?.money
    ? `${moneyLabel(cur, input.currency)} of ${moneyLabel(target, input.currency)}`
    : `${Math.round(cur).toLocaleString('en-US')} of ${Math.round(target).toLocaleString('en-US')}${g?.unit ? ` ${g.unit}` : ''}`);
  const copy: Record<StepKey, { title: string; done: string; open: string; progress: PathStep['progress'] }> = {
    offer: { title: 'Say what you sell', done: 'Everything it writes starts here', open: 'One sentence. It writes nothing without it', progress: null },
    sent: { title: 'Send the first message', done: `${plural(input.sent, 'message')} sent so far`, open: 'From your own WhatsApp or email — the drafts are on Matches', progress: null },
    reply: { title: 'Get a reply', done: `${plural(input.replied, 'reply', 'replies')} so far`, open: `${plural(input.sent, 'message')} out, no answer yet`, progress: null },
    paid: { title: 'First paying client', done: `${plural(input.won, 'client')} so far`, open: `${plural(input.replied, 'conversation')}, none paid yet`, progress: null },
    repeat: { title: `${REPEAT_WINS} paying clients`, done: 'Something you can repeat, not luck', open: 'One can be luck. Three is something you can repeat', progress: { done: Math.min(input.won, REPEAT_WINS), of: REPEAT_WINS } },
    goal: g
      ? { title: g.title, done: 'Reached — set the next one', open: g.target ? ofTarget(g.current ?? 0, g.target) : 'No number on it yet', progress: g.target ? { done: Math.min(g.current ?? 0, g.target), of: g.target } : null }
      : { title: 'Name your goal', done: '', open: 'The path bends toward it. Nothing else here needs setting', progress: null },
  };

  const steps = order.map((k, i): PathStep => ({
    key: k,
    n: i + 1,
    title: copy[k].title,
    detail: done[k] ? copy[k].done : copy[k].open,
    state: i < current || (done[k] && i !== current) ? 'done' : i === current ? 'current' : 'next',
    // A done rung shows no fraction: it is done.
    progress: done[k] && i !== current ? null : copy[k].progress,
    input: k === 'offer' && !done.offer ? 'offer' : k === 'goal' && !g ? 'goal' : null,
  }));
  return { steps, current };
}

/* ─── What comes next ─────────────────────────────────────────────────────── */

export type NextKind = 'move' | 'offer' | 'project';

export interface NextStep {
  key: string;
  kind: NextKind;
  id: string;
  /** What kind of work it is, at a glance — a drafted message is a send, whatever the Move's kind. */
  icon: PathIcon;
  /** Who does it. An offer and a running project are the app's; a Move is yours. */
  actor: 'ai' | 'you';
  title: string;
  detail: string;
  /** For an offer: the plan being approved, always on screen when it is. */
  plan: string | null;
}

/**
 * The planner's next steps after the call, in its own order: the Moves it
 * ranked, then the work it offers to do itself, then what it is already doing.
 * Nothing is invented to fill the list — an empty one says the planner has
 * nothing beyond the call, which is true and useful.
 */
const KIND_ICON: Record<Move['kind'], PathIcon> = {
  earn: 'money', spend: 'money', build: 'research', fix: 'writer', learn: 'watcher', meet: 'meeting', decide: 'call', avoid: 'lost',
};

export function pathNext(input: { moves: Move[]; commissions: CommissionThread[] }, max = MAX_NEXT): { steps: NextStep[]; more: number } {
  const steps: NextStep[] = [];
  for (const m of worthDoing(input.moves, Number.POSITIVE_INFINITY).shown) {
    steps.push({
      key: `m:${m.id}`, kind: 'move', id: m.id, icon: m.artifact.kind === 'message' ? 'send' : KIND_ICON[m.kind] ?? 'done', actor: 'you', title: m.headline,
      detail: [KIND_LABEL[m.kind], m.artifact.kind === 'message' ? 'drafted' : null, m.cost_label].filter(Boolean).join(' · '),
      plan: null,
    });
  }
  for (const m of input.moves) {
    if (m.artifact?.kind !== 'plan') continue;
    steps.push({ key: `o:${m.id}`, kind: 'offer', id: m.id, icon: 'research', actor: 'ai', title: m.headline, detail: 'It can do this itself — the plan is below', plan: m.artifact.value });
  }
  for (const t of input.commissions) {
    const c = t.commission;
    // A project stopped on you is an ask, said beside the call; this is the work under way.
    if (c.status !== 'active') continue;
    const { done, total } = t.report.progress;
    steps.push({ key: `p:${c.id}`, kind: 'project', id: c.id, icon: 'research', actor: 'ai', title: c.objective, detail: total ? `Under way · ${done} of ${total} steps done` : 'Under way · reports back here', plan: null });
  }
  return { steps: steps.slice(0, max), more: Math.max(0, steps.length - max) };
}

/* ─── The week ────────────────────────────────────────────────────────────── */

export interface WeekDot { day: string; letter: string; moved: boolean; today: boolean }

/**
 * The seven days ending today, and whether each moved the business: a message
 * sent, an answer logged, a Move done. Opening the app is not moving it, and a
 * streak that counted opens would be a number that means nothing — this counts
 * what the ledger can prove you did.
 */
export function pathWeek(input: { now: Date; timezone: string; sentAt: string[]; outcomes: RecentOutcome[]; answered: AnsweredMove[] }): { days: WeekDot[]; streak: number; moved: number } {
  const today = localDay(input.now.toISOString(), input.timezone);
  const movedOn = new Set<string>();
  for (const s of input.sentAt) movedOn.add(localDay(s, input.timezone));
  for (const o of input.outcomes) if (o.source === 'manual' && !o.commission_id && o.kind !== 'nothing') movedOn.add(localDay(o.occurred_at, input.timezone));
  for (const a of input.answered) if (a.status === 'done' && a.job !== 'watch') movedOn.add(localDay(a.acted_at, input.timezone));

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(today, i - 6);
    return { day, letter: dayLetter(day), moved: movedOn.has(day), today: day === today };
  });
  // Consecutive days up to today — or up to yesterday while today is still
  // open, so a streak is not broken at nine in the morning.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].moved) streak += 1;
    else if (days[i].today) continue;
    else break;
  }
  return { days, streak, moved: days.filter((d) => d.moved).length };
}

/** The line under the greeting on Path: where you are, and what needs you. */
export function pathStatus(ladder: { steps: PathStep[]; current: number }, asks: number, streak: number): string {
  const parts = [`Step ${ladder.current + 1} of ${ladder.steps.length}`];
  if (asks) parts.push(`${asks} need${asks === 1 ? 's' : ''} you`);
  else if (streak >= 2) parts.push(`${streak} days in a row`);
  return parts.join(' · ');
}
