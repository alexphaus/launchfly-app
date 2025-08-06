/**
 * @fileoverview Intent scoring algorithm
 * Calculates visitor purchase intent based on behavior signals
 */

import { 
  SIGNAL_WEIGHTS, 
  INTENT_THRESHOLDS, 
  DEVICE_ADJUSTMENTS,
  validateSignals 
} from './signals';

/**
 * Calculate intent score from visitor signals
 * @param {Object} signals - Visitor behavior signals
 * @param {Object} options - Scoring options
 * @returns {Object} Intent analysis result
 */
export function calculateIntentScore(signals, options = {}) {
  const validatedSignals = validateSignals(signals);
  const deviceType = validatedSignals.deviceInfo?.type || 'desktop';
  const adjustments = DEVICE_ADJUSTMENTS[deviceType] || DEVICE_ADJUSTMENTS.desktop;
  
  // Calculate component scores
  const componentScores = {
    engagement: calculateEngagementScore(validatedSignals, adjustments),
    interest: calculateInterestScore(validatedSignals, adjustments),
    urgency: calculateUrgencyScore(validatedSignals, adjustments),
    behavior: calculateBehaviorScore(validatedSignals, adjustments)
  };
  
  // Calculate weighted total score
  const totalScore = (
    componentScores.engagement * 0.25 +
    componentScores.interest * 0.35 +
    componentScores.urgency * 0.3 +
    componentScores.behavior * 0.1
  );
  
  // Apply device-specific adjustments
  const adjustedScore = applyDeviceAdjustments(totalScore, adjustments, validatedSignals);
  
  // Determine intent stage
  const stage = determineIntentStage(adjustedScore, validatedSignals);
  
  // Generate recommendations
  const recommendations = generateRecommendations(adjustedScore, validatedSignals, componentScores);
  
  return {
    score: Math.round(Math.min(100, Math.max(0, adjustedScore))),
    stage,
    componentScores,
    recommendations,
    signals: validatedSignals,
    confidence: calculateConfidence(validatedSignals),
    timestamp: Date.now()
  };
}

/**
 * Calculate engagement score (how active the user is)
 */
function calculateEngagementScore(signals, adjustments) {
  let score = 0;
  
  // Mouse velocity (indicates active browsing)
  if (adjustments.mouseVelocity > 0) {
    const velocityScore = Math.min(signals.mouseVelocity / 100, 1) * 20;
    score += velocityScore * adjustments.mouseVelocity;
  }
  
  // Scroll depth (user is reading content)
  const scrollScore = (signals.scrollDepth / 100) * 25;
  score += scrollScore * (adjustments.scrollDepthMultiplier || 1);
  
  // Time on page (up to 5 minutes has positive impact)
  const timeScore = Math.min(signals.timeOnPage / 300, 1) * 20;
  score += timeScore;
  
  // Reduce score for inactivity
  const inactivityPenalty = Math.min(signals.inactivityPeriods * 5, 20);
  score -= inactivityPenalty;
  
  return Math.max(0, score);
}

/**
 * Calculate interest score (how interested they are in products/pricing)
 */
function calculateInterestScore(signals, adjustments) {
  let score = 0;
  
  // CTA interactions (strong buying signal)
  const ctaScore = Math.min(signals.ctaHovers * 8, 30);
  score += ctaScore * (adjustments.ctaHoverWeight || 1);
  
  // Pricing views (very strong buying signal)
  const pricingScore = Math.min(signals.pricingViews * 15, 40);
  score += pricingScore;
  
  // Product views (moderate buying signal)
  const productScore = Math.min(signals.viewedProducts.length * 5, 20);
  score += productScore;
  
  return score;
}

/**
 * Calculate urgency score (immediate action indicators)
 */
function calculateUrgencyScore(signals, adjustments) {
  let score = 0;
  
  // Exit intent (very strong urgency signal)
  if (signals.exitIntent) {
    score += 40;
  }
  
  // Multiple pricing views in short time
  if (signals.pricingViews > 2) {
    score += 20;
  }
  
  // High CTA interaction
  if (signals.ctaHovers > 3) {
    score += 15;
  }
  
  // Return visitor (if we can detect this)
  if (signals.referrer !== 'direct' && signals.timeOnPage > 30) {
    score += 10;
  }
  
  return score;
}

/**
 * Calculate behavior score (quality indicators)
 */
function calculateBehaviorScore(signals, adjustments) {
  let score = 10; // Base score for any visitor
  
  // Organic traffic gets bonus (vs paid)
  if (!signals.referrer.includes('google.com/ads') && 
      !signals.referrer.includes('facebook.com') &&
      !signals.referrer.includes('utm_source=')) {
    score += 5;
  }
  
  // Desktop users often have higher intent
  if (signals.deviceInfo?.type === 'desktop') {
    score += 5;
  }
  
  // Business hours (if timestamp available)
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 17) {
    score += 5;
  }
  
  return score;
}

/**
 * Apply device-specific score adjustments
 */
function applyDeviceAdjustments(score, adjustments, signals) {
  let adjustedScore = score;
  
  // Mobile users might have different patterns
  if (signals.deviceInfo?.type === 'mobile') {
    // Mobile users might scroll more but convert less
    adjustedScore *= 0.9;
  } else if (signals.deviceInfo?.type === 'tablet') {
    // Tablet users are in between
    adjustedScore *= 0.95;
  }
  
  return adjustedScore;
}

/**
 * Determine intent stage based on score
 */
function determineIntentStage(score, signals) {
  if (signals.exitIntent || score >= INTENT_THRESHOLDS.exitIntent) {
    return 'exit_intent';
  } else if (score >= INTENT_THRESHOLDS.urgentIntervention) {
    return 'decision';
  } else if (score >= INTENT_THRESHOLDS.proactiveMessage) {
    return 'consideration';
  } else if (score >= INTENT_THRESHOLDS.showChat) {
    return 'interest';
  } else {
    return 'awareness';
  }
}

/**
 * Generate action recommendations based on intent
 */
function generateRecommendations(score, signals, componentScores) {
  const recommendations = [];
  
  // High urgency recommendations
  if (signals.exitIntent) {
    recommendations.push({
      action: 'exit_intent_popup',
      priority: 'urgent',
      message: 'Show exit intent offer immediately',
      data: { discountSuggestion: 15 }
    });
  }
  
  if (score >= INTENT_THRESHOLDS.urgentIntervention) {
    recommendations.push({
      action: 'ai_intervention',
      priority: 'high',
      message: 'Start AI conversation with purchasing assistance',
      data: { opener: 'pricing_focused' }
    });
  }
  
  // Medium priority recommendations
  if (score >= INTENT_THRESHOLDS.proactiveMessage && signals.pricingViews > 1) {
    recommendations.push({
      action: 'pricing_help',
      priority: 'medium',
      message: 'Offer pricing explanation or comparison',
      data: { focus: 'value_proposition' }
    });
  }
  
  if (score >= INTENT_THRESHOLDS.showChat && componentScores.interest > 30) {
    recommendations.push({
      action: 'show_chat',
      priority: 'medium',
      message: 'Display chat widget proactively',
      data: { delay: 5000 }
    });
  }
  
  // Low priority recommendations
  if (signals.ctaHovers > 2 && score < INTENT_THRESHOLDS.showChat) {
    recommendations.push({
      action: 'cta_optimization',
      priority: 'low',
      message: 'Consider CTA placement or messaging optimization',
      data: { element: 'cta_buttons' }
    });
  }
  
  if (signals.timeOnPage > 120 && signals.scrollDepth < 50) {
    recommendations.push({
      action: 'content_optimization',
      priority: 'low',
      message: 'Content may not be engaging enough',
      data: { section: 'above_fold' }
    });
  }
  
  return recommendations;
}

/**
 * Calculate confidence in the intent score
 */
function calculateConfidence(signals) {
  let confidence = 0;
  
  // More data points = higher confidence
  const dataPoints = [
    signals.mouseVelocity > 0,
    signals.scrollDepth > 10,
    signals.timeOnPage > 30,
    signals.ctaHovers > 0,
    signals.pricingViews > 0,
    signals.viewedProducts.length > 0
  ].filter(Boolean).length;
  
  confidence += (dataPoints / 6) * 50;
  
  // Longer sessions = higher confidence
  if (signals.timeOnPage > 60) confidence += 20;
  if (signals.timeOnPage > 180) confidence += 20;
  
  // Clear signals = higher confidence
  if (signals.pricingViews > 0) confidence += 10;
  if (signals.exitIntent) confidence += 20;
  
  return Math.min(100, Math.round(confidence));
}

/**
 * Compare two intent scores and determine significant changes
 */
export function compareIntentScores(previous, current) {
  const scoreDiff = current.score - previous.score;
  const isSignificant = Math.abs(scoreDiff) >= 10;
  const stageChanged = previous.stage !== current.stage;
  
  return {
    scoreDifference: scoreDiff,
    isSignificantChange: isSignificant,
    stageChanged,
    trend: scoreDiff > 0 ? 'increasing' : scoreDiff < 0 ? 'decreasing' : 'stable',
    recommendations: current.recommendations.filter(rec => 
      !previous.recommendations.some(prevRec => prevRec.action === rec.action)
    )
  };
}

/**
 * Get recommended actions based on intent analysis
 */
export function getRecommendedActions(intentAnalysis) {
  return intentAnalysis.recommendations
    .sort((a, b) => {
      const priorityOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 3); // Return top 3 recommendations
}