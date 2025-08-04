/**
 * Inngest API Route
 * 
 * Serves all Inngest functions for the Launchfly application.
 * This single endpoint handles all background job orchestration.
 */

import { serve } from "inngest/next";
import { inngest } from "../../../lib/inngest.js";

// Import all Inngest functions
import {
  businessGenerationOrchestrator,
  handleAnalysisCompleted,
  handleCreationCompleted,
  handleGenerationCompleted
} from "../../../lib/inngest/functions/business-generation.js";

import {
  growthStrategyOrchestrator,
  customerAcquisitionCampaign,
  coldEmailCampaignOrchestrator,
  handleColdEmailBatchSent
} from "../../../lib/inngest/functions/growth-strategies.js";

// Collect all functions
const functions = [
  // Business Generation Functions
  businessGenerationOrchestrator,
  handleAnalysisCompleted,
  handleCreationCompleted,
  handleGenerationCompleted,
  
  // Growth Strategy Functions
  growthStrategyOrchestrator,
  customerAcquisitionCampaign,
  coldEmailCampaignOrchestrator,
  handleColdEmailBatchSent
];

// Create and export the handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  streaming: true
});

// Health check for the Inngest endpoint
export async function HEAD() {
  return new Response('OK', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Inngest-Functions': functions.length.toString(),
      'X-Inngest-Status': 'healthy'
    }
  });
}
