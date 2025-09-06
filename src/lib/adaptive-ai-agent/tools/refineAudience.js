// src/lib/adaptive-ai-agent/tools/refineAudience.js
import { addMemory } from "../memory";

export const definition = {
  name: 'refineAudience',
  description: 'Refines the target audience criteria based on feedback or poor campaign performance.',
  parameters: {
    type: 'object',
    properties: {
      feedback: {
        type: 'string',
        description: 'Feedback from previous steps, e.g., "Low prospect count", "Low open rates".',
      },
    },
    required: ['feedback'],
  },
};

export async function execute(business, params) {
  console.log(`Tool: refineAudience - Refining audience based on feedback: ${params.feedback}`);
  
  const oldCriteria = business.business_data?.targetAudience || "No criteria defined.";
  // Simulate AI generating new criteria
  const newCriteria = `Based on the feedback '${params.feedback}', the new target audience will focus more on mid-sized companies (50-200 employees) in the SaaS industry, specifically targeting VPs of Marketing.`;
  
  await addMemory(
    business.id,
    `Audience refined. Old criteria: "${oldCriteria}". New criteria: "${newCriteria}"`,
    'strategy_adjustment'
  );

  return {
    success: true,
    summary: `Audience criteria was updated. The new focus is on mid-sized SaaS companies.`,
    oldCriteria,
    newCriteria,
  };
}
