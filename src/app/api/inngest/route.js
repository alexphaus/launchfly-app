import { serve } from 'inngest/next';
import { inngest, BusinessEvents, updateBusinessProgress } from '@/lib/inngest';
import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity, launchBusiness, growBusiness } from '@/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Update session stage and progress
async function updateSessionStage(sessionId, stage, progress) {
  await supabase
    .from('sessions')
    .update({ 
      stage, 
      progress: progress || getProgressForStage(stage) 
    })
    .eq('id', sessionId);
}

// Get default progress percentage based on stage
function getProgressForStage(stage) {
  const stages = {
    'pending': 0,
    'analyzing': 25,
    'researching': 45,
    'building': 65,
    'finalizing': 85,
    'complete': 100,
    'error': 0
  };
  return stages[stage] || 0;
}

// Business Analysis Function
const analyzeBusinessOpportunity = inngest.createFunction(
  { id: "analyze-business-opportunity" },
  { event: "business/analysis.started" },
  async ({ event, step }) => {
    const { sessionId, businessId, formData } = event.data;
    
    try {
      // Update session to analyzing stage
      await step.run("update-session-analyzing", async () => {
        await updateSessionStage(sessionId, 'analyzing', 25);
      });
      
      // Analyze the business opportunity
      const opportunity = await step.run("analyze-opportunity", async () => {
        return await analyzeOpportunity(formData, sessionId);
      });
      
      // Update business with name and initial data
      await step.run("update-business-name", async () => {
        await updateBusinessProgress(businessId, {
          businessName: opportunity.businessName,
          niche: opportunity.niche,
          problem: opportunity.problem,
          solution: opportunity.solution,
          uniqueAdvantage: opportunity.uniqueAdvantage
        });
        
        // Also update the name in the main business record for display
        await supabase
          .from('businesses')
          .update({ 
            name: opportunity.businessName
          })
          .eq('id', businessId);
      });
      
      // Send a real-time event about the business name
      await step.run("emit-name-created", async () => {
        await inngest.send({
          name: BusinessEvents.BusinessNameCreated,
          data: { 
            businessId, 
            sessionId,
            businessName: opportunity.businessName
          }
        });
      });
      
      // Store opportunity data
      await step.run("store-opportunity-data", async () => {
        await supabase
          .from('businesses')
          .update({ 
            opportunity_data: opportunity
          })
          .eq('id', businessId);
      });
      
      // Update session to researching stage
      await step.run("update-session-researching", async () => {
        await updateSessionStage(sessionId, 'researching', 45);
      });
      
      // Emit completion event
      return { 
        success: true,
        opportunity,
        sessionId,
        businessId,
        formData
      };
    } catch (error) {
      console.error("Error in analysis step:", error);
      
      // Update session to error state
      await step.run("update-session-error", async () => {
        await updateSessionStage(sessionId, 'error');
        await supabase
          .from('sessions')
          .update({ error_message: error.message })
          .eq('id', sessionId);
      });
      
      return {
        success: false,
        error: error.message,
        sessionId,
        businessId
      };
    }
  }
);

// Business Building Function
const buildBusiness = inngest.createFunction(
  { id: "build-business" },
  { event: "business/building.started" },
  async ({ event, step }) => {
    const { sessionId, businessId, opportunity, formData } = event.data;
    
    try {
      // Update session to building stage
      await step.run("update-session-building", async () => {
        await updateSessionStage(sessionId, 'building', 65);
      });
      
      // Generate website theme and design first
      await step.run("generate-website-theme", async () => {
        // Simulating the theme generation part of launchBusiness
        const theme = {
          colors: {
            primary: '#3b82f6',
            secondary: '#1e40af',
            textDark: '#1f2937',
            textGray: '#6b7280',
            borderColor: '#e5e7eb'
          },
          font: 'Inter',
          gradient: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'
        };
        
        const logo = opportunity.niche.includes('tech') ? '💻' : 
                    opportunity.niche.includes('food') ? '🍽️' :
                    opportunity.niche.includes('health') ? '💪' : '🚀';
                    
        // Update business with theme
        await updateBusinessProgress(businessId, {
          theme,
          logo
        });
        
        // Emit theme applied event
        await inngest.send({
          name: BusinessEvents.BusinessThemeApplied,
          data: { businessId, sessionId, theme, logo }
        });
        
        return { theme, logo };
      });
      
      // Small delay to show the theme/design changes in the UI
      await step.sleep("theme-display-delay", 2000);
      
      // Generate products
      await step.run("generate-products", async () => {
        // Simulating product generation
        const products = [
          {
            name: `${opportunity.businessName} Starter`,
            price: '$199',
            description: 'Perfect for getting started',
            features: [
              'Basic setup included',
              'Email support',
              '30-day guarantee'
            ]
          },
          {
            name: `${opportunity.businessName} Pro`,
            price: '$499',
            description: 'Most popular choice',
            features: [
              'Everything in Starter',
              'Priority support',
              'Advanced features',
              'Custom setup'
            ],
            popular: true
          },
          {
            name: `${opportunity.businessName} Enterprise`,
            price: '$999',
            description: 'For serious businesses',
            features: [
              'Everything in Pro',
              'Dedicated support',
              'Custom development',
              'SLA guarantee'
            ]
          }
        ];
        
        // Update business with products
        await updateBusinessProgress(businessId, {
          products
        });
        
        // Emit products created event
        await inngest.send({
          name: BusinessEvents.BusinessProductsCreated,
          data: { businessId, sessionId, products }
        });
        
        return products;
      });
      
      // Small delay to show the products in the UI
      await step.sleep("products-display-delay", 2000);
      
      // Generate tagline and marketing
      await step.run("generate-marketing", async () => {
        const tagline = `${opportunity.businessName}: ${opportunity.solution} for ${opportunity.niche}`;
        const marketing = {
          tagline,
          description: opportunity.solution,
          targetAudience: opportunity.niche,
          channels: ['Social Media', 'Email Marketing', 'Content Marketing']
        };
        
        // Update business with marketing data
        await updateBusinessProgress(businessId, {
          tagline,
          marketing
        });
        
        // Emit tagline created event
        await inngest.send({
          name: BusinessEvents.BusinessTaglineCreated,
          data: { businessId, sessionId, tagline }
        });
        
        return marketing;
      });
      
      // Launch the business (actual full business data generation)
      const businessData = await step.run("launch-business", async () => {
        return await launchBusiness(opportunity, sessionId, businessId);
      });
      
      // Update session to finalizing stage
      await step.run("update-session-finalizing", async () => {
        await updateSessionStage(sessionId, 'finalizing', 85);
      });
      
      // Update business with generated data
      await step.run("update-business-data", async () => {
        await supabase
          .from('businesses')
          .update({
            name: businessData.businessName,
            subdomain: businessData.domain ? businessData.domain.replace('.com', '').toLowerCase() : `business-${Date.now()}`,
            business_data: businessData,
            status: 'ready'
          })
          .eq('id', businessId);
      });
      
      // Update session to complete stage
      await step.run("update-session-complete", async () => {
        await updateSessionStage(sessionId, 'complete', 100);
      });
      
      // Return success
      return { 
        success: true, 
        businessData,
        sessionId,
        businessId
      };
    } catch (error) {
      console.error("Error in building step:", error);
      
      // Update session to error state
      await step.run("update-session-error", async () => {
        await updateSessionStage(sessionId, 'error');
        await supabase
          .from('sessions')
          .update({ error_message: error.message })
          .eq('id', sessionId);
          
        // Update business status
        await supabase
          .from('businesses')
          .update({ status: 'failed' })
          .eq('id', businessId);
      });
      
      return {
        success: false,
        error: error.message,
        sessionId,
        businessId
      };
    }
  }
);

// Business Generation Orchestrator
const generateBusinessOrchestrator = inngest.createFunction(
  { id: "generate-business-orchestrator" },
  { event: "business/generation.requested" },
  async ({ event, step }) => {
    const { sessionId, businessId, formData } = event.data;
    
    try {
      // Step 1: Analyze the business opportunity
      const analysisResult = await step.run("analyze-opportunity", async () => {
        const result = await inngest.send({
          name: "business/analysis.started",
          data: { sessionId, businessId, formData }
        });
        return result;
      });
      
      // Only proceed if analysis was successful
      if (!analysisResult.success) {
        throw new Error("Business analysis failed");
      }
      
      // Step 2: Start building the business
      const buildResult = await step.run("build-business", async () => {
        const result = await inngest.send({
          name: "business/building.started",
          data: { 
            sessionId, 
            businessId, 
            opportunity: analysisResult.opportunity, 
            formData 
          }
        });
        return result;
      });
      
      // Emit completion event
      await step.run("emit-completion", async () => {
        await inngest.send({
          name: BusinessEvents.GenerationCompleted,
          data: {
            sessionId,
            businessId,
            businessData: buildResult.businessData
          }
        });
      });
      
      return { 
        success: true, 
        sessionId,
        businessId,
        businessData: buildResult.businessData
      };
    } catch (error) {
      console.error("Error in business generation:", error);
      
      // Update session to error state
      await step.run("handle-error", async () => {
        await updateSessionStage(sessionId, 'error');
        await supabase
          .from('sessions')
          .update({ error_message: error.message })
          .eq('id', sessionId);
          
        // Update business status
        await supabase
          .from('businesses')
          .update({ status: 'failed' })
          .eq('id', businessId);
          
        // Emit failure event
        await inngest.send({
          name: BusinessEvents.GenerationFailed,
          data: {
            sessionId,
            businessId,
            error: error.message
          }
        });
      });
      
      return {
        success: false,
        error: error.message,
        sessionId,
        businessId
      };
    }
  }
);

// Growth function remains the same
// ...existing code...

// Export the Inngest handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeBusinessOpportunity,
    buildBusiness,
    generateBusinessOrchestrator
    // ...existing code...
  ]
});

// Specify runtime config
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running AI tasks
