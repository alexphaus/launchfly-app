// src/lib/copilot/decide.ts
// Decide: everything that waits on the person, as cards in one deck, ahead of
// the people worth a message.
//
// Why one deck. The tabs had drifted into two places to act: the Path held the
// call, the move and "Needs you"; Engine held the bet's move and the people a
// bet found; Swipe held the businesses. The same day's work was spread over
// three screens, and the owner's own words for Engine were that half of it was
// things Swipe could do. Path is gone, Engine is the system (what runs and what
// it has proven), and every decision is a card here: right does it, left puts it
// off. A decision is not advice — each card is a row that already waits on the
// person (a call picked, a project that stopped to ask, a conversation Claude
// proposed, a post the bet found, money in from somebody unnamed), so the deck is
// filled by whatever ran overnight and by the chats the person had, never
// written for the occasion.
//
// What it is held to:
//
//   - Nothing drafts from a blank offer (invariant 1): with no offer the first
//     card is writing one, and the people worth a message are not dealt at all.
//   - The answers that grade a call are the call's own buttons. A swipe is too
//     cheap a gesture to say "I did it", and a call answered by accident teaches
//     tomorrow's call the wrong thing — so its right swipe only hands work over,
//     where the call is work the app offers to do.
//   - Most important first. Everything that waits on the person comes before
//     every lead, and among those, what is lost by waiting (a project blocked on
//     you, an introduction offered, a post someone may have answered) comes
//     before what only goes stale. The owner's first deck dealt the bet's eight
//     posts before the bet's own step and its checkpoint: eight strangers ahead
//     of the two decisions the bet turns on.
//   - A post found is a lead, like a business: it is dealt after the decisions,
//     and it is not counted on the tab's badge, which says what needs the person
//     rather than how many strangers there are.
//   - Every card says why it is here (`why`): the rule that dealt it and the rows
//     behind it, never a reason written for the occasion — read aloud when asked
//     by voice (walk.ts). A line a model wrote is said to be one.
//
// Pure: no DB import, so copilot-core.test.ts covers the order and the words.
// SwipeTab.tsx maps each card onto its action.

import type { DeckCard } from './deck';
import { verdictOf, type Decision } from './decision';
import type { Step } from './engine';
import { dayIn } from './lab';
import type { NowMove } from './plan';
import type { AskKind, AskRow } from './today';
import { postedWords, type Voice } from './voices';

export type DecideKind =
  /** Nothing is drafted from a blank offer: writing one comes first. */
  | 'offer'
  /** Today's call, answered on its own buttons. */
  | 'call'
  /** What needsYou found: a question, an introduction, a fix, a proposal, a confirm, an approval. */
  | 'ask'
  /** A post this device opened: did they answer? */
  | 'answered'
  /** A post the running bet found, where somebody said its problem. */
  | 'voice'
  /** The bet's own next step (engine.ts engineStep), where it is not a post. */
  | 'bet'
  /** The plan's step or a Move, when no call waits. */
  | 'move'
  /** Pivot or persevere: bets ended since the last answer, read on System against the parts. */
  | 'checkpoint'
  /** What a pivot on who buys left behind. */
  | 'pivot'
  /** Money in from a payer the bank names and the person has not: a client's payment is a sale. */
  | 'payer'
  /** What broke overnight: the nightly run, a check, a source, a read. Said as a card, not a banner over the pile. */
  | 'broke'
  /** Nothing can look for anyone yet. */
  | 'setup'
  /** No call has been picked today. */
  | 'brief';

/**
 * What a card is about, for the chips over the pile: on a low day, only the
 * people; with an hour free, only the clients. Every card has one, so a chip
 * never hides a card from All.
 */
export type Focus = 'clients' | 'people' | 'projects' | 'bets';
export const FOCUSES: readonly Focus[] = ['clients', 'people', 'projects', 'bets'];
export const FOCUS_LABEL: Record<Focus, string> = { clients: 'Clients', people: 'People', projects: 'Projects', bets: 'Bets' };

/** A payer the bank names and the person has not (money/ledger.ts toName), as the card says it. */
export interface PayerAsk {
  key: string;
  name: string;
  /** Already written as money, in the read's currency: the card never formats a figure itself. */
  total: string;
  count: number;
  /** The last payment's day. */
  last: string;
  /** The business it most likely is (ledger.ts suggest): offered, never linked unasked. */
  looksLike: string | null;
}

/** One thing that broke, in words, with where it is fixed. */
export interface BrokeLine {
  key: string;
  title: string;
  detail: string;
  /** Where the fix is: the watched sources, the nightly run on You, or reading the account again. */
  fix: 'sources' | 'nightly' | 'reload';
}

export interface DecideCard {
  /** Stable across reloads, and never one a lead card uses ('d:' — leads are 'q:', 'o:', 'm:'). */
  key: string;
  kind: DecideKind;
  focus: Focus;
  /** Over the title: what kind of decision it is. */
  eyebrow: string;
  title: string;
  detail: string | null;
  /** Why it is here, now: the rule that dealt it and the rows behind it. Never empty. */
  why: string[];
  /** What the right swipe does, on its button. Null where the card's own buttons answer it. */
  right: string | null;
  /** The left swipe: to the back of the pile, or not a fit (a post, set aside for good). */
  left: 'later' | 'not_fit';
  /** Counted on the tab's badge: it waits on the person. A post found is a lead and is not. */
  needs: boolean;
  ask?: AskRow;
  voice?: Voice;
  step?: Step;
  now?: NowMove;
  payer?: PayerAsk;
  broke?: BrokeLine[];
  /** When this device opened the post, for an `answered` card. */
  openedAt?: string;
}

export interface DecideInput {
  noOffer: boolean;
  /** Today's call waits on an answer, and is not stale against the plan (plan.ts pathNow). */
  callPending: boolean;
  /** The call is work the app offers to do: the right swipe hands it over. */
  callHandsOver: boolean;
  /**
   * The call itself, for what it says aloud and why it is first: its headline,
   * and how the calls before it went (null under three answered — too few to say).
   */
  call?: { headline: string; record: { answered: number; did: number; moved: number } | null } | null;
  /** pathNow's move. Only a plan step or a Move is a card of its own; the rest are below or are leads. */
  now: NowMove | null;
  /** needsYou's rows, in its order. */
  asks: AskRow[];
  /** The bet's step (engine.ts), read with no posts opened: the posts are cards of their own. */
  step: Step | null;
  /** The running bet, in a line, for the why on the cards it is behind: "Day 4 of 14 · 0 of 10 conversations". */
  bet?: { belief: string; line: string } | null;
  /** The running bet's people not yet talked to or set aside, newest search first. */
  voices: Voice[];
  /** Post id → when this device opened it (engine.ts parseOpened). */
  opened: Readonly<Record<string, string>>;
  pivotLeft: boolean;
  /** A checkpoint is due (lab.ts checkpointView), and how many bets ended since the last one. */
  checkpoint: { due: boolean; ended: number };
  /** Nothing is looking for businesses or people: no Maps targeting and no web search. */
  cannotSearch: boolean;
  /** No call today, and none being picked now. */
  noCall: boolean;
  /** Payers to name, biggest first. Only the first few are dealt: past that it is the Bank sheet's list. */
  payers?: PayerAsk[];
  /** What broke, most serious first (derive.ts brokeLines). One card says all of it. */
  broke?: BrokeLine[];
  /** The person's day and zone: how long something has waited is said in their days. */
  today?: string;
  timezone?: string;
}

/** Payers dealt as cards; the rest wait on the Bank sheet, which lists every one. */
export const MAX_PAYER_CARDS = 3;

const ASK_EYEBROW: Record<AskKind, string> = {
  question: 'A project asks you',
  intro: 'An introduction waits',
  fix: 'Work that failed a check',
  proposal: 'Claude proposes',
  confirm: 'Did these go?',
  approve: 'Waiting for your OK',
  send: 'To send',
};

/** Each opens where it is answered — the project, the introduction, the proposals, the confirm card — except a fix, which one tap starts again. */
const ASK_RIGHT: Record<AskKind, string> = {
  question: 'Answer it',
  intro: 'Follow it up',
  fix: 'Try again',
  proposal: 'Look at it',
  confirm: 'Answer',
  approve: 'Read the plan',
  send: 'Send',
};

const ASK_FOCUS: Record<AskKind, Focus> = {
  question: 'projects', fix: 'projects', approve: 'projects',
  intro: 'people', proposal: 'people',
  confirm: 'clients', send: 'clients',
};

/** Steps the deck has its own cards for: the posts (each one is a card) and the offer. */
const STEP_COVERED: ReadonlySet<Step['kind']> = new Set(['reply', 'waiting', 'offer']);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "today", "yesterday", "3 days ago", from a timestamp, in the person's own days. Null when it cannot be said. */
function since(iso: string | null | undefined, i: Pick<DecideInput, 'today' | 'timezone'>): string | null {
  if (!iso || !i.today) return null;
  const day = dayIn(iso, i.timezone || 'UTC');
  return day ? postedWords(day, i.today) : null;
}

/** Why each ask is here. The rule, then what the rows say of this one. */
function askWhy(a: AskRow, i: DecideInput): string[] {
  const when = since(a.since, i);
  switch (a.kind) {
    case 'question': return [
      `${when ? `It stopped ${when}` : 'It stopped'} to ask you this. Nothing on it moves until you answer, so it is near the top.`,
    ];
    case 'intro': return [
      'An introduction goes cold: the person who offered it forgets they did. So it comes before anything that only goes stale.',
    ];
    case 'fix': return [
      `${when ? `It stopped ${when}` : 'It stopped'}, and nothing else on it moves meanwhile. Try again hands it back to the worker as it was.`,
    ];
    case 'approve': return [
      `${when ? `Written ${when}` : 'Written'} and waiting on your OK. A project spends nothing until you approve it, so it waits here rather than running.`,
    ];
    case 'proposal': return [
      `Claude proposed it from a chat${when ? ` ${when}` : ''}. Nothing is in your record until you keep it, and waiting costs it nothing, so it comes after what goes cold.`,
    ];
    case 'confirm': return [
      'What you did outside the app is counted only once you say so: an opened draft nobody marked sent is not counted as sent.',
    ];
    case 'send': return ['Written and waiting to be sent.'];
  }
}

/**
 * Every card that waits on the person, in the order dealt. The people worth a
 * message (deck.ts deckCards) follow them on the same pile.
 */
export function decideCards(i: DecideInput): DecideCard[] {
  const asks = i.asks.filter((a) => a.kind !== 'send');
  const asked = (k: AskKind) => asks.filter((a) => a.kind === k).map((a): DecideCard => ({
    key: `d:${a.key}`, kind: 'ask', focus: a.kind === 'proposal' && a.about === 'test' ? 'bets' : ASK_FOCUS[k], eyebrow: ASK_EYEBROW[k],
    // A question's title is what was asked; its detail is the project it stopped.
    title: a.title, detail: a.detail || null, why: askWhy(a, i),
    right: ASK_RIGHT[k], left: 'later', needs: true, ask: a,
  }));
  const betLine = i.bet ? `Your bet: ${i.bet.line}.` : null;

  const first: DecideCard[] = [];
  if (i.noOffer) {
    first.push({
      key: 'd:offer', kind: 'offer', focus: 'clients', eyebrow: 'One thing first', title: 'Write what you sell',
      detail: 'Three lines: what you sell, who it is for, and the problem it takes away.',
      why: [
        'Nothing is drafted, searched or proposed without it: a message written from a blank offer is not yours.',
        'So it comes first, and nobody worth a message is dealt until it is written.',
      ],
      right: 'Write it', left: 'later', needs: true,
    });
  }

  if (i.callPending) {
    const r = i.call?.record;
    first.push({
      key: 'd:call', kind: 'call', focus: 'bets', eyebrow: 'Today’s call', title: i.call?.headline ?? '', detail: null,
      why: [
        'Today’s call is the one move the nightly run weighed against everything else waiting, so it comes first.',
        'Answer it on its own buttons: a swipe never says you did it, because the answer grades tomorrow’s call.',
        ...(r ? [`Of the last ${plural(r.answered, 'call')} you answered, ${r.did} ${r.did === 1 ? 'was' : 'were'} done${r.did ? ` and ${r.moved} moved the number ${r.moved === 1 ? 'it' : 'they'} named` : ''}.`] : []),
      ],
      right: i.callHandsOver ? 'Hand it over' : null, left: 'later', needs: true,
    });
  } else if (i.noCall && !i.noOffer) {
    // Where the call would be: picking it weighs everything else on this pile.
    first.push({
      key: 'd:brief', kind: 'brief', focus: 'bets', eyebrow: 'Today’s call', title: 'Nothing has been weighed yet today',
      detail: 'The nightly run picks one. It has not today, so it can be picked now.',
      why: ['Today’s call weighs everything on this pile and picks the one move worth most. Without it, the order here is the app’s rules alone.'],
      right: 'Pick today’s call', left: 'later', needs: true,
    });
  }

  // What is lost by waiting: blocked work, an introduction, a post somebody may have answered.
  const opened = i.voices.filter((v) => !!i.opened[v.id]);
  const fresh = i.voices.filter((v) => !i.opened[v.id]);
  const answered = opened.map((v): DecideCard => {
    const at = since(i.opened[v.id], i);
    return {
      key: `d:a:${v.id}`, kind: 'answered', focus: 'people', eyebrow: 'You opened their post', title: v.title,
      detail: v.said && v.said !== v.title ? v.said : null,
      why: [
        `You opened it ${at ?? 'earlier'}. If they answered, how it ended counts toward your bet; a reply nobody logs counts as nothing.`,
        ...(betLine ? [betLine] : []),
      ],
      right: 'They answered', left: 'later', needs: true, voice: v, openedAt: i.opened[v.id],
    };
  });
  const warm = [...asked('question'), ...asked('intro'), ...answered, ...asked('fix'), ...asked('approve')];

  // What the bet turns on, then the plan's own step.
  const bet: DecideCard[] = [];
  // With no bet running the bet's step is the checkpoint already; while one runs it is asked here, because Path asked it and System only shows it.
  if (i.checkpoint.due && i.step?.kind !== 'checkpoint') {
    bet.push({
      key: `d:checkpoint:${i.checkpoint.ended}`, kind: 'checkpoint', focus: 'bets', eyebrow: 'Checkpoint', title: 'Pivot or persevere?',
      detail: `${plural(i.checkpoint.ended, 'bet')} ended since you last decided. Answered on System, against the parts it is about.`,
      why: ['A checkpoint comes due when bets end. Until it is answered, the next bet starts without what the last ones showed.'],
      right: 'Answer it', left: 'later', needs: true,
    });
  }
  if (i.step && !STEP_COVERED.has(i.step.kind)) {
    bet.push({
      // Keyed on what it says: a step that changed is a new card, not one already put off.
      key: `d:bet:${i.step.kind}:${i.step.title}`, kind: 'bet', focus: 'bets', eyebrow: 'Your bet', title: i.step.title, detail: i.step.why,
      why: [
        'The bet’s next step, read from its own rows: what it counts, how far it has got, and what is left to try.',
        ...(i.bet ? [`It tests: ${i.bet.belief}`] : []),
      ],
      right: i.step.primary.label, left: 'later', needs: true, step: i.step,
    });
  }
  // The plan's own step or a Move, while no call waits: the call already weighed them.
  const now = !i.callPending && i.now && (i.now.kind === 'step' || i.now.kind === 'move') ? i.now : null;
  if (now) {
    bet.push({
      key: `d:${now.key}`, kind: 'move', focus: 'bets', eyebrow: now.kind === 'step' ? 'Your plan' : 'Worth doing',
      title: now.title, detail: [now.why, now.size].filter(Boolean).join(' · ') || null,
      why: [now.kind === 'step'
        ? 'The first open step of your plan that fits today. Marked done here, it is ticked on the plan, which Claude reads too.'
        : 'Worked out overnight from your own rows, and no call is waiting ahead of it.'],
      right: now.kind === 'step' ? 'Done' : 'Open it', left: 'later', needs: true, now,
    });
  }

  // What waits on nothing: records to put right, money to name, ideas from a chat.
  const payers = (i.payers ?? []).slice(0, MAX_PAYER_CARDS).map((p): DecideCard => ({
    key: `d:pay:${p.key}`, kind: 'payer', focus: 'clients', eyebrow: 'Money came in', title: `Who paid you ${p.total}?`,
    detail: `${p.name} · ${p.count === 1 ? `paid ${dayLabel(p.last)}` : `${p.count} payments, the last ${dayLabel(p.last)}`}`,
    why: [
      'Your bank names them and you have not. A client’s payment counts as a sale on System; anyone else’s is money in and nothing more.',
      ...(p.looksLike ? [`The name reads like ${p.looksLike}, a business in your pile. Nothing is linked until you say so.`] : []),
    ],
    right: 'Name them', left: 'later', needs: true, payer: p,
  }));
  const later = [...asked('confirm'), ...payers, ...asked('proposal')];

  const rest: DecideCard[] = [];
  if (i.pivotLeft) {
    rest.push({
      key: 'd:pivot', kind: 'pivot', focus: 'bets', eyebrow: 'Since you pivoted who buys', title: 'Still looking for the buyers you left', detail: null,
      why: ['You changed who buys, and the searches and drafts for the old buyers still run. Setting them aside stops both.'],
      right: 'Set them aside', left: 'later', needs: true,
    });
  }
  const broke = i.broke ?? [];
  if (broke.length) {
    const [top, ...more] = broke;
    rest.push({
      // Keyed on what broke: a new failure is a new card, even on a day one was put off.
      key: `d:broke:${broke.map((b) => b.key).join('+')}`, kind: 'broke', focus: 'projects',
      eyebrow: broke.length === 1 ? 'Something broke' : `${broke.length} things broke`, title: top.title, detail: top.detail,
      why: [
        'Said here rather than over the pile: when something breaks, fewer people reach this deck, and a quiet deck is not a quiet week.',
        ...more.map((b) => `${b.title}: ${b.detail}`),
      ],
      right: top.fix === 'sources' ? 'Open sources' : top.fix === 'nightly' ? 'See the nightly run' : 'Read it again',
      left: 'later', needs: true, broke,
    });
  }
  if (i.cannotSearch && !i.noOffer) {
    rest.push({
      key: 'd:setup', kind: 'setup', focus: 'clients', eyebrow: 'Nothing can look for you yet', title: 'Choose who to look for',
      detail: 'Say which kinds of business you want, and where. The app finds real ones and writes the first message for each.',
      why: ['Nothing is searching, so nobody new reaches this pile until it is chosen.'],
      right: 'Choose', left: 'later', needs: true,
    });
  }

  // The posts the bet found: leads, after every decision and ahead of the businesses — warm before cold.
  const posts = fresh.map((v): DecideCard => {
    const posted = v.posted && i.today ? postedWords(v.posted, i.today) : null;
    return {
      key: `d:v:${v.id}`, kind: 'voice', focus: 'people', eyebrow: 'Someone said it', title: v.title,
      detail: v.said && v.said !== v.title ? v.said : null,
      why: [
        `Found by your bet’s search${posted ? `, posted ${posted}` : ''}: somebody describing the problem your bet is about, in their own words.`,
        ...(betLine ? [betLine] : []),
      ],
      right: 'Open their post', left: 'not_fit', needs: false, voice: v,
    };
  });

  return [...first, ...warm, ...bet, ...later, ...rest, ...posts];
}

/** Under this many answered calls a record says nothing, and is not said. */
export const CALL_RECORD_MIN = 3;

/**
 * How the calls before today's went, from the log: answered (done, turned down
 * or wrong — never "ignored", which is the app's inference and not an answer,
 * invariant 5), done, and done with the number it named moved the right way.
 */
export function callRecord(log: Array<Pick<Decision, 'id' | 'response' | 'verify'>>, todayId: string | null): { answered: number; did: number; moved: number } | null {
  const past = log.filter((x) => x.id !== todayId && (x.response === 'did' || x.response === 'rejected' || x.response === 'wrong'));
  if (past.length < CALL_RECORD_MIN) return null;
  const did = past.filter((x) => x.response === 'did');
  return { answered: past.length, did: did.length, moved: did.filter((x) => verdictOf(x) === 'worked').length };
}

/** How many wait on the person: the tab's badge. A post found is a lead, as a business is. */
export function decideCount(cards: DecideCard[]): number {
  return cards.filter((c) => c.needs).length;
}

/* ─── The people worth a message ──────────────────────────────────────────── */

/** Which chip a business, a draft or a find is under: a client (or paid work), or a person. */
export function leadFocus(c: Pick<DeckCard, 'kind' | 'group'>): Focus {
  if (c.kind !== 'find') return 'clients';
  return c.group === 'people' || c.group === 'signals' ? 'people' : 'clients';
}

/**
 * Why a business or a find is where it is in the pile, before the matcher's own
 * reasons (deck.ts deckCards' order): already said yes to, a follow-up on its
 * day, posted last night. Nothing the card does not carry.
 */
export function leadWhy(c: Pick<DeckCard, 'kind' | 'title' | 'fresh' | 'followUp' | 'createdAt' | 'source'>, today: string, timezone = 'UTC'): string[] {
  const when = (iso: string | null) => (iso ? postedWords(dayIn(iso, timezone) ?? '', today) : null);
  if (c.kind === 'draft' && c.followUp) return ['A follow-up: your first message has had its days and no answer came back.'];
  if (c.kind === 'draft') {
    const w = when(c.createdAt);
    return [`You said yes to ${c.title}${w ? ` ${w}` : ''}. The message is written and waits on you to send it.`];
  }
  if (c.kind === 'find' && c.fresh) return [`Found ${when(c.createdAt) ?? 'in the last day'}${c.source ? ` on ${c.source}` : ''}: a post like this is answered first by whoever answers first.`];
  if (c.fresh) return [`Found ${when(c.createdAt) ?? 'in the last day'}, and nobody has written to them yet.`];
  return [];
}

/* ─── What the screen says over the pile ──────────────────────────────────── */

/** "6 to go · 4 need you · 2 sent": the subheader, from the pile as it stands. */
export function deckLine(i: { left: number; needs: number; sent: number; later: number }): string {
  if (!i.left) return i.later ? `All done · ${i.later} put off for later` : 'All done for now';
  return [`${i.left} to go`, i.needs ? `${i.needs} need${i.needs === 1 ? 's' : ''} you` : null, i.sent ? `${i.sent} sent` : null].filter(Boolean).join(' · ');
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Oct". A fixed list rather than Intl, so the server and the phone print the same words. */
function dayLabel(d: string): string {
  const [, m, day] = d.slice(0, 10).split('-').map(Number);
  return m && day ? `on ${day} ${MONTH_ABBR[m - 1]}` : '';
}
