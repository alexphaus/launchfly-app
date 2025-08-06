/**
 * @fileoverview React hook for AI Sales analytics and optimization
 * Provides analytics tracking, A/B testing, and performance monitoring
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createAnalyticsClient } from '../lib/analytics/posthog-client';
import ABTestingManager from '../lib/analytics/ab-testing';
import { AI_EVENTS, trackFunnelStage, CONVERSION_FUNNEL } from '../lib/analytics/ai-events';

/**
 * Hook for AI sales analytics and optimization
 * @param {Object} options - Configuration options
 * @param {string} options.visitorId - Visitor ID
 * @param {string} options.sessionId - Session ID
 * @param {string} options.businessId - Business ID
 * @param {boolean} options.enabled - Whether analytics is enabled
 * @returns {Object} Analytics utilities and data
 */
export const useAISalesAnalytics = (options = {}) => {
  const { visitorId, sessionId, businessId, enabled = true } = options;
  
  const [analyticsClient, setAnalyticsClient] = useState(null);
  const [abTestingManager, setAbTestingManager] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [experiments, setExperiments] = useState({});
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  
  const sessionStartRef = useRef(Date.now());
  const eventCountRef = useRef(0);
  const funnelStageRef = useRef(CONVERSION_FUNNEL.LANDED);
  
  // Initialize analytics
  useEffect(() => {
    if (!enabled || !visitorId || !sessionId || !businessId) return;
    
    const initializeAnalytics = async () => {
      try {
        // Create analytics client
        const client = createAnalyticsClient(visitorId, sessionId, businessId);
        setAnalyticsClient(client);
        
        // Create A/B testing manager
        const abManager = new ABTestingManager(client, visitorId, businessId);
        await abManager.initializeExperiments();
        setAbTestingManager(abManager);
        
        // Get active experiments
        const activeExperiments = {};
        for (const [expId] of abManager.activeExperiments) {
          activeExperiments[expId] = abManager.getVariant(expId);
        }
        setExperiments(activeExperiments);
        
        // Track session start
        client.startSession();
        client.setUserProperties({
          businessId,
          sessionId,
          firstSeen: Date.now()
        });
        
        setIsInitialized(true);
        
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
      }
    };
    
    initializeAnalytics();
    
    // Cleanup on unmount
    return () => {
      if (analyticsClient) {
        analyticsClient.endSession({
          duration: Date.now() - sessionStartRef.current,
          interactions: eventCountRef.current,
          funnelStage: funnelStageRef.current
        });
        analyticsClient.flush();
      }
    };
  }, [enabled, visitorId, sessionId, businessId]);
  
  /**
   * Track custom event
   * @param {string} event - Event name
   * @param {Object} properties - Event properties
   */
  const track = useCallback((event, properties = {}) => {
    if (!analyticsClient || !isInitialized) return;
    
    analyticsClient.track(event, properties);
    eventCountRef.current++;
  }, [analyticsClient, isInitialized]);
  
  /**
   * Track intent changes
   * @param {Object} intentData - Intent analysis data
   */
  const trackIntentChange = useCallback((intentData) => {
    if (!analyticsClient) return;
    
    analyticsClient.trackIntentChange(intentData);
    
    // Update funnel stage based on intent
    const newStage = getFunnelStageFromIntent(intentData.stage);
    if (newStage !== funnelStageRef.current) {
      trackFunnelStage(newStage, analyticsClient, intentData);
      funnelStageRef.current = newStage;
    }
  }, [analyticsClient]);
  
  /**
   * Track chat events
   * @param {string} event - Chat event type
   * @param {Object} data - Chat event data
   */
  const trackChatEvent = useCallback((event, data = {}) => {
    if (!analyticsClient) return;
    
    analyticsClient.trackChatEvent({
      event,
      ...data
    });
    
    // Track experiment goals
    if (event === 'opened' && abTestingManager) {
      abTestingManager.trackGoalAchieved('CHAT_OPENER');
      abTestingManager.trackGoalAchieved('INTENT_THRESHOLD');
    }
  }, [analyticsClient, abTestingManager]);
  
  /**
   * Track payment events
   * @param {string} event - Payment event type
   * @param {Object} data - Payment data
   */
  const trackPaymentEvent = useCallback((event, data = {}) => {
    if (!analyticsClient) return;
    
    analyticsClient.trackPaymentEvent({
      event,
      ...data
    });
    
    // Track conversion goals
    if (event === 'completed' && abTestingManager) {
      abTestingManager.trackGoalAchieved('DISCOUNT_STRATEGY', {
        revenue: data.amount,
        currency: data.currency
      });
    }
  }, [analyticsClient, abTestingManager]);
  
  /**
   * Track page events
   * @param {Object} pageData - Page data
   */
  const trackPageView = useCallback((pageData = {}) => {
    if (!analyticsClient) return;
    
    analyticsClient.trackPageView(pageData);
  }, [analyticsClient]);
  
  /**
   * Get experiment variant
   * @param {string} experimentId - Experiment identifier
   * @returns {Object|null} Experiment variant
   */
  const getExperimentVariant = useCallback((experimentId) => {
    return experiments[experimentId] || null;
  }, [experiments]);
  
  /**
   * Get optimized chat opener
   * @param {Object} context - Visitor context
   * @returns {string} Optimized opener message
   */
  const getOptimizedChatOpener = useCallback((context = {}) => {
    if (!abTestingManager) {
      return "Hi there! How can I help you today?";
    }
    
    return abTestingManager.getChatOpener(context);
  }, [abTestingManager]);
  
  /**
   * Get optimized discount strategy
   * @param {Object} context - Sales context
   * @returns {Object} Discount strategy
   */
  const getOptimizedDiscountStrategy = useCallback((context = {}) => {
    if (!abTestingManager) {
      return { type: 'standard', timing: 'on_request' };
    }
    
    return abTestingManager.getDiscountStrategy(context);
  }, [abTestingManager]);
  
  /**
   * Get optimized intent threshold
   * @returns {number} Intent threshold
   */
  const getOptimizedIntentThreshold = useCallback(() => {
    if (!abTestingManager) {
      return 50;
    }
    
    return abTestingManager.getIntentThreshold();
  }, [abTestingManager]);
  
  /**
   * Update performance metrics
   * @param {Object} metrics - Metrics to update
   */
  const updateMetrics = useCallback((metrics) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      ...metrics,
      lastUpdated: Date.now()
    }));
  }, []);
  
  /**
   * Get session analytics data
   * @returns {Object} Session analytics
   */
  const getSessionAnalytics = useCallback(() => {
    return {
      sessionId,
      visitorId,
      businessId,
      duration: Date.now() - sessionStartRef.current,
      events: eventCountRef.current,
      funnelStage: funnelStageRef.current,
      experiments: Object.keys(experiments),
      isInitialized
    };
  }, [sessionId, visitorId, businessId, experiments, isInitialized]);
  
  /**
   * Force flush analytics events
   */
  const flush = useCallback(() => {
    if (analyticsClient) {
      analyticsClient.flush();
    }
  }, [analyticsClient]);
  
  return {
    // State
    isInitialized,
    experiments,
    performanceMetrics,
    
    // Tracking methods
    track,
    trackIntentChange,
    trackChatEvent,
    trackPaymentEvent,
    trackPageView,
    
    // Optimization methods
    getExperimentVariant,
    getOptimizedChatOpener,
    getOptimizedDiscountStrategy,
    getOptimizedIntentThreshold,
    
    // Utilities
    updateMetrics,
    getSessionAnalytics,
    flush,
    
    // Direct access to managers (for advanced use)
    analyticsClient,
    abTestingManager
  };
};

/**
 * Convert intent stage to funnel stage
 * @param {string} intentStage - Intent stage
 * @returns {string} Funnel stage
 */
function getFunnelStageFromIntent(intentStage) {
  const mapping = {
    awareness: CONVERSION_FUNNEL.ENGAGED,
    interest: CONVERSION_FUNNEL.INTERESTED,
    consideration: CONVERSION_FUNNEL.CONSIDERING,
    decision: CONVERSION_FUNNEL.DECIDED,
    exit_intent: CONVERSION_FUNNEL.DECIDED
  };
  
  return mapping[intentStage] || CONVERSION_FUNNEL.ENGAGED;
}