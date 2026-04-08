// src/app/api/agent/run/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Run Endpoint — Starts or continues an autonomous agent task
//
// Called by:
//   1. QStash dispatch (new task or continuation — always carries taskId)
//   2. Legacy callers that pass full params (backwards compat: creates task row)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeAgentTask } from '@/lib/agent/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let taskId: string;

    if (body.taskId) {
      // DB-driven path: QStash sent us just the taskId
      taskId = body.taskId;
    } else if (body.businessId && body.goal) {
      // Legacy path: caller sent full params — create task row and run inline (no QStash)
      console.log(`[agent/run] Legacy dispatch for ${body.businessId}: ${(body.goal as string).substring(0, 80)}`);
      taskId = crypto.randomUUID();
      const supabase = getSupabase();
      await supabase.from('agent_tasks').insert({
        id: taskId,
        business_id: body.businessId,
        status: 'pending',
        goal: body.goal,
        role: body.role || null,
        messages: [],
        steps_used: 0,
        tool_log: [],
        owner_phone: body.ownerPhone || null,
        enabled_tools: body.enabledTools || null,
        parent_task_id: body.parentTaskId || null,
      });
    } else {
      return NextResponse.json({ error: 'Missing taskId or (businessId + goal)' }, { status: 400 });
    }

    console.log(`[agent/run] Executing task ${taskId}`);
    const result = await executeAgentTask(taskId);
    console.log(`[agent/run] Task ${taskId}: ${result.status} (${result.stepsUsed} steps)`);

    return NextResponse.json({
      status: result.status,
      taskId: result.taskId,
      stepsUsed: result.stepsUsed,
      result: result.result,
    });
  } catch (err) {
    console.error('[agent/run] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
