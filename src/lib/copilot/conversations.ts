// src/lib/copilot/conversations.ts
// What was actually said, on both sides, shaped for the agent.
//
// Pure by design — no DB import — so copilot-core.test.ts can cover the part
// that decides what the model gets to read. The reads live in store.ts.
//
// Everything here is about a budget. The context pack is serialised whole into
// the prompt (agent/schema.ts userPrompt) and already runs to ~9KB against a
// model that needs two minutes to answer it. Message bodies are the largest
// text this system holds, so they are capped hard and selected deliberately
// rather than dumped: six replies and six openers is enough to show a pattern,
// and a hundred would push out the metrics the decision has to cite.

/** One reply, trimmed. Long enough to carry an objection, short enough to spend. */
export const REPLY_TEXT_MAX = 300;
/** One sent opener, trimmed. */
export const SENT_TEXT_MAX = 280;
/** How many replies the pack carries. */
export const MAX_PACK_REPLIES = 6;
/** How many openers per bucket (replied / ignored). */
export const MAX_SENT_PER_BUCKET = 3;
/**
 * A message sent yesterday and not yet answered is not evidence of anything.
 * Only silence this old counts as silence — the same reasoning as gradeDecisions:
 * the record has to wait before it is allowed to draw a conclusion.
 */
export const NO_REPLY_AFTER_DAYS = 3;

export interface PackReply {
  /** The business that replied, when the execution was linked to one. */
  business: string | null;
  text: string;
  occurred_at: string;
}

export interface PackSentExample {
  text: string;
  /** True when a reply came back; false only after NO_REPLY_AFTER_DAYS of silence. */
  replied: boolean;
  sent_at: string;
}

/**
 * Collapse a stored message into one line of prompt-safe text. WhatsApp bodies
 * arrive with hard newlines and long signatures; a raw body dropped into JSON
 * is mostly whitespace by weight, and whitespace costs the same as an argument.
 */
export function trimMessage(raw: string | null | undefined, max: number): string {
  if (!raw) return '';
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export interface ReplyRow {
  note: string | null;
  occurred_at: string;
  business?: string | null;
}

/**
 * Compare timestamps as instants, never as strings. PostgREST returns a
 * timestamptz as "…T08:00:00+00:00" while anything JS made is "…T08:00:00.000Z";
 * the two sort against each other by the punctuation after the seconds, which
 * is not a time. Date.parse costs nothing here and cannot be read wrong later.
 */
const at = (iso: string): number => Date.parse(iso);

/** Newest replies that actually carry text. A reply we recorded but never read
 *  the body of is a row, not a fact, and adds nothing to the prompt. */
export function selectReplies(rows: ReplyRow[], max = MAX_PACK_REPLIES): PackReply[] {
  return rows
    .map((r) => ({ business: r.business ?? null, text: trimMessage(r.note, REPLY_TEXT_MAX), occurred_at: r.occurred_at }))
    .filter((r) => r.text.length > 0)
    .sort((a, b) => at(b.occurred_at) - at(a.occurred_at))
    .slice(0, max);
}

export interface SentRow {
  id: string;
  body: string | null;
  sent_at: string | null;
}

/**
 * The only honest answer to "what works for me": openers that got a reply,
 * beside openers that did not. Balanced on purpose — a list of winners with no
 * losers beside it is a testimonial page, and a model shown only wins will
 * conclude that whatever it was shown is what works.
 */
export function selectSentExamples(
  rows: SentRow[],
  repliedExecutionIds: Set<string>,
  opts: { now?: Date; perBucket?: number } = {},
): PackSentExample[] {
  const now = opts.now ?? new Date();
  const perBucket = opts.perBucket ?? MAX_SENT_PER_BUCKET;
  const silenceBefore = now.getTime() - NO_REPLY_AFTER_DAYS * 86_400_000;

  const shaped = rows
    .filter((r): r is SentRow & { sent_at: string } => !!r.sent_at)
    .map((r) => ({ id: r.id, text: trimMessage(r.body, SENT_TEXT_MAX), sent_at: r.sent_at }))
    .filter((r) => r.text.length > 0)
    .sort((a, b) => at(b.sent_at) - at(a.sent_at));

  const replied = shaped.filter((r) => repliedExecutionIds.has(r.id)).slice(0, perBucket);
  const ignored = shaped.filter((r) => !repliedExecutionIds.has(r.id) && at(r.sent_at) < silenceBefore).slice(0, perBucket);

  return [
    ...replied.map((r) => ({ text: r.text, replied: true, sent_at: r.sent_at })),
    ...ignored.map((r) => ({ text: r.text, replied: false, sent_at: r.sent_at })),
  ];
}
