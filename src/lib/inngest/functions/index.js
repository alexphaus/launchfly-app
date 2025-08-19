// src/lib/inngest/functions/index.js
/**
 * Inngest Functions Export
 * All AI orchestration functions for Launchfly
 */

export { generateBusiness } from './generate-business';
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

// Export all functions as an array for the Inngest serve handler
export const functions = [
  require('./generate-business').generateBusiness,
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
];