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
// Not every business reaches out. The app counts only what it sends — so for a
// business whose buyers find it (online, by word of mouth, on a marketplace, in
// person; FOUND_BY), the parts it cannot count are judged on what the person
// can: their bets (lab.ts), which are rows too, the conversations they log,
// the sales they log, and the assets they have (assets.ts). Outreach keeps the
// funnel's rules exactly; the other four are read through those instead of
// being called missing for want of sends. Nobody has said and nothing was
// sent is a question for the person — "how do buyers find you?" — never a
// default to outreach.
//
// It passes DIRECTION.md's survival test for the usual reason. An agent with
// memory can write a business model canvas from a chat; "6 meetings, 2 paid,
// none at your $150" needs the ledger.
//
// Pure: no DB import.

import type { AssetKind } from './assets';
import { blockedOn, lapsedOn } from './commission';
import { MIN_SAMPLE } from './diagnose';
import type { Agent, AgentKey } from './machine';
import { FOUND_BY_LABEL, foundByOf } from './offer';
import { REPEAT_WINS } from './pathway';
import { RATE_SAMPLE, WORKING_REPLIES, priceOf } from './plan';
import { moneyLabel } from './review';
import type { CommissionThread, FoundBy, Offer } from './types';
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
  | { sheet: 'offer' | 'targeting' | 'working' | 'foundby' | 'talk' | 'signals' }
  | { outreach: 'to_send' }
  | { tab: 'swipe' }
  /** Start a bet on this part: the bet sheet, opened on it. */
  | { bet: LinkKey }
  /** Make or draft an asset of this kind. */
  | { asset: AssetKind };

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
  /**
   * Testing only because a bet is open on it: nothing counted yet. True to say
   * — a test is running — and not a step forward, so a checkpoint's read-back
   * and "since you last looked" do not call it one (evidenceState).
   */
  bare?: boolean;
  /** "Counted since 7 Oct, when you pivoted who buys.": where its count starts, when a pivot restarted it. */
  since?: string;
  /** What that pivot left out of it, said: "Before 7 Oct: 6 meetings · 2 paid, at $1 each. Not counted here…". Also first in `more`. */
  before?: string;
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
  /** How buyers find the business, when the person said; else offer.found_by, else read off the sends. */
  foundBy?: FoundBy | null;
  /** The Lab's bets, as evidence: a bet's verdict is computed from rows, so it is rows too. Newest first or not: sorted here. */
  bets?: ChainBet[];
  /**
   * The conversations the person logged with possible buyers, all time (The
   * Mom Test's log): how many, how many had the problem, how many committed.
   * The people around the money are not in it (ideas.ts talkTotals).
   */
  talks?: { n: number; problem: number; committed: number };
  /** The assets that stand for a part, by title: a demo (pay), a script (close), a landing page (reach), a workflow (deliver). */
  assets?: { demo: string | null; script: string | null; landing: string | null; workflow: string | null };
  /**
   * Per part, the rows since the newest pivot that changed it (PIVOT_REACH).
   * A part with none is judged on everything, as before there were pivots.
   */
  eras?: Partial<Record<LinkKey, PartEra>>;
  /**
   * What the count link recorded (signal.ts): sign-ups and enquiries, counted,
   * and whether there is a link at all. Absent on a payload from before it.
   */
  signals?: { linked: boolean; signup: number; enquiry: number };
}

/**
 * What a pivot restarts: the part it changes and every part measured after it.
 * A new buyer hears, says yes and pays differently, so what the old buyer did
 * at any of those says nothing about the new one. Delivery is the product's,
 * and only a pivot on it restarts it.
 */
export const PIVOT_REACH: Record<LinkKey, readonly LinkKey[]> = {
  who: ['who', 'reach', 'close', 'pay'],
  reach: ['reach', 'close', 'pay'],
  close: ['close', 'pay'],
  pay: ['pay'],
  deliver: ['deliver'],
};

/** The funnel's own counts from one day on (era.ts eraCounts): the shapes ChainInput holds all time. */
export interface EraCounts {
  funnel: { sent: number; replied: number; meetings: number; won: number; outside: number };
  bySegment: ChainInput['bySegment'];
  byChannel: ChainInput['byChannel'];
  wins: Array<number | null>;
}

/** What one part is judged on after a pivot: the rows since its day, and the pivot that set it. */
export interface PartEra extends EraCounts {
  /** The person's day of the pivot. Rows from it on count; rows before it are said, not counted. */
  since: string;
  /** The part the pivot changed: this one, or one before it. */
  pivot: LinkKey;
  /** The conversations with buyers logged since, as ChainInput's talks. */
  talks: { n: number; problem: number; committed: number };
  /** What the count link recorded since. */
  signals?: { signup: number; enquiry: number };
}

/**
 * Per part, the newest pivot that restarts it. Read off the checkpoints the
 * person answered — a pivot is their word that the business changed there,
 * never something the app infers from an edited offer. On one day, a part's own
 * pivot names it over an earlier part's.
 */
export function restartsOf(checkpoints: Array<{ on: string; decision: string; part: LinkKey | null }>): Partial<Record<LinkKey, { on: string; pivot: LinkKey }>> {
  const out: Partial<Record<LinkKey, { on: string; pivot: LinkKey }>> = {};
  for (const c of checkpoints) {
    if (c.decision !== 'pivot' || !c.part || !PIVOT_REACH[c.part]) continue;
    for (const k of PIVOT_REACH[c.part]) {
      const cur = out[k];
      if (!cur || c.on > cur.on || (c.on === cur.on && c.part === k)) out[k] = { on: c.on, pivot: c.part };
    }
  }
  return out;
}

/** A bet, as the chain reads it: which part, how it stands, and its count said in a line ("3 of 3 commitments"). */
export interface ChainBet {
  part: LinkKey;
  state: 'running' | 'passed' | 'failed' | 'stopped';
  line: string;
  /** The person's day it began, for ordering. */
  start: string;
  /** "18 Sep": the day it crossed the line, ran out or was called off. Null while it runs. */
  when: string | null;
  /** Its count so far. Optional: a bet read before it was carried counts as something counted. */
  result?: number;
}

export interface Verdict {
  proven: boolean;
  title: string;
  /** The bar and the count against it — never a forecast. */
  line: string;
  /** Where the count against the bar starts, when a pivot restarted what they pay. */
  since?: string;
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

/**
 * "2 conversations and 6 meetings": the tries a close or a price was put to,
 * each by its own name. Summed under one word, six meetings and no logged
 * conversation read "6 conversations" beside a log that said none.
 */
export function triedWords(talks: number, meetings: number): string {
  const parts = [talks ? plural(talks, 'conversation') : null, meetings ? plural(meetings, 'meeting') : null].filter((x): x is string => !!x);
  return parts.length ? parts.join(' and ') : plural(0, 'conversation');
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
  // Said beats read: the person's word for how buyers find them, else outreach
  // when the app has sent or found for them, else nobody has said.
  const found = i.foundBy !== undefined ? { value: i.foundBy, said: i.foundBy != null } : foundByOf(i.offer, i.funnel.sent, i.funnel.matched);
  const outbound = found.value === 'outreach';
  // Each part read on its own rows: since the pivot that restarted it, or all
  // time where none did (eraView). The verdict is held to what they pay's.
  const at = (k: LinkKey): [ChainInput, Ctx] => {
    const v = eraView(i, k);
    return [v, { offerSet, whoShort, ai, agent, found: found.value, outbound, wins: readWins(v.wins, i.offer.price_band) }];
  };
  const [pv, pc] = at('pay');
  const links: BusinessLink[] = [
    whoLink(...at('who')),
    reachLink(...at('reach')),
    closeLink(...at('close')),
    payLink(pv, pc.wins, pc),
    deliverLink(...at('deliver')),
  ].map((l) => withEra(l, i, outbound));
  const verdict = chainVerdict(offerSet, pc.wins, i.currency);
  return { links, weak: weakLink(links, offerSet), verdict: i.eras?.pay && offerSet ? { ...verdict, since: sinceLine(i.eras.pay) } : verdict };
}

/* ─── Since a pivot ───────────────────────────────────────────────────────── */

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "7 Oct", from the day's own digits (lab.ts dayWords, which this module cannot import: lab reads the chain). */
const dayOf = (day: string) => {
  const [, m, d] = day.slice(0, 10).split('-').map(Number);
  return m && d ? `${d} ${MONTH[m - 1] ?? ''}`.trim() : day;
};

/** "Counted since 7 Oct, when you pivoted who buys." */
export function sinceLine(e: Pick<PartEra, 'since' | 'pivot'>): string {
  return `Counted since ${dayOf(e.since)}, when you pivoted ${LINK_LABEL[e.pivot].toLowerCase()}.`;
}

/**
 * The input as one part reads it after a pivot: the funnel, the sales, the
 * conversations and the bets from its day on. What it found (`matched`) stays
 * whole — a business found is supply, not evidence about the new offer — and so
 * do the drafts waiting, which are today's.
 */
function eraView(i: ChainInput, k: LinkKey): ChainInput {
  const e = i.eras?.[k];
  if (!e) return i;
  return {
    ...i,
    funnel: { ...e.funnel, matched: i.funnel.matched },
    bySegment: e.bySegment,
    byChannel: e.byChannel,
    wins: e.wins,
    talks: e.talks,
    bets: (i.bets ?? []).filter((b) => b.start >= e.since),
    signals: i.signals ? { linked: i.signals.linked, ...(e.signals ?? { signup: 0, enquiry: 0 }) } : undefined,
  };
}

/** `all` less `some`, as multisets: the amounts paid before a day, from every amount and the ones since. */
function lessOf(all: number[], some: number[]): number[] {
  const left = [...some];
  return all.filter((a) => {
    const at = left.indexOf(a);
    if (at < 0) return true;
    left.splice(at, 1);
    return false;
  });
}

/**
 * What a pivot left out of a part, said on it: the rows before its day that
 * would have counted. Kept, not deleted — History has every one — and said, so
 * a part that reads "untested" the day after a pivot is not mistaken for a
 * business with no record.
 */
function beforeLine(i: ChainInput, e: PartEra, k: LinkKey, outbound: boolean): string | null {
  const f = i.funnel;
  const t = i.talks ?? { n: 0, problem: 0, committed: 0 };
  const known = (xs: Array<number | null>) => xs.filter((a): a is number => typeof a === 'number' && Number.isFinite(a) && a > 0);
  const paidBefore = lessOf(known(i.wins), known(e.wins));
  // Never fewer sales than amounts: two reads of one table a moment apart can disagree by a row.
  const winsBefore = Math.max(0, i.wins.length - e.wins.length, paidBefore.length);
  const n = {
    sent: Math.max(0, f.sent - e.funnel.sent),
    replied: Math.max(0, f.replied - e.funnel.replied),
    meetings: Math.max(0, f.meetings - e.funnel.meetings),
    talks: outbound ? 0 : Math.max(0, t.n - e.talks.n),
    // An era with no count of its own says nothing came before, rather than every sign-up did.
    signup: e.signals ? Math.max(0, (i.signals?.signup ?? 0) - e.signals.signup) : 0,
    enquiry: e.signals ? Math.max(0, (i.signals?.enquiry ?? 0) - e.signals.enquiry) : 0,
  };
  // Said as the pay part says a sale, without the price: the price is the new one's.
  const paid = winsBefore ? winsLine({ count: winsBefore, known: paidBefore, atPrice: 0, price: null }, i.currency) : null;
  const betsBefore = (i.bets ?? []).filter((b) => b.part === k && b.start < e.since).length;
  const sent = n.sent && `${plural(n.sent, 'message')} sent`;
  const replies = n.replied && plural(n.replied, 'reply', 'replies');
  const talks = n.talks && plural(n.talks, 'conversation');
  const meetings = n.meetings && plural(n.meetings, 'meeting');
  // Only what the part reads where the business is: a business found online
  // never counted a send on How they hear, so "27 messages sent" before its
  // pivot is a number about some other way in, said as if it were this one's.
  const parts = ({
    who: outbound ? [sent, replies, paid] : [talks && `${talks} with buyers`, paid],
    reach: outbound ? [sent, replies] : [n.signup && plural(n.signup, 'sign-up'), n.enquiry && plural(n.enquiry, 'enquiry', 'enquiries')],
    close: outbound ? [replies, meetings, paid] : [talks, meetings, paid],
    pay: [talks, meetings, paid],
    deliver: [],
  } as Record<LinkKey, Array<string | 0 | null>>)[k].filter((x): x is string => !!x);
  if (betsBefore) parts.push(plural(betsBefore, 'bet'));
  return parts.length ? `Before ${dayOf(e.since)}: ${parts.join(' · ')}. Not counted here, and kept in History.` : null;
}

/** A part as a pivot left it: where its count starts, and what came before, said first when it is open. */
function withEra(l: BusinessLink, i: ChainInput, outbound: boolean): BusinessLink {
  const e = i.eras?.[l.key];
  if (!e) return l;
  const before = beforeLine(i, e, l.key, outbound);
  return before ? { ...l, since: sinceLine(e), before, more: [before, ...l.more] } : { ...l, since: sinceLine(e) };
}

interface Ctx {
  offerSet: boolean;
  /** Who they sell to, quoted, or a plain phrase when their words are a list too long to read inside a sentence. */
  whoShort: string;
  ai: MoveBy;
  agent: (k: AgentKey) => Agent | null;
  /** How buyers find the business, or null when nobody has said and nothing was sent. */
  found: FoundBy | null;
  /** Outreach: the app counts this part itself, from what it sends. */
  outbound: boolean;
  wins: WinRead;
}

/* ─── Bets as evidence ────────────────────────────────────────────────────── */

const BET_SAID: Record<ChainBet['state'], string> = { running: 'Running', passed: 'Passed', failed: 'Did not pass', stopped: 'Called off' };

/** The bets on one part, newest first. */
function betsOn(i: ChainInput, part: LinkKey): ChainBet[] {
  return (i.bets ?? []).filter((b) => b.part === part).sort((a, b) => b.start.localeCompare(a.start));
}

/** The record a part's bets leave on it, shown when the part is open: the one running, and the last one that ended. */
function betMore(bets: ChainBet[]): string[] {
  const running = bets.find((b) => b.state === 'running');
  const last = bets.find((b) => b.state !== 'running');
  return [
    running ? `A bet is running: ${running.line} so far` : null,
    last ? `${BET_SAID[last.state]}${last.when ? `, ${last.when}` : ''}: ${last.line}` : null,
  ].filter((x): x is string => !!x);
}

/** The newest bet on a part that passed, if any. */
const passedOf = (bets: ChainBet[]) => bets.find((b) => b.state === 'passed') ?? null;

/**
 * Whether a part's bets have told it anything: one ran its course, or one has
 * counted something. A bet opened today, or one called off before it counted
 * anything, is a test begun and not a result.
 */
const betsCounted = (bets: ChainBet[]) => bets.some((b) => b.state === 'passed' || b.state === 'failed' || (b.result ?? 1) > 0);

/** What a part's newest bet says about it, when bets are all it has. */
function betSaid(b: ChainBet): string {
  if (b.state === 'running') return (b.result ?? 1) > 0 ? `A bet is running: ${b.line} so far.` : 'A bet on it is running. Nothing counted yet.';
  if (b.state === 'stopped') return `The last bet on it was called off: ${b.line}.`;
  return b.state === 'passed' ? `A bet passed${b.when ? ` on ${b.when}` : ''}: ${b.line}.` : `The last bet did not pass: ${b.line}.`;
}

/** The last two bets that ran out short of the line, with nothing passed since: the part is not working by its own record. */
function twoShort(bets: ChainBet[]): [ChainBet, ChainBet] | null {
  const ended = bets.filter((b) => b.state === 'passed' || b.state === 'failed');
  return ended.length >= 2 && ended[0].state === 'failed' && ended[1].state === 'failed' ? [ended[0], ended[1]] : null;
}

/** "Bet on how they hear": the move that opens the bet sheet on a part. */
const betMove = (part: LinkKey, label: string): LinkMove => ({ key: `${part}-bet`, label, by: 'you', go: { bet: part } });

/* ─── The parts ───────────────────────────────────────────────────────────── */

function whoLink(i: ChainInput, c: Ctx): BusinessLink {
  const { matched, sent } = i.funnel;
  // A kind of business that paid, held to the person's price: two one-dollar
  // tests are not a market. With no price said, any amount counts.
  const price = priceOf(i.offer.price_band);
  const paysAt = (s: ChainInput['bySegment'][number]) => (s.paid ?? []).filter((a) => price == null || a >= price).length;
  const words = i.offer.for_who?.trim() || (i.segments.length ? saidList(i.segments, 3) : null);
  const what = words ? `${words}${i.area ? ` in ${i.area}` : ''}` : null;
  const bets = betsOn(i, 'who');
  const passed = passedOf(bets);

  if (!c.outbound) return whoByOwnCount(i, c, what, bets);

  const where = [i.segments.length && i.area ? 'Maps' : null, i.web ? 'the web' : null].filter(Boolean).join(' and ');
  const facts = matched
    ? [`${matched} found${where ? ` on ${where}` : ''}`, i.worthAMessage ? `${i.worthAMessage} worth a message` : null].filter(Boolean).join(' · ')
    : where ? 'Nothing found yet' : 'Nothing to look for yet';
  const answering = i.bySegment.filter((s) => s.replied > 0 || s.won > 0);
  const best = [...answering].sort((a, b) => paysAt(b) - paysAt(a) || b.replied - a.replied)[0] ?? null;
  const more = [
    ...(answering.length ? [`Answered: ${answering.slice(0, 3).map((s) => `${s.segment} ${s.replied} of ${s.sent}${s.won ? `, ${s.won} paid` : ''}`).join(' · ')}`] : []),
    ...betMore(bets),
  ];

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
  if (best && (paysAt(best) > 0 || best.replied >= WORKING_REPLIES)) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'works', runner,
      why: paysAt(best) > 0
        ? `${best.segment} paid${price != null ? ` your ${moneyLabel(price, i.currency)}` : ''}. A kind of business that pays is the bar, and this one has.`
        : `${best.segment} answered ${best.replied} times. ${WORKING_REPLIES} answers from one kind of business is the bar.`,
      moves: demand ? [demand] : [] };
  }
  // A bet on who buys that passed is a buyer found by the person's own count:
  // the funnel had not shown one yet, and the bet did.
  if (passed) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'works', runner,
      why: `A bet on who buys passed${passed.when ? ` on ${passed.when}` : ''}: ${passed.line}.`, moves: demand ? [demand] : [] };
  }
  if (!sent) {
    return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'untested', runner,
      why: matched ? `${matched} found and none written to yet. Which kind answers is the first thing to find out.` : 'Nothing found yet, so nothing has been tried.',
      // Writing to the first few is How they hear's move, and it tests this part too.
      moves: !matched && !i.segments.length && !i.web ? [{ key: 'who-where', label: 'Say where to look', by: 'you', go: { sheet: 'targeting' } }] : [] };
  }
  return { key: 'who', label: LINK_LABEL.who, what, facts, more, state: 'testing', runner,
    why: answering.length
      ? `No kind of business has answered ${WORKING_REPLIES} times yet.`
      : `${plural(sent, 'message')} out and no kind of business has answered yet.`,
    moves: demand ? [demand] : [] };
}

/**
 * Who buys, where the app does not find them: the person's words, the
 * conversations they logged, the sales at their price and their bets. A sale
 * at the price is a buyer found; problem conversations are the test before it.
 */
function whoByOwnCount(i: ChainInput, c: Ctx, what: string | null, bets: ChainBet[]): BusinessLink {
  const t = i.talks ?? { n: 0, problem: 0, committed: 0 };
  const w = c.wins;
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const facts = [
    t.n ? `${plural(t.n, 'conversation')} with buyers` : null,
    t.n ? `${t.problem} have the problem` : null,
    w.atPrice ? `${w.atPrice} paid your price` : null,
  ].filter(Boolean).join(' · ') || 'Nothing logged yet';
  const more = betMore(bets);
  const base = { key: 'who' as const, label: LINK_LABEL.who, what, facts, more, runner };
  const ask = c.offerSet ? betMove('who', 'Bet on who buys') : null;
  if (!what) {
    return { ...base, state: 'missing', why: 'Nobody has said who buys.', moves: [{ key: 'who-say', label: 'Say who buys', by: 'you', go: { sheet: 'offer' } }] };
  }
  const passed = passedOf(bets);
  if (passed) return { ...base, state: 'works', why: `A bet on who buys passed${passed.when ? ` on ${passed.when}` : ''}: ${passed.line}.`, moves: [] };
  if (w.price != null && w.atPrice > 0) {
    return { ...base, state: 'works', why: `${plural(w.atPrice, 'sale')} at your ${moneyLabel(w.price, i.currency)}: somebody who buys at the price exists.`, moves: [] };
  }
  if (t.n || bets.length) {
    return { ...base, state: 'testing',
      why: t.n ? `${t.problem} of the ${plural(t.n, 'possible buyer')} you talked to have the problem${t.committed ? `, and ${t.committed} committed to something` : ''}.` : betSaid(bets[0]),
      moves: ask ? [ask] : [],
      ...(t.n || betsCounted(bets) ? {} : { bare: true }) };
  }
  return { ...base, state: 'untested', why: 'No possible buyer has been asked yet. Ten conversations about the problem is the quickest way to know.', moves: ask ? [ask] : [] };
}

function reachLink(i: ChainInput, c: Ctx): BusinessLink {
  const { sent, replied } = i.funnel;
  const bets = betsOn(i, 'reach');
  if (!c.outbound) return reachByOwnCount(i, c, bets);

  const channels = i.byChannel.filter((x) => x.sent > 0).map((x) => CHANNEL_WORD[x.channel] ?? x.channel);
  const what = channels.length ? capital(saidList(channels)) : null;
  const facts = [sent ? `${sent} sent · ${plural(replied, 'reply', 'replies')}` : 'Nothing sent yet', i.queue ? `${i.queue} waiting to send` : null].filter(Boolean).join(' · ');
  const more = [...(i.said.voice ?? []).slice(0, 1).map((v) => `How you write: ${v}`), ...betMore(bets)];
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

/** What a bet counts for each way buyers arrive, said as the example in "a bet counts it". */
const OWN_COUNT: Record<Exclude<FoundBy, 'outreach'>, string> = {
  inbound: 'the enquiries and sign-ups that come in',
  referrals: 'the introductions people make',
  marketplace: 'the enquiries the listing brings',
  local: 'the people who come in or stop to talk',
};

/**
 * How they hear, where the app cannot see it: the person's bets count it. Two
 * passed is a pattern; one passed with somebody paying is the channel doing its
 * job; two short in a row, with nothing passed since, is the channel not
 * working by its own record. Nobody has said how buyers arrive and nothing was
 * sent is a question, not outreach by default.
 */
function reachByOwnCount(i: ChainInput, c: Ctx, bets: ChainBet[]): BusinessLink {
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const more = betMore(bets);
  const landing = i.assets?.landing ?? null;
  // What arrived through the count link: measured, so a part with it is never
  // bare, and said beside the bet's count rather than in place of it — a number
  // of sign-ups is not a verdict on whether they are enough; a bet is.
  const sig = i.signals;
  const arrived = sig ? sig.signup + sig.enquiry : 0;
  const heard = arrived
    ? `${[sig!.signup ? plural(sig!.signup, 'sign-up') : null, sig!.enquiry ? plural(sig!.enquiry, 'enquiry', 'enquiries') : null].filter(Boolean).join(' and ')} through your count link`
    : null;
  const linkMove: LinkMove | null = sig && !sig.linked ? { key: 'reach-link', label: 'Count sign-ups by themselves', by: 'you', go: { sheet: 'signals' } } : null;
  if (!c.offerSet) {
    return { key: 'reach', label: LINK_LABEL.reach, what: null, facts: '', more, state: 'missing', runner, moves: [],
      why: 'Nothing is written from a blank offer — say what you sell first.' };
  }
  if (!c.found) {
    return { key: 'reach', label: LINK_LABEL.reach, what: null, facts: 'Nothing sent through the app', more, state: 'missing', runner,
      why: 'Nobody has said how buyers find you. The app counts outreach itself; every other way, your bets count.',
      moves: [{ key: 'reach-how', label: 'Say how buyers find you', by: 'you', go: { sheet: 'foundby' } }] };
  }
  const found = c.found as Exclude<FoundBy, 'outreach'>;
  const what = `${FOUND_BY_LABEL[found]}${landing ? ` · ${landing}` : ''}`;
  const facts = [bets[0] ? `${BET_SAID[bets[0].state]}: ${bets[0].line}` : null, heard].filter(Boolean).join(' · ') || 'No count yet';
  const base = { key: 'reach' as const, label: LINK_LABEL.reach, what, facts, more, runner };
  const passed = bets.filter((b) => b.state === 'passed');
  const page: LinkMove | null = found === 'inbound' && !landing ? { key: 'reach-landing', label: 'A landing page', by: 'you', go: { asset: 'landing_page' } } : null;
  const ask = betMove('reach', 'Bet on how they hear');
  const moves = [ask, page, linkMove].filter((m): m is LinkMove => !!m);
  if (passed.length >= 2) {
    return { ...base, state: 'works', why: `${passed.length} bets on how they hear passed. Twice is a pattern, not luck.`, moves: [] };
  }
  if (passed.length && c.wins.count) {
    return { ...base, state: 'works',
      why: `A bet on how they hear passed${passed[0].when ? ` on ${passed[0].when}` : ''}, and ${plural(c.wins.count, 'sale')} came in.`, moves: [] };
  }
  const short = twoShort(bets);
  if (short) {
    return { ...base, state: 'stuck',
      why: `The last two bets on how they hear did not pass: ${short[0].line}, then ${short[1].line}.`,
      moves };
  }
  if (bets.length) {
    const b = bets[0];
    return { ...base, state: 'testing',
      why: b.state === 'passed' ? `A bet passed${b.when ? ` on ${b.when}` : ''}: ${b.line}. Once more and it is a pattern.` : betSaid(b),
      moves,
      ...(betsCounted(bets) || arrived ? {} : { bare: true }) };
  }
  if (heard) {
    return { ...base, state: 'testing', why: `${capital(heard)}. A bet on how they hear says whether that is enough.`, moves };
  }
  return { ...base, state: 'untested',
    why: sig?.linked
      ? `Your count link has recorded nothing yet. It counts ${OWN_COUNT[found]} as they come in; a bet says whether they are enough.`
      : `The app cannot see this way in, so a bet counts it: ${OWN_COUNT[found]}.`,
    moves };
}

function closeLink(i: ChainInput, c: Ctx): BusinessLink {
  const { replied, meetings, won, outside } = i.funnel;
  const bets = betsOn(i, 'close');
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const scriptMove: LinkMove | null = c.offerSet && !i.assets?.script ? { key: 'close-script', label: 'A sales script', by: 'you', go: { asset: 'script' } } : null;

  if (!c.outbound) {
    // Conversations the person logged stand in for replies: the app did not
    // send anything to be replied to.
    const t = i.talks ?? { n: 0, problem: 0, committed: 0 };
    const conv = t.n + meetings;
    const facts = conv || won ? [plural(t.n, 'conversation'), meetings ? plural(meetings, 'meeting') : null, `${won} won`].filter(Boolean).join(' · ') : 'Waits on the first conversation';
    const base = { key: 'close' as const, label: LINK_LABEL.close, what: i.assets?.script ?? null, facts, more: betMore(bets), runner };
    const log: LinkMove = { key: 'close-log', label: 'Log a conversation', by: 'you', go: { sheet: 'talk' } };
    if (!conv && !won) return { ...base, state: 'untested', why: 'Nothing can close before a conversation. Log the ones you have.', moves: [log] };
    if (won >= REPEAT_WINS) return { ...base, state: 'works', why: `${won} won. At ${REPEAT_WINS} it is something you can repeat, not luck.`, moves: [] };
    if (conv >= CLOSE_SAMPLE && !won) {
      return { ...base, state: 'stuck',
        why: `${capital(triedWords(t.n, meetings))} and nobody paid. From ${CLOSE_SAMPLE} on, that says more about the ask than about luck.`,
        moves: [scriptMove, betMove('close', 'Bet on how they say yes')].filter((m): m is LinkMove => !!m) };
    }
    return { ...base, state: 'testing',
      why: won ? `${won} won so far. At ${REPEAT_WINS} it stops being luck.` : `${capital(triedWords(t.n, meetings))} and nothing won yet.`,
      moves: [scriptMove, log].filter((m): m is LinkMove => !!m) };
  }

  const facts = replied || meetings || won ? [plural(replied, 'reply', 'replies'), plural(meetings, 'meeting'), `${won} won`].join(' · ') : 'Waits on the first reply';
  const more = [...(outside ? [`${outside} logged outside the app, for messages that went out some other way`] : []), ...betMore(bets)];
  const onePager: LinkMove = { key: 'close-onepager', label: 'Sales one-pager', by: c.ai, ask: 'Write a one-page sales sheet I can send after someone replies, in my own words' };
  const base = { key: 'close' as const, label: LINK_LABEL.close, what: i.assets?.script ?? null, facts, more, runner };

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

function payLink(i: ChainInput, w: WinRead, c: Ctx): BusinessLink {
  const m = (n: number) => moneyLabel(n, i.currency);
  // The conversations a price was put to: meetings where the app sent, and the
  // ones the person logged where it did not — each said by its own name.
  const talked = c.outbound ? 0 : (i.talks?.n ?? 0);
  const conv = i.funnel.meetings + talked;
  const what = i.offer.price_band?.trim() || null;
  const bets = betsOn(i, 'pay');
  const more = [
    i.wonRecent.amount > 0 ? `${m(i.wonRecent.amount)} in the last ${i.wonRecent.days} days` : null,
    i.goal?.target ? `${i.goal.title}: ${m(i.goal.current ?? 0)} of ${m(i.goal.target)}` : null,
    i.said.price?.length ? `What you charge: ${i.said.price.join(' · ')}` : null,
    ...betMore(bets),
  ].filter((x): x is string => !!x);
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const base = { key: 'pay' as const, label: LINK_LABEL.pay, what, facts: winsLine(w, i.currency), more, runner };
  // Proof is what a price is believed on. A demo script is within any worker's
  // reach — writing — where a built demo is not, and the person records it. A
  // demo kept as an asset is proof too, link or not.
  const proof: LinkMove | null = !i.offer.proof_url?.trim() && !i.assets?.demo && c.offerSet
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
  if (w.count && !w.atPrice && conv >= CLOSE_SAMPLE) {
    return { ...base, state: 'stuck',
      why: `${capital(triedWords(talked, i.funnel.meetings))} and ${w.count} paid, none at your ${m(w.price)}. From ${CLOSE_SAMPLE} on, that says more about the price or the proof than about luck.`,
      moves: [proof, pricing].filter((x): x is LinkMove => !!x) };
  }
  if (!w.count) return { ...base, state: 'untested', why: 'Nothing paid yet.', moves: proof ? [proof] : [] };
  return { ...base, state: 'testing',
    why: w.atPrice ? `${w.atPrice} paid at your ${m(w.price)}. ${REPEAT_WINS} is the bar.` : `${w.count} paid, none yet at your ${m(w.price)}.`,
    moves: [proof, pricing].filter((x): x is LinkMove => !!x) };
}

function deliverLink(i: ChainInput, c: Ctx): BusinessLink {
  const lines = i.said.deliver ?? [];
  const workflow = i.assets?.workflow ?? null;
  const bets = betsOn(i, 'deliver');
  const passed = passedOf(bets);
  const runner = { by: 'you' as const, name: 'You', problem: null };
  const more = [...lines.slice(workflow ? 0 : 1, 3), ...betMore(bets)];
  if (!lines.length && !workflow) {
    return { key: 'deliver', label: LINK_LABEL.deliver, what: null, facts: 'Not written', more: betMore(bets), state: passed ? 'testing' : 'missing', runner,
      why: passed ? `A bet on delivery passed${passed.when ? ` on ${passed.when}` : ''}: ${passed.line}. Nothing is written down yet.` : 'Nobody has written how a client goes from yes to delivered.',
      moves: [
        { key: 'deliver-write', label: 'Write how you deliver', by: 'you', go: { sheet: 'working' } },
        { key: 'deliver-onboard', label: 'Client onboarding', by: c.ai, ask: 'Plan how I take a new client from the first yes to delivered, step by step' },
      ] };
  }
  // Delivery is judged by its own bets, where there are any: a step handed
  // over, or clients served by hand, counted. What is written is a claim.
  if (passed) {
    return { key: 'deliver', label: LINK_LABEL.deliver, what: workflow ?? lines[0], facts: '', more, state: 'works', runner,
      why: `A bet on delivery passed${passed.when ? ` on ${passed.when}` : ''}: ${passed.line}.`, moves: [] };
  }
  return { key: 'deliver', label: LINK_LABEL.deliver, what: workflow ?? lines[0], facts: '', more, state: 'untested', runner,
    why: workflow ? 'Written down as a workflow. Nothing in the app measures delivery; a bet can.' : 'What you wrote. Nothing in the app measures delivery yet.',
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

/**
 * A part's state as evidence: testing with nothing counted (`bare`) is where
 * untested was. Starting a bet moved "who buys" from Untested to Testing on the
 * live account, and the screen called that progress twice — "since you last
 * looked" and the checkpoint's "has moved forward since" — over a log with no
 * conversation in it. What is kept and compared is this, never the label.
 */
export function evidenceState(l: Pick<BusinessLink, 'state' | 'bare'>): LinkState {
  return l.state === 'testing' && l.bare ? 'untested' : l.state;
}

export function snapshotChain(at: string, links: BusinessLink[]): SeenChain {
  return { at, states: Object.fromEntries(links.map((l) => [l.key, evidenceState(l)])) };
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
 * Path's plan keeps. Compared as evidence (evidenceState), so a bet opened is
 * not news. A part bare now that was kept as Testing is not news either: a
 * snapshot from before `bare` kept the label, and cannot say whether anything
 * had been counted then.
 */
export function chainChanges(seen: SeenChain | null, links: BusinessLink[]): ChainChange[] {
  if (!seen) return [];
  return links.flatMap((l) => {
    const from = seen.states[l.key];
    const to = evidenceState(l);
    if (!from || from === to || (l.bare && from === 'testing')) return [];
    return [{ key: l.key, from, to }];
  });
}

/** "How they hear went from Testing to Works". */
export function changeLine(c: ChainChange): string {
  return `${LINK_LABEL[c.key]} went from ${LINK_STATE_LABEL[c.from]} to ${LINK_STATE_LABEL[c.to]}`;
}

/* ─── The rest of the tab ─────────────────────────────────────────────────── */

/**
 * Projects that cannot move without the person: a draft to approve, a question,
 * or a breakage to retry — less any waiting on a day that has passed
 * (commission.ts lapsedOn), which nothing the person answers can now make useful.
 */
export function waitingOnYou(threads: CommissionThread[], today?: string): number {
  return threads.filter((t) => (t.commission.status === 'draft' || blockedOn(t.commission, t.report) !== null) && !(today && lapsedOn(t.commission, today))).length;
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
