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
import { AGENT_TOOLS, getToolsForAgent, executeTool, type ToolContext } from './tools';
import { getConversationHistory, saveMessage } from '@/lib/ai-receptionist/history';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_STEPS_PER_INVOCATION = 8;   // Tools per serverless invocation (8 × ~3.5s + LLM overhead ≈ 40s, safe for 60s limit)
const MAX_TOTAL_STEPS = 80;            // Hard cap across all continuations
const AGENT_MODEL = 'deepseek-chat';   // DeepSeek V3.2 — strong reasoning, tool use, low cost
const WALL_CLOCK_LIMIT_MS = 45_000;    // 45s — bail well before Vercel's 60s hard kill (LLM calls can take 10s+)
const STALE_TASK_MINUTES = 5;          // Mark running tasks older than this as timed-out
const BUDGET_WARNING_STEPS = 5;        // When this many steps remain, tell agent to wrap up

/**
 * Safely truncate a string without splitting surrogate pairs (emoji).
 * `.substring()` can cut a multi-byte emoji in half, producing an unpaired
 * surrogate that breaks JSON serialization on strict parsers (DeepSeek V3.2).
 */
function safeSlice(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  // Use Array.from to split by code points, not UTF-16 code units
  const codePoints = Array.from(str);
  if (codePoints.length <= maxLen) return str;
  return codePoints.slice(0, maxLen).join('');
}

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
  ownerPhone?: string;    // Owner phone for memory loading
  messages?: AgentMessage[];  // Restored messages (for continuations)
  stepsUsed?: number;
  toolLog?: ToolLogEntry[];
  enabledTools?: string[] | null; // Internal tools to enable (e.g. ['save_leads']); null = all
  parentTaskId?: string;  // If this is a sub-task, the parent task to resume on completion
  approvalResponse?: string; // If resuming from an approval gate, the owner's response
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
    .not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")')
    .limit(1)
    .maybeSingle();

  // Determine the name to use in the report. If the runner was given a specific role (e.g. Chief of Staff),
  // try to infer the name from it, otherwise use the customer-facing assistant name or default.
  let repName = assistant?.name;
  if (params.role?.includes('Chief of Staff')) repName = 'Chief of Staff';
  else if (params.role?.includes('Purchasing OS')) repName = 'Purchasing OS';
  else if (params.role?.includes('Content & Growth OS')) repName = 'Content & Growth OS';

  // ownerPhone = where to deliver agent reports
  // Priority: whatsapp_notify_number (explicit) > whatsapp_number > phone_number
  const toolCtx: ToolContext = {
    businessId: params.businessId,
    businessName: biz?.name || undefined,
    ownerPhone: biz?.whatsapp_notify_number || biz?.whatsapp_number || biz?.phone_number || undefined,
    assistantName: repName,
    taskId,
  };

  // Build initial messages if this is a fresh task
  if (messages.length === 0) {
    const bd = biz?.business_data as Record<string, unknown> | null;
    const industry = (bd?.industry || bd?.category || '') as string;
    const location = (bd?.city || bd?.location || '') as string;

    // ── Load Memory Context (conversation history, recent tasks, active jobs) ──
    const ownerPhoneNorm = (params.ownerPhone || toolCtx.ownerPhone || '').replace(/^\+/, '');
    const [conversationHistory, recentTasks, activeJobs] = await Promise.all([
      // 1. Recent owner↔agent conversations (last 8 days, up to 30 messages)
      ownerPhoneNorm
        ? getConversationHistory(ownerPhoneNorm, params.businessId)
        : Promise.resolve([]),
      // 2. Last 5 completed agent tasks (summaries)
      supabase
        .from('agent_tasks')
        .select('goal, result, updated_at')
        .eq('business_id', params.businessId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5)
        .then(r => r.data || []),
      // 3. Active jobs for this business
      supabase
        .from('jobs')
        .select('id, title, status, description, materials_needed, blockers, updated_at')
        .eq('business_id', params.businessId)
        .in('status', ['draft', 'quoting', 'ready', 'blocked'])
        .order('updated_at', { ascending: false })
        .limit(10)
        .then(r => r.data || []),
    ]);

    // Build memory context string for the system prompt
    let memoryContext = '';

    if (conversationHistory.length > 0) {
      memoryContext += '\n\n## RECENT CONVERSATION HISTORY (owner ↔ you)\n';
      // Limit to last 10 turns to keep system prompt lean
      for (const msg of conversationHistory.slice(-10)) {
        memoryContext += `${msg.role === 'user' ? 'OWNER' : 'YOU'}: ${safeSlice(msg.content, 300)}\n`;
      }
    }

    if (recentTasks.length > 0) {
      memoryContext += '\n\n## RECENT COMPLETED TASKS\n';
      for (const t of recentTasks) {
        const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3600000);
        // Skip delegated sub-task goals from the history shown to the orchestrator
        const goalStr = (t.goal as string) || '';
        if (goalStr.startsWith('[DELEGATED TASK]')) continue;
        memoryContext += `- [${ago}h ago] ${safeSlice(goalStr, 120)} → ${safeSlice((t.result as string) || '', 150)}\n`;
      }
    }

    if (activeJobs.length > 0) {
      memoryContext += '\n\n## ACTIVE JOBS/PURCHASE ORDERS\n';
      for (const j of activeJobs) {
        memoryContext += `- "${j.title}" (ID: ${j.id}, status: ${j.status})`;
        if (j.blockers?.length) memoryContext += ` ⚠️ Blockers: ${j.blockers.join(', ')}`;
        memoryContext += '\n';
      }
    }

    messages = [
      {
        role: 'system',
        content: buildSystemPrompt(toolCtx, params.role, industry, location, memoryContext),
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

  // Save parent linkage if this is a sub-task
  if (params.parentTaskId) {
    await supabase.from('agent_tasks').update({
      parent_task_id: params.parentTaskId,
    }).eq('id', taskId);
  }

  // ── Inject approval response if resuming from an approval gate ──
  if (params.approvalResponse && messages.length > 0) {
    messages.push({
      role: 'user',
      content: `Owner's response to your approval request: "${params.approvalResponse}"`,
    });
  }

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
      timeout: 40_000, // 40s — must finish before Vercel's 60s hard kill
    });

    // Resolve which tools this agent can use
    const agentTools = getToolsForAgent(params.enabledTools);

    while (stepsThisInvocation < MAX_STEPS_PER_INVOCATION && stepsUsed < MAX_TOTAL_STEPS) {
      // ── Wall-clock check: bail before Vercel kills us ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Approaching wall-clock limit (${Math.round((Date.now() - startTime) / 1000)}s), scheduling continuation`);
        break; // Fall through to continuation logic below
      }

      // ── Budget warning: inject a system nudge when steps are running low ──
      // Two-tier warning: per-invocation (approaching 8-step limit) AND global (80-step cap)
      const stepsRemainingGlobal = MAX_TOTAL_STEPS - stepsUsed;
      const stepsRemainingInvocation = MAX_STEPS_PER_INVOCATION - stepsThisInvocation;
      const shouldWarn = stepsRemainingGlobal <= BUDGET_WARNING_STEPS || stepsRemainingInvocation <= 2;
      const budgetMessages = shouldWarn
        ? [...messages, {
            role: 'system' as const,
            content: `⚠️ URGENT: You only have ${Math.min(stepsRemainingGlobal, stepsRemainingInvocation)} tool calls left in this execution window. You MUST call send_report NOW with whatever data you have collected so far. Summarize your findings and deliver them to the owner. Do NOT make any more research calls.`,
          }]
        : messages;

      const completion = await client.chat.completions.create({
        model: AGENT_MODEL,
        messages: budgetMessages as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: agentTools,
        tool_choice: 'auto',
      });

      // ── Post-LLM wall-clock check: the API call itself may have taken 10s+ ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Wall-clock limit hit after LLM call (${Math.round((Date.now() - startTime) / 1000)}s), saving state for continuation`);
        // Save the assistant's response to messages so the continuation can pick up cleanly
        const msg = completion.choices[0]?.message;
        if (msg?.tool_calls?.length) {
          const fnCalls = msg.tool_calls.filter(
            (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function',
          );
          messages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: fnCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });
          // Add placeholder tool results so the message history stays valid
          for (const tc of fnCalls) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: 'Tool execution deferred to next continuation (time limit reached).',
            });
          }
        }
        break;
      }

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
            // Per-tool timeout: 45s max (leave headroom for wall-clock)
            const toolTimeout = 45_000;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), toolTimeout);
            try {
              toolResult = await Promise.race([
                executeTool(tc.function.name, toolArgs, toolCtx),
                new Promise<string>((_, reject) => {
                  controller.signal.addEventListener('abort', () =>
                    reject(new Error(`Tool ${tc.function.name} timed out after ${toolTimeout / 1000}s`))
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
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

          // ── PAUSE SIGNAL: tool requested task suspension ──
          if (toolResult.startsWith('__PAUSE__:')) {
            console.log(`[agent:${taskId}] Tool ${tc.function.name} requested pause: ${toolResult.substring(0, 100)}`);

            // Fill in dummy results for any remaining tool calls in this batch
            const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
            for (const unexecutedTc of fnCalls) {
              if (!executedIds.has(unexecutedTc.id)) {
                messages.push({
                  role: 'tool',
                  tool_call_id: unexecutedTc.id,
                  content: 'Skipped — task is pausing.',
                });
              }
            }

            // Save full state for resumption
            const pauseType = toolResult.includes('waiting_approval') ? 'waiting_approval' : 'waiting_subtask';
            await saveTaskState(supabase, taskId, params.businessId, {
              status: pauseType,
              goal: params.goal,
              role: params.role,
              stepsUsed,
              toolLog,
            });
            // Also save messages + resume context
            await supabase.from('agent_tasks').update({
              messages: messages,
              owner_phone: params.ownerPhone || toolCtx.ownerPhone,
              enabled_tools: params.enabledTools || null,
            }).eq('id', taskId);

            return { status: 'completed' as const, result: toolResult, taskId, stepsUsed, toolLog };
          }

          // Check wall clock after each tool execution too
          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            console.log(`[agent:${taskId}] Wall-clock limit hit mid-step, breaking to schedule continuation`);
            // We must append dummy results for the remaining unexecuted tool calls
            const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
            for (const unexecutedTc of fnCalls) {
              if (!executedIds.has(unexecutedTc.id)) {
                messages.push({
                  role: 'tool',
                  tool_call_id: unexecutedTc.id,
                  content: 'Tool skipped due to execution time limit. Agent will resume execution in a moment.',
                });
                toolLog.push({
                  tool: unexecutedTc.function.name,
                  args: {},
                  result: 'Skipped (timeout)',
                  timestamp: new Date().toISOString(),
                });
                stepsUsed++;
                stepsThisInvocation++;
              }
            }
            break;
          }
        }
      } else {
        // Model returned a final text response — task is complete
        const finalResult = assistantMessage.content || 'Task completed (no output).';

        // ── Safety net: if the agent never called send_report, deliver the result now ──
        const agentCalledSendReport = toolLog.some(t => t.tool === 'send_report');
        if (!agentCalledSendReport && toolCtx.ownerPhone && !params.goal.startsWith('[DELEGATED TASK]')) {
          try {
            await executeTool('send_report', { message: safeSlice(finalResult, 3500) }, toolCtx);
            console.log(`[agent:${taskId}] Auto-delivered final result via send_report (agent forgot to call it)`);
          } catch (e) {
            console.warn(`[agent:${taskId}] Auto send_report failed:`, e);
          }
        }

        await saveTaskState(supabase, taskId, params.businessId, {
          status: 'completed',
          goal: params.goal,
          role: params.role,
          stepsUsed,
          toolLog,
          result: finalResult,
        });

        // ── Persist conversation to chat_history for memory continuity ──
        // Skip delegated sub-tasks — only save direct owner↔agent conversations
        const ownerPhoneNorm = (params.ownerPhone || toolCtx.ownerPhone || '').replace(/^\+/, '');
        if (ownerPhoneNorm && !params.goal.startsWith('[DELEGATED TASK]')) {
          try {
            // goal is now the raw owner WhatsApp message (no wrapper to strip)
            await saveMessage(ownerPhoneNorm, 'user', safeSlice(params.goal, 2000), params.businessId);
            await saveMessage(ownerPhoneNorm, 'assistant', safeSlice(finalResult, 2000), params.businessId);
          } catch (e) {
            console.warn(`[agent:${taskId}] Failed to save conversation to history:`, e);
          }
        }

        // ── Resume parent task if this was a sub-task ──
        await resumeParentIfNeeded(supabase, taskId, finalResult);

        return { status: 'completed', result: finalResult, taskId, stepsUsed, toolLog };
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent:${taskId}] Fatal error at step ${stepsUsed}:`, errMsg);

    // If the error is a timeout and we haven't done much work yet, retry via QStash
    const isTimeout = errMsg.includes('timed out') || errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT');
    if (isTimeout && stepsUsed < 2) {
      console.log(`[agent:${taskId}] LLM timeout on early step — scheduling retry via QStash`);
      const retried = await scheduleAgentContinuation({
        taskId,
        businessId: params.businessId,
        goal: params.goal,
        role: params.role,
        ownerPhone: params.ownerPhone,
        messages,
        stepsUsed,
        toolLog,
        enabledTools: params.enabledTools,
      });
      if (retried) {
        await saveTaskState(supabase, taskId, params.businessId, {
          status: 'running',
          goal: params.goal,
          role: params.role,
          stepsUsed,
          toolLog,
        });
        return { status: 'continued', taskId, stepsUsed, toolLog };
      }
    }

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
    // Hard cap reached — force one final send_report attempt with collected data
    console.log(`[agent:${taskId}] MAX_TOTAL_STEPS reached (${stepsUsed}), forcing send_report`);

    // Try to get the agent to send a report with whatever it has
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        timeout: 40_000,
      });
      const agentTools = getToolsForAgent(params.enabledTools);
      const forceCompletion = await client.chat.completions.create({
        model: AGENT_MODEL,
        messages: [
          ...messages,
          {
            role: 'system' as const,
            content: 'CRITICAL: You have run out of tool budget. You MUST call send_report RIGHT NOW with all the data you have collected. Format the report as best you can with available information. This is your FINAL action.',
          },
        ] as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: agentTools,
        tool_choice: { type: 'function', function: { name: 'send_report' } },
      });

      const forcedMsg = forceCompletion.choices[0]?.message;
      if (forcedMsg?.tool_calls?.length) {
        for (const tc of forcedMsg.tool_calls) {
          if (tc.type === 'function' && tc.function.name === 'send_report') {
            const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
            const result = await executeTool('send_report', args, toolCtx);
            toolLog.push({ tool: 'send_report', args, result: result.substring(0, 500), timestamp: new Date().toISOString() });
            console.log(`[agent:${taskId}] Forced send_report: ${result.substring(0, 100)}`);
          }
        }
      }
    } catch (forceErr) {
      console.error(`[agent:${taskId}] Forced send_report failed:`, forceErr);
    }

    const summary = `Agent completed after ${stepsUsed} steps (budget exhausted, report sent).`;

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
    ownerPhone: params.ownerPhone,
    messages,
    stepsUsed,
    toolLog,
    enabledTools: params.enabledTools,
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
  memoryContext?: string,
): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // If a custom role/system_prompt was provided (from DB), use it as the primary identity
  const identity = role
    ? role
    : `You are an autonomous AI agent working for ${toolCtx.businessName || 'a business'}.`;

  return `${identity}

TODAY'S DATE: ${todayStr}
BUSINESS: ${toolCtx.businessName || 'Unknown'}
${industry ? `INDUSTRY: ${industry}` : ''}
${location ? `LOCATION: ${location}` : ''}

You have access to tools: search the web, scrape pages, find local businesses, save leads, query the database, draft content, send WhatsApp messages, manage jobs, delegate tasks, request approval, search/save memory, and send reports to the owner.

## RULES
1. Think step-by-step. Plan your approach before using tools.
2. Use search_memory FIRST to check if you already know something relevant.
3. Use search_web to research before making decisions.
4. Always save valuable leads using save_leads — don't just list them.
5. When done, use send_report to deliver findings/results to the owner.
6. Be efficient — minimize unnecessary tool calls.
7. If a tool fails, try an alternative approach.
8. When your task is complete, provide a clear summary.
9. Use save_memory to remember important insights, supplier info, decisions, and patterns.
10. Use request_approval BEFORE taking costly or irreversible actions (placing orders, sending campaigns).

## DELEGATION
- Use delegate_task for fire-and-forget tasks (you don't need the result).
- Use delegate_task_and_wait when you NEED the sub-agent's result to continue (e.g. "get quotes from Purchasing OS, then compare them").
- Your task will pause and automatically resume with the sub-agent's result.

## APPROVAL GATES
- Use request_approval when you need owner sign-off before proceeding.
- Your task will pause and resume with the owner's response.
- Always include: what you want to do, estimated cost/impact, and clear options.

## MEMORY & CONTINUITY
You have LONG-TERM MEMORY via search_memory and save_memory tools.
- search_memory before making decisions — you may have relevant past learnings.
- save_memory after discovering important facts (supplier reliability, pricing, owner preferences).
You also have conversation history and recent task context below:
- Reference past conversations naturally ("As we discussed yesterday...")
- Avoid re-doing work that was already completed
- Follow up on pending items proactively
- Provide strategic recommendations based on patterns you observe
${memoryContext || '\n(No prior conversation history available — this is the first interaction.)'}

## STRATEGIC THINKING
When the owner asks a question or gives a task:
- Consider the broader business context, not just the literal request
- Proactively flag risks, opportunities, or follow-up actions
- If you see patterns in past tasks (e.g. repeated supplier issues), mention them
- Suggest improvements or optimizations when relevant
- Be concise but insightful — act like a trusted Chief of Staff, not just a task executor

IMPORTANT: When you have completed the task, respond with a final text message summarizing what you did and the results. Do NOT call any more tools after your work is done.`;
}

// ─── QStash Continuation ─────────────────────────────────────────────────

async function scheduleAgentContinuation(params: {
  taskId: string;
  businessId: string;
  goal: string;
  role?: string;
  ownerPhone?: string;
  messages: AgentMessage[];
  stepsUsed: number;
  toolLog: ToolLogEntry[];
  enabledTools?: string[] | null;
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
        // First pass: trim individual messages; second pass: cap total payload
        messages: (() => {
          const trimmed = params.messages.map(m => {
            if (m.role === 'tool' && m.content && m.content.length > 15000) {
              return { ...m, content: safeSlice(m.content, 15000) + '\n[...truncated]' };
            }
            return m;
          });
          // If total serialized size > 800KB, aggressively trim oldest tool results
          let serialized = JSON.stringify(trimmed);
          if (serialized.length > 800_000) {
            for (let i = 0; i < trimmed.length && serialized.length > 800_000; i++) {
              if (trimmed[i].role === 'tool' && trimmed[i].content && trimmed[i].content!.length > 2000) {
                trimmed[i] = { ...trimmed[i], content: safeSlice(trimmed[i].content!, 2000) + '\n[...aggressively truncated]' };
                serialized = JSON.stringify(trimmed);
              }
            }
          }
          return trimmed;
        })(),
        stepsUsed: params.stepsUsed,
        toolLog: params.toolLog,
        enabledTools: params.enabledTools,
        ownerPhone: params.ownerPhone,
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

// ── Resume Parent Task (when sub-task completes) ─────────────────────────

async function resumeParentIfNeeded(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  subTaskResult: string,
): Promise<void> {
  try {
    // Check if this task has a parent
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('parent_task_id')
      .eq('id', taskId)
      .maybeSingle();

    if (!task?.parent_task_id) return;

    const parentId = task.parent_task_id;
    console.log(`[agent:${taskId}] Sub-task complete, resuming parent ${parentId}`);

    // Load parent task state
    const { data: parent } = await supabase
      .from('agent_tasks')
      .select('business_id, goal, role, steps_used, tool_log, messages, owner_phone, enabled_tools, status')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent || parent.status !== 'waiting_subtask') {
      console.warn(`[agent:${taskId}] Parent ${parentId} not in waiting_subtask state (${parent?.status})`);
      return;
    }

    // Parse stored messages
    let parentMessages: AgentMessage[] = [];
    try {
      parentMessages = typeof parent.messages === 'string'
        ? JSON.parse(parent.messages)
        : parent.messages || [];
    } catch { /* empty */ }

    // Inject sub-task result into parent's conversation
    parentMessages.push({
      role: 'user',
      content: `Sub-agent completed its task. Result:\n\n${safeSlice(subTaskResult, 3000)}`,
    });

    // Resume parent via QStash
    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
    if (!qstashToken) {
      console.warn(`[agent:${taskId}] Cannot resume parent — no QSTASH_TOKEN`);
      return;
    }

    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const targetUrl = `${appUrl.replace(/\/$/, '')}/api/agent/run`;

    const enabledTools = parent.enabled_tools
      ? (Array.isArray(parent.enabled_tools) ? parent.enabled_tools.map(String) : null)
      : null;

    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '2s',
        'Upstash-Retries': '1',
      },
      body: JSON.stringify({
        taskId: parentId,
        businessId: parent.business_id,
        goal: parent.goal,
        role: parent.role,
        messages: parentMessages,
        stepsUsed: parent.steps_used,
        toolLog: parent.tool_log || [],
        enabledTools,
        ownerPhone: parent.owner_phone,
      }),
    });

    if (!res.ok) {
      console.error(`[agent:${taskId}] Failed to resume parent via QStash: ${res.status}`);
    } else {
      console.log(`[agent:${taskId}] Parent ${parentId} resumed via QStash`);
      await supabase.from('agent_tasks').update({
        status: 'running',
        updated_at: new Date().toISOString(),
      }).eq('id', parentId);
    }
  } catch (err) {
    console.error(`[agent:${taskId}] Error resuming parent:`, err);
  }
}

// ── Resume Task from Approval (exported for webhook use) ─────────────────

export async function resumeTaskFromApproval(
  taskId: string,
  approvalResponse: string,
): Promise<boolean> {
  const supabase = getSupabase();

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('business_id, goal, role, steps_used, tool_log, messages, owner_phone, enabled_tools, status')
    .eq('id', taskId)
    .maybeSingle();

  if (!task || task.status !== 'waiting_approval') {
    console.warn(`[agent:resume] Task ${taskId} not in waiting_approval state (${task?.status})`);
    return false;
  }

  let messages: AgentMessage[] = [];
  try {
    messages = typeof task.messages === 'string'
      ? JSON.parse(task.messages)
      : task.messages || [];
  } catch { /* empty */ }

  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  if (!qstashToken) return false;

  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
  const targetUrl = `${appUrl.replace(/\/$/, '')}/api/agent/run`;

  const enabledTools = task.enabled_tools
    ? (Array.isArray(task.enabled_tools) ? task.enabled_tools.map(String) : null)
    : null;

  const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${qstashToken}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': '1s',
      'Upstash-Retries': '1',
    },
    body: JSON.stringify({
      taskId,
      businessId: task.business_id,
      goal: task.goal,
      role: task.role,
      messages,
      stepsUsed: task.steps_used,
      toolLog: task.tool_log || [],
      enabledTools,
      ownerPhone: task.owner_phone,
      approvalResponse,
    }),
  });

  if (!res.ok) return false;

  await supabase.from('agent_tasks').update({
    status: 'running',
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  console.log(`[agent:resume] Task ${taskId} resumed with approval: "${approvalResponse.substring(0, 50)}"`);
  return true;
}
