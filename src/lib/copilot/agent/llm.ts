// src/lib/copilot/agent/llm.ts
// LLM-backed agent over any OpenAI-compatible endpoint via the Vercel AI SDK.
// Config (first match wins):
//   COPILOT_AI_API_KEY + COPILOT_AI_BASE_URL + COPILOT_AI_MODEL   explicit
//   OPENAI_API_KEY                                                 OpenAI, gpt-4o-mini
//   DEEPSEEK_API_KEY                                               DeepSeek, deepseek-chat

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { BriefOutput, ContextPack, OpportunityAgent } from '../types';
import { SYSTEM_PROMPT, extractJson, normalizeBrief, userPrompt } from './schema';

interface LlmConfig { apiKey: string; baseURL?: string; model: string }

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
    this.provider = createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  }

  async generateBrief(pack: ContextPack): Promise<BriefOutput> {
    const { text } = await generateText({
      model: this.provider(this.model),
      system: SYSTEM_PROMPT,
      prompt: userPrompt(pack),
      temperature: 0.4,
      maxRetries: 1,
    });
    return normalizeBrief(extractJson(text));
  }
}
