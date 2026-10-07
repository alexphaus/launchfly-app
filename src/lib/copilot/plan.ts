// src/lib/copilot/plan.ts
// The Path's forward half: where you are, in words rather than step numbers;
// the one move to make now; and the plan from here to the goal you put first.
// Every number in it is computed from your rows, the price you wrote and the
// time you said you have.
//
// Why arithmetic and not a written roadmap. DIRECTION.md's test is whether a
// personal agent with memory could do this after a week of use. "Here is your
// plan to $1,500" it could. "10 clients at your $150, about 45 sends at the rate
// your own 9 sends earned, two days of Deep focus" it cannot, because that needs
// the ledger. So the plan is the goal walked back through the funnel — money →
// clients at your price → sends at your own rate → days at your capacity — and
// where a link has nothing under it yet (no price, no client, no reply) it says
// what would turn it into a number rather than supplying one (invariant 2).
//
// The uncertainty is part of the plan, not a disclaimer under it. A rate from
// fewer than RATE_SAMPLE sends is marked early wherever it is used, and the
// checkpoint says which result would change the plan and when you will know.
//
// Capacity is visible on purpose: the batch the move asks for, how long a
// milestone takes and whether a step fits today are all read from the time you
// set at the top of the screen, so changing it redraws the plan.
//
// Pure: no DB import.

import { daysPhrase, goalDue } from './due';
import type { PathStep } from './pathway';
import { REPEAT_WINS } from './pathway';
import { moneyLabel } from './review';
import { costMinutesOf, DEFAULT_COST_MINUTES } from './stake';
import type { AskRow } from './today';
import { CAPACITY_META, type Capacity, type Goal, type Move } from './types';

/** Minutes one send costs — the figure the send-queue job prices a batch at. */
export const SEND_MINUTES = 3;
/** Share of the day's time the move may spend sending. The rest is for whatever comes back. */
export const SEND_SHARE = 0.5;
/** Sends before a rate is a measurement rather than an early guess. */
export const RATE_SAMPLE = 20;
/** Replies by RATE_SAMPLE that say an opener is working. Fewer is a reason to change one thing. */
export const WORKING_REPLIES = 2;
/** Other things that need you, beside the move. More is a list, and the move is one thing. */
export const MAX_ALSO = 3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface Funnel { sent: number; replied: number; won: number }

/**
 * "$150", "$400-1,500 per build", "₱18k a month" → the low end. Planning on the
 * top of a range is how a plan becomes a wish; the low end is the price you
 * already said you would take.
 */
export function priceOf(band?: string | null): number | null {
  if (!band) return null;
  const m = /(\d+(?:\.\d+)?)\s*(k(?![a-z]))?/i.exec(band.replace(/(\d),(?=\d{3}\b)/g, '$1'));
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Sends a day at the capacity you set: SEND_SHARE of the day's time. The same
 * pace the move asks for, so "send 25 now" and "two days of sending" are the
 * same arithmetic — with the whole day counted, a milestone called 45 sends
 * "under a day" beside a move that asked for 25.
 */
export function sendsPerDay(capacity: Capacity): number {
  return Math.max(1, Math.floor((CAPACITY_META[capacity].minutes * SEND_SHARE) / SEND_MINUTES));
}

/** How many to send now: a day's pace, never more than are written. */
export function sendBatch(capacity: Capacity, queue: number): number {
  return queue <= 0 ? 0 : Math.min(queue, sendsPerDay(capacity));
}

/** "2 clients from 9 sends" — the basis an estimate stands on, said beside it. */
const basis = (f: Funnel) => `${plural(f.won, 'client')} from ${plural(f.sent, 'send')}`;
const daysOf = (sends: number, capacity: Capacity) => {
  const days = Math.ceil(sends / sendsPerDay(capacity));
  return days <= 1 ? 'under a day' : `${days} days`;
};

/* ─── Where you are ───────────────────────────────────────────────────────── */

export interface Here {
  /** Where you are, as a fact: "2 paying clients", "9 sent, no reply yet". */
  title: string;
  /** The funnel in one line, so the fact has its counts beside it. */
  line: string;
}

/**
 * Where you are, said the way a person would say it. "Step 5 of 6 · 2 of 3"
 * was accurate and read as a puzzle: the step number is the app's structure,
 * not the person's situation, and the fraction belongs to the milestone ahead.
 */
export function pathHere(ladder: { steps: PathStep[]; current: number }, f: Funnel): Here {
  const step = ladder.steps[ladder.current];
  const line = `${f.sent} sent · ${f.replied} replied · ${f.won} paid`;
  const reached = step?.key === 'goal' && step.input === 'next-goal';
  switch (step?.key) {
    case 'offer': return { title: 'Nothing to send yet', line: 'No offer written, so nothing is drafted' };
    case 'sent': return { title: 'Nothing sent yet', line };
    case 'reply': return { title: `${plural(f.sent, 'message')} out, no reply yet`, line };
    case 'paid': return { title: `${plural(f.replied, 'conversation')}, no client yet`, line };
    case 'repeat': return { title: plural(f.won, 'paying client'), line };
    default: return { title: reached ? `Goal reached: ${step!.title}` : plural(f.won, 'paying client'), line };
  }
}

/* ─── The move ────────────────────────────────────────────────────────────── */

export type NowKind = 'offer' | 'call' | 'send' | 'question' | 'intro' | 'fix' | 'approve' | 'confirm' | 'proposal' | 'step' | 'move' | 'find' | 'rest';

export interface NowMove {
  kind: NowKind;
  key: string;
  title: string;
  why: string | null;
  /** Its size against the time you set — "about 75 min of your 150". Null where it has no honest size. */
  size: string | null;
  /** The one tap. Null for the call, which carries its own. */
  cta: string | null;
  /** The commission, Move or introduction it opens. */
  id?: string;
  /** The drawn plan's step it is, which the one tap marks done. */
  item?: string;
}

export interface NowInput {
  noOffer: boolean;
  /** Today's call, still waiting on an answer. Arbitration already weighed it against everything below. */
  callPending: boolean;
  queue: { count: number; oldestDays: number };
  /** needsYou's rows, in its order. */
  asks: AskRow[];
  /** Moves worth doing below the call (worthDoing's split), in the planner's order. */
  moves: Move[];
  capacity: Capacity;
  funnel: Funnel;
  /** Businesses worth a message that nobody has drafted for yet. */
  freshMatches: number;
  /**
   * The drawn plan's first open step that fits today (roadmapFirstStep), and
   * whether there is a drawn plan at all. With one, the plan decides whether
   * selling is part of this person's path, so a blank offer is no longer the
   * move by default.
   */
  planStep?: { item: string; title: string; milestone: string; size: string; sends?: boolean } | null;
  hasPlan?: boolean;
}

const ASK_NOW: Record<AskRow['kind'], { title: (a: AskRow) => string; cta: string; size: string }> = {
  question: { title: (a) => a.title, cta: 'Answer it', size: 'a few minutes' },
  intro: { title: (a) => a.title, cta: 'Follow it up', size: 'a few minutes' },
  fix: { title: (a) => `Get "${a.title}" going again`, cta: 'Open it', size: 'one tap' },
  approve: { title: (a) => `Approve "${a.title}"`, cta: 'Read the plan', size: 'a few minutes' },
  confirm: { title: (a) => a.title, cta: 'Answer it', size: 'a few minutes' },
  send: { title: (a) => a.title, cta: 'Open the drafts', size: '' },
  // Never the move (pathNow leaves proposals beside it): here so the record of kinds is whole.
  proposal: { title: (a) => `Claude proposes: ${a.title}`, cta: 'Keep or drop it', size: 'one tap' },
};

/**
 * The one move, and what else needs you beside it.
 *
 * In order: today's call while it waits, because arbitration already weighed it
 * against everything below — and a blank offer's call carries the tap that
 * writes one, while a call about something else (a job post, a question) does
 * not need an offer at all; then the offer, when there is none, because nothing
 * else can be drafted; the drafts, because on an outbound path nothing moves until
 * something goes out, and they are finished work earning nothing; then whatever
 * a person is blocking — a question, an introduction, a breakage, an approval,
 * a reply with no ending; then the planner's first Move that fits the time you
 * set; then the businesses worth a message. Once the call is answered it is a
 * receipt, and the move is the next thing — the call's card said as much, and
 * the old Path left it at the centre of the screen anyway.
 */
export function pathNow(input: NowInput): { now: NowMove; also: AskRow[] } {
  const cap = CAPACITY_META[input.capacity];
  const f = input.funnel;
  const asks = input.asks;
  const also = (without?: string) => asks.filter((a) => a.key !== without).slice(0, MAX_ALSO);

  if (input.callPending) return { now: { kind: 'call', key: 'call', title: '', why: null, size: null, cta: null }, also: also() };
  if (input.noOffer && !input.hasPlan) {
    return {
      now: { kind: 'offer', key: 'offer', title: 'Write what you sell', why: 'Three lines. Nothing is drafted, researched or proposed without them — a message written from a blank offer is not yours.', size: 'about 3 min', cta: 'Write it' },
      also: also(),
    };
  }

  // The drafts, sized to the day. Said differently depending on who put them
  // here: without a plan, sending is the path; with one, the plan asked for it
  // or had nothing of yours that fits today.
  const sendNow = (because: string) => {
    const n = sendBatch(input.capacity, input.queue.count);
    const rate = f.sent > 0 && f.replied > 0 ? f.replied / f.sent : null;
    const expect = rate ? Math.round(n * rate) : 0;
    const early = f.sent < RATE_SAMPLE ? ', early' : '';
    return {
      now: {
        kind: 'send' as const, key: 'send',
        title: n >= input.queue.count ? `Send your ${plural(input.queue.count, 'draft')}` : `Send ${n} of your ${input.queue.count} drafts`,
        why: [
          input.queue.oldestDays > 0 ? `The oldest has waited ${plural(input.queue.oldestDays, 'day')}.` : 'Written and waiting.',
          rate
            ? `At your rate so far — ${plural(f.replied, 'reply', 'replies')} from ${plural(f.sent, 'send')}${early} — that is about ${expect ? plural(expect, 'reply', 'replies') : 'one reply, if any'}.`
            : because,
        ].join(' '),
        size: `about ${n * SEND_MINUTES} min of your ${cap.minutes}`,
        cta: 'Open the drafts',
      },
      also: also('queue'),
    };
  };

  // Without a plan, on an outbound path nothing moves until something goes out.
  if (!input.hasPlan && input.queue.count > 0) return sendNow('Nothing on this path moves until something goes out.');

  // With a plan, the drafts are no longer first by default. They were: Alex's
  // plan said to rewrite the opener before sending more, and the card over it
  // said "Send 25 of your 56 drafts" — written with the old opener. Maria's said
  // "nothing on this path moves until something goes out" about one stale sales
  // draft, over a plan about market stalls. The plan is told the drafts exist
  // and decides; until it asks for them they are a chip beside the move.
  // A proposal blocks nothing — it is a chat's draft waiting for a yes — so it
  // waits beside the move and never takes the move's place over the plan.
  const blocking = (input.hasPlan ? asks.filter((a) => a.kind !== 'send') : asks).filter((a) => a.kind !== 'proposal');
  const ask = blocking[0];
  if (ask) {
    const k = ASK_NOW[ask.kind];
    return { now: { kind: ask.kind, key: ask.key, title: k.title(ask), why: ask.detail, size: k.size || null, cta: k.cta, id: ask.id }, also: also(ask.key) };
  }

  // The plan's step before the planner's Moves: the plan is ordered against the
  // person's goals, and a Move is one job's idea of a good next thing.
  const step = input.planStep;
  if (step?.sends && input.queue.count > 0) return sendNow('Your plan puts sending them this week.');
  if (step) {
    return {
      now: {
        kind: 'step', key: `rm:${step.item}`, item: step.item, title: step.title,
        // The milestone, not its reason: the reason is under the milestone on the
        // plan, open, a few rows down. Both on one screen was the same sentence twice.
        why: `Toward: ${step.milestone}.`,
        size: `${step.size} · you have ${cap.minutes} min`,
        cta: 'Mark it done',
      },
      also: also(),
    };
  }
  // A plan with nothing of yours that fits today: finished drafts are the best
  // use of the time, but the plan never said sending is the path, so neither does this.
  if (input.queue.count > 0) return sendNow('Written and waiting, and nothing else on your plan fits today.');

  const fitting = input.moves.find((m) => (costMinutesOf(m.cost_label) ?? DEFAULT_COST_MINUTES) <= cap.minutes);
  const move = fitting ?? input.moves[0];
  if (move) {
    const minutes = costMinutesOf(move.cost_label);
    return {
      now: {
        kind: 'move', key: `m:${move.id}`, title: move.headline, why: move.why?.find((w) => w?.trim())?.trim() ?? null,
        size: minutes != null
          ? `about ${minutes} min of your ${cap.minutes}${fitting ? '' : ' — more than today holds'}`
          : move.cost_label,
        cta: 'Open it', id: move.id,
      },
      also: also(),
    };
  }

  if (input.freshMatches > 0) {
    return {
      now: { kind: 'find', key: 'find', title: `Swipe through the ${plural(input.freshMatches, 'business', 'businesses')} worth a message`, why: 'Found since you last looked. Each card comes with its message written; right sends it.', size: null, cta: 'Open Swipe' },
      also: also(),
    };
  }
  return { now: { kind: 'rest', key: 'rest', title: 'Nothing is waiting on you', why: 'The next run works out what comes next from what comes back.', size: null, cta: null }, also: also() };
}

/* ─── The plan ────────────────────────────────────────────────────────────── */

export type StopKind = 'rung' | 'check' | 'goal';

export interface Stop {
  key: string;
  kind: StopKind;
  title: string;
  /** Where it stands now: "2 of 3", "$0 of $1,500". */
  status: string | null;
  progress: { done: number; of: number } | null;
  /** What it takes, from your rows. Null when there is nothing to compute from. */
  takes: string | null;
  /** How long at the capacity you set, or what would turn it into a number. */
  when: string | null;
  /** This fortnight's real pace beside it, when that pace does not get there. */
  pace: string | null;
  /** The estimate rests on fewer than RATE_SAMPLE sends. */
  early: boolean;
}

export interface AheadInput {
  ladder: { steps: PathStep[]; current: number };
  funnel: Funnel;
  /** The goal the path points at: the first by your priority, a money one when there is one. */
  goal: Pick<Goal, 'id' | 'title' | 'metric' | 'target_value' | 'current_value' | 'horizon_days' | 'created_at'> | null;
  /** Every other active goal, in your priority order. */
  others: Array<Pick<Goal, 'id' | 'title' | 'metric' | 'target_value' | 'current_value' | 'horizon_days' | 'created_at'>>;
  /** Their calendar day, for the days left to a goal's date (due.ts). */
  today: string;
  price: number | null;
  currency: string;
  capacity: Capacity;
  /** Sends in the last fourteen days — the pace you actually kept, beside the one your capacity allows. */
  sentFortnight: number;
  /** diagnose()'s bottleneck finding, once there is enough sent to have one. */
  bottleneck: { headline: string; action?: string } | null;
}

export interface Beyond { key: string; title: string; status: string }

/**
 * From the milestone you are on to the goal you put first: the ladder's rungs
 * still ahead, the point where the guesses become numbers, then the goal — each
 * with what it takes and how long at your capacity. Then the goals beyond it,
 * named with where they stand and no more: a plan past the first goal is a plan
 * built on the first goal's guesses.
 */
export function pathAhead(input: AheadInput): { stops: Stop[]; beyond: Beyond[] } {
  const f = input.funnel;
  const label = CAPACITY_META[input.capacity].label;
  const early = f.sent < RATE_SAMPLE;
  const perClient = f.sent > 0 && f.won > 0 ? f.sent / f.won : null;
  const perReply = f.sent > 0 && f.replied > 0 ? f.sent / f.replied : null;
  const money = (n: number) => moneyLabel(n, input.currency);
  const stops: Stop[] = [];

  const ahead = input.ladder.steps.slice(input.ladder.current).filter((s) => s.key !== 'offer' && s.key !== 'goal' && s.state !== 'done');
  for (const s of ahead) {
    if (s.key === 'sent') {
      stops.push({ key: 'rung:sent', kind: 'rung', title: 'Your first message', status: null, progress: null, takes: 'One send. The drafts are already written.', when: 'Two minutes, from Swipe.', pace: null, early: false });
    } else if (s.key === 'reply') {
      stops.push({
        key: 'rung:reply', kind: 'rung', title: 'A first reply', status: null, progress: null,
        takes: `No reply yet from ${plural(f.sent, 'send')}.`,
        when: f.sent < RATE_SAMPLE ? `If there is still none at ${RATE_SAMPLE}, change the first line or the list.` : 'Past twenty with none, the opener or the list is wrong. Change one of them.',
        pace: null, early,
      });
    } else if (s.key === 'paid') {
      stops.push({
        key: 'rung:paid', kind: 'rung', title: 'A first paying client', status: plural(f.replied, 'conversation'), progress: null,
        takes: perReply ? `About ${plural(Math.ceil(perReply), 'send')} a conversation at your rate so far.` : null,
        when: null,
        pace: null, early,
      });
    } else if (s.key === 'repeat') {
      const need = Math.max(0, REPEAT_WINS - f.won);
      const sends = perClient ? Math.ceil(need * perClient) : null;
      stops.push({
        key: 'rung:repeat', kind: 'rung', title: `${REPEAT_WINS} paying clients`, status: `${f.won} of ${REPEAT_WINS}`,
        progress: { done: Math.min(f.won, REPEAT_WINS), of: REPEAT_WINS },
        takes: sends != null ? `About ${plural(sends, 'more send')} at your rate — ${basis(f)}.` : null,
        when: sends != null ? `${capital(daysOf(sends, input.capacity))} of sending at ${label}. One client can be luck. Three is something you can repeat.` : 'One client can be luck. Three is something you can repeat.',
        pace: null, early,
      });
    }
    // The checkpoint sits after the milestone you are on: it is the next thing you will learn.
    if (stops.length === 1) {
      const check = checkpoint(f, input.bottleneck);
      if (check) stops.push(check);
    }
  }
  if (!stops.length) {
    const check = checkpoint(f, input.bottleneck);
    if (check) stops.push(check);
  }

  stops.push(goalStop(input, perClient, early, money, label));

  const beyond = input.others.map((g): Beyond => ({
    key: `goal:${g.id}`,
    title: g.title,
    status: g.target_value && g.target_value > 0 && g.metric === 'currency'
      ? `${money(g.current_value ?? 0)} of ${money(g.target_value)}`
      : g.target_value && g.target_value > 0
      ? `${Math.round(g.current_value ?? 0)} of ${Math.round(g.target_value)}`
      : goalDue(g, input.today) ? `No target · ${daysPhrase(goalDue(g, input.today)!)}` : 'No target',
  }));
  return { stops, beyond };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What you will know next, and what would change the plan. Before RATE_SAMPLE
 * sends every rate above is a guess, and the honest thing is to say when it
 * stops being one and what result means what. After that, the funnel's own
 * bottleneck is the open question.
 */
function checkpoint(f: Funnel, bottleneck: AheadInput['bottleneck']): Stop | null {
  if (f.sent < RATE_SAMPLE) {
    return {
      key: 'check:sample', kind: 'check', title: `At ${RATE_SAMPLE} sends, the guesses become numbers`,
      status: `${f.sent} of ${RATE_SAMPLE}`, progress: { done: f.sent, of: RATE_SAMPLE },
      takes: `${WORKING_REPLIES} or more replies by then: this opener works, send more of it. Fewer: change its first line or the list before the next batch.`,
      when: null, pace: null, early: false,
    };
  }
  if (bottleneck) {
    return { key: 'check:bottleneck', kind: 'check', title: bottleneck.headline, status: null, progress: null, takes: bottleneck.action ?? null, when: null, pace: null, early: false };
  }
  return null;
}

function goalStop(input: AheadInput, perClient: number | null, early: boolean, money: (n: number) => string, label: string): Stop {
  const g = input.goal;
  if (!g) {
    return { key: 'goal', kind: 'goal', title: 'Name your goal', status: null, progress: null, takes: 'The plan points at it. Nothing else here needs setting.', when: null, pace: null, early: false };
  }
  const target = g.target_value && g.target_value > 0 ? g.target_value : null;
  const current = g.current_value ?? 0;
  if (!target || g.metric !== 'currency') {
    return {
      key: `goal:${g.id}`, kind: 'goal', title: g.title,
      status: target ? `${Math.round(current)} of ${Math.round(target)}` : null,
      progress: target ? { done: Math.min(current, target), of: target } : null,
      takes: target ? null : 'There is no number on it, so the plan cannot walk back from it. Give it a target and it can.',
      when: null, pace: null, early: false,
    };
  }
  const gap = Math.max(0, target - current);
  const base = { key: `goal:${g.id}`, kind: 'goal' as const, title: g.title, status: `${money(current)} of ${money(target)}`, progress: { done: Math.min(current, target), of: target } };
  if (!gap) return { ...base, takes: 'Reached. Set the next one.', when: null, pace: null, early: false };
  if (!input.price) {
    return { ...base, takes: `${money(gap)} to go. Put a price in your offer and this turns into clients and sends.`, when: null, pace: null, early: false };
  }
  const clients = Math.ceil(gap / input.price);
  const sends = perClient ? Math.ceil(clients * perClient) : null;
  // Days left to its date, not the horizon it was written with: that number
  // never counted down, so this said "90 days left" for ninety days.
  const due = goalDue(g, input.today);
  const whenParts: string[] = [];
  if (sends == null) whenParts.push('Your first paying client turns this into sends and days.');
  if (sends != null) whenParts.push(`${capital(daysOf(sends, input.capacity))} of sending at ${label}.`);
  if (sends != null && due && due.daysLeft > 0) {
    const perDay = Math.ceil(sends / due.daysLeft);
    whenParts.push(`${capital(daysPhrase(due))}: ${plural(perDay, 'send')} a day ${perDay <= sendsPerDay(input.capacity) ? 'gets there' : 'gets there, which is more than the time you set'}.`);
  } else if (sends != null && due) {
    whenParts.push(`Its date has passed: ${daysPhrase(due)}.`);
  }
  return {
    ...base,
    takes: `${plural(clients, 'client')} at your ${money(input.price)}${sends != null ? ` · about ${plural(sends, 'send')} at your rate — ${basis(input.funnel)}` : ' · no client yet to measure a rate from'}.`,
    when: whenParts.join(' ') || null,
    // The capacity is the pace you could keep; this is the one you did. Said
    // only when it does not get there, because that is when it is news.
    pace: input.sentFortnight === 0 ? 'Nothing sent in the last two weeks — at that pace it does not move.' : null,
    early: sends != null && early,
  };
}

/** The line under the greeting on the Path: what needs you, or the streak — nothing when neither. */
export function planStatus(asks: number, streak: number): string | null {
  // Not "where you are": that is the first line under the header, in bigger
  // type, and the header said it again directly above it.
  if (asks) return `${asks} need${asks === 1 ? 's' : ''} you`;
  if (streak >= 2) return `${streak} days in a row`;
  return null;
}
