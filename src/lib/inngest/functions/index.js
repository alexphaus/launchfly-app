// src/lib/inngest/functions/index.js
/**
 * Inngest Functions Export
 * All AI orchestration functions for Launchfly
 */

export { generateBusiness } from './generate-business';
export { generateLeadMagnet } from './generate-lead-magnet';
export { enhancedColdEmailOutreach as coldEmailOutreach } from './cold-outreach';
export { growthEngine } from './growth-engine';
export { 
  customerAcquisitionOrchestrator, 
  dailyOutreachFunction, 
  emailResponseHandler, 
  campaignOptimizer, 
  weeklyPerformanceReport 
} from './customer-acquisition';

export { 
  followUpHandler, 
  followUpScheduler 
} from './follow-up-handler';

export { 
  growthStrategyOrchestrator,
  customerAcquisitionCampaign,
  coldEmailCampaignOrchestrator,
  handleColdEmailBatchSent 
} from './growth-strategies';

export {
  hourlyOptimization,
  dailyMarketResearch,
  weeklyCompetitorAnalysis,
  monthlyStrategyReview,
  performanceMonitor
} from './ai-business-agent';

export {
  aiCofounderThink,
  consolidateMemories,
  monitorExperiments,
  generateExperiments,
  executePlans,
  checkConversations,
  proactiveOutreach,
  forecastRevenue,
  monitorCompetitors,
  sendUserDigest
} from './enhanced-ai-cofounder';

// Import minimal functions
import { minimalFunctions } from './minimal-functions.js';
import { weeklyDigestFunctions } from './weekly-digest-function.js';

// Check if expensive functions should be disabled
const DISABLE_EXPENSIVE_FUNCTIONS = process.env.DISABLE_EXPENSIVE_AI_FUNCTIONS === 'true';

// Export functions based on configuration
export const functions = DISABLE_EXPENSIVE_FUNCTIONS ? [
  // Only minimal, event-driven functions
  // Always include core business generation so onboarding can progress
  require('./generate-business').generateBusiness,
  require('./generate-lead-magnet').generateLeadMagnet,
  ...minimalFunctions,
  // Weekly digest (cheap, data-only)
  ...weeklyDigestFunctions,
  // Keep essential event-driven functions from existing system
] : [
  // Full system (legacy - not recommended due to high costs)
  require('./generate-business').generateBusiness,
  require('./generate-lead-magnet').generateLeadMagnet,
  require('./cold-outreach').enhancedColdEmailOutreach,
  require('./cold-outreach').enhancedColdEmailOutreach,
  require('./growth-engine').growthEngine,
  require('./customer-acquisition').customerAcquisitionOrchestrator,
  require('./customer-acquisition').dailyOutreachFunction,
  require('./customer-acquisition').emailResponseHandler,
  require('./customer-acquisition').campaignOptimizer,
  require('./customer-acquisition').weeklyPerformanceReport,
  require('./growth-strategies').growthStrategyOrchestrator,
  require('./growth-strategies').customerAcquisitionCampaign,
  require('./growth-strategies').coldEmailCampaignOrchestrator,
  require('./growth-strategies').handleColdEmailBatchSent,
  require('./conversion-optimizer').conversionOptimizer,
  require('./follow-up-handler').followUpHandler,
  require('./follow-up-handler').followUpScheduler,
  require('./ai-business-agent').hourlyOptimization,
  require('./ai-business-agent').dailyMarketResearch,
  require('./ai-business-agent').weeklyCompetitorAnalysis,
  require('./ai-business-agent').monthlyStrategyReview,
  require('./ai-business-agent').performanceMonitor,
  // Enhanced AI Cofounder functions
  require('./enhanced-ai-cofounder').aiCofounderThink,
  require('./enhanced-ai-cofounder').consolidateMemories,
  require('./enhanced-ai-cofounder').monitorExperiments,
  require('./enhanced-ai-cofounder').generateExperiments,
  require('./enhanced-ai-cofounder').executePlans,
  require('./enhanced-ai-cofounder').checkConversations,
  require('./enhanced-ai-cofounder').proactiveOutreach,
  require('./enhanced-ai-cofounder').forecastRevenue,
  require('./enhanced-ai-cofounder').monitorCompetitors,
  require('./enhanced-ai-cofounder').sendUserDigest,
];