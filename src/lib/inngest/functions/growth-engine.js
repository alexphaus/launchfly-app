// src/lib/inngest/functions/growth-engine.js
import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import { growBusiness, runGrowthExperiments } from '@/core/grow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Growth Engine - Orchestrates all growth strategies
 * Runs experiments, tracks metrics, and optimizes campaigns
 */
export const growthEngine = inngest.createFunction(
  {
    id: 'growth-engine',
    name: 'Growth Engine Orchestrator',
    retries: 2,
    concurrency: {
      limit: 20,
    }
  },
  { event: EVENTS.GROWTH_CAMPAIGN_STARTED },
  async ({ event, step }) => {
    const { businessId, businessData, campaignType } = event.data;
    
    // Step 1: Initialize growth tracking
    const growthSession = await step.run('init-growth-session', async () => {
      const { data, error } = await supabase
        .from('growth_sessions')
        .insert({
          business_id: businessId,
          campaign_type: campaignType,
          status: 'active',
          started_at: new Date().toISOString(),
          metrics: {
            leads_generated: 0,
            conversions: 0,
            revenue_generated: 0
          }
        })
        .select()
        .single();
        
      if (error) console.error('Error creating growth session:', error);
      return data;
    });
    
    // Step 2: Run core growth strategies in parallel
    const growthResults = await step.run('execute-growth-strategies', async () => {
      // This uses the existing growBusiness function but with better error handling
      try {
        const results = await growBusiness(businessData, businessId);
        return results;
      } catch (error) {
        console.error('Growth strategy error:', error);
        return {
          customers: { totalLeads: 0, totalVisits: 0 },
          revenue: { totalRevenue: 0 }
        };
      }
    });
    
    // Step 3: Launch customer acquisition campaigns
    if (businessData.businessName) {
      // Trigger comprehensive customer acquisition
      await step.sendEvent('trigger-customer-acquisition', {
        name: EVENTS.CUSTOMER_ACQUISITION_STARTED,
        data: {
          businessId,
          businessData
        }
      });
      
      // Also trigger content generation
      await step.sendEvent('trigger-content-generation', {
        name: EVENTS.CONTENT_GENERATION_REQUESTED,
        data: {
          businessId,
          businessData,
          contentType: 'blog_posts',
          quantity: 5
        }
      });
    }
    
    // Step 4: Run growth experiments
    const experiments = await step.run('run-growth-experiments', async () => {
      try {
        const results = await runGrowthExperiments(businessData);
        
        // Store experiment results
        if (results && results.length > 0) {
          await supabase
            .from('growth_experiments')
            .insert(
              results.map(exp => ({
                business_id: businessId,
                name: exp.name,
                hypothesis: exp.hypothesis,
                success: exp.success,
                learnings: exp.learnings,
                created_at: new Date().toISOString()
              }))
            );
        }
        
        return results;
      } catch (error) {
        console.error('Experiment error:', error);
        return [];
      }
    });
    
    // Step 5: Update business metrics
    await step.run('update-business-metrics', async () => {
      const updates = {
        last_growth_campaign_at: new Date().toISOString(),
      };
      
      if (growthResults.customers) {
        updates.total_leads = growthResults.customers.totalLeads || 0;
        updates.total_visitors = growthResults.customers.totalVisits || 0;
      }
      
      if (growthResults.revenue) {
        updates.projected_revenue = growthResults.revenue.totalRevenue || 0;
      }
      
      await supabase
        .from('businesses')
        .update(updates)
        .eq('id', businessId);
    });
    
    // Step 6: Schedule next growth cycle
    if (campaignType === 'initial_launch') {
      // Schedule daily growth campaigns for the first week
      for (let day = 1; day <= 7; day++) {
        await step.sendEvent(`schedule-day-${day}-growth`, {
          name: EVENTS.GROWTH_CAMPAIGN_STARTED,
          data: {
            businessId,
            businessData,
            campaignType: 'daily_growth',
            day
          },
          ts: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }
    
    // Step 7: Send growth report
    await step.run('send-growth-report', async () => {
      if (growthSession && businessData.form_data?.email) {
        // In production, send email report
        console.log('Growth report would be sent to:', businessData.form_data.email);
      }
    });
    
    return {
      success: true,
      session_id: growthSession?.id,
      metrics: {
        leads: growthResults.customers?.totalLeads || 0,
        visitors: growthResults.customers?.totalVisits || 0,
        revenue: growthResults.revenue?.totalRevenue || 0,
        experiments_run: experiments.length
      }
    };
  }
);