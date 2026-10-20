// src/lib/copilot/walk.ts
// Decide, walked through by voice: the app reads the card on top aloud, and the
// answer said back is the swipe. For a morning walk, a drive, a kitchen — the
// deck without the thumb.
//
// Why not a chat. The obvious build was a voice assistant to ask anything, and
// that is crowded ground the app has no edge on: a chat with the whole record
// is Claude's job (DIRECTION.md). What only this app has is the pile — rows
// that wait on the person — so the voice does the pile, card by card, with the
// same answers the buttons give and nothing else.
//
// What it is held to:
//
//   - The answers are the deck's: yes is the right swipe, no is the left, later
//     is to the back. A word that is none of them is asked again, never guessed
//     at.
//   - Today's call is graded by what is said to it. A swipe cannot say "I did
//     it" (decide.ts) because a gesture that cheap would grade it wrong; a
//     spoken "I did it" is deliberate, so it can.
//   - Nothing opens outside the app on a voice's say-so. A phone opens no page,
//     no WhatsApp and no clipboard without a tap, and it is right not to: those
//     cards say so and wait for the thumb (spokenRight).
//   - A message is never sent unheard. "Send" on a business reads the message
//     first and asks again (SwipeTab.tsx keeps who was read).
//
// Pure: no DOM, no speech API. copilot-core.test.ts covers the words and the
// parsing; SwipeTab.tsx and VoiceLog.tsx do the listening and the speaking.

import type { DecideCard, DecideKind } from './decide';
import type { StepGo } from './engine';
import type { Commitment } from './lab';

/** Said into the header's mic while on Decide: why the card on top is there, or to be walked through the pile. */
export type DeckIntent = 'why' | 'walk';

/** Lower case, no punctuation but apostrophes, one space: what the rules below read. */
export function heardWords(heard: string): string {
  return heard.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const WHY = /^(why|how come)\b|\bwhy (this|that|is (this|that|it)|now|it)\b/;
/** About the card and nothing else: "why this one?", "why is this here" — not "why did sales drop", which is the Ask sheet's. */
const WHY_CARD = /^(why|how come)( (is )?(this|that|it)( one)?( card)?( here| first| now| on top)?| now| here)?$/;
const WALK = /\b(walk me through|walk through|read (them|these|the cards|my cards|the pile|it all) (to me|out)|read me (the|my) (cards|pile)|go through (them|the cards|my cards|the pile|the deck))\b/;

export function deckIntent(heard: string): DeckIntent | null {
  const h = heardWords(heard);
  if (!h) return null;
  if (WALK.test(h)) return 'walk';
  if (WHY_CARD.test(h)) return 'why';
  return null;
}

export type CallAnswer = 'did' | 'rejected' | 'wrong';

export type WalkAnswer =
  /** The right swipe. */
  | { do: 'yes' }
  /** The left swipe: not for me, not a fit, or — on a decision — later. */
  | { do: 'no' }
  /** To the back of the pile, for this session. */
  | { do: 'later' }
  | { do: 'why' }
  | { do: 'again' }
  /** The message on a business, or what was said in a post. */
  | { do: 'read' }
  | { do: 'help' }
  | { do: 'stop' }
  /** Today's call, answered: only on the call's card. */
  | { do: 'call'; answer: CallAnswer }
  /** How a conversation from a post ended: only on a post already opened. */
  | { do: 'ended'; commitment: Commitment }
  | { do: 'unknown' };

const STOP = /^(stop|pause|enough|that'?s (it|enough|all)|i'?m done|done for (now|today)|quit|exit|end( it| the walk)?|finish)\b/;
const HELP = /^(help|what can i say|options|what are my options)\b/;
const AGAIN = /^(again|repeat|say (that|it) again|what|sorry|pardon|come again)\b/;
const READ = /^(read (it|the message|me the message|the post|what they said|it out)|what does it say|what did they (say|write))\b/;
const DID = /\b(i did( it)?|did it|done it|i'?ve done it|it'?s done|done)\b/;
const REJECTED = /\b(not doing (it|that)|won'?t do (it|that)|i'?m not doing|not going to do|no not doing)\b/;
const WRONG = /\b(wrong call|bad call|that'?s wrong|wrong one|it'?s wrong)\b/;
const NO_ANSWER = /\b(no (answer|reply|response)( yet)?|not yet|didn'?t (answer|reply)|haven'?t (answered|replied)|nothing yet|still waiting)\b/;
const MONEY = /\b(paid|pay|payment|money|bought|purchased?|deposit|sale|sold)\b/;
const INTRO = /\b(intro|introduc\w*|referr\w*|connect(ed|ing)? me)\b/;
const TIME = /\b(another call|second call|a call|call (back|again)|meeting|meet|demo|follow ?up|next week|booked?)\b/;
const NOTHING = /\b(nothing|no commitment|just (chatted|talked)|not interested|didn'?t (commit|want)|said no)\b/;
const NO = /^(no|nope|nah)\b|\bnot (a fit|for me|interested|my thing)\b|^(skip|pass|reject|bin it|drop it|set (it )?aside)\b/;
const LATER = /^(later|not now|next|move on|after|tomorrow|put (it )?off|come back( to it)?|leave it|maybe later)\b/;
const YES = /^(yes|yeah|yep|yup|sure|ok|okay|do it|go( ahead)?|send( it)?|open( it)?|answer( it)?|try( it)? again|approve|let'?s do it|hand it over|done|mark (it )?done|they answered|name them|choose|pick( it)?)\b/;

/**
 * What was said back to a card. Read in order: stopping and asking come first,
 * so "stop" is never a no; the call's three answers and a post's ending only on
 * their own cards; anything else that is not plainly an answer is asked again.
 */
export function walkAnswer(heard: string, kind: DecideKind | 'lead'): WalkAnswer {
  const h = heardWords(heard);
  if (!h) return { do: 'unknown' };
  if (STOP.test(h)) return { do: 'stop' };
  if (HELP.test(h)) return { do: 'help' };
  if (WHY.test(h)) return { do: 'why' };
  // Before again: "what does it say" starts with "what".
  if (READ.test(h)) return { do: 'read' };
  if (AGAIN.test(h)) return { do: 'again' };
  if (kind === 'call') {
    // "Wrong call" first: it has "call" in it, and "not doing it" has "doing it".
    if (WRONG.test(h)) return { do: 'call', answer: 'wrong' };
    if (REJECTED.test(h)) return { do: 'call', answer: 'rejected' };
    if (DID.test(h)) return { do: 'call', answer: 'did' };
  }
  if (kind === 'answered') {
    if (NO_ANSWER.test(h)) return { do: 'later' };
    // An ending said is the conversation logged; the money one first, since "paid for a call" was money.
    if (MONEY.test(h)) return { do: 'ended', commitment: 'money' };
    if (INTRO.test(h)) return { do: 'ended', commitment: 'intro' };
    if (TIME.test(h)) return { do: 'ended', commitment: 'time' };
    if (NOTHING.test(h)) return { do: 'ended', commitment: 'none' };
  }
  if (NO.test(h)) return { do: 'no' };
  if (LATER.test(h)) return { do: 'later' };
  if (YES.test(h)) return { do: 'yes' };
  return { do: 'unknown' };
}

/**
 * What a spoken yes can do on a card: run here, open one of the app's own sheets
 * (and the walk waits while it is open), need a tap — a page, an app or the
 * clipboard, which a phone opens only from a finger — or nothing, where the
 * card's own buttons answer it.
 */
export type SpokenRight = 'run' | 'sheet' | 'tap' | 'none';

function stepRight(g: StepGo): SpokenRight {
  switch (g.to) {
    case 'find': case 'draft': return 'run';
    case 'copylink': case 'post': return 'tap';
    case 'people': return 'none';
    default: return 'sheet';
  }
}

export function spokenRight(c: Pick<DecideCard, 'kind' | 'right' | 'ask' | 'step' | 'now' | 'broke'>): SpokenRight {
  if (!c.right) return 'none';
  switch (c.kind) {
    case 'call': case 'pivot': case 'brief': return 'run';
    case 'voice': return 'tap';
    case 'ask': return c.ask?.kind === 'fix' ? 'run' : 'sheet';
    case 'bet': return c.step ? stepRight(c.step.primary.go) : 'none';
    case 'move': return c.now?.kind === 'step' ? 'run' : 'sheet';
    case 'broke': return c.broke?.[0]?.fix === 'reload' ? 'run' : 'sheet';
    default: return 'sheet';
  }
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
/** A full stop where the words have none of their own: "Which supplier?" is not read "Which supplier?." */
export const ends = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
/** The first sentence of a detail, for the ear: the rest is on the screen. */
function firstSentence(s: string | null): string | null {
  const t = s?.trim();
  if (!t) return null;
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).replace(/\s*—.*$/, '').replace(/[.!?]$/, '');
}

/** What can be said back to a card, read after it. */
export function walkPrompt(c: Pick<DecideCard, 'kind' | 'right' | 'ask' | 'step' | 'now' | 'broke'>): string {
  if (c.kind === 'call') return `Say I did it, not doing it, or wrong call${c.right ? '. Yes hands it over' : ''}. Or later.`;
  if (c.kind === 'answered') return 'Did they answer? Say how it ended: nothing, another call, an intro, or money. Or say no answer.';
  if (c.kind === 'voice') return 'Say not a fit, later, or why. Opening their post takes a tap.';
  const r = spokenRight(c);
  if (r === 'tap') return `Say later or why. ${c.right} takes a tap.`;
  if (r === 'none') return 'Say later, or why.';
  return `Say yes to ${lowerFirst(c.right!)}, later, or why.`;
}

/** A decision, read aloud: what it is, the one line that says it, and what can be said back. */
export function decisionWords(c: DecideCard): string {
  if (c.kind === 'call') return `Today's call: ${ends(c.title || 'it is on the screen')} ${walkPrompt(c)}`;
  if (c.kind === 'voice' || c.kind === 'answered') {
    const where = c.voice?.where ? ` on ${c.voice.where}` : '';
    const said = c.detail ? ` They wrote: ${ends(c.detail)}` : '';
    return `${c.kind === 'voice' ? `Someone said it${where}` : `You opened their post${where}`}: ${ends(c.title)}${said} ${walkPrompt(c)}`;
  }
  const detail = firstSentence(c.detail);
  return `${ends(c.eyebrow)} ${ends(c.title)}${detail ? ` ${ends(detail)}` : ''} ${walkPrompt(c)}`;
}

/** A business, a draft or a find, read aloud: who, what, why it was picked. The message is read when asked for. */
export function leadWords(l: { title: string; sub: string | null; why: string[] }, canSend: boolean): string {
  const why = l.why[0] ? ` ${ends(l.why[0])}` : '';
  return `${ends(`${l.title}${l.sub ? `, ${l.sub}` : ''}`)}${why} Say read it${canSend ? ', send' : ''}, skip, or later.`;
}

/** Why a card is here, as said: the card's own lines, nothing added. */
export function whyWords(lines: string[]): string {
  return lines.length ? lines.map(ends).join(' ') : 'It is here because it waits on you.';
}

export const WALK_HELP = 'You can say yes, no, later, why, read it, again, or stop.';
