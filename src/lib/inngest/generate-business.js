import { inngest } from "../inngest";
import { analyzeOpportunity, launchBusiness } from "@/core";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const generateBusinessFunction = inngest.createFunction(
  {
    id: "generate-business",
    name: "Generate AI Business",
    retries: 3, // Automatically retry failed steps
    concurrency: {
      limit: 5, // Process up to 5 businesses concurrently
    },
  },
  { event: "business/generation.requested" },
  async ({ event, step }) => {
    const { sessionId, businessId, formData, timestamp } = event.data;

    console.log(`[Inngest] Starting business generation for session ${sessionId}`);

    // Step 1: Analyze opportunity (can retry independently)
    const opportunity = await step.run("analyze-opportunity", async () => {
      console.log(`[Inngest] Analyzing opportunity for session ${sessionId}`);
      
      await supabase.from('sessions').update({ 
        stage: 'analyzing',
        progress: 25 
      }).eq('id', sessionId);
      
      return await analyzeOpportunity(formData, sessionId);
    });

    // Step 2: Generate website data
    const businessData = await step.run("generate-website", async () => {
      console.log(`[Inngest] Building website for session ${sessionId}`);
      
      await supabase.from('sessions').update({ 
        stage: 'building',
        progress: 60 
      }).eq('id', sessionId);
      
      return await launchBusiness(opportunity, sessionId, businessId);
    });

    // Step 3: Update database
    await step.run("finalize-business", async () => {
      console.log(`[Inngest] Finalizing business for session ${sessionId}`);
      
      await supabase.from('sessions').update({ 
        stage: 'finalizing',
        progress: 90 
      }).eq('id', sessionId);

      // Generate subdomain safely
      const subdomain = businessData.domain 
        ? businessData.domain.replace('.com', '').toLowerCase()
        : `business-${Date.now()}`;

      await supabase.from('businesses').update({
        name: businessData.businessName,
        subdomain: subdomain,
        business_data: businessData,
        status: 'ready'
      }).eq('id', businessId);

      await supabase.from('sessions').update({ 
        stage: 'complete',
        progress: 100 
      }).eq('id', sessionId);
    });

    console.log(`[Inngest] Business generation completed for session ${sessionId}`);
    return { success: true, businessData, sessionId, businessId };
  }
);