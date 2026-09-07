// src/lib/copilot/agent/llm.ts
// LLM-backed agent over any OpenAI-compatible endpoint via the Vercel AI SDK.
// Config (first match wins):
//   COPILOT_AI_API_KEY + COPILOT_AI_BASE_URL + COPILOT_AI_MODEL   explicit
//   OPENAI_API_KEY                                                 OpenAI, gpt-4o-mini
//   DEEPSEEK_API_KEY                                               DeepSeek, deepseek-chat
//
// Tuning, all optional:
//   COPILOT_AI_TIMEOUT_MS          abort a slow generation (default 55s)
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
import type { BriefOutput, ContextPack, OpportunityAgent } from '../types';
import { SYSTEM_PROMPT, extractJson, normalizeBrief, userPrompt } from './schema';

interface LlmConfig { apiKey: string; baseURL?: string; model: string }

/** Below the route's maxDuration and below the proxy's own timeout, so there is
 *  room left for the starter to run and the brief to be persisted. */
const DEFAULT_TIMEOUT_MS = 55_000;

export function timeoutMs(): number {
  const raw = Number(process.env.COPILOT_AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function maxOutputTokens(): number | undefined {
  const raw = Number(process.env.COPILOT_AI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

/** Extra request-body fields, parsed once. Bad JSON is ignored with a warning
 *  rather than taking the brief down with it. */
export function extraBody(): Record<string, unknown> | null {
  const raw = process.env.COPILOT_AI_EXTRA_BODY;
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    console.error('[copilot] COPILOT_AI_EXTRA_BODY is not valid JSON; ignoring it');
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

  async generateBrief(pack: ContextPack): Promise<BriefOutput> {
    // One attempt, hard bounded. Retrying a generation that ran long doubles the
    // wall clock and the bill for the same likely outcome; the starter is the
    // better answer to a slow provider.
    const { text } = await generateText({
      model: this.provider(this.model),
      system: SYSTEM_PROMPT,
      prompt: userPrompt(pack),
      temperature: 0.4,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens(),
      abortSignal: AbortSignal.timeout(timeoutMs()),
    });
    return normalizeBrief(extractJson(text));
  }
}
