// src/lib/agent/provider.ts
// ═══════════════════════════════════════════════════════════════════════════
// Multi-Provider Abstraction for Agent LLM Calls
// ═══════════════════════════════════════════════════════════════════════════
//
// Default: DeepSeek (cheapest, fast, good tool calling)
// Optional: OpenAI (gpt-4o), Anthropic (via OpenAI-compat), OpenRouter
// Configured via AGENT_PROVIDER env var or per-business settings

import type OpenAIType from 'openai';
import { createClient } from '@supabase/supabase-js';

export interface AgentProvider {
  client: InstanceType<typeof OpenAIType>;
  model: string;
  contextWindow: number;  // tokens
  providerName: string;
  baseURL: string;
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
    const model = process.env.AGENT_OPENROUTER_MODEL || 'deepseek/deepseek-chat';
    
    // Dynamic context window detection for popular OpenRouter models
    let contextWindow = 64_000;
    const lowerModel = model.toLowerCase();
    
    if (lowerModel.includes('mimo')) contextWindow = 262_144;
    else if (lowerModel.includes('gemini-2.0')) contextWindow = 1_048_576;
    else if (lowerModel.includes('gemini-1.5')) contextWindow = 1_048_576;
    else if (lowerModel.includes('claude-3')) contextWindow = 200_000;
    else if (lowerModel.includes('llama-3.1')) contextWindow = 128_000;
    else if (lowerModel.includes('gpt-4o')) contextWindow = 128_000;
    else if (lowerModel.includes('o1-')) contextWindow = 128_000;

    return {
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      model,
      contextWindow,
    };
  },
};

/**
 * Resolve the LLM provider for agent tasks.
 * Priority: DB Configuration -> AGENT_PROVIDER env var → DeepSeek (default)
 */
export async function getAgentProvider(businessId?: string | null, timeoutMs = 20_000): Promise<AgentProvider> {
  const OpenAI = (await import('openai')).default;

  let dbProviderName: string | null = null;
  let dbModel: string | null = null;

  if (businessId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { data } = await supabase.from('businesses').select('ai_provider, ai_model').eq('id', businessId).single();
      if (data) {
        if (data.ai_provider) dbProviderName = data.ai_provider;
        if (data.ai_model) dbModel = data.ai_model;
      }
    } catch (err) {
      console.error('[agent:provider] Error fetching DB config:', err);
    }
  }

  const providerName = (dbProviderName || process.env.AGENT_PROVIDER || 'deepseek').toLowerCase();
  const configFn = PROVIDER_CONFIGS[providerName];

  if (!configFn) {
    console.warn(`[agent:provider] Unknown provider "${providerName}", falling back to DeepSeek`);
    const fallback = PROVIDER_CONFIGS.deepseek();
    if (!fallback) throw new Error(`[agent:provider] No API key configured for DeepSeek (fallback). Set DEEPSEEK_API_KEY.`);
    return { ...createProvider(OpenAI, fallback, timeoutMs), providerName: 'deepseek', baseURL: fallback.baseURL };
  }

  const config = configFn();
  if (!config) {
    console.warn(`[agent:provider] ${providerName} API key not configured, falling back to DeepSeek`);
    const fallback = PROVIDER_CONFIGS.deepseek();
    if (!fallback) throw new Error(`[agent:provider] No API key configured for ${providerName} or DeepSeek (fallback). Set DEEPSEEK_API_KEY.`);
    return { ...createProvider(OpenAI, fallback, timeoutMs), providerName: 'deepseek', baseURL: fallback.baseURL };
  }

  // Override model if specified in DB
  if (dbModel && providerName === (dbProviderName || process.env.AGENT_PROVIDER || 'deepseek').toLowerCase()) {
    config.model = dbModel;
  }

  // Dynamic context window detection (runs AFTER DB model override, so it uses the actual model)
  if (providerName === 'openrouter') {
    const lowerModel = config.model.toLowerCase();
    if (lowerModel.includes('mimo')) config.contextWindow = 262_144;
    else if (lowerModel.includes('gemini-2.0')) config.contextWindow = 1_048_576;
    else if (lowerModel.includes('gemini-1.5')) config.contextWindow = 1_048_576;
    else if (lowerModel.includes('claude-3')) config.contextWindow = 200_000;
    else if (lowerModel.includes('llama-3.1')) config.contextWindow = 128_000;
    else if (lowerModel.includes('gpt-4o')) config.contextWindow = 128_000;
    else if (lowerModel.includes('o1-')) config.contextWindow = 128_000;
    else if (lowerModel.includes('deepseek')) config.contextWindow = 64_000;
  }

  console.log(`[agent:provider] Using ${providerName} (${config.model}, ${config.contextWindow / 1000}K context)`);
  return { ...createProvider(OpenAI, config, timeoutMs), providerName, baseURL: config.baseURL };
}

function createProvider(
  OpenAI: typeof OpenAIType,
  config: ProviderConfig,
  timeoutMs: number,
) {
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
