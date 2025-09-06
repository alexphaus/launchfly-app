// src/lib/adaptive-ai-agent/tools/analyzeCampaignResults.js
import { addMemory } from "../memory";

export const definition = {
  name: 'analyzeCampaignResults',
  description: 'Analyzes the results of a completed outreach campaign to generate learnings.',
  parameters: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'string',
        description: 'The ID of the campaign to analyze.',
      },
    },
    required: ['campaign_id'],
  },
};

export async function execute(business, params) {
  console.log(`Tool: analyzeCampaignResults - Analyzing campaign: ${params.campaign_id}`);
  
  // In a real scenario, this would pull data from an analytics store.
  // We'll simulate the analysis.
  const openRate = (Math.random() * (0.5 - 0.2) + 0.2).toFixed(2);
  const replyRate = (Math.random() * (0.05 - 0.01) + 0.01).toFixed(2);
  const conversions = Math.floor(Math.random() * 3); // 0, 1, or 2 conversions

  const summary = `Campaign ${params.campaign_id} Analysis: Open rate was ${openRate * 100}%, reply rate was ${replyRate * 100}%, and resulted in ${conversions} conversions.`;
  const keyLearning = `Key learning: The direct and concise email style resulted in a ${openRate > 0.35 ? 'high' : 'decent'} open rate but a ${replyRate < 0.03 ? 'low' : 'moderate'} reply rate. We should consider adding more social proof to increase replies.`;
  
  await addMemory(
    business.id,
    keyLearning,
    'campaign_analysis'
  );

  return {
    success: true,
    summary,
    keyLearning,
    metrics: {
      openRate: parseFloat(openRate),
      replyRate: parseFloat(replyRate),
      conversions,
    },
  };
}
