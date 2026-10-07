// The one move at the top of Proof, said as a mission: the action, why now,
// what is ready for it, and what counts as done.
//
// Proof opened on the verdict: five parts of a business, each with a state, and
// a weak one named. True, and it asked a beginner to read a model of a business
// before it told them what to do. Two critiques of the tab said the same thing
// from outside: lead with the next achievable move, and keep the model under it
// as the map. So the move comes first, and every word of it is read off what
// Proof already works out — the weak part, the test running, the checkpoint,
// the plays — never written by a model, and never from a fixed list.
//
// Deliberately not "Mission 3 of 12", chapters or locked stages. A business does
// not go through its parts in order, and a curriculum would hold back the person
// who already has a customer from the part they need. Nor points, streaks or a
// score: DIRECTION.md declined a score on an idea, and a missed day reads as
// failing to somebody already anxious. The milestones that matter are rows: a
// conversation logged, a payment asked for, a payment.
//
// "I'm stuck" changes the mission rather than cheering at it: each reason
// swaps in the move that answers it — the words written first, people who
// already know you, a place they gather, delivering by hand, the smallest
// thing that still moves a count.
//
// Pure: no DB import.

import type { AssetKind } from './assets';
import { LINK_LABEL, type BusinessLink, type LinkKey, type LinkMove } from './business';
import { PLAY_BY_KEY, metricWords, passLine, playFor, playLine, playOf, playsFor, spanWords, type BetView, type Play } from './lab';
import type { BetNextGo } from './proof';
import type { FoundBy } from './types';

/** Each part of the business as a step toward a sale, in a beginner's words. */
export const STAGE: Record<LinkKey, string> = {
  who: 'Find who buys',
  reach: 'Get in front of them',
  close: 'Get a yes',
  pay: 'Get paid',
  deliver: 'Deliver it',
};

export type MissionKind = 'checkpoint' | 'test' | 'kept' | 'play' | 'move' | 'stuck';

/** Where the mission's button goes. The tab maps each to the sheet or tab that does it. */
export type MissionGo =
  | { checkpoint: true }
  | { next: BetNextGo; bet: string }
  | { bet: { play?: string; shelf?: string } }
  | { move: LinkMove }
  | { asset: AssetKind }
  | { sheet: 'talk' }
  | { tab: 'swipe' };

/**
 * Something already there for the mission, or one tap from being there. An asset
 * is had when it was made for the test running (`made`), or is itself the thing
 * asked for and kept (`kept`: a script, for the script). Otherwise one of its kind
 * kept is a place to start (`base`), never the thing done.
 */
export type MissionReady =
  | { kind: 'asset'; asset: AssetKind; label: string; have: 'made' | 'kept' | null; base: boolean }
  | { kind: 'drafts'; n: number }
  | { kind: 'intro'; talk: string; who: string | null };

export interface Mission {
  kind: MissionKind;
  /** The step toward a sale it is on, when it is on one. */
  stage: string | null;
  part: LinkKey | null;
  /** The one action. */
  title: string;
  /** How to do it, where there is more to say than the title: a play's own instructions. */
  how: string | null;
  /** Why this, now — from the rows. */
  why: string;
  /** How long it runs, where the app knows: a test's length. Never a guess at minutes. */
  size: string | null;
  /** What counts as done: a count the rows will show. */
  done: string;
  /** The count toward it so far, when there is one. */
  progress: { n: number; of: number } | null;
  ready: MissionReady[];
  cta: string;
  go: MissionGo;
  /** The play it starts or runs, so the list of plays under it does not offer it twice. */
  play: string | null;
}

export interface MissionInput {
  offerSet: boolean;
  links: BusinessLink[];
  weak: LinkKey | null;
  /** The test running, with where its next count happens (proof.ts betNext). */
  current: { view: BetView; next: { go: BetNextGo; label: string } } | null;
  checkpoint: { due: boolean; ended: number };
  /** Tests the person kept for later, newest first. */
  shelf: Array<{ id: string; belief: string; part: LinkKey }>;
  foundBy: FoundBy | null;
  priceLabel: string | null;
  /** Drafts written and waiting to be sent. */
  queue: number;
  /** The asset kinds the business keeps. */
  assets: AssetKind[];
  /** The asset kinds with a version made for the test running (proof.ts betWork). */
  made: AssetKind[];
  /** Introductions offered and not followed up, oldest first. */
  intros: Array<{ talk: string; who: string | null }>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The action that moves a running test's count, said as one — and as the button under it does it (proof.ts betNext). */
function testTitle(v: BetView, i: Pick<MissionInput, 'queue' | 'priceLabel' | 'foundBy'>): string {
  const b = v.bet;
  const { queue, priceLabel } = i;
  switch (b.metric) {
    case 'sent': return queue ? `Send your ${plural(queue, 'waiting draft')}` : 'Write and send the next messages';
    // Swipe is where the button goes: replies come from sends.
    case 'replied': return 'Send the next messages, and mark who replies';
    // Where buyers walk in or are introduced there is no reply to turn.
    case 'meetings': return i.foundBy === 'outreach' ? 'Turn a reply into a meeting' : 'Book a meeting with someone who could buy';
    case 'paid': return 'Ask for payment';
    case 'paid_at_price': return `Ask for ${b.priceLabel ?? priceLabel ?? 'your price'}`;
    case 'talks': return 'Have one conversation about the problem';
    case 'committed': return 'Ask for a next step: a call, an intro or money';
    case 'handed': return 'Hand one step of delivery over';
    case 'logged': return `Log the ${b.unit ?? 'count'} as they come`;
  }
}

/** A play's or a test's prep, as far as the mission needs it: what to make, and whether it is an asset. */
interface Prepped { prep?: { label: string; asset?: AssetKind } | null; metric: Play['metric']; tries?: Play['tries'] | null }

/**
 * What is ready for a play or a test: the asset its prep makes, drafts waiting where it counts sends, an intro waiting
 * where it is about people. Drafts only where sends are what it counts: offered beside "a channel you have not tried",
 * the queue from the channel that stalled read as the way to do it. A prep is had only when it was made for the test
 * running: every business keeps an offer, and "The offer, rewritten" read "In your assets" before anything was rewritten.
 */
function readyFor(p: Prepped | null, part: LinkKey | null, i: MissionInput, running: boolean): MissionReady[] {
  const out: MissionReady[] = [];
  const asset = p?.prep?.asset ?? null;
  if (asset && p?.prep) out.push({ kind: 'asset', asset, label: p.prep.label, have: running && i.made.includes(asset) ? 'made' : null, base: i.assets.includes(asset) });
  const sends = p && (p.metric === 'sent' || p.metric === 'replied' || p.tries?.metric === 'sent');
  if (i.queue && sends) out.push({ kind: 'drafts', n: i.queue });
  if (i.intros.length && (part === 'who' || part === 'reach' || part === 'close')) out.push({ kind: 'intro', talk: i.intros[0].talk, who: i.intros[0].who });
  return out;
}

/** A play as the mission: start it as a test, with its line as what counts. */
export function playMission(p: Play, why: string, i: MissionInput, kind: MissionKind = 'play'): Mission {
  return {
    kind, stage: STAGE[p.part], part: p.part,
    title: p.label, how: p.how, why,
    size: `Runs ${spanWords(p.days)}`,
    done: `Done when: ${playLine(p, i.priceLabel)}.`,
    progress: null,
    ready: readyFor(p, p.part, i, false),
    cta: 'Start this test',
    go: { bet: { play: p.key } },
    play: p.key,
  };
}

/**
 * The one move. In order: the checkpoint when it is due, since the next test
 * waits on the decision; the test running, by the action that moves its count;
 * the weak part's own first step, while nothing on it is said or tried; a test
 * the person kept for the weak part; the play for it; its first move. Null
 * without an offer — Proof's first card asks for it, and a mission saying the
 * same would say it twice — or with nothing left to move.
 */
export function missionOf(i: MissionInput): Mission | null {
  if (!i.offerSet) return null;

  if (i.checkpoint.due) {
    return {
      kind: 'checkpoint', stage: null, part: null,
      title: 'Decide: keep going, or change one part',
      how: null,
      why: `${plural(i.checkpoint.ended, 'test')} ended since the last decision. Deciding first keeps the next test honest.`,
      size: null, done: 'Done when you pick one.', progress: null, ready: [],
      cta: 'Decide', go: { checkpoint: true }, play: null,
    };
  }

  if (i.current) {
    const { view: v, next } = i.current;
    const b = v.bet;
    const play = b.play ? PLAY_BY_KEY.get(b.play) ?? null : null;
    const left = Math.max(0, b.days - v.day);
    return {
      kind: 'test', stage: STAGE[b.part], part: b.part,
      title: testTitle(v, i),
      how: playOf(b)?.how ?? null,
      why: `Day ${v.day} of ${b.days} on “${b.belief}”${left ? `, ${plural(left, 'day')} left` : ', the last day'}.`,
      size: null,
      done: `Done when: ${passLine(b, v.last)}.`,
      progress: { n: v.result, of: b.target },
      // The play's prep, or the prep the model's idea came with.
      ready: readyFor({ prep: play?.prep ?? b.idea?.prep ?? null, metric: b.metric, tries: b.tries }, b.part, i, true),
      cta: next.label,
      go: { next: next.go, bet: b.id },
      play: b.play,
    };
  }

  const weak = i.weak;
  if (!weak) return null;
  const link = i.links.find((l) => l.key === weak) ?? null;
  const why = link ? `${LINK_LABEL[weak]} is the weak part. ${link.why}` : `${LINK_LABEL[weak]} is the weak part.`;

  // Nothing said or nothing tried has a step before any test: a test of a price nobody set counts nothing, and a new
  // channel is not the move while the drafts for this one sit unsent. Say it, send it, log it — then test it.
  const first = link && (link.state === 'missing' || link.state === 'untested') ? link.moves.find(isOwnStep) ?? null : null;
  if (first) return moveMission(first, weak, why);

  // What the person wrote down to run next beats a play from a book.
  const kept = i.shelf.find((e) => e.part === weak);
  if (kept) {
    return {
      kind: 'kept', stage: STAGE[weak], part: weak,
      title: `Start the test you kept: “${kept.belief}”`,
      how: null, why, size: null,
      done: 'Done when it is running. What counts is the line you wrote with it.',
      progress: null, ready: [], cta: 'Start it', go: { bet: { shelf: kept.id } }, play: null,
    };
  }

  // On getting paid, the test that needs money first: a promise or a second call is not a sale.
  const plays = playsFor(weak, i.foundBy);
  const play = (weak === 'pay' ? plays.find((p) => p.metric === 'paid' || p.metric === 'paid_at_price') : null) ?? plays[0] ?? null;
  if (play) return playMission(play, why, i);

  const move = link?.moves[0] ?? null;
  return move ? moveMission(move, weak, why) : null;
}

/** A step that is the person's own and opens something: not a test (a play says more) and not a model's draft. */
const isOwnStep = (m: LinkMove) => m.by === 'you' && !!m.go && !('bet' in m.go);

/** What counts as done for a part's move: what the screen it opens shows when it is. */
function doneOf(m: LinkMove): string {
  const g = m.go;
  if (!g) return m.by === 'ai' ? 'Done when your agent is back and you have read it.' : 'Done when Claude has answered it.';
  if ('sheet' in g) return g.sheet === 'talk' ? 'Done when one is logged.' : 'Done when it is saved.';
  if ('asset' in g) return 'Done when it is kept in your assets.';
  if ('bet' in g) return 'Done when a test is running.';
  return 'Done when the first one is sent.';
}

function moveMission(move: LinkMove, part: LinkKey, why: string): Mission {
  return {
    kind: 'move', stage: STAGE[part], part,
    title: move.label, how: null, why, size: null, done: doneOf(move),
    progress: null, ready: [], cta: move.label, go: { move }, play: null,
  };
}

/* ─── I'm stuck ───────────────────────────────────────────────────────────── */

export const STUCK = ['words', 'nervous', 'reach', 'deliver', 'time'] as const;
export type Stuck = (typeof STUCK)[number];

export const STUCK_LABEL: Record<Stuck, string> = {
  words: 'I don’t know what to say',
  nervous: 'I’m nervous about it',
  reach: 'I can’t reach these people',
  deliver: 'I’m not sure I can deliver',
  time: 'I only have five minutes',
};

/**
 * The move that answers a reason for being stuck. Each changes what to do, not
 * how to feel about it: nervous is people who already know you, not a pep
 * talk; can't reach them is a place they gather, not more of the same list;
 * not sure you can deliver is delivering by hand once, not more selling.
 */
export function stuckMission(reason: Stuck, from: Mission, i: MissionInput): Mission {
  const fromPlay = from.play ? PLAY_BY_KEY.get(from.play) ?? null : null;
  // The first play that answers the reason, fits how buyers find this business and is not the move already on screen.
  // Each carries its own why: the second answer to "nervous" is a different reason it is easier, not the first one again.
  // A list with two plays that fit any business always has one left, since only one can be on screen.
  const swap = (options: Array<[key: string, why: string]>): Mission | null => {
    const fits = (p: Play) => p.fits === 'any' || i.foundBy == null || p.fits.includes(i.foundBy);
    const hit = options.find(([k]) => k !== from.play && fits(PLAY_BY_KEY.get(k)!));
    return hit ? playMission(playFor(PLAY_BY_KEY.get(hit[0])!, i.foundBy), hit[1], i, 'stuck') : null;
  };
  // Something to write before the move, as its own mission: open it when it is had, write it when it is not.
  const write = (asset: AssetKind, label: string, have: 'made' | 'kept' | null, why: string): Mission => {
    return {
      kind: 'stuck', stage: from.stage, part: from.part,
      // The labels are the plays' own ("The offer, rewritten"), so they follow a colon rather than "your".
      title: have ? `Read it first: ${label.toLowerCase()}` : `Get the words written first: ${label.toLowerCase()}`,
      how: null, why, size: null,
      done: have ? 'Done when you have read it through once.' : 'Done when it is kept in your assets.',
      progress: null,
      ready: [{ kind: 'asset', asset, label, have, base: i.assets.includes(asset) }],
      cta: have ? 'Open it' : 'Write it', go: { asset }, play: null,
    };
  };
  switch (reason) {
    case 'words': {
      // The words the move has a prep for — had once made for the test running — else a script, had when one is kept.
      const why = 'It is easier to say with the words in front of you. Then come back to the move.';
      const asset = fromPlay?.prep?.asset ?? null;
      if (fromPlay?.prep && asset) return write(asset, fromPlay.prep.label, from.kind === 'test' && i.made.includes(asset) ? 'made' : null, why);
      return write('script', 'A sales script', i.assets.includes('script') ? 'kept' : null, why);
    }
    case 'nervous':
      return swap([
        ['warm-first', 'People who already know you are the easiest first conversations, and they know who has the problem.'],
        ['mom-test', 'A conversation about their problem has nothing in it to say no to. You are asking, not selling.'],
      ])!;
    case 'reach':
      return swap([
        ['bullseye', 'If you can’t reach them where you are looking, go where they already gather.'],
        ['one-event', 'If you can’t reach them where you are looking, go to a room they are already in.'],
        ['warm-first', 'If strangers do not answer yet, start with people who already know you. They know who has the problem.'],
      ])!;
    case 'deliver':
      // Already delivering by hand: the doubt is answered on paper first, every step written down before the next client.
      return swap([['concierge', 'Selling before you can deliver is the worry. Delivering by hand once, and writing each step down, answers it.']])
        ?? write('workflow', 'The steps', i.assets.includes('workflow') ? 'kept' : null, 'Every step on one page shows what you can already do by hand and what you cannot yet.');
    case 'time':
      return i.queue
        ? {
          kind: 'stuck', stage: from.stage, part: from.part,
          title: 'Send one waiting draft', how: null,
          why: `${plural(i.queue, 'draft is', 'drafts are')} already written. One send is five minutes and still counts.`,
          size: null, done: 'Done when one is sent.', progress: null, ready: [{ kind: 'drafts', n: i.queue }],
          cta: 'Open Swipe', go: { tab: 'swipe' }, play: null,
        }
        : {
          kind: 'stuck', stage: from.stage, part: from.part,
          title: 'Log one conversation you already had', how: null,
          // Dated the day it happened, as every count reads it (lab.ts talkCounts): logging it today does not move a test that began after it.
          why: 'Five minutes is enough to log a conversation you had and never wrote down. It counts on the day it happened.',
          size: null, done: 'Done when one is logged.', progress: null, ready: [],
          cta: 'Log a conversation', go: { sheet: 'talk' }, play: null,
        };
  }
}

/** A count said with its unit, for a mission's progress line: "1 of 3 payments". */
export function progressLine(m: Mission, v: BetView | null): string | null {
  if (!m.progress || !v) return null;
  return `${m.progress.n} of ${m.progress.of} ${metricWords(v.bet.metric, m.progress.of, v.bet.priceLabel, v.bet.unit)}`;
}
