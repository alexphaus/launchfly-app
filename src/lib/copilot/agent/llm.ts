// src/lib/copilot/agent/llm.ts
// LLM-backed agent over any OpenAI-compatible endpoint via the Vercel AI SDK.
// Config (first match wins):
//   COPILOT_AI_API_KEY + COPILOT_AI_BASE_URL + COPILOT_AI_MODEL   explicit
//   OPENAI_API_KEY                                                 OpenAI, gpt-4o-mini
//   DEEPSEEK_API_KEY                                               DeepSeek, deepseek-chat
//
// Tuning, all optional:
//   COPILOT_AI_TIMEOUT_MS          abort a slow generation on a request the
//                                  user is waiting on (default 30s)
//   COPILOT_AI_CRON_TIMEOUT_MS     the same bound for the nightly run, which
//                                  nobody is waiting on (default 120s)
//   COPILOT_AI_MAX_OUTPUT_TOKENS   cap the reply
//   COPILOT_AI_EXTRA_BODY          JSON merged into the request body, for
//                                  endpoint-specific knobs this file should not
//                                  hardcode — e.g. {"reasoning":{"effort":"low"}}
//                                  on OpenRouter.
//
// The timeout is not a nicety. A reasoning model pointed at this prompt can
// spend 6,000-11,000 tokens thinking and take five minutes; the request dies at
// the proxy, the user sees a 504, and the generation is billed anyway. Failing
// fast hands the run to the starter, which always produces a brief.

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { BriefOutput, BriefRunOpts, ContextPack, OpportunityAgent } from '../types';
import { SYSTEM_PROMPT, extractJson, normalizeBrief, userPrompt } from './schema';
import { isNightlyPass } from '../nightly';

export interface LlmConfig { apiKey: string; baseURL?: string; model: string }

/**
 * Deliberately conservative. 55s was chosen against a guess that the proxy
 * allowed 60, and it still 504'd — so the real limit is lower than that and
 * nobody has measured it. 30s fits comfortably under anything plausible.
 *
 * The cost of being too low is a starter brief, and the client says so
 * ("Agent unavailable, showed a starter brief"). The cost of being too high is
 * a 504 with the generation billed and nothing shown. Those are not symmetric.
 *
 * Measure the real ceiling with GET /api/copilot/health?sleep=N — walk N up
 * until it returns 504 — then raise COPILOT_AI_TIMEOUT_MS to sit under it.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The nightly run is a different problem wearing the same name. It is started
 * by scripts/copilot-cron.mjs against 127.0.0.1, so Traefik is not in the path
 * and the ceiling that forces 30s above simply does not exist. Sharing one
 * budget between the two cost every brief in production: the cron ran, the
 * model was answering normally, and this file aborted it at exactly 30.0s on
 * every single run for weeks — so every brief the user read was the starter.
 *
 * 120s is chosen against the generations recorded in docs/COPILOT.md (75s,
 * 120s, 185s, 318s, 335s on GLM-5.3-Flash) and against the cron route's own
 * maxDuration of 300s, which the whole loop — supply, reconcile, brief, per
 * profile, sequentially — still has to fit inside. Raise it only alongside
 * that, and remember it is spent once per profile.
 */
const DEFAULT_CRON_TIMEOUT_MS = 120_000;

function envMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function timeoutMs(): number {
  return envMs('COPILOT_AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
}

export function cronTimeoutMs(): number {
  return envMs('COPILOT_AI_CRON_TIMEOUT_MS', DEFAULT_CRON_TIMEOUT_MS);
}

/** What the caller can afford to wait, by why the brief is being run. Only the
 *  nightly pass escapes the proxy: the cron runs inside the container, and
 *  "Run again" runs it in `after()`, once the response has already gone. Every
 *  other reason is a tap waiting behind Traefik. */
export function budgetForReason(reason: string): number {
  return isNightlyPass(reason) ? cronTimeoutMs() : timeoutMs();
}

export function maxOutputTokens(): number | undefined {
  const raw = Number(process.env.COPILOT_AI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

/** Extra request-body fields, parsed once. Bad JSON is ignored with a warning
 *  rather than taking the brief down with it. */
export function extraBody(name = 'COPILOT_AI_EXTRA_BODY'): Record<string, unknown> | null {
  const raw = process.env[name];
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    console.error(`[copilot] ${name} is not valid JSON; ignoring it`);
    return null;
  }
}

export function resolveLlmConfig(): LlmConfig | null {
  if (process.env.COPILOT_AI_API_KEY) {
    return { apiKey: process.env.COPILOT_AI_API_KEY, baseURL: process.env.COPILOT_AI_BASE_URL || undefined, model: process.env.COPILOT_AI_MODEL || 'gpt-4o-mini' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY, model: process.env.COPILOT_AI_MODEL || 'gpt-4o-mini' };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', model: process.env.COPILOT_AI_MODEL || 'deepseek-chat' };
  }
  return null;
}

/**
 * The plan's model, when it should not be the brief's.
 *
 * The brief runs where a tap may be waiting on it, so it is sized to a 30s
 * budget; the plan is drawn in the background — after() on a tap, inside the
 * container at night — and it is the one call whose judgement the whole Path
 * rests on. So it can take a slower, stronger model: COPILOT_PLAN_MODEL names
 * it, and COPILOT_PLAN_API_KEY / COPILOT_PLAN_BASE_URL point it at another
 * endpoint. Unset, the plan uses the brief's model, as before.
 */
export function resolvePlanConfig(): LlmConfig | null {
  const base = resolveLlmConfig();
  const key = process.env.COPILOT_PLAN_API_KEY?.trim();
  const model = process.env.COPILOT_PLAN_MODEL?.trim();
  if (key) return { apiKey: key, baseURL: process.env.COPILOT_PLAN_BASE_URL?.trim() || base?.baseURL, model: model || base?.model || 'gpt-4o-mini' };
  if (!base) return null;
  return model ? { ...base, model } : base;
}

/**
 * How long a draw may take. 110s, as before, unless COPILOT_PLAN_TIMEOUT_MS says
 * otherwise — a reasoning model at high effort can need more. It is spent inside
 * the nightly pass too, which has five minutes for every profile, so raise it
 * knowing that.
 */
export function planTimeoutMs(): number {
  return envMs('COPILOT_PLAN_TIMEOUT_MS', 110_000);
}

/** The plan's reply cap: COPILOT_PLAN_MAX_OUTPUT_TOKENS, else the shared one. A reasoning model's thinking counts against it. */
export function planMaxOutputTokens(): number | undefined {
  const raw = Number(process.env.COPILOT_PLAN_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : maxOutputTokens();
}

/** Body knobs for the plan's endpoint — e.g. a higher reasoning effort — else the shared ones. */
export function planExtraBody(): Record<string, unknown> | null {
  return process.env.COPILOT_PLAN_EXTRA_BODY?.trim() ? extraBody('COPILOT_PLAN_EXTRA_BODY') : extraBody();
}

/**
 * A provider for one call outside the brief, with COPILOT_AI_EXTRA_BODY merged
 * in the same way, so a knob set for the endpoint applies to every call this
 * app makes rather than only to the one written first.
 */
export function providerFor(cfg: LlmConfig, extra: Record<string, unknown> | null = extraBody()) {
  return createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    fetch: extra
      ? (input, init) => {
          if (typeof init?.body !== 'string') return fetch(input, init);
          try { return fetch(input, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...extra }) }); }
          catch { return fetch(input, init); }
        }
      : undefined,
  });
}

export class LlmAgent implements OpportunityAgent {
  readonly name = 'llm' as const;
  readonly model: string;
  private provider;

  constructor(private cfg: LlmConfig) {
    this.model = cfg.model;
    const extra = extraBody();
    this.provider = createOpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
      // The SDK has no generic passthrough for body fields an OpenAI-compatible
      // endpoint understands but OpenAI itself does not, so merge them here.
      fetch: extra
        ? (input, init) => {
            if (typeof init?.body !== 'string') return fetch(input, init);
            try {
              return fetch(input, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...extra }) });
            } catch {
              return fetch(input, init);
            }
          }
        : undefined,
    });
  }

  async generateBrief(pack: ContextPack, opts?: BriefRunOpts): Promise<BriefOutput> {
    const budget = opts?.timeoutMs ?? timeoutMs();
    // One attempt, hard bounded. Retrying a generation that ran long doubles the
    // wall clock and the bill for the same likely outcome; the starter is the
    // better answer to a slow provider.
    try {
      const { text } = await generateText({
        model: this.provider(this.model),
        system: SYSTEM_PROMPT,
        prompt: userPrompt(pack),
        temperature: 0.4,
        maxRetries: 0,
        maxOutputTokens: maxOutputTokens(),
        abortSignal: AbortSignal.timeout(budget),
      });
      return normalizeBrief(extractJson(text));
    } catch (err) {
      // The bare SDK message is "The operation was aborted due to timeout",
      // which names neither the budget nor who set it. That cost a wrong
      // diagnosis: it reads exactly like an endpoint rejecting the request,
      // and copilot_agent_runs.error is usually all anyone has to go on.
      const message = err instanceof Error ? err.message : String(err);
      if (/abort|timeout/i.test(message)) {
        throw new Error(`${this.model} did not answer within ${budget}ms — raise COPILOT_AI_TIMEOUT_MS (or COPILOT_AI_CRON_TIMEOUT_MS for the nightly run), or pick a faster model`);
      }
      throw err;
    }
  }
}
