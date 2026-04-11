// src/lib/agent/provider.ts
// ═══════════════════════════════════════════════════════════════════════════
// Multi-Provider Abstraction for Agent LLM Calls
// ═══════════════════════════════════════════════════════════════════════════
//
// Default: DeepSeek (cheapest, fast, good tool calling)
// Optional: OpenAI (gpt-4o), Anthropic (via OpenAI-compat), OpenRouter
// Configured via AGENT_PROVIDER env var or per-business settings

import type OpenAIType from 'openai';

export interface AgentProvider {
  client: InstanceType<typeof OpenAIType>;
  model: string;
  contextWindow: number;  // tokens
}

interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  contextWindow: number;
}

const PROVIDER_CONFIGS: Record<string, () => ProviderConfig | null> = {
  deepseek: () => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return {
      apiKey,
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      contextWindow: 64_000,
    };
  },
  openai: () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return {
      apiKey,
      baseURL: 'https://api.openai.com/v1',
      model: process.env.AGENT_OPENAI_MODEL || 'gpt-4o',
      contextWindow: 128_000,
    };
  },
  anthropic: () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    // Requires an OpenAI-compatible proxy (e.g. LiteLLM). Native Anthropic API is NOT compatible.
    const baseURL = process.env.ANTHROPIC_BASE_URL;
    if (!baseURL) {
      console.warn('[agent:provider] ANTHROPIC_BASE_URL not set — Anthropic requires an OpenAI-compatible proxy (e.g. LiteLLM)');
      return null;
    }
    return {
      apiKey,
      baseURL,
      model: process.env.AGENT_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      contextWindow: 200_000,
    };
  },
  openrouter: () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    return {
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      model: process.env.AGENT_OPENROUTER_MODEL || 'deepseek/deepseek-chat',
      contextWindow: 64_000,
    };
  },
};

/**
 * Resolve the LLM provider for agent tasks.
 * Priority: AGENT_PROVIDER env var → DeepSeek (default)
 */
export async function getAgentProvider(timeoutMs = 20_000): Promise<AgentProvider> {
  const OpenAI = (await import('openai')).default;

  const providerName = (process.env.AGENT_PROVIDER || 'deepseek').toLowerCase();
  const configFn = PROVIDER_CONFIGS[providerName];

  if (!configFn) {
    console.warn(`[agent:provider] Unknown provider "${providerName}", falling back to DeepSeek`);
    const fallback = PROVIDER_CONFIGS.deepseek();
    if (!fallback) throw new Error(`[agent:provider] No API key configured for DeepSeek (fallback). Set DEEPSEEK_API_KEY.`);
    return createProvider(OpenAI, fallback, timeoutMs);
  }

  const config = configFn();
  if (!config) {
    console.warn(`[agent:provider] ${providerName} API key not configured, falling back to DeepSeek`);
    const fallback = PROVIDER_CONFIGS.deepseek();
    if (!fallback) throw new Error(`[agent:provider] No API key configured for ${providerName} or DeepSeek (fallback). Set DEEPSEEK_API_KEY.`);
    return createProvider(OpenAI, fallback, timeoutMs);
  }

  console.log(`[agent:provider] Using ${providerName} (${config.model}, ${config.contextWindow / 1000}K context)`);
  return createProvider(OpenAI, config, timeoutMs);
}

function createProvider(
  OpenAI: typeof OpenAIType,
  config: ProviderConfig,
  timeoutMs: number,
): AgentProvider {
  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: timeoutMs,
    }),
    model: config.model,
    contextWindow: config.contextWindow,
  };
}
