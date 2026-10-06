// src/lib/copilot/reading.ts
// A bet's first reading: the funnel's counts since it began, on the card from day
// one.
//
// Why. A bet whose line is a sale shows an empty bar until a sale lands, which
// for "2 sales at your $150 by 18 Oct" is most of its life. A chat answers in
// seconds and a test that says nothing for thirteen days loses the person it is
// meant to be better for: the first bet in its owner's record was called off the
// next day. Nothing was wrong with it. Every step on the way to the sale had
// already been counted, and the card did not show them. So the card shows the
// funnel up to the count the bet is decided on — sent, replied, meetings,
// payments, sales at the price — each as counted since the bet began, with the
// one the bet is decided on marked as the line.
//
// What it is not: a second verdict. The rungs are counted by `countIn`, the
// function the verdict uses, to the day the verdict reads to, so the count a bet
// is decided on is the same number in both places (a suite holds that in every
// state). A rung with a count of its own never moves a bet toward its line, and
// nothing here estimates anything: no pace, no "on track", no percentage — a
// number is shown only because a row was counted (invariant 2).
//
// Pure: no DB import.

import { dayWords, metricWords, metricsFor, type Bet, type BetView, type LabMetric } from './lab';
import type { FoundBy } from './types';

export type RungState = 'done' | 'next' | 'later';

export interface Rung {
  metric: LabMetric;
  n: number;
  /** "messages sent", "reply", "sales at your $150": the noun for n, with the bet's own price or word. For a sentence. */
  words: string;
  /** "sent", "reply", "at $150": the same, short enough to sit beside its number in a row of five on a phone. */
  label: string;
  /** The count the bet is decided on. */
  line: boolean;
  /** The line to reach, on the rung that is the line. */
  target: number | null;
  /** What the bet planned to take of this (its `tries`), where this is that count. */
  planned: number | null;
  /** Counted at least once, the step the funnel has not reached yet, or further on than that. */
  state: RungState;
}

/** The funnel up to and including each count a bet can be decided on, in the order it happens. */
const LADDER: Record<LabMetric, LabMetric[]> = {
  sent: ['sent'],
  replied: ['sent', 'replied'],
  meetings: ['sent', 'replied', 'meetings'],
  paid: ['sent', 'replied', 'meetings', 'paid'],
  paid_at_price: ['sent', 'replied', 'meetings', 'paid', 'paid_at_price'],
  talks: ['talks'],
  committed: ['talks', 'committed'],
  handed: ['handed'],
  logged: ['logged'],
};

/**
 * Short enough to wrap in a row rather than break in a word: the card has a phone's
 * width for up to five of them, and "messages sent" is not one word. Still grammar
 * for its number — "1 reply", "3 replies" — because a chip is read as a phrase.
 */
const LABEL: Record<LabMetric, (n: number, bet: Pick<Bet, 'priceLabel' | 'unit'>) => string> = {
  sent: () => 'sent',
  replied: (n) => (n === 1 ? 'reply' : 'replies'),
  meetings: (n) => (n === 1 ? 'meeting' : 'meetings'),
  paid: () => 'paid',
  paid_at_price: (_, b) => `at ${b.priceLabel ?? 'your price'}`,
  talks: (n) => (n === 1 ? 'talk' : 'talks'),
  committed: () => 'committed',
  handed: () => 'finished',
  logged: (n, b) => metricWords('logged', n, null, b.unit),
};

/**
 * The rungs a bet's card shows, from the counts since it began. Sends and replies
 * are left out of a business whose buyers do not come through them, as the bet
 * sheet leaves them out of what it offers. One rung is no ladder — a bet decided
 * on sends has nothing before the count it is decided on — so the card shows
 * none, and a payload from before readings has none to show.
 */
export function rungsOf(view: Pick<BetView, 'bet' | 'reading'>, found: FoundBy | null): Rung[] {
  const { bet, reading } = view;
  if (!reading) return [];
  const allowed = new Set(metricsFor(found));
  const steps = LADDER[bet.metric].filter((m) => m === bet.metric || allowed.has(m));
  // What it takes is a step as well, where the funnel has no room for it: a plan counted in conversations.
  if (bet.tries && !steps.includes(bet.tries.metric) && allowed.has(bet.tries.metric)) steps.unshift(bet.tries.metric);
  let next = false;
  return steps.map((metric) => {
    const n = reading[metric] ?? 0;
    const state: RungState = n > 0 ? 'done' : !next ? 'next' : 'later';
    if (n === 0) next = true;
    return {
      metric, n, state,
      words: metricWords(metric, n, bet.priceLabel, bet.unit),
      label: LABEL[metric](n, bet),
      line: metric === bet.metric,
      target: metric === bet.metric ? bet.target : null,
      planned: bet.tries && bet.tries.metric === metric ? bet.tries.planned : null,
    };
  });
}

/**
 * The reading in a line, for a screen reader and for Claude: "Counted since 5 Oct:
 * 11 messages sent, 1 reply, 0 meetings." Nothing when there is no ladder.
 */
export function readingLine(view: Pick<BetView, 'bet' | 'reading'>, found: FoundBy | null): string | null {
  const rungs = rungsOf(view, found);
  if (rungs.length < 2) return null;
  return `Counted since ${dayWords(view.bet.start)}: ${rungs.map((r) => `${r.n} ${r.words}`).join(', ')}.`;
}
