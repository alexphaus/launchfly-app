/**
 * Inngest Client Configuration
 * 
 * This module sets up the Inngest client for background job processing.
 * It handles business generation, email outreach, and growth automation.
 */

import { Inngest } from 'inngest';

// Create the main Inngest client
export const inngest = new Inngest({
  id: 'launchfly',
  name: 'Launchfly Business Generator',
  env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
});

// Event type definitions for better TypeScript support and documentation
export const INNGEST_EVENTS = {
  BUSINESS_GENERATION_REQUESTED: 'business/generation.requested',
  BUSINESS_GENERATION_COMPLETED: 'business/generation.completed',
  BUSINESS_GENERATION_FAILED: 'business/generation.failed',
  
  EMAIL_OUTREACH_REQUESTED: 'email/outreach.requested',
  EMAIL_OUTREACH_COMPLETED: 'email/outreach.completed',
  
  GROWTH_ENGINE_DAILY: 'growth/engine.daily',
  GROWTH_EXPERIMENT_STARTED: 'growth/experiment.started',
  GROWTH_EXPERIMENT_COMPLETED: 'growth/experiment.completed',
};

// Helper function to send events with consistent format
export async function sendInngestEvent(eventName, data) {
  try {
    const result = await inngest.send({
      name: eventName,
      data,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`Inngest event sent: ${eventName}`, { eventId: result.ids?.[0] });
    return result;
  } catch (error) {
    console.error(`Failed to send Inngest event: ${eventName}`, error);
    throw error;
  }
}

export default inngest;