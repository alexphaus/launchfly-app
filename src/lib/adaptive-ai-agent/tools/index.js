// src/lib/adaptive-ai-agent/tools/index.js

// This file acts as a registry for all available tools the AI agent can use.
// By centralizing them here, we can easily provide the planner with a definition list.

import * as conductMarketResearch from './conductMarketResearch';
import * as findProspects from './findProspects';
import * as launchOutreachCampaign from './launchOutreachCampaign';
import * as analyzeCampaignResults from './analyzeCampaignResults';
import * as refineAudience from './refineAudience';
import * as analyzeFinalOutcome from './analyzeFinalOutcome';

// Export the tools so the executor can call them by name.
export {
  conductMarketResearch,
  findProspects,
  launchOutreachCampaign,
  analyzeCampaignResults,
  refineAudience,
  analyzeFinalOutcome,
};

/**
 * Returns a JSON schema definition of all available tools for the planner.
 */
export function getToolsDefinition() {
  return [
    conductMarketResearch.definition,
    findProspects.definition,
    launchOutreachCampaign.definition,
    analyzeCampaignResults.definition,
    refineAudience.definition,
    analyzeFinalOutcome.definition,
  ].filter(d => d); // Filter out any undefined definitions
}
