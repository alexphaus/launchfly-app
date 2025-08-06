/**
 * @fileoverview A/B testing framework for AI sales optimization
 * Handles experiment management, variant assignment, and result analysis
 */

import { EXPERIMENTS, AI_EVENTS } from './ai-events';

/**
 * A/B testing manager for AI sales experiments
 */
export class ABTestingManager {
  constructor(analyticsClient, visitorId, businessId) {
    this.analytics = analyticsClient;
    this.visitorId = visitorId;
    this.businessId = businessId;
    this.activeExperiments = new Map();
    this.assignedVariants = new Map();
  }

  /**
   * Initialize experiments for the current visitor
   */
  async initializeExperiments() {
    // Get active experiments from configuration or feature flags
    const activeExperiments = await this.getActiveExperiments();
    
    for (const [experimentId, experiment] of Object.entries(activeExperiments)) {
      if (this.shouldParticipateInExperiment(experiment)) {
        const variant = this.assignVariant(experiment);
        this.activeExperiments.set(experimentId, experiment);
        this.assignedVariants.set(experimentId, variant);
        
        // Track experiment participation
        this.analytics.track(AI_EVENTS.EXPERIMENT_STARTED, {
          experimentId,
          experimentName: experiment.name,
          variantId: variant.id,
          variantName: variant.name
        });
      }
    }
  }

  /**
   * Get variant for a specific experiment
   * @param {string} experimentId - Experiment identifier
   * @returns {Object|null} Assigned variant or null
   */
  getVariant(experimentId) {
    return this.assignedVariants.get(experimentId) || null;
  }

  /**
   * Track when a variant is shown to the user
   * @param {string} experimentId - Experiment identifier
   * @param {Object} context - Additional context
   */
  trackVariantShown(experimentId, context = {}) {
    const variant = this.getVariant(experimentId);
    if (!variant) return;

    this.analytics.track(AI_EVENTS.VARIANT_SHOWN, {
      experimentId,
      variantId: variant.id,
      variantName: variant.name,
      ...context
    });
  }

  /**
   * Track goal achievement for experiment
   * @param {string} experimentId - Experiment identifier
   * @param {Object} goalData - Goal achievement data
   */
  trackGoalAchieved(experimentId, goalData = {}) {
    const variant = this.getVariant(experimentId);
    if (!variant) return;

    this.analytics.track(AI_EVENTS.GOAL_ACHIEVED, {
      experimentId,
      variantId: variant.id,
      variantName: variant.name,
      ...goalData
    });
  }

  /**
   * Get chat opener based on experiment
   * @param {Object} context - Visitor context for personalization
   * @returns {string} Chat opener message
   */
  getChatOpener(context = {}) {
    const variant = this.getVariant('CHAT_OPENER');
    
    if (!variant) {
      return "Hi there! How can I help you today?"; // Default
    }

    this.trackVariantShown('CHAT_OPENER', { context: 'chat_opening' });

    switch (variant.id) {
      case 'personalized':
        return this.generatePersonalizedOpener(context);
      case 'urgent':
        return this.generateUrgentOpener(context);
      default:
        return "Hi there! How can I help you today?";
    }
  }

  /**
   * Get discount strategy based on experiment
   * @param {Object} context - Sales context
   * @returns {Object} Discount strategy
   */
  getDiscountStrategy(context = {}) {
    const variant = this.getVariant('DISCOUNT_STRATEGY');
    
    if (!variant) {
      return { type: 'standard', timing: 'on_request' };
    }

    this.trackVariantShown('DISCOUNT_STRATEGY', { context: 'discount_offering' });

    switch (variant.id) {
      case 'immediate':
        return {
          type: 'immediate',
          timing: 'first_interaction',
          amount: 10,
          message: "Welcome! I have a special 10% discount for new visitors."
        };
      case 'earned':
        return {
          type: 'earned',
          timing: 'after_engagement',
          amount: 15,
          trigger: 'high_engagement',
          message: "You seem really interested! Let me offer you 15% off."
        };
      case 'exit_intent':
        return {
          type: 'exit_intent',
          timing: 'exit_detection',
          amount: 20,
          message: "Wait! Before you go, here's 20% off to get you started."
        };
      default:
        return { type: 'standard', timing: 'on_request' };
    }
  }

  /**
   * Get intent threshold based on experiment
   * @returns {number} Intent threshold percentage
   */
  getIntentThreshold() {
    const variant = this.getVariant('INTENT_THRESHOLD');
    
    if (!variant) {
      return 50; // Default threshold
    }

    this.trackVariantShown('INTENT_THRESHOLD', { context: 'intent_detection' });
    return variant.threshold || 50;
  }

  /**
   * Assign variant to visitor using deterministic hashing
   * @param {Object} experiment - Experiment configuration
   * @returns {Object} Assigned variant
   */
  assignVariant(experiment) {
    // Create deterministic hash based on visitor ID and experiment name
    const hash = this.hashString(`${this.visitorId}-${experiment.name}`);
    const normalized = (hash % 100) + 1; // 1-100
    
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (normalized <= cumulative) {
        return variant;
      }
    }
    
    // Fallback to first variant
    return experiment.variants[0];
  }

  /**
   * Check if visitor should participate in experiment
   * @param {Object} experiment - Experiment configuration
   * @returns {boolean} Whether to participate
   */
  shouldParticipateInExperiment(experiment) {
    // Check if experiment is active
    if (experiment.status === 'paused' || experiment.status === 'completed') {
      return false;
    }
    
    // Check if within date range
    if (experiment.startDate && new Date() < new Date(experiment.startDate)) {
      return false;
    }
    
    if (experiment.endDate && new Date() > new Date(experiment.endDate)) {
      return false;
    }
    
    // Check traffic allocation (if specified)
    if (experiment.trafficAllocation) {
      const hash = this.hashString(`${this.visitorId}-traffic-${experiment.name}`);
      const normalized = (hash % 100) + 1;
      if (normalized > experiment.trafficAllocation) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate personalized opener based on context
   * @param {Object} context - Visitor context
   * @returns {string} Personalized opener
   */
  generatePersonalizedOpener(context) {
    const { signals = {}, referrer, timeOfDay } = context;
    
    if (signals.pricingViews > 1) {
      return "I see you're comparing our pricing options. I'd be happy to help you choose the perfect plan!";
    }
    
    if (signals.viewedProducts?.length > 2) {
      return "You've been exploring our solutions! I can help you find exactly what you're looking for.";
    }
    
    if (referrer && referrer.includes('google')) {
      return "Welcome from Google! I'm here to answer any questions about what you found.";
    }
    
    if (timeOfDay >= 17 || timeOfDay < 9) {
      return "Thanks for visiting us outside business hours! I'm available 24/7 to help.";
    }
    
    return "Welcome! I'm here to help you discover the perfect solution for your needs.";
  }

  /**
   * Generate urgent opener based on context
   * @param {Object} context - Visitor context
   * @returns {string} Urgent opener
   */
  generateUrgentOpener(context) {
    const { signals = {} } = context;
    
    if (signals.exitIntent) {
      return "Wait! I have something special that might interest you before you go.";
    }
    
    if (signals.pricingViews > 1) {
      return "Limited time: Get 20% off any plan you choose today!";
    }
    
    return "🔥 Special offer ending soon! Let me show you how to save big today.";
  }

  /**
   * Get active experiments from configuration
   * @returns {Object} Active experiments
   */
  async getActiveExperiments() {
    // In production, this would fetch from PostHog or database
    // For demo, return predefined experiments
    return EXPERIMENTS;
  }

  /**
   * Simple string hash function for deterministic assignment
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get experiment results for analysis
   * @param {string} experimentId - Experiment identifier
   * @param {Array} events - Array of tracked events
   * @returns {Object} Experiment results
   */
  static analyzeExperimentResults(experimentId, events) {
    const experimentEvents = events.filter(
      e => e.properties.experimentId === experimentId
    );
    
    const variants = {};
    
    // Group events by variant
    experimentEvents.forEach(event => {
      const variantId = event.properties.variantId;
      if (!variants[variantId]) {
        variants[variantId] = {
          id: variantId,
          name: event.properties.variantName,
          participants: new Set(),
          goalAchievements: 0,
          impressions: 0
        };
      }
      
      variants[variantId].participants.add(event.properties.visitorId);
      
      if (event.event === AI_EVENTS.VARIANT_SHOWN) {
        variants[variantId].impressions++;
      }
      
      if (event.event === AI_EVENTS.GOAL_ACHIEVED) {
        variants[variantId].goalAchievements++;
      }
    });
    
    // Calculate conversion rates
    Object.values(variants).forEach(variant => {
      variant.participants = variant.participants.size;
      variant.conversionRate = variant.participants > 0 
        ? (variant.goalAchievements / variant.participants) * 100 
        : 0;
    });
    
    // Find winning variant
    const sortedVariants = Object.values(variants).sort(
      (a, b) => b.conversionRate - a.conversionRate
    );
    
    const winner = sortedVariants[0];
    const control = variants.control;
    
    return {
      experimentId,
      variants,
      winner: winner ? {
        variantId: winner.id,
        conversionRate: winner.conversionRate,
        lift: control ? winner.conversionRate - control.conversionRate : 0
      } : null,
      totalParticipants: Object.values(variants).reduce(
        (sum, v) => sum + v.participants, 0
      ),
      statisticalSignificance: calculateStatisticalSignificance(variants)
    };
  }
}

/**
 * Calculate statistical significance of A/B test results
 * @param {Object} variants - Variant results
 * @returns {Object} Statistical significance data
 */
function calculateStatisticalSignificance(variants) {
  // Simplified statistical significance calculation
  // In production, use proper statistical tests
  
  const variantArray = Object.values(variants);
  if (variantArray.length < 2) {
    return { significant: false, confidence: 0 };
  }
  
  const control = variants.control || variantArray[0];
  const treatment = variantArray.find(v => v.id !== control.id) || variantArray[1];
  
  // Sample size check
  const minSampleSize = 100;
  if (control.participants < minSampleSize || treatment.participants < minSampleSize) {
    return { significant: false, confidence: 0, reason: 'Insufficient sample size' };
  }
  
  // Simple z-test approximation
  const p1 = control.goalAchievements / control.participants;
  const p2 = treatment.goalAchievements / treatment.participants;
  const pooledP = (control.goalAchievements + treatment.goalAchievements) / 
                  (control.participants + treatment.participants);
  
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1/control.participants + 1/treatment.participants));
  const zScore = Math.abs(p2 - p1) / se;
  
  // Confidence levels (simplified)
  let confidence = 0;
  if (zScore > 2.576) confidence = 99;
  else if (zScore > 1.96) confidence = 95;
  else if (zScore > 1.645) confidence = 90;
  
  return {
    significant: confidence >= 95,
    confidence,
    zScore,
    lift: ((p2 - p1) / p1) * 100
  };
}

export default ABTestingManager;