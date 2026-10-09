// src/lib/copilot/engine.ts
// The Engine tab's one next step: what to do now, said once, at the top.
//
// Why it exists. Proof opened on its verdict: the offer, a chain of five dots
// with five state words, the weak link explained in forty words, runway in bets
// and a checkpoint read back — and the one thing to do was two and a half
// screens down, at the foot of the bet's card. A review of the tab said it
// plainly: an instrument too heavy for the moment it is used in, for someone
// with two months of runway. The tab is opened to act, so the action leads and
// the verdict is one tap under it.
//
// What it is held to:
//
//   - It is read off the rows. The step is a rule over what the person has done
//     (the bet, the conversations logged, the posts found and opened), never a
//     model's advice; the only words a model ever writes here are its ideas,
//     elsewhere, held to their own checks.
//   - Every number in it is one the person's own rows hold: the bet's count and
//     line, the days left on its last day, the goal's target and date. No pace,
//     no projection, no "on track" (invariant 2).
//   - A bet that does not pay says so. Passing a conversation bet earns nothing;
//     the goal it sits beside still needs its money by its date. Said from the
//     goal's own numbers, with the way to what pays one tap away, because a tab
//     about building a business that lets a person believe a test is income is
//     the opposite of a co-founder.
//   - It acts only by the person's tap: a search is theirs to start, a post is
//     theirs to open, and nothing is sent from here (invariant 4).
//
// Pure: no DB import. The screen (ProofTab.tsx) maps `StepGo` onto its actions.

import type { LinkKey } from './business';
import { dateLabel, daysPhrase, goalDue } from './due';
import { creditedGoalId } from './goalcard';
import { resultLine, type Bet, type BetView, type Talk } from './lab';
import { betNext, type BetNextGo } from './proof';
import type { FoundBy, Goal } from './types';
import { betVoiced, stuckLine, type BetVoices } from './voices';

/** Where a step's button goes. The screen decides how: a sheet, a scroll, a link, a search. */
export type StepGo =
  | { to: 'offer' }
  | { to: 'foundby' }
  | { to: 'checkpoint' }
  /** Search for the running bet's people (voicefind.ts). */
  | { to: 'find' }
  /** Their post, in a new tab: the person replies from their own account. */
  | { to: 'post'; voice: string; url: string }
  /** The card of people found, scrolled to. */
  | { to: 'people' }
  | { to: 'bet'; part: LinkKey }
  | { to: 'shelf'; id: string }
  /** Where the bet's own next count happens (proof.ts betNext). */
  | { to: 'next'; go: BetNextGo }
  | { to: 'tab'; tab: 'path' | 'swipe' };

export interface StepButton { label: string; go: StepGo }

/** What passing the bet does for the goal money lands on, said from the goal's own numbers. */
export interface Payoff {
  line: string;
  /** True for a bet counted in sales: each one moves the goal. */
  pays: boolean;
  /** Where what does pay is, when this bet does not. */
  link: StepButton | null;
}

export type StepKind = 'offer' | 'found' | 'checkpoint' | 'shelf' | 'pick' | 'reply' | 'waiting' | 'find' | 'count';

export interface Step {
  kind: StepKind;
  eyebrow: string;
  /** The step, as a sentence the person can act on. */
  title: string;
  /** Where it stands, in their own numbers. */
  why: string | null;
  /** One line under the button: what a tap does, where that is not obvious. */
  hint: string | null;
  primary: StepButton;
  /** The line handed to Claude with the whole record, when a bet is running: a chat to think it through in. */
  claude: string | null;
  payoff: Payoff | null;
}

/** The goal money lands on, reduced to what the step says of it. */
export interface PayoffGoal {
  title: string;
  unit: string | null;
  target: number;
  current: number;
  /** The goal's date and days left, where it has one (due.ts). */
  dueOn: string | null;
  daysLeft: number | null;
}

/**
 * The goal a logged sale moves — the first money goal by priority, the same rule
 * recordOutcome applies (goalcard.ts creditedGoalId) — as the step reads it.
 * Null with no such goal, or none with a target to be short of.
 */
export function payoffGoal(goals: Goal[], today: string): PayoffGoal | null {
  const id = creditedGoalId(goals);
  const g = id ? goals.find((x) => x.id === id) : null;
  if (!g || !g.target_value || g.target_value <= 0) return null;
  const due = goalDue(g, today);
  return { title: g.title, unit: g.unit, target: g.target_value, current: g.current_value ?? 0, dueOn: due?.dueOn ?? null, daysLeft: due?.daysLeft ?? null };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "$1,500", "1,500 EUR": a goal's money, whichever way its unit is written. */
function money(n: number, unit: string | null): string {
  const v = Math.round(n).toLocaleString('en-US');
  const u = (unit ?? '').trim();
  if (!u) return `$${v}`;
  return /^[^\w\s]{1,2}$/.test(u) ? `${u}${v}` : `${v} ${u}`;
}

/** A goal's name, short enough to sit in a sentence. */
const named = (t: string) => (t.length <= 40 ? t : `${t.slice(0, 39).replace(/\s+\S*$/, '')}…`);

/**
 * What passing this bet does for the money. A sale moves the goal and says by
 * how many at the price the bet is held to; anything else tests whether people
 * want it and pays nothing, and says what the goal still needs. Null when there
 * is no goal to say it about, or it is already met.
 */
export function payoffOf(bet: Pick<Bet, 'metric' | 'price' | 'priceLabel'>, goal: PayoffGoal | null, today: string): Payoff | null {
  if (!goal) return null;
  const left = goal.target - goal.current;
  if (!(left > 0)) return null;
  const by = goal.dueOn && goal.daysLeft != null
    ? ` by ${dateLabel(goal.dueOn, today)} (${daysPhrase({ dueOn: goal.dueOn, daysLeft: goal.daysLeft })})`
    : '';
  const need = money(left, goal.unit);
  if (bet.metric === 'paid' || bet.metric === 'paid_at_price') {
    const sales = bet.price && bet.price > 0 ? Math.ceil(left / bet.price) : null;
    const at = sales && bet.priceLabel ? ` At your ${bet.priceLabel} that is ${plural(sales, 'sale')}.` : '';
    return { line: `A sale counts toward ${named(goal.title)}: ${need} to go${by}.${at}`, pays: true, link: null };
  }
  return {
    line: `Passing this bet does not pay you. ${named(goal.title)} still needs ${need}${by}.`,
    pays: false,
    link: { label: 'What pays now', go: { to: 'tab', tab: 'path' } },
  };
}

/**
 * The line a chat starts from, for a bet that is running: where it stands, in
 * the bet's own words and counts, and what is asked. The whole record follows it
 * (MoveKit.tsx useBrief), so Claude reads the numbers the screens show.
 */
export function claudeAsk(view: Pick<BetView, 'day' | 'bet' | 'result' | 'tries'>): string {
  const b = view.bet;
  return `I am on day ${view.day} of ${b.days} of a bet: "${b.belief}" It stands at ${resultLine(view)}. What should I do today, and would you change the bet?`;
}

/** The bet's own next count, as a step: what to do, said as a sentence. */
function nextTitle(go: BetNextGo, unit: string | null): string {
  switch (go) {
    case 'swipe': return 'Send the next messages';
    case 'replied': return 'See who replied';
    case 'talk': return 'Log your next conversation';
    case 'sale': return 'Log a sale';
    case 'meeting': return 'Log a meeting';
    case 'count': return `Log your ${unit ?? 'count'}`;
    case 'projects': return 'Hand a step to your agent';
  }
}

export interface StepInput {
  today: string;
  offerSet: boolean;
  /** The bets could not be read: no step is better than one drawn over a record nobody could see (invariant 13). */
  unreadable: boolean;
  checkpoint: { due: boolean; ended: number };
  current: BetView | null;
  /** Every conversation logged, newest first: those since the bet began are its. */
  talks: Array<Pick<Talk, 'on'>>;
  found: FoundBy | null;
  /** The running bet's people, where it is one that has them. */
  voices: BetVoices | null;
  /** Posts this device opened and has not answered: a convenience about the screen, never a count. */
  opened: ReadonlySet<string>;
  /** Why the bet cannot search now, or null when it can (voices.ts voiceRefusal). */
  searchRefusal: string | null;
  shelf: Array<{ id: string; part: LinkKey; belief: string }>;
  weak: { key: LinkKey; label: string; why: string } | null;
  goal: PayoffGoal | null;
}

/** "Day 3 of 14 and no conversation logged yet: 10 to have in the 12 days left", or the bet's count and the days. */
function whyOf(view: BetView, talksSince: number): string {
  const b = view.bet;
  const left = Math.max(1, b.days - view.day + 1);
  const planned = b.tries?.metric === 'talks' ? b.tries.planned : b.metric === 'talks' ? b.target : null;
  const stuck = betVoiced(b) ? stuckLine({ day: view.day, days: b.days, talks: talksSince, planned }) : null;
  return stuck ?? `${resultLine(view)} · ${plural(left, 'day')} left.`;
}

const SEARCH_HINT = 'Searches recent public posts on Reddit, Indie Hackers, Hacker News, Quora and X. You reply from your own account.';
const POST_HINT = 'Their post opens in a new tab. You reply from your own account; nothing is sent from here.';

/**
 * The one step, or null where there is nothing true to say. In order: an offer
 * to write; a checkpoint nobody answered while no bet runs; the running bet's
 * next step (its people to reply to, a post waiting on an answer, a search, or
 * where its next count happens); a test kept for later; how buyers find you; a
 * bet to pick on the weak part.
 */
export function engineStep(i: StepInput): Step | null {
  if (!i.offerSet) {
    return {
      kind: 'offer', eyebrow: 'Next step', title: 'Write what you sell',
      why: 'Every part of the business is tested against it, and nothing is written from a blank offer.', hint: null,
      primary: { label: 'Write your offer — three minutes', go: { to: 'offer' } }, claude: null, payoff: null,
    };
  }
  if (i.unreadable) return null;
  const view = i.current;

  if (!view) {
    if (i.checkpoint.due) {
      return {
        kind: 'checkpoint', eyebrow: 'Next step', title: 'Pivot or persevere?',
        why: `${plural(i.checkpoint.ended, 'bet')} ended since you last decided. The next one starts from your answer.`, hint: null,
        primary: { label: 'Answer it', go: { to: 'checkpoint' } }, claude: null, payoff: null,
      };
    }
    const kept = i.shelf[0];
    if (kept) {
      return {
        kind: 'shelf', eyebrow: 'Next step · kept for later', title: kept.belief,
        why: 'You wrote this test down with its line. Start it, and only what happens after counts.', hint: null,
        primary: { label: 'Start it', go: { to: 'shelf', id: kept.id } }, claude: null, payoff: null,
      };
    }
    if (!i.found) {
      return {
        kind: 'found', eyebrow: 'Next step', title: 'Say how buyers find you',
        why: 'Every part of the business is read that way: by your sends if you write to them, by your own counts if they find you.', hint: null,
        primary: { label: 'Say it', go: { to: 'foundby' } }, claude: null, payoff: null,
      };
    }
    const part: LinkKey = i.weak?.key ?? 'who';
    return {
      kind: 'pick', eyebrow: 'Next step', title: i.weak ? `Bet on ${i.weak.label.toLowerCase()}` : 'Start your first bet',
      why: i.weak ? clamp(firstSentence(i.weak.why), 140) : 'A belief, a count that could prove it wrong, and a day: written before it starts.', hint: null,
      primary: { label: 'Pick a bet', go: { to: 'bet', part } }, claude: null, payoff: null,
    };
  }

  const b = view.bet;
  const eyebrow = `Next step · day ${view.day} of ${b.days}${view.last === i.today ? ' · last day' : ''}`;
  const talksSince = i.talks.filter((t) => t.on >= b.start && t.on <= view.last).length;
  const why = whyOf(view, talksSince);
  const common = { eyebrow, why, claude: claudeAsk(view), payoff: payoffOf(b, i.goal, i.today) };

  const v = betVoiced(b) ? i.voices : null;
  if (v) {
    const fresh = v.open.filter((x) => !i.opened.has(x.id));
    const waiting = v.open.filter((x) => i.opened.has(x.id));
    if (fresh.length) {
      const first = fresh[0];
      return {
        ...common, kind: 'reply',
        title: fresh.length === 1 ? 'Reply to the person who said it' : `Reply to one of the ${fresh.length} people who said it`,
        hint: POST_HINT,
        primary: { label: `Open the post on ${first.where}`, go: { to: 'post', voice: first.id, url: first.url } },
      };
    }
    if (waiting.length) {
      return {
        ...common, kind: 'waiting',
        title: waiting.length === 1 ? 'Did they answer?' : `Did any of the ${waiting.length} answer?`,
        why: `You opened ${waiting.length === 1 ? 'a post' : `${waiting.length} posts`} and have not logged an answer. Log each one that answered; set aside the rest.`,
        hint: null,
        primary: { label: 'Log who answered', go: { to: 'people' } },
      };
    }
    if (!i.searchRefusal) {
      return {
        ...common, kind: 'find',
        title: v.found === 0 ? 'Find people who said it' : 'Find more people who said it',
        hint: v.found === 0 ? SEARCH_HINT : null,
        primary: { label: v.found === 0 ? 'Find people' : 'Find more', go: { to: 'find' } },
      };
    }
  }

  const next = betNext(b.metric, i.found, b.unit);
  return {
    ...common, kind: 'count', title: nextTitle(next.go, b.unit), hint: null,
    primary: { label: next.label, go: { to: 'next', go: next.go } },
  };
}

/** The first sentence of a longer reason: the part a step needs, where the sheet has the rest. */
function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/* ─── Posts this device opened ────────────────────────────────────────────── */

/** Where the device keeps which posts were opened: a convenience about the screen, nothing is decided from it. */
export const OPENED_KEY = (profileId: string) => `cp2.voices.opened:${profileId}`;
/** Opened posts remembered. Past it the oldest go: a post opened a year ago is not waiting on an answer. */
export const OPENED_MAX = 200;

/** Whatever came out of storage, reshaped rather than trusted: post id → when it was opened. */
export function parseOpened(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (/^v_[0-9a-f]{8}$/.test(id) && typeof at === 'string' && Number.isFinite(Date.parse(at))) out[id] = at;
  }
  return trimOpened(out);
}

function trimOpened(m: Record<string, string>): Record<string, string> {
  const keep = Object.entries(m).sort((a, b) => b[1].localeCompare(a[1])).slice(0, OPENED_MAX);
  return Object.fromEntries(keep);
}

/** A post opened: remembered with when, and the first time is the one that stays. */
export function markOpened(prev: Record<string, string>, id: string, at: string): Record<string, string> {
  return prev[id] ? prev : trimOpened({ ...prev, [id]: at });
}

/** A post answered or set aside is no longer waiting. */
export function clearOpened(prev: Record<string, string>, id: string): Record<string, string> {
  if (!(id in prev)) return prev;
  const { [id]: _gone, ...rest } = prev;
  return rest;
}
