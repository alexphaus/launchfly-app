// src/lib/ai-provider.ts
// ═══════════════════════════════════════════════════════════════════════════
// Shared AI Provider — DeepSeek V3 via OpenAI-compatible API
//
// Centralizes model config so switching providers is a one-file change.
// Uses Vercel AI SDK's createOpenAI for compatibility with generateText/generateObject.
//
// Usage:
//   import { deepseek, CHAT_MODEL, MINI_MODEL } from '@/lib/ai-provider';
//   generateText({ model: deepseek(CHAT_MODEL), ... })
// ═══════════════════════════════════════════════════════════════════════════

import { createOpenAI } from '@ai-sdk/openai';

export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

// Main chat model — used for receptionist brain, content generation, etc.
export const CHAT_MODEL = 'deepseek-chat';

// Fast/cheap model — used for intent classification, extraction, etc.
// DeepSeek V3 is already cheap enough to use for everything, so same model.
export const MINI_MODEL = 'deepseek-chat';
