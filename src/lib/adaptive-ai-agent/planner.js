// src/lib/adaptive-ai-agent/planner.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getToolsDefinition } from './tools';
import { queryMemory } from './memory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Creates a strategic plan for a business to achieve a specific objective.
 * @param {string} businessId
 * @param {string} objective
 * @returns {Promise<Object>} The newly created plan.
 */
export async function createPlan(businessId, objective) {
  console.log(`📝 Creating a new plan for business ${businessId} with objective: "${objective}"`);

  const business = await getBusinessData(businessId);
  const relevantMemories = await queryMemory(businessId, `Memories related to business planning and achieving the objective: ${objective}`);

  const toolsDefinition = getToolsDefinition();
  
  const prompt = `
    You are a strategic AI business cofounder. Your goal is to create a robust, step-by-step plan to achieve the following objective for a user's business.

    **Business Context:**
    - Business Name: ${business.business_data?.businessName || business.name}
    - Industry: ${business.business_data?.industry}
    - Description: ${business.business_data?.tagline}
    - Products/Services: ${JSON.stringify(business.business_data?.products)}

    **Primary Objective:**
    ${objective}

    **Relevant Learnings from Past Activities (Memory):**
    ${relevantMemories.length > 0 ? relevantMemories.map(m => `- ${m.content}`).join('\n') : 'No past learnings found.'}

    **Instructions:**
    1.  Create a sequence of tasks to achieve the objective.
    2.  The plan should be logical, starting with foundational steps like research and prospecting before moving to outreach and optimization.
    3.  For each task, provide a clear description and specify the exact 'tool_to_call' from the available tools list.
    4.  Provide the necessary 'tool_params' as a JSON object for each tool call.
    5.  The final task should always be 'analyzeFinalOutcome' to review the entire plan's success.

    **Available Tools:**
    ${JSON.stringify(toolsDefinition, null, 2)}

    **Output Format:**
    Return a valid JSON object with a single key "tasks", which is an array of task objects. Do not include any other text or explanation outside of the JSON object.
    Each task object must have: "description", "tool_to_call", and "tool_params".

    Example:
    {
      "tasks": [
        {
          "description": "Research the target market and identify 3 potential customer personas.",
          "tool_to_call": "conductMarketResearch",
          "tool_params": { "topics": ["customer personas", "market trends"] }
        },
        {
          "description": "Find 50 potential customers based on the research.",
          "tool_to_call": "findProspects",
          "tool_params": { "quantity": 50, "criteria": "Based on market research" }
        }
      ]
    }
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: "You are a world-class business strategist AI that creates actionable plans as JSON objects." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const planData = JSON.parse(response.choices[0].message.content);
  const tasks = planData.tasks || [];

  // Create plan and tasks in the database
  const { data: newPlan, error: planError } = await supabase
    .from('ai_plans')
    .insert({
      business_id: businessId,
      objective: objective,
      status: 'in_progress',
    })
    .select()
    .single();

  if (planError) throw planError;

  const tasksToInsert = tasks.map((task, index) => ({
    plan_id: newPlan.id,
    business_id: businessId,
    description: task.description,
    tool_to_call: task.tool_to_call,
    tool_params: task.tool_params || {},
    status: 'pending',
    priority: index,
  }));

  const { error: tasksError } = await supabase.from('ai_tasks').insert(tasksToInsert);
  if (tasksError) throw tasksError;

  console.log(`✅ Plan ${newPlan.id} created with ${tasks.length} tasks.`);
  return newPlan;
}

async function getBusinessData(businessId) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    return data;
}
