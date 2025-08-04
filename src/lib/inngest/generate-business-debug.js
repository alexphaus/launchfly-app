import { inngest } from "../inngest";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const generateBusinessDebugFunction = inngest.createFunction(
  {
    id: "generate-business-debug",
    name: "Debug Business Generation",
    retries: 2,
    concurrency: {
      limit: 5,
    },
  },
  { event: "business/generation.debug" },
  async ({ event, step }) => {
    const { sessionId, businessId, formData, timestamp } = event.data;

    console.log(`=== DEBUG INNGEST FUNCTION: Starting business generation ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Business ID: ${businessId}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Form Data:`, formData);

    // Step 1: Mock analysis (quick)
    const opportunity = await step.run("mock-analyze-opportunity", async () => {
      console.log(`[Debug] Step 1: Mock analyzing opportunity for session ${sessionId}`);
      
      try {
        await supabase.from('sessions').update({ 
          stage: 'analyzing',
          progress: 25 
        }).eq('id', sessionId);
        
        // Mock opportunity data
        const mockOpportunity = {
          businessName: "AI Coaching Pro",
          description: "Professional AI coaching for entrepreneurs",
          targetMarket: formData.targetMarket || "entrepreneurs",
          businessModel: "1-on-1 coaching and courses",
          marketSize: 1000000,
          competition: "medium",
          successProbability: 0.85,
          quickWins: ["Create LinkedIn presence", "Start newsletter", "Offer free consultation"]
        };
        
        await supabase.from('sessions').update({ 
          stage: 'researching',
          progress: 40 
        }).eq('id', sessionId);
        
        console.log(`[Debug] Step 1 completed for session ${sessionId}`);
        return mockOpportunity;
      } catch (error) {
        console.error(`[Debug] Step 1 failed for session ${sessionId}:`, error);
        
        await supabase.from('sessions').update({ 
          stage: 'error',
          error_message: error.message 
        }).eq('id', sessionId);
        
        throw error;
      }
    });

    // Step 2: Mock business creation (quick)
    const businessData = await step.run("mock-generate-website", async () => {
      console.log(`[Debug] Step 2: Mock building website for session ${sessionId}`);
      
      try {
        await supabase.from('sessions').update({ 
          stage: 'building',
          progress: 60 
        }).eq('id', sessionId);
        
        // Mock business data
        const mockBusinessData = {
          businessName: opportunity.businessName,
          description: opportunity.description,
          domain: "ai-coaching-pro.com",
          subdomain: "ai-coaching-pro",
          products: [
            {
              id: 1,
              name: "1-Hour AI Strategy Session",
              price: 197,
              description: "Get personalized AI strategy for your business"
            },
            {
              id: 2,
              name: "AI Implementation Course",
              price: 497,
              description: "Complete course on implementing AI in your business" 
            }
          ],
          theme: {
            primaryColor: "#007BFF",
            secondaryColor: "#6C757D",
            backgroundColor: "#FFFFFF"
          },
          hero: {
            title: "Transform Your Business with AI Coaching",
            subtitle: "Expert guidance to implement AI solutions that actually work"
          }
        };
        
        await supabase.from('sessions').update({ 
          stage: 'finalizing',
          progress: 80 
        }).eq('id', sessionId);
        
        console.log(`[Debug] Step 2 completed for session ${sessionId}`);
        return mockBusinessData;
      } catch (error) {
        console.error(`[Debug] Step 2 failed for session ${sessionId}:`, error);
        
        await supabase.from('sessions').update({ 
          stage: 'error',
          error_message: error.message 
        }).eq('id', sessionId);
        
        throw error;
      }
    });

    // Step 3: Update database
    await step.run("finalize-business", async () => {
      console.log(`[Debug] Step 3: Finalizing business for session ${sessionId}`);
      
      try {
        await supabase.from('sessions').update({ 
          stage: 'finalizing',
          progress: 90 
        }).eq('id', sessionId);

        // Generate subdomain safely
        const subdomain = businessData.domain 
          ? businessData.domain.replace('.com', '').toLowerCase()
          : `business-${Date.now()}`;

        console.log(`[Debug] Updating business with subdomain: ${subdomain}`);
        await supabase.from('businesses').update({
          name: businessData.businessName,
          subdomain: subdomain,
          business_data: businessData,
          status: 'ready'
        }).eq('id', businessId);

        console.log(`[Debug] Marking session as complete`);
        await supabase.from('sessions').update({ 
          stage: 'complete',
          progress: 100 
        }).eq('id', sessionId);
        
        console.log(`[Debug] Step 3 completed for session ${sessionId}`);
      } catch (error) {
        console.error(`[Debug] Step 3 failed for session ${sessionId}:`, error);
        
        await supabase.from('sessions').update({ 
          stage: 'error',
          error_message: error.message 
        }).eq('id', sessionId);
        
        throw error;
      }
    });

    console.log(`[Debug] Business generation completed for session ${sessionId}`);
    return { success: true, businessData, sessionId, businessId };
  }
);
