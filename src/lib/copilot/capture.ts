// src/lib/copilot/capture.ts
// What the app saw and has not been told the end of.
//
// Pure — no DB import — so copilot-core.test.ts covers the rules about what the
// app is allowed to assume. The reads live in store.ts.
//
// Two gaps, both measured on the live account, both upstream of every decision
// the product makes:
//
//   9 sent in 30 days against 51 drafts waiting, 2 replies and 6 MEETINGS. Nine
//   sends do not produce six meetings. The deep link recorded nothing, so the
//   count is whatever the user remembered to confirm.
//
//   won_amount = $1, against those same six meetings and a $3,000 goal. The
//   outcome half is no better maintained than the send half.
//
// So the app grades its own calls against two numbers nobody is feeding it. The
// answer is not more prompting — it is asking ONCE, in a batch, about things the
// app actually observed, instead of asking N times about things it hopes for.

/**
 * How long to leave an opened message alone before asking about it.
 *
 * A MINIMUM age, not a maximum: a draft opened ten minutes ago is probably still
 * being typed, and asking then is the nagging this replaces — but one opened
 * last Tuesday and never confirmed is exactly the hole in the ledger, and it
 * never ages out of being worth one question.
 */
export const OPENED_SETTLE_MINUTES = 10;
/** A reply this old with no won/lost is a deal whose end nobody recorded. */
export const OUTCOME_CHASE_DAYS = 7;
/** One card, not a to-do list. Past this the count speaks for the rest. */
export const MAX_CAPTURE_ROWS = 6;

export interface OpenedDraft {
  /** The action id, which is what sendAction and markSent already take. */
  id: string;
  who: string;
  openedAt: string;
  channel: string;
}

export interface UnresolvedReply {
  /** The opportunity the reply came from — recordOutcome takes this. */
  opportunityId: string;
  who: string;
  repliedAt: string;
}

const hoursSince = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;

/**
 * Drafts opened and never confirmed, oldest first.
 *
 * Opening is evidence, not proof, and this module never converts one into the
 * other: nothing here marks anything sent. It produces a question, and the
 * user's answer is what reaches the ledger. That distinction is invariant 2 —
 * the difference between a number the app observed and one it inferred.
 *
 * Within the stale window they are left alone. A message opened ten minutes ago
 * is probably still being typed, and asking about it is the nagging this
 * replaces.
 */
export function openedAwaitingAnswer(
  drafts: Array<OpenedDraft & { sent: boolean }>,
  now: Date,
  opts: { settleMinutes?: number } = {},
): OpenedDraft[] {
  const settle = opts.settleMinutes ?? OPENED_SETTLE_MINUTES;
  return drafts
    .filter((d) => !d.sent)
    .filter((d) => {
      const mins = (now.getTime() - new Date(d.openedAt).getTime()) / 60_000;
      // A future timestamp is clock skew between the device and the row, not a
      // message from tomorrow, so it is not yet old enough to ask about.
      return Number.isFinite(mins) && mins >= settle;
    })
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    .slice(0, MAX_CAPTURE_ROWS);
}

/** Replies old enough that the deal has an ending nobody wrote down. */
export function repliesAwaitingOutcome(
  replies: Array<UnresolvedReply & { resolved: boolean }>,
  now: Date,
  opts: { afterDays?: number } = {},
): UnresolvedReply[] {
  const after = opts.afterDays ?? OUTCOME_CHASE_DAYS;
  return replies
    .filter((r) => !r.resolved)
    .filter((r) => hoursSince(r.repliedAt, now) >= after * 24)
    .sort((a, b) => a.repliedAt.localeCompare(b.repliedAt))
    .slice(0, MAX_CAPTURE_ROWS);
}

export interface CaptureAsk {
  kind: 'opened' | 'outcome';
  /** The whole question, in one line. */
  headline: string;
  /** Why it is being asked, in the app's own numbers. */
  because: string;
}

/**
 * The one card, or nothing.
 *
 * Sends lead when both are waiting: an unconfirmed send corrupts `sent`, which
 * every other number is computed against, including the reply rate that decides
 * whether the opener is working. An unlogged outcome corrupts one goal.
 *
 * Returns null on a clean ledger, and the card is not rendered — a standing
 * "nothing to confirm" panel is the filler this codebase keeps deleting.
 */
export function captureAsk(input: {
  opened: OpenedDraft[];
  replies: UnresolvedReply[];
  sentInWindow: number;
  windowDays: number;
}): CaptureAsk | null {
  if (input.opened.length) {
    const n = input.opened.length;
    return {
      kind: 'opened',
      headline: n === 1
        ? `You opened the message to ${input.opened[0].who}. Did it go?`
        : `You opened ${n} messages. Did they go?`,
      because: `The app counts ${input.sentInWindow} sent in ${input.windowDays} days, and every number it shows you is built on that one.`,
    };
  }
  if (input.replies.length) {
    const n = input.replies.length;
    const who = input.replies[0].who;
    return {
      kind: 'outcome',
      headline: n === 1
        ? `${who} replied. Where did it get to?`
        : `${n} replies are still open, oldest from ${who}. Where did they get to?`,
      because: 'A reply with no ending is a deal the app cannot count, and it is counting what your goals are measured against.',
    };
  }
  return null;
}
