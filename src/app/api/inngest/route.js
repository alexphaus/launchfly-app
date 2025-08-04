import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';

/**
 * Inngest API Route
 * Handles all Inngest function executions
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  landingPage: true, // Enable the Inngest dev dashboard
});