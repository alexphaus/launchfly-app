/**
 * Inngest API Handler
 * 
 * This route handles webhooks from Inngest for executing background functions.
 * All Inngest functions are registered and served through this endpoint.
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';

// Import all Inngest functions
import { 
  generateBusinessFunction, 
  generateBusinessFailedFunction 
} from '@/lib/inngest/functions/generate-business';

import { emailOutreachFunction } from '@/lib/inngest/functions/customer-acquisition';

import { 
  dailyGrowthEngine, 
  startGrowthExperiment 
} from '@/lib/inngest/functions/growth-engine';

// Register all functions with Inngest
const handler = serve({
  client: inngest,
  functions: [
    generateBusinessFunction,
    generateBusinessFailedFunction,
    emailOutreachFunction,
    dailyGrowthEngine,
    startGrowthExperiment,
  ],
  // Streaming allows for better performance with long-running functions
  streaming: true,
});

// Export handlers for Next.js App Router
export { handler as GET, handler as POST, handler as PUT };

// Set runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes to handle long-running business generation