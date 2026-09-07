// src/lib/copilot/decision.ts
// The one call, the trade-off it implies, and whether it turned out to be right.
//
// Everything here is pure. The agent proposes a decision, the server snapshots
// the metric it named, and a sweep a few days later reads the same metric back.
// Grading is against the ledger, never against the model's opinion of itself —
// that is the whole point of keeping the record.

import type { Metrics } from './types';

export type DecisionResponse = 'pending' | 'did' | 'rejected' | 'ignored' | 'wrong';
export type DecisionConfidence = 'high' | 'low';
/** The one number a decision expects to move. 'none' is honest for calls that
 *  change nothing measurable this week (setting targeting, writing a note). */
export type DecisionMetric = 'sent' | 'replies' | 'meetings' | 'won' | 'won_amount' | 'none';
export const DECISION_METRICS: readonly DecisionMetric[] = ['sent', 'replies', 'meetings', 'won', 'won_amount', 'none'];
export const DECISION_RESPONSES: readonly DecisionResponse[] = ['pending', 'did', 'rejected', 'ignored', 'wrong'];

/** Long enough for a reply to arrive, short enough to still be about this call. */
export const VERIFY_AFTER_DAYS = 3;
/** Under this many recorded calls there is nothing honest to conclude. */
export const MIN_REVIEW = 4;
/** A topic has to recur before "you keep doing this" is a pattern and not noise. */
export const MIN_TOPIC_RUN = 3;

export interface Change { what: string; from: string; to: string }

/** What the agent emits. Becomes a Decision once persisted with a baseline. */
export interface DecisionDraft {
  headline: string;
  because: string[];
  instead_of?: string;
  confidence?: DecisionConfidence;
  missing?: string;
  topic?: string;
  verify_metric?: DecisionMetric;
}

export interface DontDraft { title: string; why: string }

export interface Decision {
  id: string;
  for_date: string;
  headline: string;
  because: string[];
  instead_of: string | null;
  confidence: DecisionConfidence;
  missing: string | null;
  topic: string | null;
  dont: DontDraft | null;
  changed: Change[];
  response: DecisionResponse;
  verify: { metric: DecisionMetric; baseline: number; after: number | null; verifiedAt: string | null };
}

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

/** The numbers worth waking someone up about. Snapshotted with every call. */
export interface DecisionSnapshot {
  sent: number;
  replies: number;
  meetings: number;
  won: number;
  won_amount: number;
  queue: number;
  sourced: number;
  runway_months: number | null;
}

export function snapshotOf(m: Metrics): DecisionSnapshot {
  return {
    sent: m.sent, replies: m.replies, meetings: m.meetings, won: m.won, won_amount: m.won_amount,
    queue: m.awaiting_approval, sourced: m.pipeline.sourced, runway_months: m.runway_months,
  };
}

export function metricValue(m: Metrics, k: DecisionMetric): number {
  switch (k) {
    case 'sent': return m.sent;
    case 'replies': return m.replies;
    case 'meetings': return m.meetings;
    case 'won': return m.won;
    case 'won_amount': return m.won_amount;
    default: return 0;
  }
}

/** Constraints first, then outcomes, then effort, then supply: the order a
 *  person actually needs them in when deciding what to do with a morning. */
const WATCHED: Array<{ key: keyof DecisionSnapshot; label: string; fmt: (n: number) => string }> = [
  { key: 'runway_months', label: 'Runway', fmt: (n) => `${n} mo` },
  { key: 'won_amount', label: 'Won', fmt: (n) => n.toLocaleString() },
  { key: 'meetings', label: 'Meetings', fmt: String },
  { key: 'replies', label: 'Replies', fmt: String },
  { key: 'sent', label: 'Sent', fmt: String },
  { key: 'queue', label: 'Drafts waiting', fmt: String },
  { key: 'sourced', label: 'Matches', fmt: String },
];

export const MAX_CHANGES = 4;

/** Only what moved, most decision-relevant first. No previous snapshot means
 *  this is the first brief, and "everything is new" is not a change. */
export function changesSince(prev: DecisionSnapshot | null, now: DecisionSnapshot): Change[] {
  if (!prev) return [];
  const out: Change[] = [];
  for (const w of WATCHED) {
    const a = prev[w.key];
    const b = now[w.key];
    if (a == null || b == null || a === b) continue;
    out.push({ what: w.label, from: w.fmt(a as number), to: w.fmt(b as number) });
    if (out.length === MAX_CHANGES) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Was it right?
// ---------------------------------------------------------------------------

export type DecisionVerdict = 'open' | 'measuring' | 'worked' | 'no_movement' | 'done' | 'rejected' | 'ignored' | 'wrong';

export const VERDICT_LABEL: Record<DecisionVerdict, string> = {
  open: 'Waiting on you',
  measuring: 'Measuring',
  worked: 'Worked',
  no_movement: 'Nothing moved',
  done: 'Done',
  rejected: 'You said no',
  ignored: 'Ignored',
  wrong: 'Wrong call',
};

/** How far the named metric moved since the call. Null until it is read back. */
export function movedBy(d: Pick<Decision, 'verify'>): number | null {
  const { after, baseline } = d.verify;
  return after == null ? null : after - baseline;
}

export function verdictOf(d: Pick<Decision, 'response' | 'verify'>): DecisionVerdict {
  if (d.response === 'wrong') return 'wrong';
  if (d.response === 'rejected') return 'rejected';
  if (d.response === 'ignored') return 'ignored';
  if (d.response === 'pending') return 'open';
  // Did it. Whether it worked is the ledger's call, not the user's.
  if (d.verify.metric === 'none') return 'done';
  const moved = movedBy(d);
  if (moved == null) return 'measuring';
  return moved > 0 ? 'worked' : 'no_movement';
}

export interface DecisionReview {
  total: number;
  did: number;
  ignored: number;
  worked: number;
  noMovement: number;
  /** Recommended again and again, acted on, and it never moved the number. */
  deadTopic: { topic: string; count: number } | null;
  /** Recommended again and again and never once acted on. */
  avoidedTopic: { topic: string; count: number } | null;
  /** One sentence, or null when the record is too short to say anything. */
  line: string | null;
}

function runOf(decisions: Array<Pick<Decision, 'topic' | 'response' | 'verify'>>, pick: (v: DecisionVerdict) => boolean, exclude: (v: DecisionVerdict) => boolean) {
  const counts = new Map<string, { n: number; hit: number; bad: number }>();
  for (const d of decisions) {
    const topic = d.topic?.trim().toLowerCase();
    if (!topic) continue;
    const v = verdictOf(d);
    const c = counts.get(topic) ?? { n: 0, hit: 0, bad: 0 };
    c.n += 1;
    if (exclude(v)) c.hit += 1;
    if (pick(v)) c.bad += 1;
    counts.set(topic, c);
  }
  let best: { topic: string; count: number } | null = null;
  for (const [topic, c] of counts) {
    if (c.n < MIN_TOPIC_RUN || c.hit > 0 || c.bad === 0) continue;
    if (!best || c.n > best.count) best = { topic, count: c.n };
  }
  return best;
}

/** The reflection engine, such as it is: not advice, just the record read back. */
export function decisionReview(decisions: Array<Pick<Decision, 'topic' | 'response' | 'verify'>>): DecisionReview {
  const verdicts = decisions.map(verdictOf);
  const count = (v: DecisionVerdict) => verdicts.filter((x) => x === v).length;
  const worked = count('worked');
  const noMovement = count('no_movement');
  const ignored = count('ignored');
  const did = worked + noMovement + count('measuring') + count('done');

  // Acted on repeatedly, never moved the number it named.
  const deadTopic = runOf(decisions, (v) => v === 'no_movement', (v) => v === 'worked');
  // Recommended repeatedly and never once acted on.
  const avoidedTopic = runOf(decisions, (v) => v === 'ignored' || v === 'rejected', (v) => v === 'worked' || v === 'no_movement' || v === 'measuring' || v === 'done');

  let line: string | null = null;
  if (decisions.length >= MIN_REVIEW) {
    if (avoidedTopic) line = `${avoidedTopic.count} of your last ${decisions.length} calls were about ${avoidedTopic.topic}, and you have not done one of them. Either it is the wrong call or something is in the way.`;
    else if (deadTopic) line = `${deadTopic.count} of your last ${decisions.length} calls were about ${deadTopic.topic}. You did them and the number did not move.`;
    else if (worked > 0) line = `${worked} of your last ${decisions.length} calls moved the number they named.`;
    else if (ignored >= Math.ceil(decisions.length / 2)) line = `You ignored ${ignored} of your last ${decisions.length} calls. A call nobody makes is not a call.`;
  }

  return { total: decisions.length, did, ignored, worked, noMovement, deadTopic, avoidedTopic, line };
}

// ---------------------------------------------------------------------------
// The deterministic call
// ---------------------------------------------------------------------------

export interface StarterDecisionInput {
  metrics: Metrics;
  /** Real, sourced matches ranked and ready to be written to. */
  candidates: number;
  offerEmpty: boolean;
  hasSegments: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The floor. Used when no model is configured and when the configured one fails,
 * so Today always leads with a call rather than a blank card.
 *
 * The order matters more than any individual rung: a broken opener outranks an
 * unsent queue, because sending more of a message nobody answers is the most
 * expensive thing on this list.
 */
export function starterDecision(input: StarterDecisionInput): { decision: DecisionDraft; dont: DontDraft | null } {
  const m = input.metrics;
  const queue = m.awaiting_approval;
  const win = `${m.window_days} days`;

  if (input.offerEmpty) {
    return {
      decision: {
        headline: 'Say what you sell before anything else goes out.',
        because: [
          `${plural(m.pipeline.sourced, 'real match', 'real matches')} are waiting and none of them can be written to.`,
          'A message drafted from a blank offer is a stranger\'s template, not yours.',
        ],
        instead_of: 'Finding more matches you still cannot write to.',
        confidence: 'high', topic: 'offer', verify_metric: 'sent',
      },
      dont: m.pipeline.sourced > 0 ? { title: 'Do not run another match search', why: `You already have ${m.pipeline.sourced} you cannot write to yet.` } : null,
    };
  }

  // A weak opener beats an unsent queue: more sends make it worse, not better.
  if (m.sent >= 5 && m.replies === 0) {
    const thin = m.sent < 10;
    return {
      decision: {
        headline: 'Change the opening line before you send another message.',
        because: [
          `${m.sent} sent in ${win}, zero replies.`,
          'The volume is not the problem — nobody is answering the message itself.',
        ],
        instead_of: queue > 0 ? `Sending the ${plural(queue, 'draft')} already waiting.` : 'Sending the same opener to more people.',
        confidence: thin ? 'low' : 'high',
        missing: thin ? 'Ten sends is the smallest sample that separates a weak opener from bad luck. You are at ' + m.sent + '.' : undefined,
        topic: 'opener', verify_metric: 'replies',
      },
      dont: { title: 'Do not approve the waiting drafts as written', why: 'They use the opener that has not worked yet.' },
    };
  }

  // Replies that never became conversations are the cheapest thing in the app.
  if (m.replies > 0 && m.meetings === 0) {
    return {
      decision: {
        headline: 'Ask the people who already replied for a call.',
        because: [
          `${plural(m.replies, 'reply', 'replies')} in ${win} and no meeting booked from any of them.`,
          'Someone who answered is worth more than a hundred who have not been asked.',
        ],
        instead_of: 'New outreach to people who have never heard of you.',
        confidence: 'high', topic: 'converting', verify_metric: 'meetings',
      },
      dont: { title: 'Do not start a new batch today', why: 'The warm replies go cold first.' },
    };
  }

  if (queue > 0) {
    const runway = m.runway_months != null && m.runway_months < 4 ? `Runway is ${m.runway_months} months, so unsent work is the expensive kind.` : null;
    return {
      decision: {
        headline: `Send the ${plural(queue, 'draft')} already written before finding anything new.`,
        because: [
          `${queue} drafted, ${m.sent} sent in ${win}.`,
          runway ?? 'Every one of them is addressed to a real business with a contact.',
        ],
        instead_of: 'Another match search.',
        confidence: 'high', topic: 'sending', verify_metric: 'sent',
      },
      dont: { title: 'Do not find new matches today', why: `${m.pipeline.sourced} are already here and ${queue} are written.` },
    };
  }

  if (!input.hasSegments) {
    return {
      decision: {
        headline: 'Set who you sell to and where.',
        because: ['No targeting means no real supply, and nothing below this line can run.'],
        instead_of: 'Waiting for matches that will never arrive.',
        confidence: 'high', topic: 'targeting', verify_metric: 'sent',
      },
      dont: null,
    };
  }

  if (input.candidates === 0) {
    return {
      decision: {
        headline: 'Pull a fresh batch of matches.',
        because: [`Nothing is left to write to: ${m.pipeline.sourced} sourced, none of them open.`],
        instead_of: 'Re-reading the ones you already skipped.',
        confidence: 'high', topic: 'supply', verify_metric: 'sent',
      },
      dont: null,
    };
  }

  return {
    decision: {
      headline: 'Draft and send the highest-ranked match today.',
      because: [
        `${plural(input.candidates, 'ranked match', 'ranked matches')} waiting and nothing in the send queue.`,
        m.sent > 0 ? `${m.sent} sent in ${win}, ${plural(m.replies, 'reply', 'replies')} back.` : 'Nothing has gone out yet, so there is no reply rate to reason about.',
      ],
      instead_of: 'Reading the whole list before writing to any of it.',
      confidence: m.sent > 0 ? 'high' : 'low',
      missing: m.sent > 0 ? undefined : 'Nothing has been sent, so this is a starting move, not a measured one.',
      topic: 'sending', verify_metric: 'sent',
    },
    dont: null,
  };
}
