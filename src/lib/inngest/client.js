// src/lib/inngest/client.js
import { Inngest } from 'inngest';

/**
 * Inngest client for AI orchestration
 * Handles business generation and growth automation
 */
export const inngest = new Inngest({ 
  id: 'launchfly',
  // This will allow us to track events in the Inngest dashboard
  name: 'Launchfly AI Platform'
});

// Event types for type safety
export const EVENTS = {
  // Business generation events
  BUSINESS_GENERATION_STARTED: 'business/generation.started',
  BUSINESS_STAGE_UPDATED: 'business/stage.updated',
  BUSINESS_GENERATION_COMPLETED: 'business/generation.completed',
  BUSINESS_GENERATION_FAILED: 'business/generation.failed',
  
  // Growth automation events
  GROWTH_CAMPAIGN_STARTED: 'growth/campaign.started',
  COLD_OUTREACH_REQUESTED: 'growth/outreach.requested',
  COLD_OUTREACH_FOLLOWUP: 'growth/outreach.followup',
  EMAIL_BATCH_SENT: 'growth/email.batch.sent',
  CONTENT_GENERATED: 'growth/content.generated',
  CONTENT_GENERATION_REQUESTED: 'growth/content.generation.requested',
  
  // Customer acquisition events
  CUSTOMER_ACQUISITION_STARTED: 'customer/acquisition.started',
  DAILY_OUTREACH_SCHEDULED: 'customer/outreach.daily',
  EMAIL_RESPONSE_RECEIVED: 'customer/email.response',
  OPTIMIZATION_STARTED: 'customer/optimization.started',
  WEEKLY_REPORT_SCHEDULED: 'customer/report.weekly',
  // Lead nurturing
  NURTURE_SCHEDULED: 'customer/nurture.scheduled',
  
  // Analytics events
  VISITOR_TRACKED: 'analytics/visitor.tracked',
  SALE_RECORDED: 'analytics/sale.recorded',
};