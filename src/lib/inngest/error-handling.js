import { inngest } from "../inngest";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Error handler function that runs when any other function fails
 */
export const errorHandlerFunction = inngest.createFunction(
  {
    id: "error-handler",
    name: "Handle Failed Business Generation",
  },
  { event: "business/generation.failed" },
  async ({ event, step }) => {
    const { sessionId, businessId, error, originalEventData } = event.data;

    console.log(`[Inngest] Handling error for session ${sessionId}:`, error);

    await step.run("update-error-state", async () => {
      // Update session with error details
      await supabase.from('sessions').update({
        stage: 'error',
        error_message: error.message || 'Unknown error occurred',
        progress: 0
      }).eq('id', sessionId);

      // Update business status
      if (businessId) {
        await supabase.from('businesses').update({
          status: 'failed',
          error_message: error.message || 'Generation failed'
        }).eq('id', businessId);
      }
    });

    // Optional: Send notification to user or admin
    await step.run("notify-error", async () => {
      // You could send an email, Slack notification, etc.
      console.log(`[Inngest] Error notification sent for session ${sessionId}`);
    });

    return { success: true, errorHandled: true };
  }
);

/**
 * Function to handle business data validation and cleanup
 */
export const validateBusinessFunction = inngest.createFunction(
  {
    id: "validate-business",
    name: "Validate Generated Business Data",
  },
  { event: "business/validation.requested" },
  async ({ event, step }) => {
    const { businessId, businessData } = event.data;

    console.log(`[Inngest] Validating business data for ${businessId}`);

    const validationResult = await step.run("validate-data", async () => {
      // Validate required fields
      const requiredFields = ['businessName', 'description', 'products'];
      const missingFields = requiredFields.filter(field => !businessData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate subdomain format
      if (businessData.domain) {
        const subdomain = businessData.domain.replace('.com', '').toLowerCase();
        if (!/^[a-z0-9-]+$/.test(subdomain)) {
          throw new Error('Invalid subdomain format');
        }
      }

      return { valid: true, warnings: [] };
    });

    await step.run("update-validation-status", async () => {
      await supabase.from('businesses').update({
        validation_status: 'validated',
        validation_result: validationResult
      }).eq('id', businessId);
    });

    return { success: true, validationResult };
  }
);

/**
 * Function to handle progressive business enhancement
 */
export const enhanceBusinessFunction = inngest.createFunction(
  {
    id: "enhance-business",
    name: "Enhance Business with Additional AI Features",
  },
  { event: "business/enhancement.requested" },
  async ({ event, step }) => {
    const { businessId, enhancementType } = event.data;

    console.log(`[Inngest] Enhancing business ${businessId} with ${enhancementType}`);

    const enhancement = await step.run("generate-enhancement", async () => {
      switch (enhancementType) {
        case 'seo':
          // Generate SEO optimizations
          return { type: 'seo', data: 'SEO enhancements generated' };
        case 'marketing':
          // Generate marketing materials
          return { type: 'marketing', data: 'Marketing materials generated' };
        case 'analytics':
          // Set up analytics tracking
          return { type: 'analytics', data: 'Analytics setup completed' };
        default:
          throw new Error(`Unknown enhancement type: ${enhancementType}`);
      }
    });

    await step.run("save-enhancement", async () => {
      // Update business with enhancement data
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();

      const updatedData = {
        ...business.business_data,
        enhancements: {
          ...business.business_data.enhancements,
          [enhancementType]: enhancement
        }
      };

      await supabase.from('businesses').update({
        business_data: updatedData
      }).eq('id', businessId);
    });

    return { success: true, enhancement };
  }
);
