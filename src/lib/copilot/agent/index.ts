// src/lib/copilot/agent/index.ts
// Picks the agent. External webhook first, then LLM, then the starter.

import type { OpportunityAgent } from '../types';
import { LlmAgent, resolveLlmConfig } from './llm';
import { StarterAgent } from './starter';
import { WebhookAgent } from './webhook';

export function getAgent(): OpportunityAgent {
  if (process.env.COPILOT_AGENT_URL) return new WebhookAgent(process.env.COPILOT_AGENT_URL, process.env.COPILOT_AGENT_SECRET);
  const llm = resolveLlmConfig();
  if (llm) return new LlmAgent(llm);
  return new StarterAgent();
}

export { StarterAgent };
