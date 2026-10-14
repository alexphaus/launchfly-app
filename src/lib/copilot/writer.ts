// src/lib/copilot/writer.ts
// A writing job, done by the app's own model in one call.
//
// Writing went to the hands: "Draft one reusable reply for any post that states
// pay" was dispatched to a browsing agent, which tried to send the reply and
// stopped at Needs a fix (contract.ts, leak 1). A writing job needs the person's own words
// and nothing from outside, and the app holds both — the offer, the working
// file, what they answered on this job — and already has a model. So writing is
// done here, in one call, and held to the rules every draft in this app is held
// to: nothing from a blank offer (invariant 1), no number the person never gave
// (invariant 2), no link they did not give, no placeholder.
//
// Pure: the prompt and the check. jobs/commission.ts makes the call.

import { numberOutside } from './assets';
import { briefText } from './brieftext';
import type { CommissionBrief, CommissionResult } from './commission';
import { ringOf } from './contract';

export const WRITE_SYSTEM = `You write one piece of text for one person's business, in their words. You are not a chatbot and not an advisor.

Return ONLY a JSON object, no prose and no code fences:
{ "title": "what it is, in a few words", "body": "the text itself, ready to use", "kind": "message" | "text" }

Use "message" when it is something they will send to someone (an email, a DM, a reply); "text" for everything else.

Rules, all of them load-bearing:
- Write from what the task says about them and nothing else. Never invent a number, a price, a result, a client, a testimonial or a link. If a figure is not in the task, the text does without it.
- No placeholders: no [brackets], no {{braces}}, no "your name". Use the name the task gives, or write so none is needed.
- When the task asks for several (three subject lines, five openers), give exactly that many, one per line, numbered "1." "2." and so on.
- Plain text. No markdown headings, no bold.
- If the task says the owner answered a question, use the answer.
- You do not send anything. You write it; they send it.`;

/** The prompt: the brief as every worker reads it. */
export const writePrompt = (b: CommissionBrief) => briefText(b);

/** Where a number or a link may come from: the person's own words on this job. */
export function writeSources(b: CommissionBrief): string[] {
  const o = b.who.offer ?? {};
  return [
    b.objective, b.why ?? '', o.sells ?? '', o.for_who ?? '', o.problem ?? '', o.price_band ?? '', o.proof_url ?? '',
    b.who.headline ?? '', b.who.working ?? '', b.who.target_area ?? '', b.who.location ?? '',
    ...b.log.filter((e) => e.kind === 'answered').map((e) => e.summary),
    b.goal ? `${b.goal.title} ${b.goal.target ?? ''}` : '',
  ];
}

const PLACEHOLDER = /\[[^\]]{0,40}\]|\{\{|\}\}|<[a-z][^>]*>|\b(your name|company name|business name|lorem ipsum|insert [a-z]+)\b/i;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)]+/gi;
const linkKey = (u: string) => u.trim().replace(/[.,;:!?)]+$/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();

export const WRITE_BODY_MAX = 3800;

export type Written = { ok: true; title: string; body: string; kind: 'message' | 'text' } | { ok: false; why: string };

/**
 * The model's text held to what a draft in this app may be. Refused, not
 * repaired: a draft with an invented figure reads as the person's, which is
 * worse than no draft.
 */
export function checkWritten(parsed: unknown, b: CommissionBrief): Written {
  const j = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const body = typeof j.body === 'string' ? j.body.trim() : '';
  if (!body) return { ok: false, why: 'the model wrote nothing' };
  if (body.length > WRITE_BODY_MAX) return { ok: false, why: 'it wrote more than fits' };
  const title = (typeof j.title === 'string' && j.title.trim() ? j.title.trim() : 'The draft').slice(0, 80);
  const all = `${title}\n${body}`;
  if (PLACEHOLDER.test(all)) return { ok: false, why: 'it left a placeholder in it' };
  const sources = writeSources(b);
  const given = new Set(sources.flatMap((s) => s.match(URL_RE) ?? []).map(linkKey));
  for (const url of all.match(URL_RE) ?? []) {
    if (!given.has(linkKey(url))) return { ok: false, why: `it put in a link you did not give (${url.replace(/[.,;:!?)]+$/, '').slice(0, 60)})` };
  }
  const stray = numberOutside(all, sources);
  if (stray) return { ok: false, why: `it wrote a number that is not yours (${stray})` };
  return { ok: true, title, body, kind: j.kind === 'message' ? 'message' : 'text' };
}

/**
 * The written text as the worker's report: one done, and the plan it was.
 *
 * When the objective also asks for it to be sent — "Write and send a follow-up
 * to Ana" — the plan says the sending is the person's, which the ring guard
 * would mark anyway; saying it here keeps the done honest about what was done.
 */
export function writtenResult(b: CommissionBrief, w: Extract<Written, { ok: true }>): CommissionResult {
  const sends = ringOf(b.objective) !== 'read';
  return {
    events: [{
      kind: 'done',
      step: 1,
      summary: `${sends ? 'Written — sending it is yours' : 'Written'}: ${w.title}`.slice(0, 300),
      artifact: { kind: w.kind, label: w.kind === 'message' ? 'The message' : 'The draft', value: w.body },
    }],
    plan: [
      { n: 1, do: `Write it: ${w.title}`.slice(0, 200), state: 'done' },
      ...(sends ? [{ n: 2, do: 'Send it', state: 'todo' as const }] : []),
    ],
    claimed: null,
  };
}

/** A writing job that could not be written, as the report: a breakage, with a retry. */
export function notWritten(why: string): CommissionResult {
  return { events: [{ kind: 'blocked', step: 1, summary: `Nothing was written: ${why}.`.slice(0, 300), artifact: null }], plan: null, claimed: null };
}

/** Invariant 1, in the words the card shows. */
export const BLANK_OFFER = 'say what you sell first (You → Your offer) — nothing is written from a blank offer';
