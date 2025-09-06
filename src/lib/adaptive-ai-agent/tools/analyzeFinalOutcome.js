// src/lib/adaptive-ai-agent/tools/analyzeFinalOutcome.js
import { addMemory } from "../memory";

export const definition = {
  name: 'analyzeFinalOutcome',
  description: 'Analyzes the final outcome of a plan to determine if the objective was met.',
  parameters: {
    type: 'object',
    properties: {
      plan_objective: {
        type: 'string',
        description: 'The original objective of the plan.',
      },
    },
    required: ['plan_objective'],
  },
};

export async function execute(business, params) {
  console.log(`Tool: analyzeFinalOutcome - Analyzing objective: ${params.plan_objective}`);

  const revenue = business.total_revenue || 0;
  // A simple check for this example. A real one would be more complex.
  const objectiveMet = revenue >= 1000;
  
  const summary = `Final Outcome Analysis: The objective to "${params.plan_objective}" was ${objectiveMet ? 'MET' : 'NOT MET'}. Current revenue is $${revenue}.`;
  
  await addMemory(
    business.id,
    summary,
    'plan_conclusion'
  );

  return {
    success: true,
    objectiveMet,
    finalRevenue: revenue,
    summary,
  };
}
