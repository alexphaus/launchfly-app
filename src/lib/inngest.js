// src/lib/inngest.js
/**
 * Inngest Client Configuration
 * 
 * Central configuration for all Inngest functions and events.
 * This provides the foundation for our AI orchestration system.
 */

import { Inngest } from "inngest";

// Create the main Inngest client
export const inngest = new Inngest({ 
  id: "launchfly", 
  name: "Launchfly AI Business Generator",
  eventKey: process.env.INNGEST_EVENT_KEY
});

// Event types for type safety and better organization
export const EventTypes = {
  // Business Generation Flow
  BUSINESS_GENERATION_STARTED: "business/generation.started",
  BUSINESS_ANALYSIS_COMPLETED: "business/analysis.completed", 
  BUSINESS_RESEARCH_COMPLETED: "business/research.completed",
  BUSINESS_CREATION_COMPLETED: "business/creation.completed",
  BUSINESS_GENERATION_COMPLETED: "business/generation.completed",
  
  // Growth & Marketing Flow
  GROWTH_STRATEGY_STARTED: "growth/strategy.started",
  COLD_EMAIL_CAMPAIGN_STARTED: "growth/cold-email.started",
  COLD_EMAIL_BATCH_SENT: "growth/cold-email.batch-sent",
  GROWTH_EXPERIMENT_COMPLETED: "growth/experiment.completed",
  
  // Customer Acquisition
  CUSTOMER_ACQUISITION_STARTED: "customer/acquisition.started",
  DAILY_OUTREACH_SCHEDULED: "customer/outreach.daily",
  EMAIL_RESPONSE_RECEIVED: "customer/email.response",
  OPTIMIZATION_STARTED: "customer/optimization.started",
  WEEKLY_REPORT_SCHEDULED: "customer/report.weekly",
  LEAD_GENERATED: "customer/lead.generated",
  CUSTOMER_CONVERTED: "customer/converted",
  
  // Business Operations
  WEBSITE_TRAFFIC_DETECTED: "business/traffic.detected",
  SALE_COMPLETED: "business/sale.completed",
  REVENUE_MILESTONE_REACHED: "business/milestone.reached",
  
  // Error Handling
  PROCESS_FAILED: "system/process.failed",
  RETRY_REQUIRED: "system/retry.required"
};

// Utility function to send events with consistent structure
export async function sendEvent(eventName, data, user = null) {
  try {
    const eventData = {
      name: eventName,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        ...(user && { user })
      }
    };
    
    await inngest.send(eventData);
    console.log(`✅ Inngest event sent: ${eventName}`, { eventData });
    return { success: true, eventData };
  } catch (error) {
    console.error(`❌ Failed to send Inngest event: ${eventName}`, error);
    throw error;
  }
}

// Helper to send events with retry logic
export async function sendEventWithRetry(eventName, data, user = null, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await sendEvent(eventName, data, user);
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Event data schemas for validation and documentation
export const EventSchemas = {
  businessGenerationStarted: {
    sessionId: "string",
    businessId: "string", 
    userData: "object",
    formData: "object"
  },
  
  growthStrategyStarted: {
    businessId: "string",
    businessData: "object",
    strategies: "array"
  },
  
  coldEmailCampaignStarted: {
    businessId: "string",
    campaign: "object",
    targetList: "array"
  }
};
