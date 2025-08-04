/**
 * Inngest Function: Business Generation
 * 
 * This function handles the complete business generation process in the background,
 * using your existing core functions while tracking progress in the inngest_jobs table.
 */

import { createClient } from '@supabase/supabase-js';
import { inngest, INNGEST_EVENTS } from '../inngest.js';
import { analyzeOpportunity, launchBusiness } from '../../core/index.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const generateBusinessFunction = inngest.createFunction(
  { 
    id: 'generate-business',
    name: 'Generate Complete Business',
    retries: 2,
    // Increase timeout for business generation (5 minutes)
    timeout: '5m',
  },
  { event: INNGEST_EVENTS.BUSINESS_GENERATION_REQUESTED },
  async ({ event, step }) => {
    const { sessionId, businessId, formData, inngestJobId } = event.data;
    
    console.log('Starting Inngest business generation:', { sessionId, businessId, inngestJobId });

    // Step 1: Mark job as running and update session to analyzing
    await step.run('initialize-generation', async () => {
      // Update inngest_jobs table
      await supabase
        .from('inngest_jobs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', inngestJobId);

      // Update session stage to 'analyzing'
      await supabase
        .from('sessions')
        .update({ stage: 'analyzing' })
        .eq('id', sessionId);
        
      // Small delay to show analyzing stage
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { stage: 'analyzing' };
    });

    // Step 2: Analyze the business opportunity
    const opportunity = await step.run('analyze-opportunity', async () => {
      console.log('Analyzing business opportunity...');
      
      // Update session stage to 'researching'
      await supabase
        .from('sessions')
        .update({ stage: 'researching' })
        .eq('id', sessionId);
      
      // Call existing core function
      const result = await analyzeOpportunity(formData, sessionId);
      
      // Update inngest_jobs with progress
      await supabase
        .from('inngest_jobs')
        .update({ 
          progress: 30,
          current_step: 'opportunity_analyzed',
          step_data: { opportunity: result }
        })
        .eq('id', inngestJobId);
      
      return result;
    });

    // Step 3: Launch the business
    const businessData = await step.run('launch-business', async () => {
      console.log('Launching business...');
      
      // Update session stage to 'building'
      await supabase
        .from('sessions')
        .update({ stage: 'building' })
        .eq('id', sessionId);
        
      // Call existing core function
      const result = await launchBusiness(opportunity, sessionId, businessId);
      
      // Update inngest_jobs with more progress
      await supabase
        .from('inngest_jobs')
        .update({ 
          progress: 80,
          current_step: 'business_launched',
          step_data: { businessData: result }
        })
        .eq('id', inngestJobId);
      
      return result;
    });

    // Step 4: Finalize and save business data
    await step.run('finalize-business', async () => {
      console.log('Finalizing business...');
      
      // Update session stage to 'finalizing'
      await supabase
        .from('sessions')
        .update({ stage: 'finalizing' })
        .eq('id', sessionId);
        
      // Small delay for finalizing stage
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update business record with generated data
      await supabase
        .from('businesses')
        .update({
          name: businessData.businessName,
          subdomain: businessData.domain ? 
            businessData.domain.replace('.com', '').toLowerCase() : 
            `business-${Date.now()}`,
          business_data: businessData,
          opportunity_data: opportunity, // Store in the JSONB field
          status: 'ready'
        })
        .eq('id', businessId);

      // Mark session as complete
      await supabase
        .from('sessions')
        .update({ stage: 'complete' })
        .eq('id', sessionId);
        
      // Mark inngest job as completed
      await supabase
        .from('inngest_jobs')
        .update({ 
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          current_step: 'business_complete',
          result: { businessData, opportunity }
        })
        .eq('id', inngestJobId);
        
      return { success: true, businessData, opportunity };
    });

    // Step 5: Trigger email outreach (if enabled)
    await step.run('trigger-email-outreach', async () => {
      console.log('Triggering email outreach...');
      
      // Send event to start email outreach process
      await inngest.send({
        name: INNGEST_EVENTS.EMAIL_OUTREACH_REQUESTED,
        data: {
          businessId,
          sessionId,
          businessData,
          opportunity
        }
      });
      
      return { emailOutreachTriggered: true };
    });

    console.log('Business generation completed successfully:', { sessionId, businessId });
    
    return {
      success: true,
      businessId,
      sessionId,
      businessData,
      opportunity
    };
  }
);

// Error handling function - runs if the main function fails
export const generateBusinessFailedFunction = inngest.createFunction(
  { 
    id: 'generate-business-failed',
    name: 'Handle Business Generation Failure'
  },
  { event: INNGEST_EVENTS.BUSINESS_GENERATION_FAILED },
  async ({ event, step }) => {
    const { sessionId, businessId, inngestJobId, error } = event.data;
    
    await step.run('handle-failure', async () => {
      console.error('Business generation failed:', { sessionId, businessId, error });
      
      // Update session to error state
      await supabase
        .from('sessions')
        .update({ 
          stage: 'error',
          error_message: error.message || 'Business generation failed'
        })
        .eq('id', sessionId);
        
      // Update business status if we have businessId
      if (businessId) {
        await supabase
          .from('businesses')
          .update({ status: 'failed' })
          .eq('id', businessId);
      }
      
      // Update inngest job status
      if (inngestJobId) {
        await supabase
          .from('inngest_jobs')
          .update({ 
            status: 'failed',
            error_message: error.message || 'Unknown error',
            failed_at: new Date().toISOString()
          })
          .eq('id', inngestJobId);
      }
      
      return { handled: true };
    });
  }
);