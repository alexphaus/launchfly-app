// src/lib/agent/runner.ts
// ═══════════════════════════════════════════════════════════════════════════
// Autonomous Agent Loop Runner
// ═══════════════════════════════════════════════════════════════════════════
//
// Implements an agentic think→act→observe loop using OpenAI function calling.
// Handles serverless timeout constraints via QStash continuation:
//   1. Runs up to MAX_STEPS_PER_INVOCATION tool calls per API invocation
//   2. If more steps needed, serializes state → QStash → resumes on next hit
//   3. Hard cap at MAX_TOTAL_STEPS to prevent runaway agents
//
// Flow:
//   executeAgentTask() → OpenAI thinks → calls tool → observe → loop
//   ↓ (if budget exhausted)
//   scheduleAgentContinuation() → QStash → /api/agent/run → resume

import { createClient } from '@supabase/supabase-js';
import { AGENT_TOOLS, executeTool, type ToolContext } from './tools';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_STEPS_PER_INVOCATION = 5;   // Tools per serverless invocation (avoid timeout)
const MAX_TOTAL_STEPS = 25;           // Hard cap across all continuations
const AGENT_MODEL = 'deepseek-chat';   // DeepSeek V3 — strong reasoning, tool use, low cost
const WALL_CLOCK_LIMIT_MS = 50_000;   // 50s — bail before Vercel's 60s hard kill
const STALE_TASK_MINUTES = 5;         // Mark running tasks older than this as timed-out

// ─── Types ───────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  businessId: string;
  goal: string;
  role?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  messages: AgentMessage[];
  stepsUsed: number;
  toolLog: ToolLogEntry[];
  createdAt: string;
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ToolLogEntry {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: string;
}

// ─── Main Entry Point ────────────────────────────────────────────────────

/**
 * Start or resume an agent task.
 * Returns the final result when complete, or schedules continuation via QStash.
 */
export async function executeAgentTask(params: {
  taskId?: string;        // Existing task ID (for continuations)
  businessId: string;
  goal: string;
  role?: string;
  messages?: AgentMessage[];  // Restored messages (for continuations)
  stepsUsed?: number;
  toolLog?: ToolLogEntry[];
}): Promise<{
  status: 'completed' | 'continued' | 'failed';
  result?: string;
  taskId: string;
  stepsUsed: number;
  toolLog: ToolLogEntry[];
}> {
  const supabase = getSupabase();

  // Create or restore task
  const taskId = params.taskId || crypto.randomUUID();
  let messages: AgentMessage[] = params.messages || [];
  let stepsUsed = params.stepsUsed || 0;
  const toolLog: ToolLogEntry[] = params.toolLog || [];

  // Load business context for tools
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, whatsapp_number, whatsapp_notify_number, phone_number, business_data')
    .eq('id', params.businessId)
    .single();

  const { data: assistant } = await supabase
    .from('assistants')
    .select('name')
    .eq('business_id', params.businessId)
    .eq('active', true)
    .maybeSingle();

  // ownerPhone = where to deliver agent reports
  // Priority: whatsapp_notify_number (explicit) > whatsapp_number > phone_number
  const toolCtx: ToolContext = {
    businessId: params.businessId,
    businessName: biz?.name || undefined,
    ownerPhone: biz?.whatsapp_notify_number || biz?.whatsapp_number || biz?.phone_number || undefined,
    assistantName: assistant?.name || undefined,
  };

  // Build initial messages if this is a fresh task
  if (messages.length === 0) {
    const bd = biz?.business_data as Record<string, unknown> | null;
    const industry = (bd?.industry || bd?.category || '') as string;
    const location = (bd?.city || bd?.location || '') as string;

    messages = [
      {
        role: 'system',
        content: buildSystemPrompt(toolCtx, params.role, industry, location),
      },
      {
        role: 'user',
        content: params.goal,
      },
    ];
  }

  // Save initial task state
  await saveTaskState(supabase, taskId, params.businessId, {
    status: 'running',
    goal: params.goal,
    role: params.role,
    stepsUsed,
    toolLog,
  });

  // Auto-clean stale tasks from previous invocations that got killed by Vercel
  try {
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', result: 'Timed out: stuck in running state', updated_at: new Date().toISOString() })
      .eq('status', 'running')
      .neq('id', taskId)
      .lt('updated_at', new Date(Date.now() - STALE_TASK_MINUTES * 60_000).toISOString());
  } catch { /* non-critical */ }

  // ── Agent Loop (wrapped in top-level try/catch so task never stays stuck) ──
  const startTime = Date.now();
  try {
    let stepsThisInvocation = 0;

    // Instantiate DeepSeek client (OpenAI-compatible API)
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    while (stepsThisInvocation < MAX_STEPS_PER_INVOCATION && stepsUsed < MAX_TOTAL_STEPS) {
      // ── Wall-clock check: bail before Vercel kills us ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Approaching wall-clock limit (${Math.round((Date.now() - startTime) / 1000)}s), scheduling continuation`);
        break; // Fall through to continuation logic below
      }

      const completion = await client.chat.completions.create({
        model: AGENT_MODEL,
        messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
      });

      const choice = completion.choices[0];
      const assistantMessage = choice.message;

      // Check if the model wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Filter to function-type tool calls only
        const fnCalls = assistantMessage.tool_calls.filter(
          (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function',
        );

        // Add assistant message with tool_calls to history
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: fnCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });

        // Execute each tool call
        for (const tc of fnCalls) {
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
          } catch {
            toolArgs = {};
            console.warn(`[agent:${taskId}] Malformed tool args for ${tc.function.name}: ${tc.function.arguments?.substring(0, 100)}`);
          }
          console.log(`[agent:${taskId}] Step ${stepsUsed + 1}: ${tc.function.name}(${JSON.stringify(toolArgs).substring(0, 100)})`);

          let toolResult: string;
          try {
            toolResult = await executeTool(tc.function.name, toolArgs, toolCtx);
          } catch (toolErr) {
            toolResult = `Tool error: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`;
            console.warn(`[agent:${taskId}] Tool ${tc.function.name} threw:`, toolResult);
          }

          // Record tool observation
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResult,
          });

          toolLog.push({
            tool: tc.function.name,
            args: toolArgs,
            result: toolResult.substring(0, 500),
            timestamp: new Date().toISOString(),
          });

          stepsUsed++;
          stepsThisInvocation++;

          // Check wall clock after each tool execution too
          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            console.log(`[agent:${taskId}] Wall-clock limit hit mid-step, breaking to schedule continuation`);
            break;
          }
        }
      } else {
        // Model returned a final text response — task is complete
        const finalResult = assistantMessage.content || 'Task completed (no output).';

        await saveTaskState(supabase, taskId, params.businessId, {
          status: 'completed',
          goal: params.goal,
          role: params.role,
          stepsUsed,
          toolLog,
          result: finalResult,
        });

        return { status: 'completed', result: finalResult, taskId, stepsUsed, toolLog };
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent:${taskId}] Fatal error at step ${stepsUsed}:`, errMsg);

    await saveTaskState(supabase, taskId, params.businessId, {
      status: 'failed',
      goal: params.goal,
      role: params.role,
      stepsUsed,
      toolLog,
      result: `Agent error: ${errMsg}`,
    });

    return { status: 'failed', result: `Agent error: ${errMsg}`, taskId, stepsUsed, toolLog };
  }

  // ── Budget exhausted for this invocation ──

  if (stepsUsed >= MAX_TOTAL_STEPS) {
    // Hard cap reached — force completion
    const summary = `Agent reached maximum ${MAX_TOTAL_STEPS} steps. Tools used:\n${toolLog.map(t => `- ${t.tool}: ${t.result.substring(0, 80)}`).join('\n')}`;

    await saveTaskState(supabase, taskId, params.businessId, {
      status: 'completed',
      goal: params.goal,
      role: params.role,
      stepsUsed,
      toolLog,
      result: summary,
    });

    return { status: 'completed', result: summary, taskId, stepsUsed, toolLog };
  }

  // Schedule continuation via QStash
  const continued = await scheduleAgentContinuation({
    taskId,
    businessId: params.businessId,
    goal: params.goal,
    role: params.role,
    messages,
    stepsUsed,
    toolLog,
  });

  if (continued) {
    await saveTaskState(supabase, taskId, params.businessId, {
      status: 'running',
      goal: params.goal,
      role: params.role,
      stepsUsed,
      toolLog,
    });
    return { status: 'continued', taskId, stepsUsed, toolLog };
  }

  // QStash failed — return what we have
  const partialResult = `Agent paused after ${stepsUsed} steps (QStash unavailable). Partial results:\n${toolLog.map(t => `- ${t.tool}: ${t.result.substring(0, 100)}`).join('\n')}`;

  await saveTaskState(supabase, taskId, params.businessId, {
    status: 'failed',
    goal: params.goal,
    role: params.role,
    stepsUsed,
    toolLog,
    result: partialResult,
  });

  return { status: 'failed', result: partialResult, taskId, stepsUsed, toolLog };
}

// ─── System Prompt Builder ───────────────────────────────────────────────

function buildSystemPrompt(
  toolCtx: ToolContext,
  role: string | undefined,
  industry: string,
  location: string,
): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are an autonomous AI agent working for ${toolCtx.businessName || 'a business'}.
TODAY'S DATE: ${todayStr}
${role ? `Your role: ${role}` : ''}
${industry ? `Industry: ${industry}` : ''}
${location ? `Location: ${location}` : ''}

You have access to tools to search the web, scrape pages, find local businesses, save leads to the CRM, query the database, draft content, and send reports to the business owner.

RULES:
1. Think step-by-step. Plan your approach before using tools.
2. Use search_web to research before making decisions.
3. Use scrape_page to get detailed info from specific URLs.
4. Always save valuable leads using save_leads — don't just list them.
5. When you're done, send_report your findings/results to the owner.
6. Be efficient — minimize unnecessary tool calls.
7. If a tool fails, try an alternative approach.
8. When your task is complete, provide a clear summary of what you accomplished.

IMPORTANT: When you have completed the task, respond with a final text message summarizing what you did and the results. Do NOT call any more tools after your work is done.`;
}

// ─── QStash Continuation ─────────────────────────────────────────────────

async function scheduleAgentContinuation(params: {
  taskId: string;
  businessId: string;
  goal: string;
  role?: string;
  messages: AgentMessage[];
  stepsUsed: number;
  toolLog: ToolLogEntry[];
}): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

  if (!qstashToken) {
    console.warn('[agent] No QSTASH_TOKEN — cannot schedule continuation');
    return false;
  }

  try {
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const targetUrl = `${appUrl}/api/agent/run`;

    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '2s',  // Brief pause between continuations
        'Upstash-Retries': '1',
      },
      body: JSON.stringify({
        taskId: params.taskId,
        businessId: params.businessId,
        goal: params.goal,
        role: params.role,
        // Truncate tool results in message history to stay within QStash body limits (~1MB)
        messages: params.messages.map(m => {
          if (m.role === 'tool' && m.content && m.content.length > 20000) {
            return { ...m, content: m.content.substring(0, 20000) + '\n[...truncated for continuation]' };
          }
          return m;
        }),
        stepsUsed: params.stepsUsed,
        toolLog: params.toolLog,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[agent] QStash continuation error ${res.status}: ${errText}`);
      return false;
    }

    console.log(`[agent:${params.taskId}] Continuation scheduled after ${params.stepsUsed} steps`);
    return true;
  } catch (err) {
    console.error('[agent] QStash continuation failed:', err);
    return false;
  }
}

// ─── Task State Persistence ──────────────────────────────────────────────

async function saveTaskState(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  businessId: string,
  state: {
    status: string;
    goal: string;
    role?: string;
    stepsUsed: number;
    toolLog: ToolLogEntry[];
    result?: string;
  },
): Promise<void> {
  try {
    await supabase.from('agent_tasks').upsert({
      id: taskId,
      business_id: businessId,
      status: state.status,
      goal: state.goal,
      role: state.role || null,
      steps_used: state.stepsUsed,
      tool_log: state.toolLog,
      result: state.result || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    // Non-critical — don't crash the agent if state save fails
    console.warn(`[agent:${taskId}] Failed to save state:`, err);
  }
}
