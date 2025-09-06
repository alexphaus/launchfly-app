/**
 * Inngest Functions for Enhanced AI Cofounder
 * 
 * These functions run the AI cofounder's thinking cycles, memory consolidation,
 * experiment monitoring, and other autonomous operations in a serverless environment.
 */

import { inngest } from '../client.js';
import { EnhancedAICofounder } from '../../ai-cofounder/enhanced-orchestrator.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Main thinking cycle - runs every 5 minutes
 */
export const aiCofounderThink = inngest.createFunction(
  {
    id: 'ai-cofounder-think',
    name: 'AI Cofounder Thinking Cycle',
    concurrency: {
      limit: 10, // Limit concurrent thinking cycles
      key: 'event.data.businessId'
    }
  },
  { cron: '*/5 * * * *' }, // Every 5 minutes
  async ({ event, step }) => {
    // Get all active businesses
    const { data: businesses } = await step.run('get-active-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id, ai_enabled, business_data')
        .eq('ai_enabled', true)
        .eq('status', 'active');
    });

    if (!businesses || businesses.length === 0) {
      return { message: 'No active businesses to process' };
    }

    // Process each business
    const results = await step.run('process-businesses', async () => {
      const processPromises = businesses.map(async (business) => {
        try {
          const cofounder = new EnhancedAICofounder(business.id);
          
          // Initialize if needed
          if (!cofounder.isRunning) {
            await cofounder.initialize();
          }
          
          // Run thinking cycle
          const result = await cofounder.think();
          
          return {
            businessId: business.id,
            success: true,
            result
          };
        } catch (error) {
          console.error(`Error processing business ${business.id}:`, error);
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(processPromises);
    });

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
);

/**
 * Memory consolidation - runs daily
 */
export const consolidateMemories = inngest.createFunction(
  {
    id: 'consolidate-memories',
    name: 'Consolidate AI Memories',
  },
  { cron: '0 3 * * *' }, // Daily at 3 AM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id')
        .eq('ai_enabled', true);
    });

    const results = await step.run('consolidate', async () => {
      const consolidationPromises = businesses.map(async (business) => {
        try {
          const { AIMemorySystem } = await import('../../ai-cofounder/memory-system.js');
          const memory = new AIMemorySystem(business.id);
          const result = await memory.consolidateMemories();
          
          return {
            businessId: business.id,
            success: true,
            ...result
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(consolidationPromises);
    });

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length
    };
  }
);

/**
 * Experiment monitoring - runs every 30 minutes
 */
export const monitorExperiments = inngest.createFunction(
  {
    id: 'monitor-experiments',
    name: 'Monitor Active Experiments',
  },
  { cron: '*/30 * * * *' }, // Every 30 minutes
  async ({ event, step }) => {
    // Get active experiments
    const { data: experiments } = await step.run('get-experiments', async () => {
      return await supabase
        .from('ai_experiments')
        .select('*')
        .eq('status', 'running');
    });

    if (!experiments || experiments.length === 0) {
      return { message: 'No active experiments' };
    }

    const results = await step.run('monitor', async () => {
      const monitorPromises = experiments.map(async (experiment) => {
        try {
          const { AutonomousExperiments } = await import('../../ai-cofounder/autonomous-experiments.js');
          const experimenter = new AutonomousExperiments(experiment.business_id);
          
          // Restore experiment state
          experimenter.activeExperiments.set(experiment.id, experiment);
          
          // Monitor experiment
          const result = await experimenter.monitorExperiment(experiment.id);
          
          return {
            experimentId: experiment.id,
            success: true,
            result
          };
        } catch (error) {
          return {
            experimentId: experiment.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(monitorPromises);
    });

    return {
      monitored: results.length,
      completed: results.filter(r => r.result?.shouldStop).length
    };
  }
);

/**
 * Generate new experiments - runs weekly
 */
export const generateExperiments = inngest.createFunction(
  {
    id: 'generate-experiments',
    name: 'Generate New Experiments',
  },
  { cron: '0 9 * * 1' }, // Weekly on Monday at 9 AM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id')
        .eq('ai_enabled', true)
        .eq('status', 'active');
    });

    const results = await step.run('generate', async () => {
      const generatePromises = businesses.map(async (business) => {
        try {
          const { AutonomousExperiments } = await import('../../ai-cofounder/autonomous-experiments.js');
          const experimenter = new AutonomousExperiments(business.id);
          const experiments = await experimenter.generateExperiments();
          
          return {
            businessId: business.id,
            success: true,
            generated: experiments.length
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(generatePromises);
    });

    return {
      businesses: results.length,
      totalGenerated: results.reduce((sum, r) => sum + (r.generated || 0), 0)
    };
  }
);

/**
 * Plan execution - runs every hour
 */
export const executePlans = inngest.createFunction(
  {
    id: 'execute-plans',
    name: 'Execute Business Plans',
  },
  { cron: '0 * * * *' }, // Every hour
  async ({ event, step }) => {
    const { data: plans } = await step.run('get-active-plans', async () => {
      return await supabase
        .from('ai_business_plans')
        .select('*')
        .eq('status', 'active');
    });

    if (!plans || plans.length === 0) {
      return { message: 'No active plans' };
    }

    const results = await step.run('execute', async () => {
      const executePromises = plans.map(async (plan) => {
        try {
          const { AdaptivePlanner } = await import('../../ai-cofounder/adaptive-planner.js');
          const planner = new AdaptivePlanner(plan.business_id);
          
          // Restore plan
          planner.currentPlan = plan.plan;
          
          // Execute plan
          const result = await planner.executePlan();
          
          return {
            planId: plan.id,
            businessId: plan.business_id,
            success: true,
            result
          };
        } catch (error) {
          return {
            planId: plan.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(executePromises);
    });

    return {
      executed: results.length,
      successful: results.filter(r => r.success).length
    };
  }
);

/**
 * Customer conversation check - runs every 15 minutes
 */
export const checkConversations = inngest.createFunction(
  {
    id: 'check-conversations',
    name: 'Check Customer Conversations',
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ event, step }) => {
    // Check for new messages in conversations
    const { data: conversations } = await step.run('get-conversations', async () => {
      return await supabase
        .from('ai_conversations')
        .select('*')
        .eq('status', 'active')
        .order('last_message_at', { ascending: false });
    });

    if (!conversations || conversations.length === 0) {
      return { message: 'No active conversations' };
    }

    // Process any pending responses
    const results = await step.run('process-messages', async () => {
      // Implementation would check for new messages and generate responses
      return { processed: conversations.length };
    });

    return results;
  }
);

/**
 * Proactive outreach - runs daily
 */
export const proactiveOutreach = inngest.createFunction(
  {
    id: 'proactive-outreach',
    name: 'Generate Proactive Outreach',
  },
  { cron: '0 10 * * *' }, // Daily at 10 AM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id, business_data')
        .eq('ai_enabled', true)
        .eq('status', 'active');
    });

    const results = await step.run('generate-outreach', async () => {
      const outreachPromises = businesses.map(async (business) => {
        try {
          const { ConversationEngine } = await import('../../ai-cofounder/conversation-engine.js');
          const engine = new ConversationEngine(business.id);
          
          // Generate proactive outreach based on triggers
          const campaigns = await engine.generateProactiveOutreach({
            type: 'daily_check',
            context: business.business_data
          });
          
          return {
            businessId: business.id,
            success: true,
            campaigns: campaigns.length
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(outreachPromises);
    });

    return {
      businesses: results.length,
      totalCampaigns: results.reduce((sum, r) => sum + (r.campaigns || 0), 0)
    };
  }
);

/**
 * Revenue forecasting - runs weekly
 */
export const forecastRevenue = inngest.createFunction(
  {
    id: 'forecast-revenue',
    name: 'AI Revenue Forecasting',
  },
  { cron: '0 6 * * 1' }, // Weekly on Monday at 6 AM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id')
        .eq('ai_enabled', true);
    });

    const results = await step.run('forecast', async () => {
      const forecastPromises = businesses.map(async (business) => {
        try {
          const { RevenueIntelligence } = await import('../../ai-cofounder/revenue-intelligence.js');
          const revenue = new RevenueIntelligence(business.id);
          const forecast = await revenue.generateForecast();
          
          return {
            businessId: business.id,
            success: true,
            forecast
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(forecastPromises);
    });

    return {
      forecasted: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
);

/**
 * Competitor monitoring - runs twice daily
 */
export const monitorCompetitors = inngest.createFunction(
  {
    id: 'monitor-competitors',
    name: 'Monitor Competitor Activity',
  },
  { cron: '0 8,20 * * *' }, // Twice daily at 8 AM and 8 PM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('id, business_data')
        .eq('ai_enabled', true);
    });

    const results = await step.run('analyze-competitors', async () => {
      const analysisPromises = businesses.map(async (business) => {
        try {
          const { VisionAnalyzer } = await import('../../ai-cofounder/vision-analyzer.js');
          const vision = new VisionAnalyzer(business.id);
          const analysis = await vision.analyzeCompetitors();
          
          // Store insights in memory
          if (analysis.insights?.length > 0) {
            const { AIMemorySystem } = await import('../../ai-cofounder/memory-system.js');
            const memory = new AIMemorySystem(business.id);
            
            for (const insight of analysis.insights) {
              await memory.remember({
                content: insight,
                category: 'competitor_analysis',
                importance: 0.7
              });
            }
          }
          
          return {
            businessId: business.id,
            success: true,
            insights: analysis.insights?.length || 0
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(analysisPromises);
    });

    return {
      analyzed: results.filter(r => r.success).length,
      totalInsights: results.reduce((sum, r) => sum + (r.insights || 0), 0)
    };
  }
);

/**
 * User digest - runs weekly
 */
export const sendUserDigest = inngest.createFunction(
  {
    id: 'send-user-digest',
    name: 'Send Weekly User Digest',
  },
  { cron: '0 9 * * 1' }, // Weekly on Monday at 9 AM
  async ({ event, step }) => {
    const { data: businesses } = await step.run('get-businesses', async () => {
      return await supabase
        .from('businesses')
        .select('*')
        .eq('ai_enabled', true)
        .eq('digest_enabled', true);
    });

    const results = await step.run('send-digests', async () => {
      const digestPromises = businesses.map(async (business) => {
        try {
          // Gather weekly metrics and activities
          const [metrics, activities, experiments] = await Promise.all([
            supabase
              .from('business_metrics')
              .select('*')
              .eq('business_id', business.id)
              .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false }),
            
            supabase
              .from('ai_activities')
              .select('*')
              .eq('business_id', business.id)
              .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false })
              .limit(20),
            
            supabase
              .from('ai_experiments')
              .select('*')
              .eq('business_id', business.id)
              .in('status', ['running', 'completed'])
              .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          ]);

          // Generate digest content
          const digest = {
            businessName: business.name,
            week: new Date().toISOString().split('T')[0],
            metrics: metrics.data,
            activities: activities.data,
            experiments: experiments.data,
            highlights: [],
            recommendations: []
          };

          // Send digest email
          // Implementation would use email service
          
          return {
            businessId: business.id,
            success: true,
            sent: true
          };
        } catch (error) {
          return {
            businessId: business.id,
            success: false,
            error: error.message
          };
        }
      });

      return await Promise.all(digestPromises);
    });

    return {
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
);

// Export all functions
export const enhancedAICofounderFunctions = [
  aiCofounderThink,
  consolidateMemories,
  monitorExperiments,
  generateExperiments,
  executePlans,
  checkConversations,
  proactiveOutreach,
  forecastRevenue,
  monitorCompetitors,
  sendUserDigest
];
