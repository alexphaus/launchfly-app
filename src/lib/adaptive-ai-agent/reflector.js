// src/lib/adaptive-ai-agent/reflector.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { queryMemory, addMemory } from './memory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyzes the outcome of a task and decides if the plan needs modification.
 * @param {Object} plan The current plan object.
 * @param {Object} completedTask The task that just finished.
 * @param {Object} result The result of the completed task.
 */
export async function reflectOnOutcome(plan, completedTask, result) {
  console.log(`🤔 Reflecting on outcome of task: ${completedTask.description}`);

  // 1. Add the task result to memory
  const memoryContent = `Task "${completedTask.description}" completed with result: ${JSON.stringify(result)}`;
  await addMemory(plan.business_id, memoryContent, 'task_result');

  // 2. Query for relevant memories to provide context for reflection
  const relevantMemories = await queryMemory(plan.business_id, `Reflection context for objective: ${plan.objective}`);

  // 3. Use an LLM to decide if the plan should be modified
  const prompt = `
    You are a strategic AI business cofounder. Your task is to reflect on a completed task and decide if the current plan needs to be adapted.

    **Objective:** ${plan.objective}

    **Current Plan (remaining tasks):**
    ${plan.ai_tasks.filter(t => t.status === 'pending').map(t => `- ${t.description}`).join('\n') || 'No remaining tasks.'}

    **Completed Task:**
    - Description: ${completedTask.description}
    - Result: ${JSON.stringify(result, null, 2)}

    **Relevant Past Learnings (Memory):**
    ${relevantMemories.length > 0 ? relevantMemories.map(m => `- ${m.content}`).join('\n') : 'None.'}

    **Analysis Task:**
    Based on the task result, should the plan be modified?
    - If the result was poor (e.g., low lead count, failed campaign), suggest a corrective action (e.g., "Refine target audience", "Rewrite email copy").
    - If the result was excellent, suggest a way to capitalize on it (e.g., "Double down on successful channel").
    - If the result was expected and the plan is sound, suggest no changes.

    **Output Format:**
    Return a valid JSON object with two keys:
    1.  "assessment": A brief, one-sentence analysis of the outcome.
    2.  "new_tasks": An array of new task objects to add to the plan. If no changes are needed, return an empty array.
        Each task object must have: "description", "tool_to_call", and "tool_params".

    Example (Corrective Action):
    {
      "assessment": "The initial prospect search yielded very few results, indicating the criteria may be too narrow.",
      "new_tasks": [
        {
          "description": "Refine and broaden the target audience criteria based on initial feedback.",
          "tool_to_call": "refineAudience",
          "tool_params": { "feedback": "Low prospect count" }
        }
      ]
    }

    Example (No Change):
    {
      "assessment": "The market research was successful and provides a good foundation for the next steps.",
      "new_tasks": []
    }
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
        { role: "system", content: "You are a strategic AI that reflects on task outcomes and adapts plans, outputting JSON." },
        { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const reflection = JSON.parse(response.choices[0].message.content);

  await addMemory(plan.business_id, `Reflection: ${reflection.assessment}`, 'reflection');
  console.log(`🧠 AI Reflection: ${reflection.assessment}`);

  // If the reflector suggested new tasks, add them to the plan
  if (reflection.new_tasks && reflection.new_tasks.length > 0) {
    console.log(`➕ Adding ${reflection.new_tasks.length} new tasks to the plan.`);
    
    const tasksToInsert = reflection.new_tasks.map((task, index) => ({
      plan_id: plan.id,
      business_id: plan.business_id,
      description: task.description,
      tool_to_call: task.tool_to_call,
      tool_params: task.tool_params || {},
      status: 'pending',
      // Insert these with higher priority than other pending tasks
      priority: (plan.ai_tasks.find(t => t.status === 'pending')?.priority || 1) - 1,
    }));

    const { error } = await supabase.from('ai_tasks').insert(tasksToInsert);
    if (error) {
      console.error("Error inserting new tasks:", error);
      throw error;
    }
  }
}
