// src/lib/copilot/business.ts
// Work: the business as a chain of bets, each with a verdict from the rows.
//
// Why it was rebuilt. Work was five sections that described the business and
// never judged it: the offer as typed, the funnel as counted under four names
// that were the same for everybody, five agents with a dot each, the projects,
// and a button that copied everything into a chat. Its owner's verdict was the
// brief for this: stale, generic, a team too heavy for a status — and the want
// was the tab that knows how the business makes money, where the proven system
// is visible and everything is connected: what was built and by whom, the
// experiments, what would pay off next, and agents that do the work and ask
// only when they must.
//
// So the business is drawn as one chain — who buys, how they hear, how they
// say yes, what they pay, how you deliver — and every part of it is a bet, the
// lean startup's word for a claim nothing has checked yet. Each part carries:
//
//   what      the person's own words for it, where they wrote some
//   facts     the rows, counted
//   state     works · testing · not working · untested · missing, by a rule
//             written out in `why` with its numbers
//   runner    who does that part — an agent, you, or both. The team, placed on
//             the part of the business it runs instead of listed as a roster
//   moves     what would move it: a sheet of yours, a project for your agent
//             to approve, or a question for a chat with the whole record pasted
//
// The thresholds are the app's own, not new ones: the app plans on
// WORKING_REPLIES replies in every RATE_SAMPLE sends (the funnel checkpoint),
// and REPEAT_WINS wins is something you can repeat rather than luck (the Path). No
// part is "working" on a model's say-so, and the whole is "proven" only once it
// has been paid for REPEAT_WINS times at the price the person set — a count of
// wins cannot tell a sale from two one-dollar tests, so the amounts are read
// (invariant 2: nothing on it is estimated).
//
// The weak link is the theory of constraints applied to a funnel: the first
// part that does not work yet, because nothing past it can be tested until it
// does — unless a part further down has had enough tries to fail on its own.
// Then that one, because more of everything above it only feeds a part already
// shown not to convert.
//
// It passes DIRECTION.md's survival test for the usual reason. An agent with
// memory can write a business model canvas from a chat; "6 meetings, 2 paid,
// none at your $150" needs the ledger.
//
// Pure: no DB import.

import { blockedOn } from './commission';
import { MIN_SAMPLE } from './diagnose';
import type { Agent, AgentKey } from './machine';
import { REPEAT_WINS } from './pathway';
import { RATE_SAMPLE, WORKING_REPLIES, priceOf } from './plan';
import { moneyLabel } from './review';
import type { CommissionThread, Offer } from './types';
import type { WorkingSection } from './working';

/* ─── The parts ───────────────────────────────────────────────────────────── */

export const LINK_KEYS = ['who', 'reach', 'close', 'pay', 'deliver'] as const;
export type LinkKey = (typeof LINK_KEYS)[number];

export const LINK_LABEL: Record<LinkKey, string> = {
  who: 'Who buys',
  reach: 'How they hear',
  close: 'How they say yes',
  pay: 'What they pay',
  deliver: 'How you deliver',
};

export const LINK_STATES = ['works', 'testing', 'stuck', 'untested', 'missing'] as const;
export type LinkState = (typeof LINK_STATES)[number];

/** Every state ships with its word. A colour alone is not a verdict. */
export const LINK_STATE_LABEL: Record<LinkState, string> = {
  works: 'Works',
  testing: 'Testing',
  stuck: 'Not working',
  untested: 'Untested',
  missing: 'Missing',
};

/**
 * Conversations before "none of them paid" says something about the ask or the
 * price rather than about luck. The same five the funnel waits for before it
 * compares two channels (diagnose.ts MIN_SAMPLE), for the same reason.
 */
export const CLOSE_SAMPLE = MIN_SAMPLE;

/** A project's objective is capped at this server-side (commission.ts OBJECTIVE_MAX); an ask longer than it would be cut mid-sentence. */
export const ASK_MAX = 200;
/** Who they sell to, in their words, is quoted into an ask only up to this long; past it, it is a list and not a phrase. */
export const WHO_IN_ASK = 60;

/* ─── What would move a part ──────────────────────────────────────────────── */

/**
 * Who does it. `you` is a sheet or a tab of the app. `ai` writes a project for
 * the connected worker, as a draft that still needs approving — never started
 * unseen. `claude` copies the whole record with this as its first line, for
 * work a chat does better than a request handler: judgement over the record,
 * design. An `ai` move becomes a `claude` one where no worker is connected,
 * because a button that writes a project nothing picks up is a capability with
 * no route behind it (invariant 7).
 */
export type MoveBy = 'you' | 'ai' | 'claude';

export type MoveGo =
  | { sheet: 'offer' | 'targeting' | 'working' }
  | { outreach: 'to_send' }
  | { tab: 'swipe' };

export interface LinkMove {
  key: string;
  label: string;
  by: MoveBy;
  /** ai and claude: what is asked for — the project's objective, or the brief's first line. */
  ask?: string;
  /** you: where it goes. */
  go?: MoveGo;
}

export interface BusinessLink {
  key: LinkKey;
  label: string;
  /** What this part is in this business, in the person's words where they wrote some. */
  what: string | null;
  /** What the rows show, counted. Empty when `what` already says everything there is. */
  facts: string;
  /** Shown only when the part is open: more of the rows, never a restatement of `facts`. */
  more: string[];
  state: LinkState;
  /** The rule behind the state, with its numbers. */
  why: string;
  /**
   * Who runs it. An agent that failed or is waiting on setup says so here, on
   * the part of the business it stopped, not only on a roster (invariant 13).
   */
  runner: { by: 'ai' | 'you' | 'both'; name: string; problem: string | null };
  moves: LinkMove[];
}

export interface ChainInput {
  offer: Offer;
  /** Lines the person wrote in the working file, live only, by section. A reading the app counted is not a claim of theirs. */
  said: Partial<Record<WorkingSection, string[]>>;
  segments: string[];
  area: string | null;
  /** The app runs its own web searches for this account (hunts), so Maps is not the only place it looks. */
  web: boolean;
  /** All time, from the funnel's own counts. */
  funnel: { matched: number; sent: number; replied: number; meetings: number; won: number; outside: number };
  /** Businesses that cleared the bar and wait in the deck. */
  worthAMessage: number;
  /** `paid` is each win's amount there, where one was logged. */
  bySegment: Array<{ segment: string; sent: number; replied: number; won: number; paid?: number[] }>;
  byChannel: Array<{ channel: string; sent: number }>;
  /** Every win's amount, all time, in the sales currency; null where none was logged. */
  wins: Array<number | null>;
  /** Drafts written and waiting to be sent. */
  queue: number;
  /** Money won over the metrics window. */
  wonRecent: { amount: number; days: number };
  goal: { title: string; target: number | null; current: number | null } | null;
  currency: string;
  workerConnected: boolean;
  /** The roster (machine.ts), so a part says who runs it and whether that agent is well. */
  agents: Agent[];
  /** The condition most of their matches share that the offer does not name — a first line a new opener could lead with. */
  topOpening: string | null;
}

export interface Verdict {
  proven: boolean;
  title: string;
  /** The bar and the count against it — never a forecast. */
  line: string;
}

export interface Chain {
  links: BusinessLink[];
  weak: LinkKey | null;
  verdict: Verdict;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clampAsk = (s: string) => (s.length <= ASK_MAX ? s : `${s.slice(0, ASK_MAX - 1).replace(/[\s,;:—-]+\S*$/, '')}…`);

/** "a, b and c" — a list said, not printed. */
export function saidList(xs: string[], max = 3): string {
  const clean = [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  const shown = clean.slice(0, max);
  const rest = clean.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} +${rest}`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? '';
}

const CHANNEL_WORD: Record<string, string> = { whatsapp: 'WhatsApp', email: 'email', sms: 'text', call: 'calls' };
const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ─── Wins against the price ──────────────────────────────────────────────── */

export interface WinRead {
  count: number;
  /** Wins with an amount logged. */
  known: number[];
  /** Wins at or above the price, when there is one; every win with an amount when there is not. */
  atPrice: number;
  price: number | null;
}

export function readWins(wins: Array<number | null>, priceBand: string | null | undefined): WinRead {
  const price = priceOf(priceBand);
  const known = wins.filter((a): a is number => typeof a === 'number' && Number.isFinite(a) && a > 0);
  return { count: wins.length, known, atPrice: price != null ? known.filter((a) => a >= price).length : known.length, price };
}

/** "2 paid, at $1 each — none at your $150". Every figure off a row; a win with no amount is counted and not priced. */
export function winsLine(w: WinRead, currency: string): string {
  const m = (n: number) => moneyLabel(n, currency);
  if (!w.count) return 'Nothing paid yet';
  const unpriced = w.count - w.known.length;
  let base: string;
  if (!w.known.length) base = `${w.count} paid, no amount logged`;
  else if (w.known.every((a) => a === w.known[0])) {
    base = w.known.length === 1 ? `1 paid, ${m(w.known[0])}` : `${w.known.length} paid, at ${m(w.known[0])} each`;
    if (unpriced) base += ` · ${unpriced} with no amount`;
  } else {
    base = `${w.known.length} paid, ${m(w.known.reduce((s, a) => s + a, 0))} in all`;
    if (unpriced) base += ` · ${unpriced} with no amount`;
  }
  if (w.price == null || !w.known.length) return base;
  if (!w.atPrice) return `${base} — none at your ${m(w.price)}`;
  return w.atPrice === w.known.length ? `${base} — all at your ${m(w.price)} or more` : `${base} — ${w.atPrice} at your ${m(w.price)} or more`;
}

/* ─── The chain ───────────────────────────────────────────────────────────── */

export function businessChain(i: ChainInput): Chain {
  const offerSet = !!i.offer.sells?.trim();
  const wins = readWins(i.wins, i.offer.price_band);
  const ai: MoveBy = i.workerConnected ? 'ai' : 'claude';
  // Who the business sells to, in their words first. An ask carries the
  // instruction and not a second copy of the offer: the worker is sent the offer
  // and the working file with every project (commission `who`), and a chat gets
  // the whole record — so their words go in only while they read as a phrase,
  // and quoted, because "ask for help with Save time" spliced into a sentence
  // reads as a typo where "Save time" in quotes reads as theirs.
  const whoWords = i.offer.for_who?.trim() || (i.segments.length ? saidList(i.segments, 2) : '');
  const whoShort = whoWords && whoWords.length <= WHO_IN_ASK ? `"${whoWords}"` : 'the businesses I sell to';
  const agent = (k: AgentKey) => i.agents.find((a) => a.key === k) ?? null;

  const links: BusinessLink[] = [
    whoLink(i, { offerSet, whoShort, ai, agent }),
    reachLink(i, { offerSet, whoShort, ai, agent }),
    closeLink(i, { ai }),
    payLink(i, wins, { offerSet, whoShort, ai }),
    deliverLink(i, { ai }),
  ];
  return { links, weak: weakLink(links, offerSet), verdict: chainVerdict(offerSet, wins, i.currency) };
}

interface Ctx {
  offerSet: boolean;
  /** Who they sell to, quoted, or a plain phrase when their words are a list too long to read inside a sentence. */
  whoShort: string;
  ai: MoveBy;
  agent: (k: AgentKey) => Agent | null;
}

function whoLink(i: ChainInput, c: Ctx): BusinessLink {
  const { matched, sent } = i.funnel;
  // A kind of business that paid, held to the person's price: two one-dollar
  // tests are not a market. With no price said, any amount counts.
  const price = priceOf(i.offer.price_band);
  const paysAt = (s: ChainInput['bySegment'][number]) => (s.paid ?? []).filter((a) => price == null || a >= price).length;
  const words = i.offer.for_who?.trim() || (i.segments.length ? saidList(i.segments, 3) : null);
  const what = words ? `${words}${i.area ? ` in ${i.area}` : ''}` : null;
  const where = [i.segments.length && i.area ? 'Maps' : null, i.web ? 'the web' : null].filter(Boolean).join(' and ');
  const facts = matched
    ? [`${matched} found${where ? ` on ${where}` : ''}`, i.worthAMessage ? `${i.worthAMessage} worth a message` : null].filter(Boolean).join(' · ')
    : where ? 'Nothing found yet' : 'Nothing to look for yet';
  const answering = i.bySegment.filter((s) => s.replied > 0 || s.won > 0);
  const best = [...answering].sort((a, b) => paysAt(b) - paysAt(a) || b.replied - a.replied)[0] ?? null;
  const more = answering.length
    ? [`Answered: ${answering.slice(0, 3).map((s) => `${s.segment} ${s.replied} of ${s.sent}${s.won ? `, ${s.won} paid` : ''}`).join(' · ')}`]
    : [];

  // The Scout always looks for this part; the Watcher too once it has a source.
  // Out of matches or a night it did not run is a problem worth saying here:
  // a part nobody is looking for looks exactly like a quiet one.
  const scout = c.agent('scout');
  const watcher = c.agent('watcher');
  const watching = !!watcher && watcher.state !== 'setup';
  const trouble = [scout, watching ? watcher : null].find((a) => a && a.state !== 'working' && a.state !== 'ready') ?? null;
  const runner = { by: 'ai' as const, name: watching ? 'Scout and Watcher' : 'Scout', problem: trouble ? `${trouble.name}: ${trouble.line}` : null };

  const demand: LinkMove | null = c.offerSet
    ? { key: 'who-demand', label: 'Find where they ask for it', by: c.ai, ask: `Find ten public posts, groups or listings where ${c.whoShort} ask out loud for what I sell, with a link to each` }
    : null;

  if (!what && !matched && !i.web) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'missing', runner,
      why: 'Nobody has said who buys, so nothing is looked for.',
      moves: [{ key: 'who-say', label: 'Say who buys', by: 'you', go: { sheet: 'offer' } }] };
  }
  if (!sent) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'untested', runner,
      why: matched ? `${matched} found and none written to yet. Which kind answers is the first thing to find out.` : 'Nothing found yet, so nothing has been tried.',
      // Writing to the first few is How they hear's move, and it tests this part too.
      moves: !matched && !i.segments.length && !i.web ? [{ key: 'who-where', label: 'Say where to look', by: 'you', go: { sheet: 'targeting' } }] : [] };
  }
  if (best && (paysAt(best) > 0 || best.replied >= WORKING_REPLIES)) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'works', runner,
      why: paysAt(best) > 0
        ? `${best.segment} paid${price != null ? ` your ${moneyLabel(price, i.currency)}` : ''}. A kind of business that pays is the bar, and this one has.`
        : `${best.segment} answered ${best.replied} times. ${WORKING_REPLIES} answers from one kind of business is the bar.`,
      moves: demand ? [demand] : [] };
  }
  return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'testing', runner,
    why: answering.length
      ? `No kind of business has answered ${WORKING_REPLIES} times yet.`
      : `${plural(sent, 'message')} out and no kind of business has answered yet.`,
    moves: demand ? [demand] : [] };
}

function reachLink(i: ChainInput, c: Ctx): BusinessLink {
  const { sent, replied } = i.funnel;
  const channels = i.byChannel.filter((x) => x.sent > 0).map((x) => CHANNEL_WORD[x.channel] ?? x.channel);
  const what = channels.length ? capital(saidList(channels)) : null;
  const facts = [sent ? `${sent} sent · ${plural(replied, 'reply', 'replies')}` : 'Nothing sent yet', i.queue ? `${i.queue} waiting to send` : null].filter(Boolean).join(' · ');
  const more = (i.said.voice ?? []).slice(0, 1).map((v) => `How you write: ${v}`);
  const writer = c.agent('writer');
  const runner = { by: 'both' as const, name: 'Writer drafts, you send', problem: writer && (writer.state === 'setup' || writer.state === 'failed') ? writer.line : null };
  const sendWaiting: LinkMove | null = i.queue ? { key: 'reach-send', label: `Send the ${i.queue} waiting`, by: 'you', go: { outreach: 'to_send' } } : null;
  const writeMore: LinkMove | null = i.worthAMessage ? { key: 'reach-deck', label: 'Write to the next five', by: 'you', go: { tab: 'swipe' } } : null;

  if (!c.offerSet) {
    // The offer card above the chain carries the one button; a second "write
    // your offer" here would be the same sentence twice on one screen.
    return { key: 'reach', label: LINK_LABEL.reach, what, facts, more, state: 'missing', runner, moves: [],
      why: 'Nothing is written from a blank offer — say what you sell first.' };
  }
  if (!sent) {
    return { key: 'reach', label: LINK_LABEL.reach, what, facts, more, state: 'untested', runner,
      why: i.queue ? `${i.queue} written, none sent yet.` : 'Nothing sent yet, so nothing is tested.',
      moves: [sendWaiting ?? writeMore].filter((m): m is LinkMove => !!m) };
  }
  // The app plans on WORKING_REPLIES in every RATE_SAMPLE sends, counted per
  // whole batch: two replies by twenty-five sent is one batch and clears it, two
  // by a hundred is five and does not. A bare count would call 2 in 100 working;
  // a bare rate would flip on the twenty-first send.
  const need = WORKING_REPLIES * Math.max(1, Math.floor(sent / RATE_SAMPLE));
  if (replied >= need) {
    return { key: 'reach', label: LINK_LABEL.reach, what, facts, more, state: 'works', runner,
      why: `${plural(replied, 'reply', 'replies')} by ${sent} sent. The app plans on ${WORKING_REPLIES} in every ${RATE_SAMPLE}.`,
      moves: [sendWaiting ?? writeMore].filter((m): m is LinkMove => !!m) };
  }
  if (sent >= RATE_SAMPLE) {
    // Not "send the waiting ones": they were written with the opener that is
    // not being answered, and more of it is the expensive way to learn nothing.
    return { key: 'reach', label: LINK_LABEL.reach, what, facts, more, state: 'stuck', runner,
      why: `${sent} sent and ${plural(replied, 'reply', 'replies')}. The app plans on ${WORKING_REPLIES} in every ${RATE_SAMPLE}, so this many sends wanted ${need}.`,
      moves: [{
        key: 'reach-openers', label: 'Three new openers', by: c.ai,
        ask: clampAsk(`Write three new first messages to ${c.whoShort}, each opening on something specific to their business${i.topOpening ? `, like "${i.topOpening}"` : ''}, in my own words`),
      }] };
  }
  return { key: 'reach', label: LINK_LABEL.reach, what, facts, more, state: 'testing', runner,
    why: `${RATE_SAMPLE - sent} more sends and the reply rate is a number, not an early read.`,
    moves: [sendWaiting ?? writeMore].filter((m): m is LinkMove => !!m) };
}

function closeLink(i: ChainInput, c: Pick<Ctx, 'ai'>): BusinessLink {
  const { replied, meetings, won, outside } = i.funnel;
  const facts = replied || meetings || won ? [plural(replied, 'reply', 'replies'), plural(meetings, 'meeting'), `${won} won`].join(' · ') : 'Waits on the first reply';
  const more = outside ? [`${outside} logged outside the app, for messages that went out some other way`] : [];
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const onePager: LinkMove = { key: 'close-onepager', label: 'Sales one-pager', by: c.ai, ask: 'Write a one-page sales sheet I can send after someone replies, in my own words' };
  const base = { key: 'close' as const, label: LINK_LABEL.close, what: null, facts, more, runner };

  if (!replied && !meetings && !won) return { ...base, state: 'untested', why: 'Nothing can close before somebody answers.', moves: [] };
  if (won >= REPEAT_WINS) return { ...base, state: 'works', why: `${won} won. At ${REPEAT_WINS} it is something you can repeat, not luck.`, moves: [] };
  if (meetings >= CLOSE_SAMPLE && !won) {
    return { ...base, state: 'stuck',
      why: `${meetings} meetings and nobody paid. From ${CLOSE_SAMPLE} on, that says more about the ask than about luck.`,
      moves: [{ key: 'close-ask', label: 'Ask what stopped them', by: c.ai, ask: `Write one short question to send the ${meetings} people I met who did not buy, to learn what stopped them` }, onePager] };
  }
  if (replied >= CLOSE_SAMPLE && !meetings && !won) {
    return { ...base, state: 'stuck', why: `${replied} replies and no meeting. The gap is between interest and the ask.`, moves: [onePager] };
  }
  return { ...base, state: 'testing',
    why: won ? `${won} won so far. At ${REPEAT_WINS} it stops being luck.` : meetings ? `${plural(meetings, 'meeting')} and nothing won yet.` : `${plural(replied, 'reply', 'replies')} and no meeting yet.`,
    moves: [onePager] };
}

function payLink(i: ChainInput, w: WinRead, c: Pick<Ctx, 'offerSet' | 'whoShort' | 'ai'>): BusinessLink {
  const m = (n: number) => moneyLabel(n, i.currency);
  const { meetings } = i.funnel;
  const what = i.offer.price_band?.trim() || null;
  const more = [
    i.wonRecent.amount > 0 ? `${m(i.wonRecent.amount)} in the last ${i.wonRecent.days} days` : null,
    i.goal?.target ? `${i.goal.title}: ${m(i.goal.current ?? 0)} of ${m(i.goal.target)}` : null,
    i.said.price?.length ? `What you charge: ${i.said.price.join(' · ')}` : null,
  ].filter((x): x is string => !!x);
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const base = { key: 'pay' as const, label: LINK_LABEL.pay, what, facts: winsLine(w, i.currency), more, runner };
  // Proof is what a price is believed on. A demo script is within any worker's
  // reach — writing — where a built demo is not, and the person records it.
  const proof: LinkMove | null = !i.offer.proof_url?.trim() && c.offerSet
    ? { key: 'pay-proof', label: 'Demo script', by: c.ai, ask: `Write a short demo script of what I sell, for one of ${c.whoShort}: what they see before and after, for me to record and send` }
    : null;
  const pricing: LinkMove = { key: 'pay-pricing', label: 'Pricing check', by: 'claude', ask: 'Tell me whether what I charge is the problem, from what has closed and what has not.' };

  if (!c.offerSet || w.price == null) {
    return { ...base, state: 'missing',
      why: 'Nobody has said what it costs, so no sale can be held against a price.',
      moves: c.offerSet ? [{ key: 'pay-say', label: 'Say what it costs', by: 'you', go: { sheet: 'offer' } }] : [] };
  }
  if (w.atPrice >= REPEAT_WINS) {
    return { ...base, state: 'works', why: `${w.atPrice} paid at your ${m(w.price)} or more. ${REPEAT_WINS} is the bar.`, moves: [] };
  }
  if (w.count && !w.atPrice && meetings >= CLOSE_SAMPLE) {
    return { ...base, state: 'stuck',
      why: `${meetings} meetings and ${w.count} paid, none at your ${m(w.price)}. From ${CLOSE_SAMPLE} on, that says more about the price or the proof than about luck.`,
      moves: [proof, pricing].filter((x): x is LinkMove => !!x) };
  }
  if (!w.count) return { ...base, state: 'untested', why: 'Nothing paid yet.', moves: proof ? [proof] : [] };
  return { ...base, state: 'testing',
    why: w.atPrice ? `${w.atPrice} paid at your ${m(w.price)}. ${REPEAT_WINS} is the bar.` : `${w.count} paid, none yet at your ${m(w.price)}.`,
    moves: [proof, pricing].filter((x): x is LinkMove => !!x) };
}

function deliverLink(i: ChainInput, c: Pick<Ctx, 'ai'>): BusinessLink {
  const lines = i.said.deliver ?? [];
  const runner = { by: 'you' as const, name: 'You', problem: null };
  if (!lines.length) {
    return { key: 'deliver', label: LINK_LABEL.deliver, what: null, facts: 'Not written', more: [], state: 'missing', runner,
      why: 'Nobody has written how a client goes from yes to delivered.',
      moves: [
        { key: 'deliver-write', label: 'Write how you deliver', by: 'you', go: { sheet: 'working' } },
        { key: 'deliver-onboard', label: 'Client onboarding', by: c.ai, ask: 'Plan how I take a new client from the first yes to delivered, step by step' },
      ] };
  }
  return { key: 'deliver', label: LINK_LABEL.deliver, what: lines[0], facts: '', more: lines.slice(1, 3), state: 'untested', runner,
    why: 'What you wrote. Nothing in the app measures delivery yet.',
    moves: [{ key: 'deliver-automate', label: 'Automate a step', by: 'claude', ask: 'Find the step in how I deliver that costs me the most time, and design a simple automation for it.' }] };
}

/**
 * The part to open first. A part further down that has failed on its own
 * evidence binds everything above it; otherwise a part nobody has said comes
 * first, since it costs a sentence; otherwise the first part of the funnel that
 * does not work yet. Delivery only once everything that sells works, because
 * nothing measures it. Null with a blank offer: the offer card carries that,
 * and every part below waits on it.
 */
export function weakLink(links: BusinessLink[], offerSet: boolean): LinkKey | null {
  if (!offerSet) return null;
  const by = Object.fromEntries(links.map((l) => [l.key, l])) as Record<LinkKey, BusinessLink>;
  const funnel: LinkKey[] = ['reach', 'close', 'pay'];
  const stuck = funnel.filter((k) => by[k]?.state === 'stuck');
  if (stuck.length) return stuck[stuck.length - 1];
  const unsaid = (['who', 'pay'] as LinkKey[]).find((k) => by[k]?.state === 'missing');
  if (unsaid) return unsaid;
  const first = funnel.find((k) => by[k] && by[k].state !== 'works');
  if (first) return first;
  return by.deliver?.state === 'missing' ? 'deliver' : null;
}

/** Proven, or the bar and the count against it. */
export function chainVerdict(offerSet: boolean, w: WinRead, currency: string): Verdict {
  const m = (n: number) => moneyLabel(n, currency);
  if (!offerSet) return { proven: false, title: 'Not started', line: 'Say what you sell, and every part below it can be tested.' };
  if (w.price != null && w.atPrice >= REPEAT_WINS) {
    return { proven: true, title: 'Proven', line: `${w.atPrice} paid at your ${m(w.price)} or more. From here it is volume.` };
  }
  if (w.price == null) return { proven: false, title: 'Not proven yet', line: `Proven at ${REPEAT_WINS} paid at your price. Say what it costs and the count starts.` };
  return { proven: false, title: 'Not proven yet', line: `Proven at ${REPEAT_WINS} paid at your ${m(w.price)}. So far: ${w.atPrice}.` };
}

/* ─── Since you last looked ───────────────────────────────────────────────── */

/** What this device last saw, so a part that moved can say so. A convenience about the screen; nothing is decided from it. */
export interface SeenChain { at: string; states: Partial<Record<LinkKey, LinkState>> }

export function snapshotChain(at: string, links: BusinessLink[]): SeenChain {
  return { at, states: Object.fromEntries(links.map((l) => [l.key, l.state])) };
}

/** Whatever came out of storage, reshaped rather than trusted. Null when it does not hold together. */
export function parseSeenChain(v: unknown): SeenChain | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at)) || !r.states || typeof r.states !== 'object') return null;
  const states: Partial<Record<LinkKey, LinkState>> = {};
  for (const k of LINK_KEYS) {
    const s = (r.states as Record<string, unknown>)[k];
    if (typeof s === 'string' && (LINK_STATES as readonly string[]).includes(s)) states[k] = s as LinkState;
  }
  return { at: r.at, states };
}

export interface ChainChange { key: LinkKey; from: LinkState; to: LinkState }

/**
 * Each part whose verdict moved since this device last looked. No snapshot is
 * no change — a first visit is not "everything moved", the same rule the
 * Path's plan keeps.
 */
export function chainChanges(seen: SeenChain | null, links: BusinessLink[]): ChainChange[] {
  if (!seen) return [];
  return links.flatMap((l) => {
    const from = seen.states[l.key];
    return from && from !== l.state ? [{ key: l.key, from, to: l.state }] : [];
  });
}

/** "How they hear went from Testing to Works". */
export function changeLine(c: ChainChange): string {
  return `${LINK_LABEL[c.key]} went from ${LINK_STATE_LABEL[c.from]} to ${LINK_STATE_LABEL[c.to]}`;
}

/* ─── What the business has built ─────────────────────────────────────────── */

export type BuiltOpen = { sheet: 'offer' | 'working' } | { commission: string } | { tab: 'path' } | { href: string };

export interface BuiltRow {
  key: string;
  title: string;
  line: string;
  by: 'ai' | 'you' | 'both';
  byName: string;
  /** When it was made, for ordering and for "New". Null for what has no date of its own. */
  at: string | null;
  /** Something the business does not have yet, said where the things it has are. */
  gap: boolean;
  open: BuiltOpen;
  /** A gap's way to fill it. */
  move?: LinkMove;
}

export interface BuiltInput {
  offer: Offer;
  said: Partial<Record<WorkingSection, string[]>>;
  working: { filled: number; total: number; proposals: number };
  /** The drawn plan, when there is one. */
  plan: { milestones: number; at: string } | null;
  /** Closed projects, newest first — what was finished or called off. Live ones are in the works, not built yet. */
  closed: Array<{ id: string; objective: string; status: 'done' | 'stopped'; outcome: string | null; closedAt: string | null; createdAt: string }>;
  /** What the projects posted with something attached: a link, a document, a list. */
  outputs: Array<{ commissionId: string; at: string }>;
  /** The move that fills the proof gap, from the chain, so the two cannot offer different things. */
  proofMove: LinkMove | null;
  now: Date;
}

/** An http(s) link, or null: a proof link is the one field here that becomes an href. */
export function safeHref(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}

const hostOf = (href: string) => { try { return new URL(href).host.replace(/^www\./, ''); } catch { return href; } };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "3 Oct", from the date's own digits, so it reads the same in every zone. */
const dayLabel = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1] ?? ''}`.trim() : '';
};

const agoLabel = (iso: string, now: Date) => {
  const h = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 3_600_000));
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/**
 * What the business has to work with, by whoever made it: what is missing
 * first, then the person's own file, then what was made most recently, then
 * the rest. Not the funnel's numbers — those are on the chain, and the same
 * count twice on one screen is the thing every redraft here has deleted.
 */
export function builtRows(i: BuiltInput): BuiltRow[] {
  const gaps: BuiltRow[] = [];
  const standing: BuiltRow[] = [];
  const dated: BuiltRow[] = [];
  const offerSet = !!i.offer.sells?.trim();

  if (offerSet) {
    const proof = safeHref(i.offer.proof_url);
    if (proof) standing.push({ key: 'proof', title: 'Proof', line: hostOf(proof), by: 'you', byName: 'You', at: null, gap: false, open: { href: proof } });
    else gaps.push({ key: 'proof', title: 'Proof', line: 'None yet — a demo, a result or a client’s words', by: 'you', byName: 'Missing', at: null, gap: true, open: { sheet: 'offer' }, ...(i.proofMove ? { move: i.proofMove } : {}) });
  }

  const w = i.working;
  const playbook: BuiltRow = {
    key: 'working', title: 'How you work',
    line: `${w.filled} of ${w.total} written${w.proposals ? ` · ${w.proposals} counted from your rows, waiting for your yes` : ''}`,
    by: w.proposals ? 'both' : 'you', byName: w.proposals ? 'You and the app' : 'You', at: null,
    gap: w.filled === 0, open: { sheet: 'working' },
  };
  // Proof first among the gaps: it is the one a price is believed on.
  if (playbook.gap) gaps.push(playbook); else standing.unshift(playbook);

  if (i.plan) {
    dated.push({ key: 'plan', title: 'The plan', line: `${plural(i.plan.milestones, 'milestone')} · drawn ${agoLabel(i.plan.at, i.now)}`, by: 'ai', byName: 'Planner', at: i.plan.at, gap: false, open: { tab: 'path' } });
  }

  const outputsBy = new Map<string, number>();
  for (const o of i.outputs) outputsBy.set(o.commissionId, (outputsBy.get(o.commissionId) ?? 0) + 1);
  for (const p of i.closed) {
    const found = outputsBy.get(p.id) ?? 0;
    // Called off with nothing to show was not built. It is still in the
    // project's own sheet; here it would be a row about nothing.
    if (p.status === 'stopped' && !found) continue;
    const when = p.closedAt ? ` ${dayLabel(p.closedAt)}` : '';
    dated.push({
      key: `p:${p.id}`, title: p.objective,
      line: [p.status === 'done' ? `Finished${when}` : `Called off${when}`, found ? `${found} found` : null, p.outcome?.trim() || 'no verdict recorded'].filter(Boolean).join(' · '),
      by: 'ai', byName: 'Researcher', at: p.closedAt ?? p.createdAt, gap: false, open: { commission: p.id },
    });
  }
  dated.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  return [...gaps, ...standing.slice(0, 1), ...dated, ...standing.slice(1)];
}

/* ─── The rest of the tab ─────────────────────────────────────────────────── */

/** Projects that cannot move without the person: a draft to approve, a question, or a breakage to retry. */
export function waitingOnYou(threads: CommissionThread[]): number {
  return threads.filter((t) => t.commission.status === 'draft' || blockedOn(t.commission, t.report) !== null).length;
}

/** The line under the greeting on Work: the verdict, and what is waiting on you. */
export function workLine(verdict: Verdict, waiting: number): string {
  return [verdict.title, waiting ? `${waiting} waiting on you` : null].filter(Boolean).join(' · ');
}

/**
 * The team as one line: how many are working, and every one that is not well,
 * by name and word (invariant 13). A healthy agent needs no row of its own — the
 * part of the business it runs already says what it did.
 */
export function teamLine(agents: Agent[]): { line: string; trouble: number } {
  const working = agents.filter((a) => a.state === 'working').length;
  // A Watcher with no source is not trouble: watching feeds is optional, and
  // "needs setup" every day on an account that never wanted it is a nag.
  const trouble = agents.filter((a) => a.state === 'failed' || (a.state === 'setup' && a.key !== 'watcher'));
  return {
    line: [`${working} of ${agents.length} agents working`, ...trouble.map((a) => `${a.name} ${a.state === 'failed' ? 'failed' : 'needs setup'}`)].join(' · '),
    trouble: trouble.length,
  };
}

/** The suggestions the input box offers: what a project or a chat could do, the weak part's first. */
export function suggestedAsks(chain: Chain, max = 3): LinkMove[] {
  const order = chain.weak ? [chain.weak, ...LINK_KEYS.filter((k) => k !== chain.weak)] : [...LINK_KEYS];
  const seen = new Set<string>();
  const out: LinkMove[] = [];
  for (const k of order) {
    for (const m of chain.links.find((l) => l.key === k)?.moves ?? []) {
      if (m.by === 'you' || !m.ask || seen.has(m.key)) continue;
      seen.add(m.key);
      out.push(m);
    }
  }
  return out.slice(0, max);
}
