// src/app/api/agent/run/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Run Endpoint — Starts or continues an autonomous agent task
//
// Called by:
//   1. executor.ts `agent_task` action (initial dispatch)
//   2. QStash continuation (agent loop resumes after serverless timeout)
//   3. Direct API call (manual trigger from dashboard)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeAgentTask } from '@/lib/agent/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for agent work

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { taskId, businessId, goal, role, messages, stepsUsed, toolLog, enabledTools, ownerPhone, parentTaskId, approvalResponse } = body;

    if (!businessId || !goal) {
      return NextResponse.json(
        { error: 'Missing businessId or goal' },
        { status: 400 },
      );
    }

    console.log(`[agent/run] ${taskId ? 'Resuming' : 'Starting'} task for ${businessId}: ${goal.substring(0, 80)}`);

    const result = await executeAgentTask({
      taskId,
      businessId,
      goal,
      role,
      ownerPhone,
      messages,
      stepsUsed,
      toolLog,
      enabledTools,
      parentTaskId,
      approvalResponse,
    });

    console.log(`[agent/run] Task ${result.taskId}: ${result.status} (${result.stepsUsed} steps)`);

    return NextResponse.json({
      status: result.status,
      taskId: result.taskId,
      stepsUsed: result.stepsUsed,
      result: result.result,
      toolLog: result.toolLog?.map(t => ({ tool: t.tool, result: t.result.substring(0, 200) })),
    });
  } catch (err) {
    console.error('[agent/run] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
