// scripts/integrate-existing-webhooks.js
// Add Revenue Graph tracking to your existing Stripe webhook

import { getCentralAIBrain } from '../src/lib/central-ai-brain/orchestrator.js';

// Add this to your existing Stripe webhook handler
export async function enhanceExistingStripeWebhook(event, business) {
  // Your existing webhook logic stays the same...
  
  // ADD THIS: Record conversion in Revenue Graph
  if (event.type === 'checkout.session.completed') {
    const brain = getCentralAIBrain();
    if (brain) {
      await brain.revenueAnalyzer.recordConversion({
        businessId: business.id,
        businessType: business.business_data?.businessType || 'service',
        industry: business.business_data?.industry || 'general',
        offerType: event.data.object.metadata?.offerType || 'product',
        channel: event.data.object.metadata?.channel || 'website',
        messageTemplate: event.data.object.metadata?.campaign || 'default',
        timing: {
          dayOfWeek: new Date().getDay(),
          hourOfDay: new Date().getHours(),
          timezone: 'UTC'
        },
        conversionValue: event.data.object.amount_total / 100,
        customerData: {
          email: event.data.object.customer_details?.email,
          source: event.data.object.metadata?.source
        },
        campaignData: event.data.object.metadata || {}
      });
    }
  }
  
  // Your existing webhook logic continues...
}

// Example integration with your current webhook
export function integrateWithCurrentWebhook() {
  console.log(`
🔗 Integration Instructions:

1. Find your existing Stripe webhook handler (likely in src/app/api/stripe/webhook/)

2. Add this import at the top:
   import { getCentralAIBrain } from '@/lib/central-ai-brain/orchestrator';

3. Add this code after a successful payment:
   
   const brain = getCentralAIBrain();
   if (brain && event.type === 'checkout.session.completed') {
     await brain.revenueAnalyzer.recordConversion({
       businessId: session.metadata.businessId,
       businessType: business.business_data?.businessType || 'service',
       industry: business.business_data?.industry || 'general',
       offerType: session.metadata.offerType || 'product',
       channel: session.metadata.channel || 'website',
       conversionValue: session.amount_total / 100,
       // ... other data
     });
   }

That's it! Your existing businesses will now contribute to Revenue Graph intelligence.
  `);
}
