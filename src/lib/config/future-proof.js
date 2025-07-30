// lib/config/future-proof.js - Feature flags for gradual rollout
export const FUTURE_PROOF_CONFIG = {
  // Enable the new future-proof core system
  ENABLE_CORE_SYSTEM: process.env.ENABLE_FUTURE_PROOF_CORE === 'true',
  
  // Percentage of users to use new system (0-100)
  ROLLOUT_PERCENTAGE: parseInt(process.env.FUTURE_PROOF_ROLLOUT_PERCENTAGE || '0'),
  
  // Success guarantee features
  ENABLE_SUCCESS_GUARANTEES: process.env.ENABLE_SUCCESS_GUARANTEES === 'true',
  
  // Growth optimization features
  ENABLE_GROWTH_OPTIMIZATION: process.env.ENABLE_GROWTH_OPTIMIZATION === 'true',
  
  // Enhanced analytics and tracking
  ENABLE_ENHANCED_TRACKING: process.env.ENABLE_ENHANCED_TRACKING === 'true',
  
  // Target revenue for optimization
  DEFAULT_TARGET_REVENUE: parseInt(process.env.DEFAULT_TARGET_REVENUE || '5000'),
  
  // Fallback to legacy system on errors
  FALLBACK_ON_ERROR: process.env.FALLBACK_ON_ERROR !== 'false'
};

/**
 * Determines if a user should get the new future-proof system
 */
export function shouldUseFutureProofCore(sessionId) {
  if (!FUTURE_PROOF_CONFIG.ENABLE_CORE_SYSTEM) {
    return false;
  }
  
  // Use session ID to determine rollout group (consistent per user)
  const hash = sessionId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const userGroup = Math.abs(hash) % 100;
  return userGroup < FUTURE_PROOF_CONFIG.ROLLOUT_PERCENTAGE;
}

/**
 * Configuration for different deployment environments
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ENABLE_CORE_SYSTEM: true,
    ROLLOUT_PERCENTAGE: 100,
    ENABLE_SUCCESS_GUARANTEES: true,
    ENABLE_GROWTH_OPTIMIZATION: true,
    ENABLE_ENHANCED_TRACKING: true,
    FALLBACK_ON_ERROR: true
  },
  
  staging: {
    ENABLE_CORE_SYSTEM: true,
    ROLLOUT_PERCENTAGE: 50,
    ENABLE_SUCCESS_GUARANTEES: true,
    ENABLE_GROWTH_OPTIMIZATION: false,
    ENABLE_ENHANCED_TRACKING: true,
    FALLBACK_ON_ERROR: true
  },
  
  production: {
    ENABLE_CORE_SYSTEM: false, // Start disabled in production
    ROLLOUT_PERCENTAGE: 0,
    ENABLE_SUCCESS_GUARANTEES: false,
    ENABLE_GROWTH_OPTIMIZATION: false,
    ENABLE_ENHANCED_TRACKING: true,
    FALLBACK_ON_ERROR: true
  }
};

export default FUTURE_PROOF_CONFIG;
