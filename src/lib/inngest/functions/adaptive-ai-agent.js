// src/lib/inngest/functions/adaptive-ai-agent.js
import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { AdaptiveAIAgent } from '@/lib/adaptive-ai-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Agent Tick Cron Job
 * This function runs every 5 minutes and triggers an execution cycle for every
 * business with the adaptive agent enabled. This is the main heartbeat of the AI system.
 */
export const agentTick = inngest.createFunction(
  {
    id: 'adaptive-ai-agent-tick',
    name: 'Adaptive AI Agent - 5-Minute Tick',
    retries: 2,
  },
  { cron: '*/5 * * * *' }, // Every 5 minutes
  async ({ step }) => {
    console.log('⏰ Adaptive AI Agent Tick running...');

    const businesses = await step.run('fetch-enabled-businesses', async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('adaptive_agent_enabled', true);
      
      if (error) {
        console.error('Error fetching enabled businesses:', error);
        return [];
      }
      return data || [];
    });

    if (businesses.length === 0) {
      return { success: true, message: 'No adaptive agents enabled.' };
    }

    const events = businesses.map(business => ({
      name: 'agent.run.cycle',
      data: { businessId: business.id },
    }));

    await step.sendEvent('fan-out-agent-cycles', events);

    return {
      success: true,
      triggeredCycles: businesses.length,
    };
  }
);

/**
 * Run Agent Cycle
 * This function is triggered for a single business and executes one full
 * "think-act-reflect" cycle of the adaptive agent.
 */
export const runAgentCycle = inngest.createFunction(
  {
    id: 'adaptive-ai-agent-run-cycle',
    name: 'Adaptive AI Agent - Run Cycle',
    retries: 3,
    concurrency: {
      limit: 1,
      key: "event.data.businessId", // Ensure only one cycle runs at a time per business
    },
  },
  { event: 'agent.run.cycle' },
  async ({ event, step }) => {
    const { businessId } = event.data;
    
    const result = await step.run(`run-cycle-for-${businessId}`, async () => {
      const agent = new AdaptiveAIAgent(businessId);
      return await agent.runCycle();
    });

    return {
      success: true,
      businessId,
      result,
    };
  }
);
