/**
 * @fileoverview React hook for visitor intent detection
 * Manages visitor tracking and intent scoring
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VisitorTracker } from '../lib/visitor-tracking/tracker';
import { calculateIntentScore, compareIntentScores } from '../lib/visitor-tracking/intent-scorer';
import { INTENT_THRESHOLDS } from '../lib/visitor-tracking/signals';
import { nanoid } from 'nanoid';

/**
 * Hook for visitor intent detection
 * @param {Object} options - Configuration options
 * @param {string} options.businessId - Business ID
 * @param {Function} options.onIntentChange - Callback when intent changes
 * @param {Function} options.onRecommendation - Callback for new recommendations
 * @param {boolean} options.enabled - Whether tracking is enabled
 * @returns {Object} Intent tracking state and methods
 */
export const useVisitorIntent = (options = {}) => {
  const { 
    businessId, 
    onIntentChange, 
    onRecommendation, 
    enabled = true 
  } = options;
  
  const [visitorId] = useState(() => `visitor_${nanoid()}`);
  const [sessionId] = useState(() => `session_${nanoid()}`);
  const [intentAnalysis, setIntentAnalysis] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  
  const trackerRef = useRef(null);
  const previousAnalysisRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  
  // Initialize tracker
  useEffect(() => {
    if (!enabled || trackerRef.current) return;
    
    try {
      trackerRef.current = new VisitorTracker({
        businessId,
        visitorId,
        sessionId
      });
      
      // Subscribe to tracker events
      setupTrackerEvents();
      
      // Start tracking
      trackerRef.current.start();
      setIsTracking(true);
      setError(null);
      
    } catch (err) {
      console.error('Failed to initialize visitor tracker:', err);
      setError(err.message);
    }
    
    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
        trackerRef.current = null;
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [enabled, businessId, visitorId, sessionId]);
  
  /**
   * Setup event listeners for tracker
   */
  const setupTrackerEvents = useCallback(() => {
    if (!trackerRef.current) return;
    
    const tracker = trackerRef.current;
    
    // Listen for signal updates
    tracker.on('update', (signals) => {
      updateIntentAnalysis(signals);
    });
    
    // Listen for significant events
    tracker.on('exit_intent', (signals) => {
      updateIntentAnalysis(signals, true); // Force immediate update
    });
    
    tracker.on('cta_hover', () => {
      const signals = tracker.getSignals();
      updateIntentAnalysis(signals);
    });
    
    tracker.on('pricing_view', () => {
      const signals = tracker.getSignals();
      updateIntentAnalysis(signals);
    });
    
  }, []);
  
  /**
   * Update intent analysis from signals
   */
  const updateIntentAnalysis = useCallback((signals, forceUpdate = false) => {
    try {
      const analysis = calculateIntentScore(signals);
      
      // Compare with previous analysis
      let comparison = null;
      if (previousAnalysisRef.current) {
        comparison = compareIntentScores(previousAnalysisRef.current, analysis);
      }
      
      // Update state
      setIntentAnalysis(analysis);
      
      // Call callbacks for significant changes
      if (forceUpdate || !previousAnalysisRef.current || comparison?.isSignificantChange) {
        onIntentChange?.(analysis, comparison);
        
        // Send new recommendations
        if (comparison?.recommendations?.length > 0) {
          onRecommendation?.(comparison.recommendations);
        }
      }
      
      previousAnalysisRef.current = analysis;
      
      // Send to analytics API (debounced)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        sendIntentUpdate(analysis);
      }, 5000); // Debounce analytics updates
      
    } catch (err) {
      console.error('Intent analysis error:', err);
      setError(err.message);
    }
  }, [onIntentChange, onRecommendation]);
  
  /**
   * Send intent update to analytics API
   */
  const sendIntentUpdate = useCallback(async (analysis) => {
    if (!businessId) return;
    
    try {
      await fetch('/api/ai-sales/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId,
          sessionId,
          businessId,
          signals: analysis.signals,
          intentScore: analysis.score,
          stage: analysis.stage,
          recommendations: analysis.recommendations
        })
      });
    } catch (error) {
      console.warn('Failed to send intent update:', error);
    }
  }, [businessId, visitorId, sessionId]);
  
  /**
   * Get current visitor signals
   */
  const getCurrentSignals = useCallback(() => {
    return trackerRef.current?.getSignals() || null;
  }, []);
  
  /**
   * Force intent recalculation
   */
  const recalculateIntent = useCallback(() => {
    if (trackerRef.current) {
      const signals = trackerRef.current.getSignals();
      updateIntentAnalysis(signals, true);
    }
  }, [updateIntentAnalysis]);
  
  /**
   * Reset tracking (for testing)
   */
  const resetTracking = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.reset();
      setIntentAnalysis(null);
      previousAnalysisRef.current = null;
    }
  }, []);
  
  /**
   * Check if should trigger specific actions
   */
  const shouldTriggerAction = useCallback((action) => {
    if (!intentAnalysis) return false;
    
    switch (action) {
      case 'show_chat':
        return intentAnalysis.score >= INTENT_THRESHOLDS.showChat;
      case 'proactive_message':
        return intentAnalysis.score >= INTENT_THRESHOLDS.proactiveMessage;
      case 'urgent_intervention':
        return intentAnalysis.score >= INTENT_THRESHOLDS.urgentIntervention;
      case 'exit_intent':
        return intentAnalysis.signals.exitIntent;
      default:
        return false;
    }
  }, [intentAnalysis]);
  
  /**
   * Get recommended opener message based on intent
   */
  const getRecommendedOpener = useCallback(() => {
    if (!intentAnalysis) return null;
    
    const { signals, stage, score } = intentAnalysis;
    
    if (signals.exitIntent) {
      return {
        type: 'exit_intent',
        message: "Wait! I'd love to help you find what you're looking for. What questions do you have?",
        urgency: 'high'
      };
    }
    
    if (signals.pricingViews > 2) {
      return {
        type: 'pricing_focused',
        message: "I noticed you're comparing our pricing options. I can help you choose the perfect plan!",
        urgency: 'medium'
      };
    }
    
    if (stage === 'consideration') {
      return {
        type: 'consultative',
        message: "Hi! I see you're exploring our solutions. I'm here to answer any questions you might have.",
        urgency: 'medium'
      };
    }
    
    if (stage === 'interest') {
      return {
        type: 'friendly',
        message: "Hello! I'm here if you need any help or have questions about what we offer.",
        urgency: 'low'
      };
    }
    
    return null;
  }, [intentAnalysis]);
  
  return {
    // State
    visitorId,
    sessionId,
    intentAnalysis,
    isTracking,
    error,
    
    // Computed values
    intentScore: intentAnalysis?.score || 0,
    intentStage: intentAnalysis?.stage || 'awareness',
    recommendations: intentAnalysis?.recommendations || [],
    confidence: intentAnalysis?.confidence || 0,
    
    // Methods
    getCurrentSignals,
    recalculateIntent,
    resetTracking,
    shouldTriggerAction,
    getRecommendedOpener,
    
    // Helper methods
    isHighIntent: () => intentAnalysis?.score >= INTENT_THRESHOLDS.urgentIntervention,
    isExitIntent: () => intentAnalysis?.signals?.exitIntent || false,
    shouldShowChat: () => shouldTriggerAction('show_chat'),
    shouldSendProactiveMessage: () => shouldTriggerAction('proactive_message')
  };
};