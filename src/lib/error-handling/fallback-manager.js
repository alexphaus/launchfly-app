/**
 * @fileoverview Fallback manager for AI sales system
 * Handles graceful degradation when components fail
 */

import { AI_EVENTS } from '../analytics/ai-events';

/**
 * Fallback strategies for different types of failures
 */
export const FALLBACK_STRATEGIES = {
  AI_UNAVAILABLE: 'ai_unavailable',
  PAYMENT_FAILED: 'payment_failed',
  INTENT_DETECTION_FAILED: 'intent_detection_failed',
  ANALYTICS_FAILED: 'analytics_failed',
  NETWORK_ERROR: 'network_error',
  RATE_LIMITED: 'rate_limited',
  CONFIGURATION_ERROR: 'configuration_error'
};

/**
 * Fallback manager class
 */
export class FallbackManager {
  constructor(options = {}) {
    this.options = {
      enableFallbacks: true,
      logErrors: true,
      retryAttempts: 3,
      retryDelay: 1000,
      humanHandoffEnabled: true,
      fallbackMessages: {},
      ...options
    };
    
    this.failureCount = new Map();
    this.lastFailures = new Map();
    this.analytics = null;
  }

  /**
   * Set analytics client for error tracking
   * @param {Object} analyticsClient - Analytics client instance
   */
  setAnalytics(analyticsClient) {
    this.analytics = analyticsClient;
  }

  /**
   * Handle AI service failure
   * @param {Object} context - Failure context
   * @returns {Object} Fallback response
   */
  async handleAIFailure(context) {
    const { error, userMessage, sessionId, attempt = 1 } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.AI_UNAVAILABLE, error, context);
    
    // Try retry if within limits
    if (attempt <= this.options.retryAttempts) {
      await this.delay(this.options.retryDelay * attempt);
      return {
        action: 'retry',
        attempt: attempt + 1,
        delay: this.options.retryDelay * attempt
      };
    }
    
    // Check if human handoff should be triggered
    if (this.shouldTriggerHumanHandoff(FALLBACK_STRATEGIES.AI_UNAVAILABLE)) {
      return this.createHumanHandoffFallback(context);
    }
    
    // Return fallback response
    return {
      action: 'fallback_response',
      response: this.getAIFallbackMessage(userMessage),
      showContactForm: true,
      metadata: {
        isFallback: true,
        reason: 'ai_unavailable',
        originalError: error.message
      }
    };
  }

  /**
   * Handle payment processing failure
   * @param {Object} context - Payment context
   * @returns {Object} Fallback options
   */
  async handlePaymentFailure(context) {
    const { error, paymentData, attempt = 1 } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.PAYMENT_FAILED, error, context);
    
    // Determine payment failure type
    const failureType = this.classifyPaymentError(error);
    
    switch (failureType) {
      case 'card_declined':
        return {
          action: 'alternative_payment',
          message: 'Your card was declined. Would you like to try a different payment method?',
          alternatives: ['bank_transfer', 'paypal', 'crypto'],
          showRetry: true
        };
        
      case 'network_error':
        if (attempt <= this.options.retryAttempts) {
          return {
            action: 'retry_payment',
            attempt: attempt + 1,
            message: 'Connection issue detected. Retrying payment...'
          };
        }
        break;
        
      case 'validation_error':
        return {
          action: 'fix_details',
          message: 'Please check your payment details and try again.',
          showForm: true,
          highlightErrors: true
        };
        
      case 'service_unavailable':
        return {
          action: 'manual_process',
          message: 'Payment processing is temporarily unavailable. We can process your order manually.',
          showContactForm: true,
          escalateToHuman: true
        };
    }
    
    // Default fallback
    return {
      action: 'contact_support',
      message: 'We encountered an issue processing your payment. Our team will contact you shortly to complete your order.',
      showContactForm: true,
      collectPaymentInfo: true
    };
  }

  /**
   * Handle intent detection failure
   * @param {Object} context - Intent context
   * @returns {Object} Fallback strategy
   */
  handleIntentFailure(context) {
    const { error, visitorData } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.INTENT_DETECTION_FAILED, error, context);
    
    // Use basic heuristics as fallback
    const fallbackIntent = this.calculateBasicIntent(visitorData);
    
    return {
      action: 'basic_intent',
      intentScore: fallbackIntent.score,
      confidence: 'low',
      triggers: {
        showChat: fallbackIntent.score > 30,
        proactiveMessage: false,
        exitIntentOnly: true
      },
      message: 'Using simplified intent detection',
      degraded: true
    };
  }

  /**
   * Handle network/connectivity errors
   * @param {Object} context - Network error context
   * @returns {Object} Network fallback
   */
  handleNetworkError(context) {
    const { error, operation, attempt = 1 } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.NETWORK_ERROR, error, context);
    
    if (attempt <= this.options.retryAttempts) {
      return {
        action: 'retry_with_backoff',
        attempt: attempt + 1,
        delay: this.calculateBackoffDelay(attempt),
        message: 'Connection issue. Retrying...'
      };
    }
    
    // Offline mode fallback
    return {
      action: 'offline_mode',
      message: 'You appear to be offline. Your message will be sent when connection is restored.',
      queueMessage: true,
      showOfflineIndicator: true,
      enableLocalStorage: true
    };
  }

  /**
   * Handle rate limiting
   * @param {Object} context - Rate limit context
   * @returns {Object} Rate limit fallback
   */
  handleRateLimit(context) {
    const { retryAfter, operation } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.RATE_LIMITED, new Error('Rate limited'), context);
    
    return {
      action: 'rate_limit_wait',
      message: `Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
      showTimer: true,
      queueOperation: true,
      autoRetry: true
    };
  }

  /**
   * Handle configuration errors
   * @param {Object} context - Configuration context
   * @returns {Object} Configuration fallback
   */
  handleConfigurationError(context) {
    const { error, component } = context;
    
    this.trackFailure(FALLBACK_STRATEGIES.CONFIGURATION_ERROR, error, context);
    
    return {
      action: 'default_config',
      message: 'Using default settings due to configuration issue.',
      useDefaults: true,
      notifyAdmin: true,
      gracefulDegradation: true
    };
  }

  /**
   * Check if human handoff should be triggered
   * @param {string} failureType - Type of failure
   * @returns {boolean} Whether to trigger handoff
   */
  shouldTriggerHumanHandoff(failureType) {
    if (!this.options.humanHandoffEnabled) return false;
    
    const failureCount = this.failureCount.get(failureType) || 0;
    const consecutiveFailures = this.getConsecutiveFailures(failureType);
    
    // Trigger handoff after multiple failures
    return failureCount >= 3 || consecutiveFailures >= 2;
  }

  /**
   * Create human handoff fallback
   * @param {Object} context - Failure context
   * @returns {Object} Human handoff response
   */
  createHumanHandoffFallback(context) {
    return {
      action: 'human_handoff',
      message: 'I\'m having some technical difficulties. Let me connect you with one of our human agents who can help you right away.',
      showContactForm: true,
      priorityQueue: true,
      includeContext: true,
      contextData: {
        conversationHistory: context.conversationHistory,
        visitorData: context.visitorData,
        failureReason: context.error?.message
      }
    };
  }

  /**
   * Get AI fallback message based on user input
   * @param {string} userMessage - User's message
   * @returns {string} Fallback response
   */
  getAIFallbackMessage(userMessage) {
    const message = userMessage?.toLowerCase() || '';
    
    // Simple keyword-based responses
    if (message.includes('price') || message.includes('cost')) {
      return "I'd be happy to help with pricing information! Please visit our pricing page or fill out the contact form below and someone will get back to you with detailed pricing.";
    }
    
    if (message.includes('demo') || message.includes('trial')) {
      return "Great! I'd love to set up a demo for you. Please fill out the contact form below and we'll schedule a personalized demonstration.";
    }
    
    if (message.includes('support') || message.includes('help')) {
      return "I'm here to help! While I'm experiencing some technical issues, please use the contact form below and our support team will assist you promptly.";
    }
    
    // Default fallback
    return "I apologize, but I'm experiencing some technical difficulties right now. Please use the contact form below and one of our team members will get back to you shortly.";
  }

  /**
   * Calculate basic intent from visitor data
   * @param {Object} visitorData - Visitor information
   * @returns {Object} Basic intent calculation
   */
  calculateBasicIntent(visitorData) {
    let score = 10; // Base score
    
    if (visitorData.timeOnPage > 60) score += 20;
    if (visitorData.pageViews > 3) score += 15;
    if (visitorData.scrollDepth > 50) score += 10;
    if (visitorData.referrer?.includes('google')) score += 5;
    
    return {
      score: Math.min(score, 100),
      method: 'basic_heuristics',
      reliability: 'low'
    };
  }

  /**
   * Classify payment error type
   * @param {Error} error - Payment error
   * @returns {string} Error classification
   */
  classifyPaymentError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('declined') || message.includes('insufficient')) {
      return 'card_declined';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'network_error';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'validation_error';
    }
    if (message.includes('unavailable') || message.includes('service')) {
      return 'service_unavailable';
    }
    
    return 'unknown';
  }

  /**
   * Calculate backoff delay for retries
   * @param {number} attempt - Attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }

  /**
   * Track failure occurrence
   * @param {string} type - Failure type
   * @param {Error} error - Error object
   * @param {Object} context - Failure context
   */
  trackFailure(type, error, context) {
    // Update failure counts
    const count = this.failureCount.get(type) || 0;
    this.failureCount.set(type, count + 1);
    
    // Track last failure time
    this.lastFailures.set(type, Date.now());
    
    // Log error if enabled
    if (this.options.logErrors) {
      console.error(`Fallback triggered for ${type}:`, error, context);
    }
    
    // Track in analytics
    if (this.analytics) {
      this.analytics.track(AI_EVENTS.AI_ERROR, {
        errorType: type,
        errorMessage: error?.message || 'Unknown error',
        context: JSON.stringify(context),
        failureCount: count + 1
      });
    }
  }

  /**
   * Get consecutive failure count
   * @param {string} type - Failure type
   * @returns {number} Consecutive failures
   */
  getConsecutiveFailures(type) {
    const lastFailure = this.lastFailures.get(type);
    if (!lastFailure) return 0;
    
    // Reset if last failure was more than 10 minutes ago
    if (Date.now() - lastFailure > 600000) {
      this.failureCount.set(type, 0);
      return 0;
    }
    
    return this.failureCount.get(type) || 0;
  }

  /**
   * Reset failure counts
   * @param {string} type - Failure type (optional)
   */
  resetFailures(type = null) {
    if (type) {
      this.failureCount.delete(type);
      this.lastFailures.delete(type);
    } else {
      this.failureCount.clear();
      this.lastFailures.clear();
    }
  }

  /**
   * Get failure statistics
   * @returns {Object} Failure statistics
   */
  getFailureStats() {
    const stats = {};
    
    for (const [type, count] of this.failureCount.entries()) {
      stats[type] = {
        count,
        lastFailure: this.lastFailures.get(type),
        consecutive: this.getConsecutiveFailures(type)
      };
    }
    
    return stats;
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default FallbackManager;