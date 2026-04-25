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

/**
 * Detect context window for a given model name.
 */
function getContextWindowForModel(model: string): number {
  const lower = model.toLowerCase();
  
  if (lower.includes('mimo')) return 262_144;
  if (lower.includes('gemini-2.0')) return 1_048_576;
  if (lower.includes('gemini-1.5')) return 1_048_576;
  if (lower.includes('claude-3')) return 200_000;
  if (lower.includes('llama-3.1')) return 128_000;
  if (lower.includes('deepseek-v4')) return 128_000; // Future-proofing
  if (lower.includes('deepseek-v3')) return 64_000;
  if (lower.includes('deepseek-chat')) return 64_000;
  if (lower.includes('gpt-4o')) return 128_000;
  if (lower.includes('o1-')) return 128_000;
  
  return 64_000; // Safe default
}

const PROVIDER_CONFIGS: Record<string, (modelOverride?: string) => ProviderConfig | null> = {
  deepseek: (modelOverride) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    const model = modelOverride || 'deepseek-chat';
    return {
      apiKey,
      baseURL: 'https://api.deepseek.com',
      model,
      contextWindow: getContextWindowForModel(model),
    };
  },
  openai: (modelOverride) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const model = modelOverride || process.env.AGENT_OPENAI_MODEL || 'gpt-4o';
    return {
      apiKey,
      baseURL: 'https://api.openai.com/v1',
      model,
      contextWindow: getContextWindowForModel(model),
    };
  },
  anthropic: (modelOverride) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const baseURL = process.env.ANTHROPIC_BASE_URL;
    if (!baseURL) return null;
    const model = modelOverride || process.env.AGENT_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    return {
      apiKey,
      baseURL,
      model,
      contextWindow: getContextWindowForModel(model),
    };
  },
  openrouter: (modelOverride) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    const model = modelOverride || process.env.AGENT_OPENROUTER_MODEL || 'deepseek/deepseek-chat';
    return {
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      model,
      contextWindow: getContextWindowForModel(model),
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
        dbProviderName = data.ai_provider;
        dbModel = data.ai_model;
      }
    } catch (err) {
      console.error('[agent:provider] Error fetching DB config:', err);
    }
  }

  // ── Smart Resolution ──
  // If model contains a slash, it's almost certainly OpenRouter
  let providerName = (dbProviderName || process.env.AGENT_PROVIDER || 'deepseek').toLowerCase();
  let modelName = dbModel || (providerName === 'openrouter' ? process.env.AGENT_OPENROUTER_MODEL : undefined);

  if (modelName?.includes('/') && providerName !== 'openrouter') {
    console.log(`[agent:provider] Auto-switching to openrouter for model path: ${modelName}`);
    providerName = 'openrouter';
  }

  let configFn = PROVIDER_CONFIGS[providerName];
  if (!configFn) {
    console.warn(`[agent:provider] Unknown provider "${providerName}", falling back to DeepSeek`);
    providerName = 'deepseek';
    configFn = PROVIDER_CONFIGS.deepseek;
  }

  let config = configFn(modelName);
  if (!config && providerName !== 'deepseek') {
    console.warn(`[agent:provider] ${providerName} API key not configured, falling back to DeepSeek`);
    providerName = 'deepseek';
    config = PROVIDER_CONFIGS.deepseek(modelName?.includes('/') ? 'deepseek-chat' : modelName);
  }

  if (!config) {
    throw new Error(`[agent:provider] No API key configured for ${providerName} or DeepSeek. Check environment variables.`);
  }

  console.log(`[agent:provider] Resolved: ${providerName} (${config.model}, ${config.contextWindow / 1024}K context)`);
  
  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: timeoutMs,
    }),
    model: config.model,
    contextWindow: config.contextWindow,
    providerName,
    baseURL: config.baseURL,
  };
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
