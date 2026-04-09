// src/lib/agent/runner.ts
// ═══════════════════════════════════════════════════════════════════════════
// Autonomous Agent Loop Runner — DB-Driven State Machine (v2)
// ═══════════════════════════════════════════════════════════════════════════
//
// Architecture:
//   - ALL state lives in the `agent_tasks` table (single source of truth)
//   - QStash carries ONLY the taskId (36 bytes, never exceeds limits)
//   - Every step saves progress to DB before proceeding
//   - Crash recovery is automatic: QStash retry → loads latest state from DB
//
// Flow:
//   createAgentTask() → inserts row → QStash({ taskId })
//   ↓
//   executeAgentTask(taskId) → loads state from DB → agent loop → saves each step
//   ↓ (if wall-clock limit reached)
//   scheduleContinuation(taskId) → QStash({ taskId }) → resumes from DB
//   ↓ (if Vercel hard-kills)
//   QStash retries → same taskId → loads latest saved state → continues

import { createClient } from '@supabase/supabase-js';
import { getToolsForAgent, executeTool, type ToolContext } from './tools';
import { getConversationHistory, saveMessage } from '@/lib/ai-receptionist/history';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_STEPS_PER_INVOCATION = 4;   // Conservative: 4 steps × ~7s = 28s + overhead ≈ 35s
const MAX_TOTAL_STEPS = 80;           // Hard cap across all continuations
const AGENT_MODEL = 'deepseek-chat';
const WALL_CLOCK_LIMIT_MS = 30_000;   // 30s — leaves 30s headroom for cleanup + QStash
const STALE_TASK_MINUTES = 5;         // Auto-fail tasks stuck longer than this
const BUDGET_WARNING_STEPS = 5;       // Warn agent to wrap up when this many steps remain globally
const TOOL_RESULT_MAX = 8000;         // Max chars per tool result stored in messages
const TOOL_TIMEOUT_MS = 15_000;       // Max time for a single tool execution
const LLM_TIMEOUT_MS = 20_000;        // Max time for a single LLM call
const LLM_MAX_RETRIES = 2;            // Exponential backoff retries for transient DeepSeek errors

// ─── Utilities ───────────────────────────────────────────────────────────

/** Safely truncate a string without splitting surrogate pairs (emoji). */
function safeSlice(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  const codePoints = Array.from(str);
  if (codePoints.length <= maxLen) return str;
  return codePoints.slice(0, maxLen).join('');
}

/** Strip unpaired surrogates that break DeepSeek's strict JSON parser. */
function sanitizeString(str: string | null | undefined): string {
  if (!str) return str ?? '';
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += str[i] + str[i + 1];
        i++;
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // skip orphaned low surrogate
    } else {
      result += str[i];
    }
  }
  return result;
}

/** Sanitize all message content before sending to the LLM. */
function sanitizeMessages(msgs: AgentMessage[]): AgentMessage[] {
  return msgs.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? sanitizeString(m.content) : m.content,
  }));
}

// ─── Types ───────────────────────────────────────────────────────────────

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

interface TaskRow {
  id: string;
  business_id: string;
  status: string;
  goal: string;
  role: string | null;
  messages: AgentMessage[] | null;
  steps_used: number;
  tool_log: ToolLogEntry[] | null;
  result: string | null;
  owner_phone: string | null;
  enabled_tools: string[] | null;
  parent_task_id: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Create a new agent task in the DB and dispatch it via QStash.
 * Returns the task ID immediately (non-blocking).
 */
export async function createAgentTask(params: {
  businessId: string;
  goal: string;
  role?: string;
  ownerPhone?: string;
  enabledTools?: string[] | null;
  parentTaskId?: string;
}): Promise<{ taskId: string; dispatched: boolean }> {
  const supabase = getSupabase();
  const taskId = crypto.randomUUID();

  // Insert task row — this is the single source of truth
  const { error: insertErr } = await supabase.from('agent_tasks').insert({
    id: taskId,
    business_id: params.businessId,
    status: 'pending',
    goal: params.goal,
    role: params.role || null,
    messages: [],
    steps_used: 0,
    tool_log: [],
    result: null,
    owner_phone: params.ownerPhone || null,
    enabled_tools: params.enabledTools || null,
    parent_task_id: params.parentTaskId || null,
  });

  if (insertErr) {
    console.error(`[agent] Failed to create task ${taskId}:`, insertErr);
    return { taskId, dispatched: false };
  }

  // Dispatch via QStash — only the taskId
  const dispatched = await scheduleContinuation(taskId);

  return { taskId, dispatched };
}

/**
 * Execute (or continue) an agent task. Loads ALL state from DB.
 * This is the only entry point for the agent loop.
 */
export async function executeAgentTask(taskId: string): Promise<{
  status: 'completed' | 'continued' | 'failed';
  result?: string;
  taskId: string;
  stepsUsed: number;
}> {
  const supabase = getSupabase();

  // ── Load task from DB (single source of truth) ──
  const { data: task, error: loadErr } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (loadErr || !task) {
    console.error(`[agent:${taskId}] Task not found:`, loadErr);
    return { status: 'failed', result: 'Task not found', taskId, stepsUsed: 0 };
  }

  const row = task as TaskRow;

  // Idempotency: don't re-run completed/failed tasks
  if (row.status === 'completed' || row.status === 'failed') {
    console.log(`[agent:${taskId}] Already ${row.status}, skipping`);
    return { status: row.status as 'completed' | 'failed', result: row.result || undefined, taskId, stepsUsed: row.steps_used };
  }

  // Mark as running
  await supabase.from('agent_tasks').update({
    status: 'running',
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  // Auto-clean stale tasks from previous invocations killed by Vercel or missed QStash
  try {
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', result: 'Timed out: stuck in running or pending state', updated_at: new Date().toISOString() })
      .in('status', ['running', 'pending'])
      .neq('id', taskId)
      .lt('updated_at', new Date(Date.now() - STALE_TASK_MINUTES * 60_000).toISOString());
  } catch { /* non-critical */ }

  // ── Restore state from DB ──
  let messages: AgentMessage[] = Array.isArray(row.messages) ? row.messages : [];
  let stepsUsed = row.steps_used || 0;
  const toolLog: ToolLogEntry[] = Array.isArray(row.tool_log) ? row.tool_log : [];

  // ── Load business context ──
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, whatsapp_number, whatsapp_notify_number, phone_number, business_data')
    .eq('id', row.business_id)
    .single();

  const { data: assistant } = await supabase
    .from('assistants')
    .select('name')
    .eq('business_id', row.business_id)
    .eq('active', true)
    .not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")')
    .limit(1)
    .maybeSingle();

  // Use custom role name for report header (e.g. "Trend Scout — Weekly..." → "Trend Scout")
  // Fall back to well-known OS names, then to the active assistant name.
  let repName: string | undefined;
  if (row.role) {
    // Extract short name: take everything before " — " or " - " or use the full role
    const dashIdx = row.role.search(/\s[—–-]\s/);
    repName = dashIdx > 0 ? row.role.substring(0, dashIdx).trim() : row.role.substring(0, 40).trim();
  }
  if (!repName) repName = assistant?.name;

  const toolCtx: ToolContext = {
    businessId: row.business_id,
    businessName: biz?.name || undefined,
    ownerPhone: row.owner_phone || biz?.whatsapp_notify_number || biz?.whatsapp_number || biz?.phone_number || undefined,
    assistantName: repName,
    taskId,
  };

  // ── Build initial messages if this is a fresh task ──
  if (messages.length === 0) {
    const bd = biz?.business_data as Record<string, unknown> | null;
    const industry = (bd?.industry || bd?.category || '') as string;
    const location = (bd?.city || bd?.location || '') as string;

    const ownerPhoneNorm = (toolCtx.ownerPhone || '').replace(/^\+/, '');
    const [conversationHistory, recentTasks, activeJobs] = await Promise.all([
      ownerPhoneNorm
        ? getConversationHistory(ownerPhoneNorm, row.business_id)
        : Promise.resolve([]),
      supabase
        .from('agent_tasks')
        .select('goal, result, updated_at')
        .eq('business_id', row.business_id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5)
        .then(r => r.data || []),
      supabase
        .from('jobs')
        .select('id, title, status, description, materials_needed, blockers, updated_at')
        .eq('business_id', row.business_id)
        .in('status', ['draft', 'quoting', 'ready', 'blocked'])
        .order('updated_at', { ascending: false })
        .limit(10)
        .then(r => r.data || []),
    ]);

    let memoryContext = '';

    if (conversationHistory.length > 0) {
      memoryContext += '\n\n## RECENT CONVERSATION HISTORY (owner ↔ you)\n';
      for (const msg of conversationHistory.slice(-10)) {
        memoryContext += `${msg.role === 'user' ? 'OWNER' : 'YOU'}: ${safeSlice(msg.content, 300)}\n`;
      }
    }

    if (recentTasks.length > 0) {
      memoryContext += '\n\n## RECENT COMPLETED TASKS\n';
      for (const t of recentTasks) {
        const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3600000);
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
      { role: 'system', content: buildSystemPrompt(toolCtx, row.role || undefined, industry, location, memoryContext) },
      { role: 'user', content: row.goal },
    ];

    // Save initial messages to DB
    await supabase.from('agent_tasks').update({
      messages,
      owner_phone: toolCtx.ownerPhone || null,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);
  }

  // ── Agent Loop ──
  const startTime = Date.now();
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: LLM_TIMEOUT_MS,
    });
    const agentTools = getToolsForAgent(row.enabled_tools);
    let stepsThisInvocation = 0;

    while (stepsThisInvocation < MAX_STEPS_PER_INVOCATION && stepsUsed < MAX_TOTAL_STEPS) {
      // ── Wall-clock check ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Wall-clock limit (${Math.round((Date.now() - startTime) / 1000)}s), scheduling continuation`);
        break;
      }

      // ── Budget warning ──
      const stepsRemainingGlobal = MAX_TOTAL_STEPS - stepsUsed;
      const stepsRemainingInvocation = MAX_STEPS_PER_INVOCATION - stepsThisInvocation;
      const shouldWarn = stepsRemainingGlobal <= BUDGET_WARNING_STEPS || stepsRemainingInvocation <= 1;
      const llmMessages = shouldWarn
        ? [...messages, {
            role: 'system' as const,
            content: `⚠️ URGENT: You only have ${Math.min(stepsRemainingGlobal, stepsRemainingInvocation)} tool calls left. You MUST call send_report NOW with whatever data you have. Do NOT make more research calls.`,
          }]
        : messages;

      let completion;
      let llmErr: Error | null = null;

      for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
        try {
          completion = await client.chat.completions.create({
            model: AGENT_MODEL,
            messages: sanitizeMessages(llmMessages) as Parameters<typeof client.chat.completions.create>[0]['messages'],
            tools: agentTools,
            tool_choice: 'auto',
          });
          llmErr = null;
          break; // Success
        } catch (err: any) {
          llmErr = err;
          // Don't retry 400 Bad Request, these are formatting/validation errors
          if (err?.status === 400 || attempt === LLM_MAX_RETRIES) break;
          console.warn(`[agent:${taskId}] LLM transient error, retrying (${attempt + 1}/${LLM_MAX_RETRIES}):`, err.message);
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }

      if (llmErr || !completion) {
        throw llmErr || new Error('LLM call failed unexpectedly');
      }

      // ── Post-LLM wall-clock check ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Wall-clock limit after LLM call, saving and scheduling continuation`);
        const msg = completion.choices[0]?.message;
        if (msg?.tool_calls?.length) {
          const fnCalls = msg.tool_calls.filter(
            (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function',
          );
          messages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: fnCalls.map(tc => ({
              id: tc.id, type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });
          for (const tc of fnCalls) {
            messages.push({ role: 'tool', tool_call_id: tc.id, content: 'Deferred to next continuation.' });
          }
          await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
        }
        break;
      }

      const assistantMessage = completion.choices[0].message;

      // ── Tool calls ──
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const fnCalls = assistantMessage.tool_calls.filter(
          (tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function',
        );

        messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: fnCalls.map(tc => ({
            id: tc.id, type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });

        for (const tc of fnCalls) {
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
          } catch {
            toolArgs = {};
          }
          console.log(`[agent:${taskId}] Step ${stepsUsed + 1}: ${tc.function.name}(${JSON.stringify(toolArgs).substring(0, 100)})`);

          let toolResult: string;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
            try {
              const toolPromise = executeTool(tc.function.name, toolArgs, toolCtx);
              // Catch orphaned promise to prevent unhandled rejection if timeout wins the race
              toolPromise.catch(() => {});
              toolResult = await Promise.race([
                toolPromise,
                new Promise<string>((_, reject) => {
                  controller.signal.addEventListener('abort', () =>
                    reject(new Error(`Tool ${tc.function.name} timed out after ${TOOL_TIMEOUT_MS / 1000}s`))
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
          } catch (toolErr) {
            toolResult = `Tool error: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`;
          }

          messages.push({ role: 'tool', tool_call_id: tc.id, content: safeSlice(toolResult, TOOL_RESULT_MAX) });
          toolLog.push({ tool: tc.function.name, args: toolArgs, result: safeSlice(toolResult, 500), timestamp: new Date().toISOString() });
          stepsUsed++;
          stepsThisInvocation++;

          // ── Save progress after EVERY step ──
          await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);

          // ── PAUSE SIGNAL ──
          if (toolResult.startsWith('__PAUSE__:')) {
            const pauseType = toolResult.includes('waiting_approval') ? 'waiting_approval' : 'waiting_subtask';
            // Fill dummy results for remaining calls
            const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
            for (const unexecuted of fnCalls) {
              if (!executedIds.has(unexecuted.id)) {
                messages.push({ role: 'tool', tool_call_id: unexecuted.id, content: 'Skipped — task is pausing.' });
              }
            }
            await supabase.from('agent_tasks').update({
              status: pauseType, messages, steps_used: stepsUsed, tool_log: toolLog,
              updated_at: new Date().toISOString(),
            }).eq('id', taskId);
            return { status: 'completed' as const, result: toolResult, taskId, stepsUsed };
          }

          // Wall-clock check after each tool
          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
            for (const unexecuted of fnCalls) {
              if (!executedIds.has(unexecuted.id)) {
                messages.push({ role: 'tool', tool_call_id: unexecuted.id, content: 'Deferred to next continuation.' });
                // Don't increment stepsUsed — these weren't actually executed
              }
            }
            await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
            break;
          }
        }
      } else {
        // ── Final text response — task complete ──
        const finalResult = assistantMessage.content || 'Task completed (no output).';

        // Safety net: auto-deliver if agent forgot send_report
        const calledSendReport = toolLog.some(t => t.tool === 'send_report' && !t.result.startsWith('REJECTED'));
        if (!calledSendReport && toolCtx.ownerPhone && !row.goal.startsWith('[DELEGATED TASK]')) {
          // The finalResult is just conversational text (likely a summary). 
          // Look for the last send_report call's argument in the messages array — that contains the actual formatted report.
          let reportContent = '';
          for (let mi = messages.length - 1; mi >= 0; mi--) {
            const m = messages[mi];
            if (m.role === 'assistant' && m.tool_calls) {
              const srCall = m.tool_calls.find(tc => tc.function.name === 'send_report');
              if (srCall) {
                try {
                  const parsed = JSON.parse(srCall.function.arguments);
                  if (parsed.message && parsed.message.length > 100) {
                    reportContent = parsed.message;
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          }
          try {
            // Use extracted report if found, otherwise fall back to finalResult
            await executeTool('send_report', { message: safeSlice(reportContent || finalResult, 3500) }, toolCtx);
          } catch (e) {
            console.warn(`[agent:${taskId}] Auto send_report failed:`, e);
          }
        }

        await supabase.from('agent_tasks').update({
          status: 'completed', result: finalResult, messages, steps_used: stepsUsed, tool_log: toolLog,
          updated_at: new Date().toISOString(),
        }).eq('id', taskId);

        // Save conversation for memory continuity
        const ownerPhoneNorm = (toolCtx.ownerPhone || '').replace(/^\+/, '');
        if (ownerPhoneNorm && !row.goal.startsWith('[DELEGATED TASK]')) {
          try {
            await saveMessage(ownerPhoneNorm, 'user', safeSlice(row.goal, 2000), row.business_id);
            await saveMessage(ownerPhoneNorm, 'assistant', safeSlice(finalResult, 2000), row.business_id);
          } catch { /* non-critical */ }
        }

        // Resume parent if sub-task
        await resumeParentIfNeeded(supabase, taskId, finalResult);

        return { status: 'completed', result: finalResult, taskId, stepsUsed };
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent:${taskId}] Fatal error at step ${stepsUsed}:`, errMsg);

    // On timeout with low step count, retry via QStash
    const isTimeout = errMsg.includes('timed out') || errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT');
    if (isTimeout) {
      console.log(`[agent:${taskId}] Timeout — scheduling retry`);
      await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
      const retried = await scheduleContinuation(taskId);
      if (retried) return { status: 'continued', taskId, stepsUsed };
    }

    await supabase.from('agent_tasks').update({
      status: 'failed', result: `Agent error: ${errMsg}`, messages, steps_used: stepsUsed, tool_log: toolLog,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);

    return { status: 'failed', result: `Agent error: ${errMsg}`, taskId, stepsUsed };
  }

  // ── Need more steps → schedule continuation ──

  if (stepsUsed >= MAX_TOTAL_STEPS) {
    // Hard cap — force send_report with collected data
    console.log(`[agent:${taskId}] MAX_TOTAL_STEPS reached (${stepsUsed}), forcing send_report`);
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', timeout: LLM_TIMEOUT_MS });
      const agentTools = getToolsForAgent(row.enabled_tools);
      const forceCompletion = await client.chat.completions.create({
        model: AGENT_MODEL,
        messages: sanitizeMessages([...messages, {
          role: 'system' as const,
          content: 'CRITICAL: You have run out of tool budget. Call send_report NOW with all collected data. This is your FINAL action.',
        }]) as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: agentTools,
        tool_choice: { type: 'function', function: { name: 'send_report' } },
      });
      const forcedMsg = forceCompletion.choices[0]?.message;
      if (forcedMsg?.tool_calls?.length) {
        for (const tc of forcedMsg.tool_calls) {
          if (tc.type === 'function' && tc.function.name === 'send_report') {
            const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
            await executeTool('send_report', args, toolCtx);
          }
        }
      }
    } catch (e) {
      console.error(`[agent:${taskId}] Forced send_report failed:`, e);
    }

    const summary = `Agent completed after ${stepsUsed} steps (budget exhausted).`;
    await supabase.from('agent_tasks').update({
      status: 'completed', result: summary, messages, steps_used: stepsUsed, tool_log: toolLog,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);
    return { status: 'completed', result: summary, taskId, stepsUsed };
  }

  // Save progress and schedule continuation — QStash only gets the taskId
  await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
  const continued = await scheduleContinuation(taskId);

  if (!continued) {
    const partial = `Agent paused after ${stepsUsed} steps (continuation failed).`;
    await supabase.from('agent_tasks').update({
      status: 'failed', result: partial, updated_at: new Date().toISOString(),
    }).eq('id', taskId);
    return { status: 'failed', result: partial, taskId, stepsUsed };
  }

  return { status: 'continued', taskId, stepsUsed };
}

// ─── Resume from Approval Gate (exported for webhook use) ────────────────

export async function resumeTaskFromApproval(
  taskId: string,
  approvalResponse: string,
): Promise<boolean> {
  const supabase = getSupabase();

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('status, messages')
    .eq('id', taskId)
    .maybeSingle();

  if (!task || task.status !== 'waiting_approval') {
    console.warn(`[agent:resume] Task ${taskId} not in waiting_approval state (${task?.status})`);
    return false;
  }

  // Inject owner's response into saved messages
  const messages: AgentMessage[] = Array.isArray(task.messages) ? task.messages : [];
  messages.push({
    role: 'user',
    content: `Owner's response to your approval request: "${approvalResponse}"`,
  });

  // Save updated messages and reset status
  await supabase.from('agent_tasks').update({
    status: 'pending',
    messages,
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  // Wake up via QStash
  const dispatched = await scheduleContinuation(taskId);
  if (dispatched) {
    console.log(`[agent:resume] Task ${taskId} resumed with approval: "${approvalResponse.substring(0, 50)}"`);
  }
  return dispatched;
}

// ─── Internal Helpers ────────────────────────────────────────────────────

/** Save progress to DB (called after every step). */
async function saveProgress(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  messages: AgentMessage[],
  stepsUsed: number,
  toolLog: ToolLogEntry[],
): Promise<void> {
  try {
    await supabase.from('agent_tasks').update({
      messages,
      steps_used: stepsUsed,
      tool_log: toolLog,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);
  } catch (err) {
    console.warn(`[agent:${taskId}] Progress save failed:`, err);
  }
}

/** Schedule a continuation via QStash — only sends the taskId. */
async function scheduleContinuation(taskId: string, delaySecs = 0): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai').replace(/\/$/, '');

  if (!qstashToken) {
    console.warn('[agent] No QSTASH_TOKEN — cannot schedule continuation');
    return false;
  }

  try {
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const targetUrl = `${appUrl}/api/agent/run`;
    
    const headers: Record<string, string> = {
      Authorization: `Bearer ${qstashToken}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': '2',
    };
    if (delaySecs > 0) headers['Upstash-Delay'] = `${delaySecs}s`;

    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ taskId }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[agent] QStash error ${res.status}: ${errText.substring(0, 200)}`);
      return false;
    }

    console.log(`[agent:${taskId}] Continuation scheduled`);
    return true;
  } catch (err) {
    console.error('[agent] QStash failed:', err);
    return false;
  }
}

/** Resume parent task when a sub-task completes. */
async function resumeParentIfNeeded(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  subTaskResult: string,
): Promise<void> {
  try {
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('parent_task_id')
      .eq('id', taskId)
      .maybeSingle();

    if (!task?.parent_task_id) return;
    const parentId = task.parent_task_id;
    console.log(`[agent:${taskId}] Sub-task done, resuming parent ${parentId}`);

    const { data: parent } = await supabase
      .from('agent_tasks')
      .select('status, messages')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent || parent.status !== 'waiting_subtask') return;

    const parentMessages: AgentMessage[] = Array.isArray(parent.messages) ? parent.messages : [];
    parentMessages.push({
      role: 'user',
      content: `Sub-agent completed. Result:\n\n${safeSlice(subTaskResult, 3000)}`,
    });

    await supabase.from('agent_tasks').update({
      status: 'pending',
      messages: parentMessages,
      updated_at: new Date().toISOString(),
    }).eq('id', parentId);

    await scheduleContinuation(parentId);
  } catch (err) {
    console.error(`[agent:${taskId}] Error resuming parent:`, err);
  }
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
5. CRITICAL REPORTING RULE: You MUST use the \`send_report\` tool to deliver your final report to the owner. DO NOT USE IT TO SEND A SUMMARY OR STATUS UPDATE. The \`message\` parameter of \`send_report\` MUST CONTAIN THE EXACT REPORT FORMATTED AS REQUESTED. The text you pass to \`send_report\` IS the final message the owner receives.
6. Be efficient — minimize unnecessary tool calls.
7. If a tool fails, try an alternative approach.
8. NEVER invent, guess, or hallucinate facts. Only report what you actually found in scraped/searched content.
9. NEVER hallucinate tool executions or actions you cannot perform. Offer to draft content instead.
10. Use save_memory to remember important insights, supplier info, decisions, and patterns.
11. Use request_approval BEFORE taking costly or irreversible actions (placing orders, sending campaigns).

## DELEGATION (USE WITH EXTREME CAUTION)
- DELEGATION IS STRICTLY FORBIDDEN if you already have the tools (search_web, send_report, scrape) and instructions needed to complete the task yourself.
- ONLY delegate when the task requires a DIFFERENT specialized assistant. If your user prompt came with specific template formats, YOU MUST perform the task yourself to ensure the format is preserved.
- Use delegate_task for fire-and-forget tasks (you don't need the result).
- Use delegate_task_and_wait when you NEED the sub-agent's result to continue.
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

IMPORTANT: Your task is NOT complete until you call the \`send_report\` tool. Write the full, heavily-formatted report matching your task instructions EXACTLY into the \`message\` parameter of the \`send_report\` tool. Never just output the report in your text response.`;
}
