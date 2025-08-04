/**
 * Business Generation Inngest Functions
 * 
 * Handles the complete business generation flow:
 * 1. analyzing -> researching -> building -> complete
 * 
 * This replaces direct API calls with a robust, retryable workflow
 */

import { inngest, EventTypes } from "@/lib/inngest";
import { analyzeOpportunity } from "@/core/analyze";
import { launchBusiness } from "@/core/launch";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
 
/**
 * Main business generation orchestrator
 * Coordinates the entire business creation process
 */
export const businessGenerationOrchestrator = inngest.createFunction(
  { 
    id: "business-generation-orchestrator",
    name: "Business Generation Orchestrator",
    retries: 2,
    concurrency: {
      limit: 3, // Limit concurrent business generations
      key: "event.data.sessionId"
    }
  },
  { event: EventTypes.BUSINESS_GENERATION_STARTED },
  async ({ event, step }) => {
    const { sessionId, businessId, userData, formData } = event.data;
    
    console.log(`🚀 Starting business generation orchestration for session: ${sessionId}`);

    try {
      // Step 1: Update status to analyzing
      await step.run("update-status-analyzing", async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'analyzing' })
          .eq('id', sessionId);
        
        await supabase
          .from('businesses')
          .update({ status: 'analyzing' })
          .eq('id', businessId);
        
        console.log(`📊 Status updated to analyzing for session: ${sessionId}`);
      });

      // Step 2: Analyze business opportunity (with delay for UX)
      const opportunity = await step.run("analyze-opportunity", async () => {
        console.log(`🔍 Analyzing opportunity for session: ${sessionId}`);
        
        // Add realistic delay for better UX
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const result = await analyzeOpportunity(userData, sessionId);
        
        // Send analysis completed event
        await inngest.send({
          name: EventTypes.BUSINESS_ANALYSIS_COMPLETED,
          data: { sessionId, businessId, opportunity: result }
        });
        
        return result;
      });

      // Step 3: Update status to researching
      await step.run("update-status-researching", async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'researching' })
          .eq('id', sessionId);
        
        console.log(`🔬 Status updated to researching for session: ${sessionId}`);
        
        // Add delay for researching stage
        await new Promise(resolve => setTimeout(resolve, 4000));
      });

      // Step 4: Update status to building  
      await step.run("update-status-building", async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'building' })
          .eq('id', sessionId);
        
        console.log(`🏗️ Status updated to building for session: ${sessionId}`);
      });

      // Step 5: Launch the business
      const businessData = await step.run("launch-business", async () => {
        console.log(`🚀 Launching business for session: ${sessionId}`);
        
        const result = await launchBusiness(opportunity, sessionId, businessId);
        
        // Send creation completed event
        await inngest.send({
          name: EventTypes.BUSINESS_CREATION_COMPLETED,
          data: { sessionId, businessId, businessData: result }
        });
        
        return result;
      });

      // Step 6: Complete the generation process
      await step.run("complete-generation", async () => {
        await supabase
          .from('sessions')
          .update({ stage: 'complete' })
          .eq('id', sessionId);
        
        await supabase
          .from('businesses')
          .update({ status: 'active' })
          .eq('id', businessId);
        
        console.log(`✅ Business generation completed for session: ${sessionId}`);
        
        // Send final completion event
        await inngest.send({
          name: EventTypes.BUSINESS_GENERATION_COMPLETED,
          data: { 
            sessionId, 
            businessId, 
            businessData,
            completedAt: new Date().toISOString()
          }
        });
      });

      // Step 7: Trigger growth strategies (optional, after 5 seconds)
      await step.sleep("wait-before-growth", "5s");
      
      await step.run("trigger-growth-strategies", async () => {
        // Start growth strategies in the background
        await inngest.send({
          name: EventTypes.GROWTH_STRATEGY_STARTED,
          data: { 
            businessId, 
            businessData,
            strategies: ['customer-acquisition', 'content-marketing', 'cold-outreach']
          }
        });
        
        console.log(`📈 Growth strategies triggered for business: ${businessId}`);
      });

      return {
        success: true,
        sessionId,
        businessId,
        message: "Business generation completed successfully"
      };

    } catch (error) {
      console.error(`❌ Business generation failed for session: ${sessionId}`, error);
      
      // Update status to error
      await supabase
        .from('sessions')
        .update({ stage: 'error' })
        .eq('id', sessionId);
      
      await supabase
        .from('businesses')
        .update({ status: 'error' })
        .eq('id', businessId);
      
      // Send failure event
      await inngest.send({
        name: EventTypes.PROCESS_FAILED,
        data: { 
          sessionId, 
          businessId, 
          process: 'business-generation',
          error: error.message,
          failedAt: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }
);

/**
 * Business analysis completion handler
 * Handles post-analysis tasks and notifications
 */
export const handleAnalysisCompleted = inngest.createFunction(
  {
    id: "handle-analysis-completed",
    name: "Handle Business Analysis Completed"
  },
  { event: EventTypes.BUSINESS_ANALYSIS_COMPLETED },
  async ({ event }) => {
    const { sessionId, businessId, opportunity } = event.data;
    
    console.log(`📊 Analysis completed for session: ${sessionId}`);
    
    // Store opportunity data for later use
    await supabase
      .from('businesses')
      .update({ 
        opportunity_data: opportunity,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    // Could add notifications, webhooks, etc. here
    return { success: true };
  }
);

/**
 * Business creation completion handler
 * Handles post-creation tasks and setup
 */
export const handleCreationCompleted = inngest.createFunction(
  {
    id: "handle-creation-completed", 
    name: "Handle Business Creation Completed"
  },
  { event: EventTypes.BUSINESS_CREATION_COMPLETED },
  async ({ event }) => {
    const { sessionId, businessId, businessData } = event.data;
    
    console.log(`🏗️ Business creation completed for session: ${sessionId}`);
    
    // Could trigger:
    // - Welcome email to business owner
    // - Initial SEO setup
    // - Social media account creation
    // - Initial content generation
    
    return { success: true };
  }
);

/**
 * Final business generation completion handler
 * Handles final setup and notifications
 */
export const handleGenerationCompleted = inngest.createFunction(
  {
    id: "handle-generation-completed",
    name: "Handle Business Generation Completed"
  },
  { event: EventTypes.BUSINESS_GENERATION_COMPLETED },
  async ({ event }) => {
    const { sessionId, businessId, businessData } = event.data;
    
    console.log(`✅ Full business generation completed for session: ${sessionId}`);
    
    // Final tasks:
    // - Send completion email
    // - Update analytics
    // - Trigger initial marketing campaigns
    // - Set up monitoring
    
    return { success: true };
  }
);
