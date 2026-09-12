// src/lib/copilot/silence.ts
// The messages that got nothing back, laid out so the pattern is visible.
//
// Pure — no DB import — so copilot-core.test.ts covers every rule about what
// this is allowed to claim. The read lives in store.ts.
//
// Why it exists. "Note why the 3 sent openers got silence" was a row in the old
// "Also today" list: a real, useful instruction with nothing attached, which is
// the definition of advice. The app was holding the three messages the whole
// time. A Move carries them.
//
// What this will NOT do is tell you why. Nothing here knows why a stranger did
// not reply, and a confident sentence about it would be invention — the thing
// invariant 2 exists to stop. It reports traits anyone can check against the
// text printed underneath, and where the sample is too thin to separate two
// groups it says so instead of drawing a rule from four messages.

import { NO_REPLY_AFTER_DAYS } from './conversations';

/** Below this there is no pattern to look at, only a bad week. */
export const MIN_SILENT = 3;
/**
 * Below this on EITHER side, no trait is named as a difference.
 *
 * The same floor the agent prompt already states for this exact comparison —
 * "with fewer than three examples either side, say the sample is too small
 * instead of drawing a rule from it". Stated twice because it is the rule most
 * likely to be quietly dropped in a rewrite.
 */
export const MIN_PER_SIDE = 3;
/** Messages shown per side in the artifact. More is a transcript, not a pattern. */
export const MAX_SHOWN = 3;

export interface SentMessage {
  text: string;
  /** The business it went to, when the execution was linked to one. */
  business: string | null;
  sentAt: string;
  replied: boolean;
}

/**
 * Things about a message anybody can verify by looking at it, printed next to
 * the message itself. Nothing here is a judgement — "too long" is an opinion,
 * "41 words" is a fact, and the reader decides which one it is.
 */
export interface Traits {
  words: number;
  /** Asks something. A message with no question has not invited a reply. */
  asks: boolean;
  /** Uses the business's own name, rather than opening at nobody. */
  namesThem: boolean;
  hasLink: boolean;
}

const CURRENCY = /[$£€₱¥]/;

export function traitsOf(m: SentMessage): Traits {
  const text = m.text ?? '';
  const name = (m.business ?? '').trim();
  // First word only: "Hi Sea Nymph Resort" and "Hi there" differ in the one way
  // that matters, and a name buried in the fourth sentence is not an opening.
  const firstWord = name.split(/\s+/)[0] ?? '';
  return {
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    asks: text.includes('?'),
    namesThem: firstWord.length > 2 && new RegExp(`\\b${firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
    hasLink: /https?:\/\//i.test(text),
  };
}

/** Mean, rounded. Empty is zero rather than NaN, which renders as "NaN words". */
const mean = (ns: number[]): number => (ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0);
const share = (bs: boolean[]): number => (bs.length ? bs.filter(Boolean).length / bs.length : 0);

export interface SilenceRead {
  replied: SentMessage[];
  silent: SentMessage[];
  /**
   * Differences worth naming, each one checkable against the text below it.
   * Empty when either side is under MIN_PER_SIDE — that is not a failure, it is
   * the honest answer, and the caller says so out loud.
   */
  differences: string[];
  /** True when there is a real comparison to make. */
  comparable: boolean;
}

/**
 * Split what was sent, and name only the differences that are actually there.
 *
 * A trait is reported only when the two groups genuinely diverge on it: every
 * answered message asking a question and no silent one doing so is a finding;
 * both groups asking questions is not, and printing it anyway is how a "pattern"
 * gets read into noise.
 */
export function readSilence(messages: SentMessage[]): SilenceRead {
  const replied = messages.filter((m) => m.replied);
  const silent = messages.filter((m) => !m.replied);
  const comparable = replied.length >= MIN_PER_SIDE && silent.length >= MIN_PER_SIDE;
  if (!comparable) return { replied, silent, differences: [], comparable };

  const rt = replied.map(traitsOf);
  const st = silent.map(traitsOf);
  const differences: string[] = [];

  const rWords = mean(rt.map((t) => t.words));
  const sWords = mean(st.map((t) => t.words));
  // A fifth longer or shorter. Below that it is two samples of one habit.
  if (rWords > 0 && Math.abs(sWords - rWords) / rWords >= 0.2) {
    differences.push(`The answered ones run ${rWords} words, the silent ones ${sWords}.`);
  }

  const pairs: Array<[keyof Traits, string]> = [
    ['asks', 'end with a question'],
    ['namesThem', 'name the business in the message'],
    ['hasLink', 'include a link'],
  ];
  for (const [key, phrase] of pairs) {
    const r = share(rt.map((t) => t[key] as boolean));
    const s = share(st.map((t) => t[key] as boolean));
    // Two thirds against one third: enough separation to be worth a sentence
    // when each side is only three messages deep.
    if (r >= 0.67 && s <= 0.33) differences.push(`The answered ones ${phrase}; the silent ones mostly do not.`);
    else if (s >= 0.67 && r <= 0.33) differences.push(`The silent ones ${phrase}; the answered ones mostly do not.`);
  }
  return { replied, silent, differences, comparable };
}

const line = (m: SentMessage): string => {
  const t = traitsOf(m);
  const marks = [
    `${t.words} words`,
    t.asks ? 'asks something' : 'no question',
    t.namesThem ? 'names them' : 'opens at nobody',
    t.hasLink ? 'has a link' : null,
  ].filter(Boolean).join(' · ');
  return `${m.business ? `To ${m.business}` : 'To a business with no name on file'} — ${m.sentAt.slice(0, 10)}\n${marks}\n"${m.text}"`;
};

/**
 * The artifact: the messages themselves, both groups, with the checkable facts
 * above each one. This is the whole point — the old row told somebody to go and
 * think about three messages it was already holding.
 */
export function silenceArtifact(read: SilenceRead): string {
  const parts: string[] = [];
  if (read.replied.length) {
    parts.push(`ANSWERED (${read.replied.length})`, read.replied.slice(0, MAX_SHOWN).map(line).join('\n\n'));
  }
  parts.push(
    `GOT NOTHING BACK (${read.silent.length}) — sent more than ${NO_REPLY_AFTER_DAYS} days ago`,
    read.silent.slice(0, MAX_SHOWN).map(line).join('\n\n'),
  );
  if (read.differences.length) {
    parts.push('WHAT DIFFERS', read.differences.map((d) => `· ${d}`).join('\n'));
  } else if (!read.replied.length) {
    parts.push('WHAT DIFFERS', 'Nothing to compare against. None of these were answered, so there is no version that worked to hold them up to.');
  } else {
    parts.push('WHAT DIFFERS', `Too few on one side to call it. ${MIN_PER_SIDE} answered and ${MIN_PER_SIDE} silent is the least that can separate a habit from a coincidence.`);
  }
  return parts.join('\n\n');
}
