/**
 * @fileoverview AI Sales analytics event definitions and tracking utilities
 * Standardized events for measuring AI sales performance
 */

/**
 * Standard AI sales events for tracking
 */
export const AI_EVENTS = {
  // Session events
  SESSION_START: 'ai_session_start',
  SESSION_END: 'ai_session_end',
  
  // Intent tracking events
  INTENT_DETECTED: 'ai_intent_detected',
  INTENT_THRESHOLD_REACHED: 'ai_intent_threshold_reached',
  INTENT_SCORE_CHANGED: 'ai_intent_score_changed',
  EXIT_INTENT_DETECTED: 'ai_exit_intent_detected',
  
  // Chat events
  CHAT_OPENED: 'ai_chat_opened',
  CHAT_CLOSED: 'ai_chat_closed',
  CHAT_MINIMIZED: 'ai_chat_minimized',
  MESSAGE_SENT: 'ai_message_sent',
  MESSAGE_RECEIVED: 'ai_message_received',
  TYPING_STARTED: 'ai_typing_started',
  TYPING_STOPPED: 'ai_typing_stopped',
  
  // AI behavior events
  AI_RESPONSE_GENERATED: 'ai_response_generated',
  AI_FUNCTION_CALLED: 'ai_function_called',
  AI_ERROR: 'ai_error',
  AI_FALLBACK_TRIGGERED: 'ai_fallback_triggered',
  
  // Sales events
  PRODUCT_RECOMMENDED: 'ai_product_recommended',
  DISCOUNT_OFFERED: 'ai_discount_offered',
  OBJECTION_HANDLED: 'ai_objection_handled',
  DEMO_SCHEDULED: 'ai_demo_scheduled',
  ROI_CALCULATED: 'ai_roi_calculated',
  
  // Payment events
  PAYMENT_INITIATED: 'ai_payment_initiated',
  PAYMENT_COMPLETED: 'ai_payment_completed',
  PAYMENT_FAILED: 'ai_payment_failed',
  PAYMENT_ABANDONED: 'ai_payment_abandoned',
  
  // Conversion events
  LEAD_CAPTURED: 'ai_lead_captured',
  SALE_COMPLETED: 'ai_sale_completed',
  UPSELL_SUCCESSFUL: 'ai_upsell_successful',
  
  // Engagement events
  CTA_CLICKED: 'ai_cta_clicked',
  PRICING_VIEWED: 'ai_pricing_viewed',
  PRODUCT_VIEWED: 'ai_product_viewed',
  FAQ_ACCESSED: 'ai_faq_accessed',
  
  // A/B testing events
  EXPERIMENT_STARTED: 'ai_experiment_started',
  VARIANT_SHOWN: 'ai_variant_shown',
  GOAL_ACHIEVED: 'ai_goal_achieved',
  
  // Configuration events
  CONFIG_UPDATED: 'ai_config_updated',
  AGENT_DEPLOYED: 'ai_agent_deployed',
  PERFORMANCE_REVIEWED: 'ai_performance_reviewed'
};

/**
 * Event properties schemas for validation
 */
export const EVENT_SCHEMAS = {
  [AI_EVENTS.INTENT_SCORE_CHANGED]: {
    required: ['intentScore', 'intentStage'],
    optional: ['previousScore', 'confidence', 'signals', 'recommendations']
  },
  
  [AI_EVENTS.MESSAGE_SENT]: {
    required: ['messageId', 'role', 'contentLength'],
    optional: ['messageType', 'functionCall', 'responseTime']
  },
  
  [AI_EVENTS.PAYMENT_COMPLETED]: {
    required: ['amount', 'currency', 'paymentMethod'],
    optional: ['productId', 'discountApplied', 'processingTime']
  },
  
  [AI_EVENTS.SALE_COMPLETED]: {
    required: ['revenue', 'currency', 'conversionTime'],
    optional: ['productsSold', 'discountGiven', 'aiInteractions']
  }
};

/**
 * Standard event properties that should be included with every event
 */
export const STANDARD_PROPERTIES = {
  timestamp: () => Date.now(),
  sessionId: null,
  visitorId: null,
  businessId: null,
  url: () => typeof window !== 'undefined' ? window.location.href : null,
  userAgent: () => typeof navigator !== 'undefined' ? navigator.userAgent : null
};

/**
 * Create standardized event data
 * @param {string} eventName - Event name
 * @param {Object} properties - Event-specific properties
 * @param {Object} context - Session context
 * @returns {Object} Standardized event data
 */
export function createEventData(eventName, properties = {}, context = {}) {
  const standardProps = {};
  
  // Add standard properties
  Object.entries(STANDARD_PROPERTIES).forEach(([key, value]) => {
    if (typeof value === 'function') {
      standardProps[key] = value();
    } else if (context[key] !== undefined) {
      standardProps[key] = context[key];
    } else {
      standardProps[key] = value;
    }
  });
  
  return {
    event: eventName,
    properties: {
      ...standardProps,
      ...properties
    },
    timestamp: Date.now()
  };
}

/**
 * Validate event data against schema
 * @param {string} eventName - Event name
 * @param {Object} properties - Event properties
 * @returns {Object} Validation result
 */
export function validateEventData(eventName, properties) {
  const schema = EVENT_SCHEMAS[eventName];
  if (!schema) {
    return { valid: true, warnings: [`No schema defined for event: ${eventName}`] };
  }
  
  const errors = [];
  const warnings = [];
  
  // Check required properties
  schema.required?.forEach(prop => {
    if (properties[prop] === undefined || properties[prop] === null) {
      errors.push(`Missing required property: ${prop}`);
    }
  });
  
  // Check for unexpected properties
  const allowedProps = [...(schema.required || []), ...(schema.optional || [])];
  Object.keys(properties).forEach(prop => {
    if (!allowedProps.includes(prop) && !Object.keys(STANDARD_PROPERTIES).includes(prop)) {
      warnings.push(`Unexpected property: ${prop}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Funnel stages for conversion tracking
 */
export const CONVERSION_FUNNEL = {
  LANDED: 'landed',
  ENGAGED: 'engaged',
  INTERESTED: 'interested',
  CONSIDERING: 'considering',
  DECIDED: 'decided',
  PURCHASED: 'purchased'
};

/**
 * Track funnel progression
 * @param {string} stage - Funnel stage
 * @param {Object} analytics - Analytics client
 * @param {Object} data - Additional data
 */
export function trackFunnelStage(stage, analytics, data = {}) {
  analytics.track(AI_EVENTS.INTENT_DETECTED, {
    funnelStage: stage,
    progression: true,
    ...data
  });
}

/**
 * Performance metrics to track
 */
export const PERFORMANCE_METRICS = {
  // Engagement metrics
  CHAT_OPEN_RATE: 'chat_open_rate',
  RESPONSE_RATE: 'response_rate',
  SESSION_DURATION: 'session_duration',
  MESSAGES_PER_SESSION: 'messages_per_session',
  
  // Conversion metrics
  CHAT_TO_LEAD_RATE: 'chat_to_lead_rate',
  CHAT_TO_SALE_RATE: 'chat_to_sale_rate',
  AVERAGE_ORDER_VALUE: 'average_order_value',
  REVENUE_PER_VISITOR: 'revenue_per_visitor',
  
  // AI performance metrics
  AI_RESPONSE_TIME: 'ai_response_time',
  AI_ACCURACY_RATE: 'ai_accuracy_rate',
  FUNCTION_CALL_SUCCESS_RATE: 'function_call_success_rate',
  ERROR_RATE: 'error_rate',
  
  // User experience metrics
  USER_SATISFACTION: 'user_satisfaction',
  CHAT_COMPLETION_RATE: 'chat_completion_rate',
  BOUNCE_RATE: 'bounce_rate',
  TIME_TO_CONVERSION: 'time_to_conversion'
};

/**
 * A/B testing experiment definitions
 */
export const EXPERIMENTS = {
  CHAT_OPENER: {
    name: 'AI Chat Opener Messaging',
    variants: [
      { id: 'control', name: 'Standard Greeting', weight: 50 },
      { id: 'personalized', name: 'Personalized Greeting', weight: 25 },
      { id: 'urgent', name: 'Urgency-based Greeting', weight: 25 }
    ],
    goal: AI_EVENTS.CHAT_OPENED,
    duration: 14 // days
  },
  
  DISCOUNT_STRATEGY: {
    name: 'Discount Offering Strategy',
    variants: [
      { id: 'immediate', name: 'Immediate Discount', weight: 33 },
      { id: 'earned', name: 'Earned Discount', weight: 33 },
      { id: 'exit_intent', name: 'Exit Intent Only', weight: 34 }
    ],
    goal: AI_EVENTS.SALE_COMPLETED,
    duration: 21
  },
  
  INTENT_THRESHOLD: {
    name: 'Intent Detection Threshold',
    variants: [
      { id: 'low', name: 'Low Threshold (35%)', weight: 33, threshold: 35 },
      { id: 'medium', name: 'Medium Threshold (50%)', weight: 34, threshold: 50 },
      { id: 'high', name: 'High Threshold (65%)', weight: 33, threshold: 65 }
    ],
    goal: AI_EVENTS.CHAT_OPENED,
    duration: 10
  }
};

/**
 * Calculate conversion rate
 * @param {number} conversions - Number of conversions
 * @param {number} visitors - Number of visitors
 * @returns {number} Conversion rate as percentage
 */
export function calculateConversionRate(conversions, visitors) {
  if (visitors === 0) return 0;
  return Math.round((conversions / visitors) * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate average order value
 * @param {number} totalRevenue - Total revenue
 * @param {number} orders - Number of orders
 * @returns {number} Average order value
 */
export function calculateAOV(totalRevenue, orders) {
  if (orders === 0) return 0;
  return Math.round((totalRevenue / orders) * 100) / 100;
}

/**
 * Calculate customer acquisition cost
 * @param {number} adSpend - Advertising spend
 * @param {number} customers - Number of customers acquired
 * @returns {number} Customer acquisition cost
 */
export function calculateCAC(adSpend, customers) {
  if (customers === 0) return 0;
  return Math.round((adSpend / customers) * 100) / 100;
}

/**
 * Generate analytics report data
 * @param {Array} events - Array of tracked events
 * @param {Object} timeRange - Time range for analysis
 * @returns {Object} Analytics report
 */
export function generateAnalyticsReport(events, timeRange) {
  const report = {
    period: timeRange,
    totalEvents: events.length,
    uniqueVisitors: new Set(events.map(e => e.properties.visitorId)).size,
    sessions: new Set(events.map(e => e.properties.sessionId)).size,
    conversions: events.filter(e => e.event === AI_EVENTS.SALE_COMPLETED).length,
    revenue: events
      .filter(e => e.event === AI_EVENTS.SALE_COMPLETED)
      .reduce((sum, e) => sum + (e.properties.revenue || 0), 0),
    metrics: {},
    funnelData: {},
    experimentResults: {}
  };
  
  // Calculate key metrics
  report.metrics.conversionRate = calculateConversionRate(report.conversions, report.uniqueVisitors);
  report.metrics.averageOrderValue = calculateAOV(report.revenue, report.conversions);
  report.metrics.revenuePerVisitor = report.uniqueVisitors > 0 
    ? Math.round((report.revenue / report.uniqueVisitors) * 100) / 100 
    : 0;
  
  return report;
}