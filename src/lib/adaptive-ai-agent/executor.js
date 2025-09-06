// src/lib/adaptive-ai-agent/executor.js
import { createClient } from '@supabase/supabase-js';
import * as tools from './tools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Executes a single task from a plan.
 * @param {Object} task The task object from the ai_tasks table.
 * @returns {Promise<Object>} The result of the task execution.
 */
export async function executeTask(task) {
  console.log(`🚀 Executing task: ${task.description} (Tool: ${task.tool_to_call})`);

  await updateTaskStatus(task.id, 'in_progress');

  try {
    const tool = tools[task.tool_to_call];
    if (!tool) {
      throw new Error(`Tool "${task.tool_to_call}" not found.`);
    }

    // Execute the tool with the business context and params
    const business = await getBusinessData(task.business_id);
    const result = await tool.execute(business, task.tool_params);

    await updateTaskStatus(task.id, 'completed', result);
    console.log(`✅ Task ${task.id} completed successfully.`);
    return { success: true, data: result };

  } catch (error) {
    console.error(`❌ Error executing task ${task.id}:`, error);
    await updateTaskStatus(task.id, 'failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function updateTaskStatus(taskId, status, result = {}) {
  const updates = {
    status,
    updated_at: new Date().toISOString(),
    result,
  };

  if (status === 'in_progress') {
    updates.started_at = new Date().toISOString();
  } else if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ai_tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) {
    console.error(`Failed to update task ${taskId} status to ${status}:`, error);
    throw error;
  }
}

async function getBusinessData(businessId) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    return data;
}
