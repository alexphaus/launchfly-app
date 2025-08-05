// src/lib/inngest/functions/generate-business.js
import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity } from '@/core/analyze';
import { launchBusiness } from '@/core/launch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Main business generation function with stage updates
 * Orchestrates the entire business creation process
 */
export const generateBusiness = inngest.createFunction(
  { 
    id: 'generate-business',
    name: 'Generate AI Business',
    retries: 2,
    concurrency: {
      // Limit concurrent generations to prevent API overload
      limit: 5,
    }
  },
  { event: EVENTS.BUSINESS_GENERATION_STARTED },
  async ({ event, step }) => {
    const { sessionId, businessId, formData } = event.data;
    
    try {
      // Stage 1: Analyzing
      await step.run('update-stage-analyzing', async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'analyzing', progress: 10 })
          .eq('id', sessionId);
          
        await supabase
          .from('businesses')
          .update({ status: 'generating' })
          .eq('id', businessId);
      });
      
      // Wait a bit for UI effect
      await step.sleep('analyzing-delay', '2s');
      
      // Stage 2: Research & Analysis
      const opportunity = await step.run('analyze-opportunity', async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'researching', progress: 30 })
          .eq('id', sessionId);
          
        const result = await analyzeOpportunity(formData, sessionId);
        
        // Update progress after analysis
        await supabase
          .from('sessions')
          .update({ progress: 50 })
          .eq('id', sessionId);
          
        return result;
      });
      
      // Stage 3: Building
      await step.run('update-stage-building', async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'building', progress: 60 })
          .eq('id', sessionId);
      });
      
      // Launch the business with periodic progress updates
      const businessData = await step.run('launch-business', async () => {
        const result = await launchBusiness(opportunity, sessionId, businessId);
        
        // Update progress
        await supabase
          .from('sessions')
          .update({ progress: 80 })
          .eq('id', sessionId);
          
        return result;
      });
      
      // Stage 4: Finalizing
      await step.run('finalize-business', async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'finalizing', progress: 90 })
          .eq('id', sessionId);
          
        // Update business with final data
        await supabase
          .from('businesses')
          .update({
            name: businessData.businessName,
            subdomain: businessData.domain ? 
              businessData.domain.replace('.com', '').toLowerCase() : 
              `business-${Date.now()}`,
            business_data: businessData,
            status: 'ready'
          })
          .eq('id', businessId);
      });
      
      // Wait for finalization effect
      await step.sleep('finalizing-delay', '1.5s');
      
      // Stage 5: Complete
      await step.run('complete-generation', async () => {
        await supabase
          .from('sessions')
          .update({ 
            stage: 'complete', 
            progress: 100,
            completed_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      });
      
      // Trigger growth campaigns after business is ready
      await step.sendEvent('trigger-initial-growth', {
        name: EVENTS.GROWTH_CAMPAIGN_STARTED,
        data: {
          businessId,
          businessData,
          campaignType: 'initial_launch'
        }
      });
      
      return { success: true, businessData };
      
    } catch (error) {
      // Handle errors gracefully
      await step.run('handle-generation-error', async () => {
        console.error('Business generation error:', error);
        
        await supabase
          .from('sessions')
          .update({ 
            stage: 'error',
            error_message: error.message 
          })
          .eq('id', sessionId);
          
        await supabase
          .from('businesses')
          .update({ status: 'failed' })
          .eq('id', businessId);
      });
      
      throw error;
    }
  }
);