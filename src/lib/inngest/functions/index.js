// src/lib/inngest/functions/index.js
/**
 * Inngest Functions Export
 * All AI orchestration functions for Launchfly
 */

export { generateBusiness } from './generate-business';
export { coldEmailOutreach } from './cold-outreach';
export { growthEngine } from './growth-engine';
export { 
  customerAcquisitionOrchestrator, 
  dailyOutreachFunction, 
  emailResponseHandler, 
  campaignOptimizer, 
  weeklyPerformanceReport 
} from './customer-acquisition';

// Export all functions as an array for the Inngest serve handler
export const functions = [
  require('./generate-business').generateBusiness,
  require('./cold-outreach').coldEmailOutreach,
  require('./growth-engine').growthEngine,
  require('./customer-acquisition').customerAcquisitionOrchestrator,
  require('./customer-acquisition').dailyOutreachFunction,
  require('./customer-acquisition').emailResponseHandler,
  require('./customer-acquisition').campaignOptimizer,
  require('./customer-acquisition').weeklyPerformanceReport,
  require('./conversion-optimizer').conversionOptimizer,
];