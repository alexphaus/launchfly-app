// src/app/api/test-chat/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Test Chat API — simulates a new WhatsApp lead hitting the agent pipeline.
// POST = dispatches task (returns taskId instantly)
// GET  = polls task status (returns result when done)
// Runs the REAL agent via QStash, same as production.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveMessage } from '@/lib/ai-receptionist/history';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ── POST: create task and dispatch (returns immediately) ──
export async function POST(request: NextRequest) {
  try {
    const { message, phone, businessId } = await request.json();

    if (!message || !businessId) {
      return NextResponse.json({ error: 'message and businessId required' }, { status: 400 });
    }

    const testPhone = phone || 'test-chat-lead';
    const supabase = getSupabase();

    // Save user message to chat_history (agent reads this for context)
    await saveMessage(testPhone, 'user', message, businessId);

    // Fetch automation rules to get agent goal/role
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('name, steps')
      .eq('business_id', businessId)
      .eq('active', true);

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

    let goal = agentGoal || 'A new lead sent a WhatsApp message. Read the chat_history for context, identify who they are (lead, customer, or supplier), and respond appropriately via send_whatsapp.';
    const contextParts: string[] = [
      `Customer phone: ${testPhone}`,
      `Their message: "${message}"`,
      `Trigger event: inbound_whatsapp`,
    ];
    goal += `\n\nEvent context:\n${contextParts.join('\n')}`;

    // Fetch owner phone
    const { data: biz } = await supabase
      .from('businesses')
      .select('phone_number, whatsapp_notify_number, whatsapp_number')
      .eq('id', businessId)
      .single();
    const ownerPhone = biz?.whatsapp_notify_number || biz?.phone_number || undefined;

    // Create task and dispatch via QStash (same as production)
    const { createAgentTask } = await import('@/lib/agent/runner');
    const { taskId, dispatched } = await createAgentTask({
      businessId,
      goal,
      role: agentRole || undefined,
      ownerPhone,
    });

    if (!dispatched) {
      return NextResponse.json({ error: 'Task created but QStash dispatch failed' }, { status: 500 });
    }

    return NextResponse.json({ taskId, status: 'dispatched' });
  } catch (error) {
    console.error('Test chat POST error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// ── GET: poll task status and extract results ──
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .select('status, steps_used, tool_log, result')
    .eq('id', taskId)
    .single();

  if (error || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Still running — return status for polling
  if (task.status === 'pending' || task.status === 'running') {
    // Extract live tool progress so far
    const toolLog = (task.tool_log || []) as Array<{ tool: string }>;
    const toolsSoFar = toolLog.map(e => e.tool);
    return NextResponse.json({
      status: task.status,
      stepsUsed: task.steps_used || 0,
      toolsSoFar,
    });
  }

  // Completed or failed — extract outbound messages
  const toolLog = (task.tool_log || []) as Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
  }>;

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

  if (outboundMessages.length === 0 && task.result) {
    outboundMessages.push(task.result);
  }
  if (outboundMessages.length === 0) {
    outboundMessages.push('[Agent completed but produced no outbound message]');
  }

  // Save outbound to chat_history for conversational continuity
  const phone = request.nextUrl.searchParams.get('phone') || 'test-chat-lead';
  const businessId = request.nextUrl.searchParams.get('businessId');
  if (businessId) {
    for (const msg of outboundMessages) {
      await saveMessage(phone, 'assistant', msg, businessId);
    }
  }

  return NextResponse.json({
    status: task.status,
    reply: outboundMessages.join('\n\n'),
    bubbles: outboundMessages,
    toolsCalled: [...new Set(toolsCalled)],
    stepsUsed: task.steps_used || 0,
    result: task.result,
  });
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