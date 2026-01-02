// src/lib/inngest/client.js
import { Inngest } from 'inngest';

/**
 * Inngest client for AI orchestration
 * Handles business generation and growth automation
 */
export const inngest = new Inngest({
  id: 'launchfly',
  name: 'Launchfly AI Platform',
  // CRITICAL: eventKey is required for sending events in production
  eventKey: process.env.INNGEST_EVENT_KEY
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

  // Analytics events
  VISITOR_TRACKED: 'analytics/visitor.tracked',
  SALE_RECORDED: 'analytics/sale.recorded',

  // Enhanced AI Cofounder events
  AI_COFOUNDER_STARTED: 'ai-cofounder/started',
  AI_COFOUNDER_THINKING: 'ai-cofounder/thinking',
  AI_COFOUNDER_DECISION_MADE: 'ai-cofounder/decision.made',
  AI_COFOUNDER_PLAN_CREATED: 'ai-cofounder/plan.created',
  AI_COFOUNDER_PLAN_ADAPTED: 'ai-cofounder/plan.adapted',
  AI_COFOUNDER_EXPERIMENT_LAUNCHED: 'ai-cofounder/experiment.launched',
  AI_COFOUNDER_EXPERIMENT_COMPLETED: 'ai-cofounder/experiment.completed',
  AI_COFOUNDER_MEMORY_STORED: 'ai-cofounder/memory.stored',
  AI_COFOUNDER_CONVERSATION_STARTED: 'ai-cofounder/conversation.started',
  AI_COFOUNDER_REVENUE_FORECAST: 'ai-cofounder/revenue.forecast',

  // WhatsApp OS Follow-up Events
  WHATSAPP_FOLLOWUP_SCHEDULED: 'whatsapp/followup.scheduled',
  WHATSAPP_FOLLOWUP_SENT: 'whatsapp/followup.sent',
};