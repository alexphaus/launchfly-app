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

import type { LinkKey, Verdict } from './business';
import { dateLabel, daysPhrase, goalDue } from './due';
import { creditedGoalId } from './goalcard';
import type { HistoryEntry } from './history';
import { resultLine, type Bet, type BetView, type Talk } from './lab';
import { betNext, playSays, type BetNextGo } from './proof';
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
  | { to: 'tab'; tab: 'path' | 'swipe' }
  /** What the play has you say, drafted for the bet by the app's model (assets.ts script). */
  | { to: 'draft' }
  /** An asset already made for the bet, opened. */
  | { to: 'asset'; id: string }
  /** The address of the person's page, on the clipboard: what a play that shares the page sends. */
  | { to: 'copylink' };

export interface StepButton { label: string; go: StepGo }

/** What passing the bet does for the goal money lands on, said from the goal's own numbers. */
export interface Payoff {
  line: string;
  /** True for a bet counted in sales: each one moves the goal. */
  pays: boolean;
  /** Where what does pay is, when this bet does not. */
  link: StepButton | null;
}

export type StepKind = 'offer' | 'found' | 'checkpoint' | 'shelf' | 'pick' | 'reply' | 'waiting' | 'find' | 'count' | 'play';

export interface Step {
  kind: StepKind;
  /**
   * The part of the business the step moves, so the engine room opens on it:
   * the running bet's part, the part a kept test or a new bet is for, How they
   * hear for saying how buyers arrive. Null for a step about the whole business —
   * the offer, the checkpoint.
   */
  part: LinkKey | null;
  eyebrow: string;
  /** The step, as a sentence the person can act on. */
  title: string;
  /** Where it stands, in their own numbers. */
  why: string | null;
  /** One line under the button: what a tap does, where that is not obvious. */
  hint: string | null;
  primary: StepButton;
  /** A second way on, as a link beside the button: logging what a count link cannot see, the page's address. */
  secondary?: StepButton | null;
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
  /**
   * The play the running bet runs, where it has one, and what the screen can do
   * for it: whether its count comes in by itself, the message already made for
   * it, whether a draft can be written, whether the page is online to share.
   */
  play?: StepPlay | null;
}

export interface StepPlay {
  label: string;
  how: string;
  /** What counts the bet by itself: the count link, the page, or nothing — then the person logs it. */
  counted: 'link' | 'page' | null;
  /** A script made for this bet (assets.ts), opened rather than drafted twice. */
  script: string | null;
  /** A model and an offer to draft from (invariant 1). */
  canDraft: boolean;
  pageOnline: boolean;
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
      kind: 'offer', part: null, eyebrow: 'Your move', title: 'Write what you sell',
      why: 'Every part of the business is tested against it, and nothing is written from a blank offer.', hint: null,
      primary: { label: 'Write your offer — three minutes', go: { to: 'offer' } }, claude: null, payoff: null,
    };
  }
  if (i.unreadable) return null;
  const view = i.current;

  if (!view) {
    if (i.checkpoint.due) {
      return {
        kind: 'checkpoint', part: null, eyebrow: 'Your move', title: 'Pivot or persevere?',
        why: `${plural(i.checkpoint.ended, 'bet')} ended since you last decided. The next one starts from your answer.`, hint: null,
        primary: { label: 'Answer it', go: { to: 'checkpoint' } }, claude: null, payoff: null,
      };
    }
    const kept = i.shelf[0];
    if (kept) {
      return {
        kind: 'shelf', part: kept.part, eyebrow: 'Your move · kept for later', title: kept.belief,
        why: 'You wrote this test down with its line. Start it, and only what happens after counts.', hint: null,
        primary: { label: 'Start it', go: { to: 'shelf', id: kept.id } }, claude: null, payoff: null,
      };
    }
    if (!i.found) {
      return {
        kind: 'found', part: 'reach', eyebrow: 'Your move', title: 'Say how buyers find you',
        why: 'Every part of the business is read that way: by your sends if you write to them, by your own counts if they find you.', hint: null,
        primary: { label: 'Say it', go: { to: 'foundby' } }, claude: null, payoff: null,
      };
    }
    const part: LinkKey = i.weak?.key ?? 'who';
    return {
      kind: 'pick', part, eyebrow: 'Your move', title: i.weak ? `Bet on ${i.weak.label.toLowerCase()}` : 'Start your first bet',
      why: i.weak ? clamp(firstSentence(i.weak.why), 140) : 'A belief, a count that could prove it wrong, and a day: written before it starts.', hint: null,
      primary: { label: 'Pick a bet', go: { to: 'bet', part } }, claude: null, payoff: null,
    };
  }

  const b = view.bet;
  const eyebrow = `Your move · day ${view.day} of ${b.days}${view.last === i.today ? ' · last day' : ''}`;
  const talksSince = i.talks.filter((t) => t.on >= b.start && t.on <= view.last).length;
  const why = whyOf(view, talksSince);
  const common = { part: b.part, eyebrow, why, claude: claudeAsk(view), payoff: payoffOf(b, i.goal, i.today) };

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
  const log: StepButton = { label: next.label, go: { to: 'next', go: next.go } };
  const p = i.play;
  // The count comes in by itself, so logging it is not the move: doing the play
  // is. Day one of a bet whose count link counted its sign-ups read "Log your
  // sign-ups", with "message ten people you know" folded away in the bet's card.
  if (p && p.counted && next.go === 'count') {
    const says = playSays(p.how);
    const sharesPage = p.pageOnline && PAGE_WORDS.test(`${p.label} ${p.how}`);
    const copy: StepButton = { label: 'Copy your page link', go: { to: 'copylink' } };
    const primary: StepButton = p.script ? { label: `Open your ${says ?? 'message'}`, go: { to: 'asset', id: p.script } }
      : says && p.canDraft ? { label: `Draft the ${says}`, go: { to: 'draft' } }
      : sharesPage ? copy
      : log;
    const secondary = primary.go.to === 'copylink' ? log : primary === log ? null : sharesPage ? copy : log;
    const left = Math.max(1, b.days - view.day + 1);
    const unit = b.unit ?? 'count';
    return {
      ...common, kind: 'play', title: clamp(p.label, 90),
      why: `${clamp(firstSentence(p.how), 170)} ${resultLine(view)} · ${plural(left, 'day')} left.`,
      hint: `Your ${p.counted === 'link' ? 'count link' : 'page'} counts ${unit} by itself: log only the ones it cannot see.`,
      primary, secondary,
    };
  }
  return {
    ...common, kind: 'count', title: nextTitle(next.go, b.unit), hint: null,
    primary: log,
  };
}

/** A play about the person's page: sharing it, sending people to it. */
const PAGE_WORDS = /\b(?:landing ?page|your page|the page|page link|link to (?:it|your|the)|forward)\b/i;

/** The first sentence of a longer reason: the part a step needs, where the sheet has the rest. */
function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/* ─── The engine room ─────────────────────────────────────────────────────── */

/**
 * The part the engine room opens on: where the step is, else the weakest part,
 * else the first. The step leads because the tab is opened to act; a part chosen
 * by a tap stays chosen until the next visit.
 */
export function openPart(step: Pick<Step, 'part'> | null, weak: LinkKey | null): LinkKey {
  return step?.part ?? weak ?? 'who';
}

/** The engine's figure: the count that proves it, drawn rather than said. */
export interface EngineFigure {
  /** Sales at the price since the pivot that restarted what they pay. Null before there is an offer to sell. */
  n: number | null;
  /** The bar, shown after the count while it is not reached. */
  of: number | null;
  /** "paid at your $29", or "paid" while no price is said. */
  unit: string;
  chip: 'Proven' | 'Not proven' | 'Not started';
  /** Under the figure: the bar and where the count starts, never the count again. */
  line: string;
}

/**
 * The verdict as the engine draws it: the count big, the bar after it, and one
 * line under it. Built from the verdict's own sentence and its numbers
 * (business.ts verdictCount), so "0/3 paid at your $29" and "Not proven yet"
 * come from the same rows. The line does not say the count a second time.
 */
export function engineFigure(v: Verdict, count: { n: number; of: number; price: number | null }, priceLabel: string | null, offerSet: boolean): EngineFigure {
  const since = v.since ? ` ${v.since}` : '';
  if (!offerSet) return { n: null, of: null, unit: '', chip: 'Not started', line: v.line };
  if (v.proven) return { n: count.n, of: null, unit: priceLabel ? `paid at your ${priceLabel} or more` : 'paid', chip: 'Proven', line: `From here it is volume.${since}` };
  if (count.price == null || !priceLabel) return { n: count.n, of: count.of, unit: 'paid', chip: 'Not proven', line: v.line };
  const left = count.of - count.n;
  return { n: count.n, of: count.of, unit: `paid at your ${priceLabel}`, chip: 'Not proven', line: `Proven at ${count.of}${count.n > 0 ? `: ${left} more to go` : ''}.${since}` };
}

/** What the engine has built that "Built so far" shows before its link to the whole history. */
export const BUILT_SHOWN = 3;

/**
 * What the business has to show for itself, newest first: every sale, a bet that
 * passed, a conversation that ended in money, a project the agent finished, the
 * first version of anything made — and the plan's experiment that worked. Not
 * what was only started, decided or called off, and not every redraft of the
 * offer: those are history, not things built. Read off the history (history.ts),
 * so the two cannot disagree about what happened.
 */
export function builtSoFar(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((e) => {
    switch (e.kind) {
      case 'win': return true;
      case 'bet_end': case 'talk': case 'experiment': return e.tone === 'good';
      // A project the agent finished; one stopped is history's.
      case 'project': return e.tone !== 'quiet';
      // The first version of each thing made, by either maker: "Landing page v1: …".
      case 'asset': return / v1: /.test(e.title);
      default: return false;
    }
  });
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
