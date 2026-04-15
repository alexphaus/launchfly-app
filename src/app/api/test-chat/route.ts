// src/app/api/test-chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Test Chat API — simulates a new WhatsApp lead hitting the agent pipeline.
// Runs the REAL agent (same as production) but synchronously, extracting
// what it would have sent via send_whatsapp / send_report from the tool_log.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveMessage } from '@/lib/ai-receptionist/history';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const { message, phone, businessId } = await request.json();

    if (!message || !businessId) {
      return NextResponse.json({ error: 'message and businessId required' }, { status: 400 });
    }

    const testPhone = phone || 'test-chat-lead';
    const supabase = getSupabase();

    // Save the user message to chat_history (agent reads this for context)
    await saveMessage(testPhone, 'user', message, businessId);

    // Fetch the automation rules to get agent goal/role (same as production)
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('name, steps')
      .eq('business_id', businessId)
      .eq('active', true);

    // Find the first rule with an agent_task step (like the one in the UI)
    let agentGoal = '';
    let agentRole = '';
    if (rules?.length) {
      for (const rule of rules) {
        const steps = Array.isArray(rule.steps) ? rule.steps : [];
        const agentStep = steps.find((s: Record<string, unknown>) => s.type === 'agent_task');
        if (agentStep) {
          const cfg = (agentStep.config || agentStep) as Record<string, unknown>;
          agentGoal = (cfg.agentGoal as string) || '';
          agentRole = (cfg.agentRole as string) || '';
          break;
        }
      }
    }

    // Build the goal with event context (same as executor.ts does)
    let goal = agentGoal || 'A new lead sent a WhatsApp message. Read the chat_history for context, identify who they are (lead, customer, or supplier), and respond appropriately via send_whatsapp.';
    const contextParts: string[] = [
      `Customer phone: ${testPhone}`,
      `Their message: "${message}"`,
      `Trigger event: inbound_whatsapp`,
    ];
    goal += `\n\nEvent context:\n${contextParts.join('\n')}`;

    // Create the agent task and dispatch via QStash
    // We pass test-chat-owner as ownerPhone so status updates and reports don't get sent to real WhatsApp
    const { createAgentTask } = await import('@/lib/agent/runner');
    const { taskId, dispatched } = await createAgentTask({
      businessId,
      goal,
      role: agentRole || undefined,
      ownerPhone: 'test-chat-owner',
      enabledTools: null, // all tools
    });

    if (!dispatched) {
      return NextResponse.json({ error: `Failed to dispatch task ${taskId} to QStash` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      taskId,
    });
  } catch (error) {
    console.error('Test chat error:', error);
    return NextResponse.json({ error: 'Agent execution failed' }, { status: 500 });
  }
}

// Poll task status (called by frontend)
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  try {
    const supabase = getSupabase();
    const { data: taskRow } = await supabase
      .from('agent_tasks')
      .select('status, steps_used, tool_log, result')
      .eq('id', taskId)
      .single();

    if (!taskRow) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const toolLog = (taskRow.tool_log || []) as Array<{
      tool: string;
      args: Record<string, unknown>;
      result: string;
    }>;

    // Collect all outbound messages (send_whatsapp, send_report, send_voice_note)
    const outboundMessages: string[] = [];
    const toolsCalled: string[] = [];
    for (const entry of toolLog) {
      toolsCalled.push(entry.tool);
      if (entry.tool === 'send_whatsapp' || entry.tool === 'send_report') {
        const msg = (entry.args?.message as string) || '';
        if (msg) outboundMessages.push(msg);
      }
      if (entry.tool === 'send_voice_note') {
        outboundMessages.push('🎤 [Voice Note]');
      }
    }

    // Fallback: if agent didn't send_whatsapp, use the task result
    if ((taskRow.status === 'completed' || taskRow.status === 'failed') && outboundMessages.length === 0) {
      if (taskRow.result) outboundMessages.push(taskRow.result);
      else outboundMessages.push('[Agent completed but produced no outbound message]');
    }

    return NextResponse.json({
      status: taskRow.status,
      stepsUsed: taskRow.steps_used,
      bubbles: outboundMessages,
      toolsCalled: [...new Set(toolsCalled)],
    });
  } catch (error) {
    console.error('Task poll error:', error);
    return NextResponse.json({ error: 'Failed to poll task' }, { status: 500 });
  }
}

// Clear chat history for test phone
export async function DELETE(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId');
  const phone = request.nextUrl.searchParams.get('phone') || 'test-chat-lead';
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

  const supabase = getSupabase();
  await supabase.from('chat_history').delete().eq('phone', phone).eq('business_id', businessId);
  return NextResponse.json({ ok: true });
}