/**
 * @fileoverview PostHog analytics client configuration
 * Handles event tracking and A/B testing for AI sales optimization
 */

import posthog from 'posthog-js';

// Initialize PostHog (client-side)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    autocapture: false, // We'll handle events manually for better control
    capture_pageview: true,
    disable_session_recording: false, // Enable for debugging
    loaded: (posthog) => {
      // Set up custom configuration
      if (process.env.NODE_ENV === 'development') {
        posthog.debug();
      }
    }
  });
}

export default posthog;

/**
 * PostHog client wrapper with AI sales specific functionality
 */
export class AIAnalyticsClient {
  constructor(visitorId, sessionId, businessId) {
    this.visitorId = visitorId;
    this.sessionId = sessionId;
    this.businessId = businessId;
    this.isInitialized = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
    
    if (this.isInitialized) {
      // Identify user for session tracking
      posthog.identify(visitorId, {
        sessionId,
        businessId,
        role: 'visitor'
      });
    }
  }

  /**
   * Track AI sales events
   * @param {string} event - Event name
   * @param {Object} properties - Event properties
   */
  track(event, properties = {}) {
    if (!this.isInitialized) return;

    const eventData = {
      ...properties,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      businessId: this.businessId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    };

    posthog.capture(event, eventData);
  }

  /**
   * Track visitor intent changes
   * @param {Object} intentData - Intent analysis data
   */
  trackIntentChange(intentData) {
    this.track('ai_intent_changed', {
      intentScore: intentData.score,
      intentStage: intentData.stage,
      confidence: intentData.confidence,
      signals: intentData.signals,
      recommendations: intentData.recommendations.map(r => r.action)
    });
  }

  /**
   * Track chat interactions
   * @param {Object} chatData - Chat interaction data
   */
  trackChatEvent(chatData) {
    const { event, messageId, role, content, metadata = {} } = chatData;
    
    this.track(`ai_chat_${event}`, {
      messageId,
      role,
      contentLength: content?.length || 0,
      messageType: metadata.messageType || 'text',
      functionCall: metadata.functionCall,
      isError: metadata.isError,
      responseTime: metadata.responseTime
    });
  }

  /**
   * Track payment events
   * @param {Object} paymentData - Payment event data
   */
  trackPaymentEvent(paymentData) {
    const { event, amount, currency, paymentMethod, status, error } = paymentData;
    
    this.track(`ai_payment_${event}`, {
      amount,
      currency: currency || 'USD',
      paymentMethod,
      status,
      error,
      aiAssisted: true
    });
  }

  /**
   * Track conversion funnel
   * @param {string} stage - Funnel stage
   * @param {Object} data - Stage-specific data
   */
  trackFunnel(stage, data = {}) {
    this.track('ai_funnel_step', {
      stage,
      ...data
    });
  }

  /**
   * Get feature flag values
   * @param {string} flag - Feature flag key
   * @param {*} defaultValue - Default value if flag not found
   * @returns {*} Feature flag value
   */
  getFeatureFlag(flag, defaultValue = false) {
    if (!this.isInitialized) return defaultValue;
    return posthog.getFeatureFlag(flag) ?? defaultValue;
  }

  /**
   * Get active experiments
   * @returns {Object} Active experiments and their variants
   */
  getActiveExperiments() {
    if (!this.isInitialized) return {};
    return posthog.getActiveMatchingFeatureFlags() || {};
  }

  /**
   * Set user properties
   * @param {Object} properties - User properties to set
   */
  setUserProperties(properties) {
    if (!this.isInitialized) return;
    posthog.people.set(properties);
  }

  /**
   * Group user for cohort analysis
   * @param {string} groupType - Group type (e.g., 'business', 'industry')
   * @param {string} groupKey - Group identifier
   * @param {Object} properties - Group properties
   */
  group(groupType, groupKey, properties = {}) {
    if (!this.isInitialized) return;
    posthog.group(groupType, groupKey, properties);
  }

  /**
   * Track page view with AI context
   * @param {Object} pageData - Page view data
   */
  trackPageView(pageData = {}) {
    if (!this.isInitialized) return;
    
    this.track('ai_page_view', {
      page: window.location.pathname,
      title: document.title,
      ...pageData
    });
  }

  /**
   * Start session tracking
   */
  startSession() {
    this.track('ai_session_start', {
      device: this.getDeviceInfo(),
      viewport: this.getViewportInfo()
    });
  }

  /**
   * End session tracking
   * @param {Object} sessionData - Session summary data
   */
  endSession(sessionData = {}) {
    this.track('ai_session_end', {
      duration: sessionData.duration,
      interactions: sessionData.interactions,
      conversion: sessionData.conversion,
      revenue: sessionData.revenue
    });
  }

  /**
   * Get device information
   * @returns {Object} Device info
   */
  getDeviceInfo() {
    if (typeof window === 'undefined') return {};
    
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled
    };
  }

  /**
   * Get viewport information
   * @returns {Object} Viewport info
   */
  getViewportInfo() {
    if (typeof window === 'undefined') return {};
    
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
  }

  /**
   * Flush pending events (for page unload)
   */
  flush() {
    if (!this.isInitialized) return;
    posthog.flush();
  }
}

/**
 * Create analytics client instance
 * @param {string} visitorId - Visitor ID
 * @param {string} sessionId - Session ID
 * @param {string} businessId - Business ID
 * @returns {AIAnalyticsClient} Analytics client instance
 */
export function createAnalyticsClient(visitorId, sessionId, businessId) {
  return new AIAnalyticsClient(visitorId, sessionId, businessId);
}