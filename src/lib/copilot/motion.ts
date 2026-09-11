// src/lib/copilot/motion.ts
// What is already running. The only part of Today that is not an instruction.
//
// Pure — no DB import — so copilot-core.test.ts covers it.
//
// Why this replaces "Also today". That section rendered the model's plan[] and
// nudges[], asked for in the same response that wrote the Call, over the same
// context. It said the same thing three ways by construction: the live screen
// showed "approve and send 15 drafts", "approve and send 15 drafts today",
// "approve and send 10 drafts today" and "send 10 drafts today" as four separate
// rows, above a queue card already saying it a fifth time — with the 15 and the
// 10 disagreeing, because they came from different runs and nothing reconciled
// them. It was also the last surface in the app not held to the artifact rule:
// nine imperatives with nothing attached, which is the definition of advice.
//
// Read the screen it sits on, top to bottom: the call, the composer, the moves,
// the deck, the queue. Every one of them is an ask. Nothing said what was
// already in motion — so the question a person actually has at nine at night,
// "did anything I did today land?", had no answer anywhere on it.
//
// Every row here is computed from rows the user created. Nothing is asked of a
// model, which is also why this survives the test in DIRECTION.md: an agent with
// a memory file cannot tell you that Tuesday's call reads back on Thursday.

import { VERIFY_AFTER_DAYS } from './decision';

export type MotionKind = 'sent' | 'verifying' | 'watched';

export interface MotionRow {
  kind: MotionKind;
  /** The state, in as few words as carry it. */
  label: string;
  /** The evidence under it. Always a number or a name, never an adjective. */
  detail: string;
}

/** Names listed before the count takes over. Four is a line on a phone. */
export const MAX_NAMES = 2;
/** A source checked within this long counts as "last night". */
export const RECENT_CHECK_HOURS = 30;

const days = (from: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 86_400_000));

/** "Norj, Andrea +3" — enough to recognise, never a wall. */
export function nameList(names: string[], max = MAX_NAMES): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return '';
  const shown = clean.slice(0, max);
  const rest = clean.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} +${rest}` : shown.join(', ');
}

export interface MotionInput {
  /** Messages actually sent and not yet answered. */
  sent: Array<{ name: string; sentAt: string }>;
  /**
   * The most recent call the user said they DID, whose metric has not been read
   * back yet. Only 'did' — a call that was refused is not in motion, and one
   * already verified belongs to the record rather than to today.
   */
  call: { headline: string; metric: string; answeredAt: string } | null;
  /** Sources with a recent check, and how many Moves came out of the run. */
  sources: Array<{ label: string; lastCheckedAt: string | null }>;
  finds: number;
  now: Date;
}

/**
 * Three facts at most, and often none.
 *
 * Returning an empty list on a quiet account is correct and the section is not
 * rendered at all — a heading over "nothing yet" is the filler this whole change
 * is removing.
 */
export function inMotion(input: MotionInput): MotionRow[] {
  const out: MotionRow[] = [];

  if (input.sent.length) {
    const oldest = input.sent.reduce((a, b) => (a.sentAt <= b.sentAt ? a : b));
    const waited = days(oldest.sentAt, input.now);
    out.push({
      kind: 'sent',
      label: `${input.sent.length} sent, waiting`,
      detail: [
        waited > 0 ? `oldest ${waited} day${waited === 1 ? '' : 's'}` : 'all today',
        nameList(input.sent.map((s) => s.name)),
      ].filter(Boolean).join(' — '),
    });
  }

  if (input.call) {
    const since = days(input.call.answeredAt, input.now);
    const left = VERIFY_AFTER_DAYS - since;
    out.push({
      kind: 'verifying',
      label: input.call.headline,
      // The whole point of the decision record, said on the screen where the
      // call was made rather than only on the tab nobody opens.
      detail: left > 0
        ? `you did it — reads back on ${input.call.metric} in ${left} day${left === 1 ? '' : 's'}`
        : `you did it — ${input.call.metric} is being read back now`,
    });
  }

  const recent = input.sources.filter((s) => {
    if (!s.lastCheckedAt) return false;
    const hrs = (input.now.getTime() - new Date(s.lastCheckedAt).getTime()) / 3_600_000;
    return hrs >= 0 && hrs <= RECENT_CHECK_HOURS;
  });
  if (recent.length) {
    out.push({
      kind: 'watched',
      label: `${recent.length} source${recent.length === 1 ? '' : 's'} read`,
      // Zero finds is the honest and common answer, and saying it is what stops
      // somebody assuming the watcher is broken on a quiet night.
      detail: input.finds > 0
        ? `${input.finds} worth keeping — ${nameList(recent.map((s) => s.label))}`
        : `nothing worth your morning — ${nameList(recent.map((s) => s.label))}`,
    });
  }

  return out;
}
