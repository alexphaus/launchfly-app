// src/app/api/agent/workflow-run/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Workflow Endpoint — Upstash Workflow Durable Execution
// ═══════════════════════════════════════════════════════════════════════════
//
// Each step (LLM call, tool execution) runs in its own serverless invocation.
// No 60s wall-clock pressure. LLM calls can take minutes via context.call().
// Automatic retries on failure. Native approval pause/resume via waitForEvent.

import { serve } from '@upstash/workflow/nextjs';
import { runAgentWorkflow, type WorkflowPayload } from '@/lib/agent/workflow-runner';

export const { POST } = serve<WorkflowPayload>(
  async (context) => {
    // IMPORTANT: Do NOT return before calling context.run().
    // The Upstash SDK auth check runs our handler with a disabled context
    // and requires at least one context.run() call to authenticate.
    const taskId = context.requestPayload?.taskId;

    console.log(`[agent/workflow-run] Payload taskId: ${taskId || 'MISSING'}`);

    await runAgentWorkflow(context, taskId!);
  },
  {
    failureFunction: async ({ context, failStatus, failResponse }) => {
      console.error(`[agent/workflow-run] Workflow failed: status=${failStatus}, response=${failResponse}`);

      // Try to mark the task as failed in DB
      try {
        const taskId = context.requestPayload?.taskId;
        console.log(`[agent/workflow-run] failureFunction taskId: ${taskId || 'MISSING'}`);

        if (taskId) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!,
          );
          await supabase.from('agent_tasks').update({
            status: 'failed',
            result: `Workflow failed: ${failResponse || failStatus || 'unknown error'}`,
            updated_at: new Date().toISOString(),
          }).eq('id', taskId);
        }
      } catch (err) {
        console.error('[agent/workflow-run] Failed to update task status on failure:', err);
      }
    },
    verbose: process.env.NODE_ENV === 'development',
  },
);
