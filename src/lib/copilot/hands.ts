// src/lib/copilot/hands.ts
// The hands this deployment has, and the two simple ways of handing work over:
// the app's own Writer, in one model call, and a worker on a webhook (the n8n
// workflow, a person's inbox, a robot's controller). The Claude agent has a
// file of its own (managed.ts), because a session is a longer conversation.
//
// Each returns the worker's result and records nothing: deliver.ts acceptWork
// is the one door results come in through.

import { generateText } from 'ai';
import { extractJson } from './agent/schema';
import { maxOutputTokens, modelErrorText, providerFor, resolveLlmConfig } from './agent/llm';
import { normalizeResult, type CommissionBrief, type CommissionResult } from './commission';
import { offerIsEmpty } from './offer';
import { registryFrom, type Registry, type WorkerSpec } from './workers';
import { BLANK_OFFER, WRITE_SYSTEM, checkWritten, notWritten, writePrompt, writtenResult } from './writer';

/** Every worker on this deployment, read from the environment. Cheap: no I/O. */
export const registry = (): Registry => registryFrom(process.env, { llm: !!resolveLlmConfig() });

/** A webhook worker that browses is slow by nature; this is the synchronous ceiling. */
export const WEBHOOK_TIMEOUT_MS = 90_000;
/** One model call for one piece of writing. */
const WRITE_TIMEOUT_MS = 60_000;

/**
 * A writing job, written by the app's own model.
 *
 * Every way it can fail comes back as a `blocked` line with the reason — a
 * blank offer, no model, a model that did not answer, a draft that invented a
 * number — so the card says what stopped it and offers another go, rather than
 * the job reading "Nothing back yet" over a call that never happened.
 */
export async function runWriter(brief: CommissionBrief, o: { deadline?: number } = {}): Promise<CommissionResult> {
  // Invariant 1: 44 messages were written from a blank offer and none were sent.
  if (offerIsEmpty(brief.who.offer)) return notWritten(BLANK_OFFER);
  const cfg = resolveLlmConfig();
  if (!cfg) return notWritten('no model is configured on this server');
  const left = o.deadline ? o.deadline - Date.now() - 2_000 : WRITE_TIMEOUT_MS;
  if (left < 5_000) return notWritten('there was no time left in this run to write it — it goes again with the next one');
  let text: string;
  try {
    ({ text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: WRITE_SYSTEM,
      prompt: writePrompt(brief),
      temperature: 0.6,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 1600,
      abortSignal: AbortSignal.timeout(Math.min(WRITE_TIMEOUT_MS, left)),
    }));
  } catch (e) {
    return notWritten(`the model did not answer (${modelErrorText(e).slice(0, 160)})`);
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch { return notWritten('the model did not answer in the shape asked for'); }
  const w = checkWritten(parsed, brief);
  return w.ok ? writtenResult(brief, w) : notWritten(w.why);
}

/**
 * A job posted to a worker's webhook. It may answer at once with its result, or
 * take the brief, answer with nothing, and post to result_url later — both are
 * real: research inside twenty seconds is one shape, an hour of browsing or a
 * person picking it up after lunch is another. Throws when it could not be
 * reached, so the hand-over is recorded as not having happened.
 */
export async function postToWebhook(w: WorkerSpec, brief: CommissionBrief, o: { deadline?: number } = {}): Promise<CommissionResult> {
  if (!w.url) throw new Error(`${w.name} has no address to send to`);
  const left = o.deadline ? o.deadline - Date.now() : WEBHOOK_TIMEOUT_MS;
  if (left < 5_000) throw new Error('there was no time left in this run to reach it');
  const secret = w.secretEnv ? process.env[w.secretEnv] : undefined;
  const res = await fetch(w.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(brief),
    signal: AbortSignal.timeout(Math.min(WEBHOOK_TIMEOUT_MS, left)),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return normalizeResult(await res.json().catch(() => ({})));
}

/**
 * Which worker a post-back's bearer belongs to, or null for none. The shared
 * COPILOT_INBOUND_SECRET is the n8n worker's and every older worker's; a worker
 * with its own inbound secret can report only on work handed to it, so a
 * person's key cannot write into a job the Claude agent holds.
 */
export function workerForBearer(header: string | null, r: Registry = registry()): { worker: string | null; shared: boolean } | null {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  for (const w of r.workers) {
    const own = w.inboundSecretEnv ? process.env[w.inboundSecretEnv] : undefined;
    if (own && safeEqual(own, token)) return { worker: w.key, shared: false };
  }
  const shared = process.env.COPILOT_INBOUND_SECRET || process.env.COPILOT_JOBS_SECRET;
  if (shared && safeEqual(shared, token)) return { worker: null, shared: true };
  return null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** Whether any post-back can be accepted at all: a shared secret, or a worker with its own. */
export function inboundConfigured(r: Registry = registry()): boolean {
  return !!(process.env.COPILOT_INBOUND_SECRET || process.env.COPILOT_JOBS_SECRET) || r.workers.some((w) => w.inboundSecretEnv && process.env[w.inboundSecretEnv]);
}
