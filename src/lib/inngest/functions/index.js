// src/lib/inngest/functions/index.js
/**
 * Inngest Functions Export
 * All AI orchestration functions for Launchfly
 */

import { generateBusiness } from './generate-business';
import { enhancedColdEmailOutreach } from './cold-outreach';
import { growthEngine } from './growth-engine';
import { conversionOptimizer } from './conversion-optimizer';

// Export individual functions
export { generateBusiness };
export { enhancedColdEmailOutreach };
export { growthEngine };
export { conversionOptimizer };

// Export all functions as an array for the Inngest serve handler
export const functions = [
  generateBusiness,
  enhancedColdEmailOutreach,
  growthEngine,
  conversionOptimizer,
];