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
import { getAgentProvider, type AgentProvider } from './provider';
import { sendWhatsApp } from '@/lib/evolution';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_STEPS_PER_INVOCATION = 8;   // 8 steps — safe with context compression; wall-clock is the real limiter
const MAX_TOTAL_STEPS = 80;           // Hard cap across all continuations
const AGENT_MODEL = 'deepseek-chat';
const WALL_CLOCK_LIMIT_MS = 45_000;   // 45s — Vercel Pro allows 60s, leaves 15s headroom
const STALE_TASK_MINUTES = 5;         // Auto-fail tasks stuck longer than this
const BUDGET_WARNING_STEPS = 5;       // Warn agent to wrap up when this many steps remain globally
const TOOL_RESULT_MAX = 8000;         // Max chars per tool result stored in messages
const TOOL_TIMEOUT_MS = 15_000;       // Max time for a single tool execution
const LLM_TIMEOUT_MS = 20_000;        // Max time for a single LLM call
const LLM_MAX_RETRIES = 2;            // Exponential backoff retries for transient DeepSeek errors

// ─── Context Compression ─────────────────────────────────────────────────

const CONTEXT_COMPRESS_THRESHOLD = 48_000; // Estimated tokens (~75% of DeepSeek 64K window)
const CONTEXT_COMPRESS_KEEP_TAIL = 6;      // Messages to preserve at end (most recent context)
const CHARS_PER_TOKEN = 3.5;               // Rough estimate for English/mixed content

// ─── Parallel Tool Execution ─────────────────────────────────────────────
// Read-only tools that can safely run in parallel (no side effects)
const PARALLEL_SAFE_TOOLS = new Set([
  'search_web', 'scrape_page', 'search_memory', 'search_tasks',
  'query_database', 'get_weather_forecast', 'search_google_maps',
]);

// ─── Skill Auto-Creation ─────────────────────────────────────────────────
const SKILL_AUTO_CREATE_MIN_TOOLS = 3; // Minimum tool calls to trigger skill extraction

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

/** Estimate token count from message array. */
function estimateTokens(msgs: AgentMessage[]): number {
  let chars = 0;
  for (const m of msgs) {
    if (m.content) chars += m.content.length;
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        chars += tc.function.name.length + tc.function.arguments.length;
      }
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Compress context when messages exceed the token threshold.
 * Keeps: system prompt (first message) + last N messages.
 * Summarizes everything in between into a single condensed message.
 */
async function compressContextIfNeeded(
  messages: AgentMessage[],
  client: InstanceType<typeof import('openai').default>,
  taskId: string,
  model: string = AGENT_MODEL,
  threshold: number = CONTEXT_COMPRESS_THRESHOLD,
): Promise<AgentMessage[]> {
  const tokenEstimate = estimateTokens(messages);
  if (tokenEstimate < threshold || messages.length <= CONTEXT_COMPRESS_KEEP_TAIL + 2) {
    return messages; // No compression needed
  }

  console.log(`[agent:${taskId}] Context compression triggered: ~${tokenEstimate} tokens, ${messages.length} messages`);

  // Keep: [system prompt, ...middle to compress..., last N messages]
  const systemMsg = messages[0]; // Always the system prompt

  // Find a safe split point — never break inside a tool-call/tool-result sequence.
  // Walk backwards from the intended split to find a boundary that doesn't start with a tool message.
  let splitIdx = messages.length - CONTEXT_COMPRESS_KEEP_TAIL;
  while (splitIdx > 2 && messages[splitIdx]?.role === 'tool') {
    splitIdx--; // Move back to include the assistant+tool_calls that owns these tool results
  }

  const tail = messages.slice(splitIdx);
  const middle = messages.slice(1, splitIdx);

  if (middle.length < 3) return messages; // Not enough to compress

  // Build a condensed view of middle messages for the summarizer
  const middleSummaryInput = middle.map(m => {
    if (m.role === 'tool') {
      return `[tool result for ${m.tool_call_id}]: ${safeSlice(m.content || '', 200)}`;
    }
    if (m.role === 'assistant' && m.tool_calls?.length) {
      const calls = m.tool_calls.map(tc => `${tc.function.name}(${safeSlice(tc.function.arguments, 80)})`).join(', ');
      return `[assistant called: ${calls}]${m.content ? ` + said: ${safeSlice(m.content, 200)}` : ''}`;
    }
    return `[${m.role}]: ${safeSlice(m.content || '', 300)}`;
  }).join('\n');

  try {
    const summaryCompletion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Summarize this agent conversation history into key facts, decisions made, tool results obtained, and pending actions. Be concise but preserve ALL important data points (numbers, names, prices, URLs). Output only the summary, no preamble.' },
        { role: 'user', content: middleSummaryInput },
      ],
      max_tokens: 1500,
    });

    const summary = summaryCompletion.choices[0]?.message?.content || '';
    if (!summary) return messages; // Summarization failed, keep original

    const compressedMessages: AgentMessage[] = [
      systemMsg,
      {
        role: 'system',
        content: `[CONTEXT SUMMARY — compressed from ${middle.length} earlier messages]\n${summary}`,
      },
      ...tail,
    ];

    const newTokens = estimateTokens(compressedMessages);
    console.log(`[agent:${taskId}] Compressed: ${tokenEstimate} → ~${newTokens} tokens (${messages.length} → ${compressedMessages.length} messages)`);
    return compressedMessages;
  } catch (err) {
    console.warn(`[agent:${taskId}] Context compression failed (non-fatal):`, err);
    return messages; // Fall back to uncompressed
  }
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
  // Restore recalled skill IDs from tool_log (persisted across continuations)
  let recalledSkillIds: string[] = [];
  const recalledEntry = toolLog.find(t => t.tool === '__recalled_skills__');
  if (recalledEntry && Array.isArray(recalledEntry.args?.ids)) {
    recalledSkillIds = recalledEntry.args.ids as string[];
  }

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

    // ── Skills auto-recall: inject relevant proven workflows ──
    recalledSkillIds = [];
    try {
      const goalWords = (row.goal as string || '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .map(w => w.replace(/[%_]/g, ''))
        .filter(w => w.length > 2)
        .slice(0, 4);

      if (goalWords.length > 0) {
        // OR-match: any keyword in content
        const orFilter = goalWords.map(w => `content.ilike.%${w}%`).join(',');

        const { data: skills } = await supabase
          .from('ai_memories')
          .select('id, content, importance_score, use_count')
          .eq('business_id', row.business_id)
          .eq('archived', false)
          .in('category', ['skill', 'tool_recipe'])
          .or(orFilter)
          .order('importance_score', { ascending: false })
          .limit(2);

        if (skills?.length) {
          recalledSkillIds = skills.map(s => s.id);
          // Persist recalled skill IDs so continuations can track effectiveness
          toolLog.push({ tool: '__recalled_skills__', args: { ids: recalledSkillIds } as Record<string, unknown>, result: 'ok', timestamp: new Date().toISOString() });
          memoryContext += '\n\n## RELEVANT SKILLS (proven workflows — follow these steps if applicable)\n';
          for (const s of skills) {
            memoryContext += `${(s.content || '').substring(0, 600)}\n---\n`;
          }
        }
      }
    } catch (e) {
      console.warn(`[agent:${taskId}] Skills recall failed (non-fatal):`, e);
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
    const provider = await getAgentProvider(LLM_TIMEOUT_MS);
    const client = provider.client;
    const agentModel = provider.model;
    // Dynamic compression threshold: 75% of the provider's context window
    const compressThreshold = Math.floor(provider.contextWindow * 0.75);
    const agentTools = getToolsForAgent(row.enabled_tools);
    let stepsThisInvocation = 0;

    while (stepsThisInvocation < MAX_STEPS_PER_INVOCATION && stepsUsed < MAX_TOTAL_STEPS) {
      // ── Wall-clock check ──
      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.log(`[agent:${taskId}] Wall-clock limit (${Math.round((Date.now() - startTime) / 1000)}s), scheduling continuation`);
        break;
      }

      // ── Context compression — prevent blowing the context window ──
      messages = await compressContextIfNeeded(messages, client, taskId, agentModel, compressThreshold);

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
            model: agentModel,
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
        type FnToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
        const fnCalls: FnToolCall[] = assistantMessage.tool_calls.filter(
          (tc: { type: string }): tc is FnToolCall => tc.type === 'function',
        );

        messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: fnCalls.map((tc: FnToolCall) => ({
            id: tc.id, type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });

        // ── Classify tool calls: parallel-safe vs sequential ──
        const parallelCalls: FnToolCall[] = [];
        const sequentialCalls: FnToolCall[] = [];
        // Pre-parse all args once
        const parsedArgs = new Map<string, Record<string, unknown>>();

        for (const tc of fnCalls) {
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
          } catch {
            toolArgs = {};
          }

          // ── Payload Auto-Swap (Smart Report Delivery) ──
          if (tc.function.name === 'send_report' && typeof toolArgs.message === 'string' && assistantMessage.content) {
            const firstLine = toolArgs.message.split('\n')[0].trim();
            const isSummary = /^(here|the|a|\*)?( )?(summary|overview|report|this)/i.test(firstLine) ||
                              /^i('ve| have) (successfully |already )?(sent|delivered|compiled|generated|completed)/i.test(firstLine) ||
                              /^(perfect|great)!/i.test(firstLine);

            const contentIsLonger = assistantMessage.content.length > toolArgs.message.length;
            if ((isSummary || toolArgs.message.length < 150) && contentIsLonger) {
              console.log(`[agent:${taskId}] Intercepted summary report call, swapping payload with assistant text message`);
              toolArgs.message = assistantMessage.content.trim();
            }
          }

          parsedArgs.set(tc.id, toolArgs);

          if (PARALLEL_SAFE_TOOLS.has(tc.function.name) && fnCalls.length > 1) {
            parallelCalls.push(tc);
          } else {
            sequentialCalls.push(tc);
          }
        }

        // Helper: execute a single tool call with timeout
        const runTool = async (tc: typeof fnCalls[0]): Promise<{ id: string; name: string; args: Record<string, unknown>; result: string }> => {
          const toolArgs = parsedArgs.get(tc.id)!;
          console.log(`[agent:${taskId}] Step ${stepsUsed + 1}: ${tc.function.name}(${JSON.stringify(toolArgs).substring(0, 100)})`);

          // Live task updates (Hermes-style)
          if (toolCtx.ownerPhone && !tc.function.name.startsWith('send_')) {
            const agentName = row.role ? row.role : 'Agent';
            const iconMap: Record<string, string> = {
              request_integration: '🔌',
              browse_web: '🌐',
              scrape_page: '🕷️',
              search_web: '🔍',
              search_google_maps: '🗺️',
              save_leads: '📥',
              search_memory: '🧠',
              save_memory: '💾',
              delegate_task: '🔀',
              delegate_task_and_wait: '⏳',
              query_database: '🗄️',
              call_api: '⚡',
              draft_content: '📝',
              manage_job: '📋',
              analyze_inventory: '📦',
              request_approval: '👍',
              get_weather_forecast: '⛅',
              search_tasks: '🔍'
            };
            const icon = iconMap[tc.function.name] || '⚙️';
            // Fire-and-forget message, we don't want to block the agent loop
            sendWhatsApp(
              toolCtx.ownerPhone,
              `_${icon} ${tc.function.name}..._`,
              toolCtx.businessId || undefined
            ).catch(() => {});
          }

          let toolResult: string;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
            try {
              const toolPromise = executeTool(tc.function.name, toolArgs, toolCtx);
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
          return { id: tc.id, name: tc.function.name, args: toolArgs, result: toolResult };
        };

        // ── Execute parallel-safe tools concurrently ──
        let shouldBreak = false;
        let pauseResult: string | null = null;

        if (parallelCalls.length > 0) {
          console.log(`[agent:${taskId}] Running ${parallelCalls.length} tools in parallel: ${parallelCalls.map((tc: FnToolCall) => tc.function.name).join(', ')}`);
          const results = await Promise.allSettled(parallelCalls.map((tc: FnToolCall) => runTool(tc)));

          for (let i = 0; i < parallelCalls.length; i++) {
            const settled = results[i];
            const r = settled.status === 'fulfilled'
              ? settled.value
              : { id: parallelCalls[i].id, name: parallelCalls[i].function.name, args: parsedArgs.get(parallelCalls[i].id)!, result: `Tool error: ${(settled as PromiseRejectedResult).reason}` };

            messages.push({ role: 'tool', tool_call_id: r.id, content: safeSlice(r.result, TOOL_RESULT_MAX) });
            toolLog.push({ tool: r.name, args: r.args, result: safeSlice(r.result, 500), timestamp: new Date().toISOString() });
            stepsUsed++;
            stepsThisInvocation++;
          }

          await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);

          // Wall-clock check after parallel batch
          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            // Defer any remaining sequential calls
            for (const tc of sequentialCalls) {
              messages.push({ role: 'tool', tool_call_id: tc.id, content: 'Deferred to next continuation.' });
            }
            await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
            shouldBreak = true;
          }
        }

        // ── Execute sequential tools one by one ──
        if (!shouldBreak) {
          for (const tc of sequentialCalls) {
            const r = await runTool(tc);

            messages.push({ role: 'tool', tool_call_id: r.id, content: safeSlice(r.result, TOOL_RESULT_MAX) });
            toolLog.push({ tool: r.name, args: r.args, result: safeSlice(r.result, 500), timestamp: new Date().toISOString() });
            stepsUsed++;
            stepsThisInvocation++;

            await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);

            // ── PAUSE SIGNAL ──
            if (r.result.startsWith('__PAUSE__:')) {
              const pauseType = r.result.includes('waiting_approval') ? 'waiting_approval' : 'waiting_subtask';
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
              return { status: 'completed' as const, result: r.result, taskId, stepsUsed };
            }

            // Wall-clock check after each sequential tool
            if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
              const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
              for (const unexecuted of fnCalls) {
                if (!executedIds.has(unexecuted.id)) {
                  messages.push({ role: 'tool', tool_call_id: unexecuted.id, content: 'Deferred to next continuation.' });
                }
              }
              await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
              shouldBreak = true;
              break;
            }
          }
        }
        if (shouldBreak) break;
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

        // ── Auto-create skill from successful multi-tool tasks ──
        await autoCreateSkill(supabase, client, taskId, row.goal, row.business_id, toolLog, agentModel);

        // ── Update skill effectiveness for recalled skills ──
        if (recalledSkillIds.length > 0) {
          await updateSkillEffectiveness(supabase, recalledSkillIds, true, taskId);
        }

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

    // Downgrade skill effectiveness on failure
    if (recalledSkillIds.length > 0) {
      await updateSkillEffectiveness(supabase, recalledSkillIds, false, taskId);
    }

    return { status: 'failed', result: `Agent error: ${errMsg}`, taskId, stepsUsed };
  }

  // ── Need more steps → schedule continuation ──

  if (stepsUsed >= MAX_TOTAL_STEPS) {
    // Hard cap — force send_report with collected data
    console.log(`[agent:${taskId}] MAX_TOTAL_STEPS reached (${stepsUsed}), forcing send_report`);
    try {
      const forceProvider = await getAgentProvider(LLM_TIMEOUT_MS);
      const agentTools = getToolsForAgent(row.enabled_tools);
      const forceCompletion = await forceProvider.client.chat.completions.create({
        model: forceProvider.model,
        messages: sanitizeMessages([...messages, {
          role: 'system' as const,
          content: 'CRITICAL: You have run out of tool budget. Call send_report NOW with all collected data. This is your FINAL action.',
        }]) as Parameters<typeof forceProvider.client.chat.completions.create>[0]['messages'],
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

/**
 * Auto-create a reusable skill from successful multi-tool tasks.
 * Only triggers when: task used 3+ tools, wasn't delegated, and no similar skill exists.
 */
async function autoCreateSkill(
  supabase: ReturnType<typeof getSupabase>,
  client: InstanceType<typeof import('openai').default>,
  taskId: string,
  goal: string,
  businessId: string,
  toolLog: ToolLogEntry[],
  model: string = AGENT_MODEL,
): Promise<void> {
  try {
    // Skip delegated tasks and tasks with few tool calls
    if (goal.startsWith('[DELEGATED TASK]')) return;
    const uniqueTools = new Set(toolLog.map(t => t.tool));
    if (toolLog.length < SKILL_AUTO_CREATE_MIN_TOOLS) return;
    // Skip if the agent already saved a skill during this task
    if (toolLog.some(t => t.tool === 'save_memory' && String(t.args?.category) === 'skill')) return;

    // Check if a similar skill already exists (avoid duplicates)
    const goalWords = goal.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    if (goalWords.length === 0) return;
    const orFilter = goalWords.map(w => `content.ilike.%${w.replace(/[%_]/g, '')}%`).join(',');

    const { data: existing } = await supabase
      .from('ai_memories')
      .select('id')
      .eq('business_id', businessId)
      .in('category', ['skill', 'tool_recipe'])
      .or(orFilter)
      .limit(1);

    if (existing?.length) return; // Similar skill already exists

    // Generate skill document from tool log
    const toolSequence = toolLog.map((t, i) =>
      `${i + 1}. ${t.tool}(${JSON.stringify(t.args).substring(0, 120)}) → ${safeSlice(t.result, 100)}`
    ).join('\n');

    const skillCompletion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Create a concise reusable SKILL document from this completed agent task. Use this exact format:\n\nSKILL: [2-5 word name]\nTRIGGER: [when to use this skill]\nSTEPS:\n1. [tool_name] — [what and why]\n2. [tool_name] — [what and why]\nTIPS: [what worked, pitfalls to avoid]\n\nBe specific and actionable. Output ONLY the skill document.' },
        { role: 'user', content: `Goal: ${goal}\n\nTool sequence:\n${toolSequence}` },
      ],
      max_tokens: 500,
    });

    const skillContent = skillCompletion.choices[0]?.message?.content?.trim();
    if (!skillContent || skillContent.length < 30) return;

    // Generate embedding and save
    const OpenAILib = (await import('openai')).default;
    const embeddingClient = new OpenAILib({ apiKey: process.env.OPENAI_API_KEY! });
    const embeddingRes = await embeddingClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: skillContent.substring(0, 8000),
    });
    const embedding = embeddingRes.data[0]?.embedding;

    await supabase.from('ai_memories').insert({
      business_id: businessId,
      content: skillContent,
      category: 'skill',
      importance_score: 0.7,
      embedding: embedding || null,
      use_count: 0,
      metadata: { source: 'auto_skill', task_id: taskId, tools_used: Array.from(uniqueTools) },
    });

    console.log(`[agent:${taskId}] Auto-created skill from ${toolLog.length}-tool task`);
  } catch (err) {
    // Non-critical — don't fail the task
    console.warn(`[agent:${taskId}] Auto-skill creation failed:`, err);
  }
}

/**
 * Update skill effectiveness based on task outcome.
 * Success: increment use_count, nudge importance_score up.
 * Failure: nudge importance_score down (don't remove — may work next time).
 */
async function updateSkillEffectiveness(
  supabase: ReturnType<typeof getSupabase>,
  skillIds: string[],
  success: boolean,
  taskId: string,
): Promise<void> {
  try {
    for (const skillId of skillIds) {
      const { data: skill } = await supabase
        .from('ai_memories')
        .select('importance_score, use_count')
        .eq('id', skillId)
        .maybeSingle();

      if (!skill) continue;

      const currentScore = skill.importance_score ?? 0.5;
      const currentUseCount = skill.use_count ?? 0;

      const newScore = success
        ? Math.min(1.0, currentScore + 0.02)   // Small bump on success
        : Math.max(0.1, currentScore - 0.05);  // Larger penalty on failure

      await supabase.from('ai_memories').update({
        importance_score: Math.round(newScore * 100) / 100,
        use_count: currentUseCount + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', skillId);
    }
    console.log(`[agent:${taskId}] Updated ${skillIds.length} skill(s) effectiveness (${success ? 'success' : 'failure'})`);
  } catch (err) {
    console.warn(`[agent:${taskId}] Skill effectiveness update failed:`, err);
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

You have access to tools: search the web, scrape pages, find local businesses, save leads, query the database, draft content, send WhatsApp messages, manage jobs, delegate tasks, request approval, search/save memory, search past tasks, call external APIs, request new integrations, and send reports to the owner.

## RULES
1. Think step-by-step. Plan your approach before using tools.
2. Use search_memory FIRST to check if you already know something relevant.
3. Use search_web to research before making decisions.
4. Always save valuable leads using save_leads — don't just list them.
5. To deliver your final results, generate the full report matching the requested format perfectly, and send it to the owner using the \`send_report\` tool. Alternatively, you can omit the tool and just write the final report text in your conversational response, and I will deliver it.
6. Be efficient — minimize unnecessary tool calls.
7. If a tool fails, try an alternative approach.
8. NEVER invent, guess, or hallucinate facts. Only report what you actually found in scraped/searched content.
9. NEVER hallucinate tool executions or actions you cannot perform. Offer to draft content instead.
10. MEMORY DISCIPLINE — After EVERY task completion:
    a) Did you learn a new supplier, price, or contact? → save_memory (category: supplier or preference)
    b) Did you complete a multi-step workflow (3+ tool calls)? → save_memory (category: skill) with this format:
       SKILL: [short name]
       TRIGGER: [when to use this skill]
       STEPS:
       1. [tool_name] — [what and why]
       2. [tool_name] — [what and why]
       TIPS: [what worked, what to avoid]
    c) Did the owner correct you or express a preference? → save_memory (category: preference)
    d) Did you discover something unexpected? → save_memory (category: pattern)
    FORGETTING IS FAILURE. When in doubt, save.
11. Use request_approval BEFORE taking costly or irreversible actions (placing orders, sending campaigns).
12. Use search_tasks to look up past work when the owner asks about previous tasks, old reports, or historical decisions.

## DYNAMIC CAPABILITIES (call_api + request_integration)
You are not limited to built-in tools. You can call ANY external REST API the owner has connected:
- Use call_api to interact with third-party services (video generators, design tools, analytics, etc.).
- Before calling an API, search_memory for category "tool_recipe" — you may already know the exact endpoint and body format.
- After a successful API call, save_memory with category "tool_recipe" so you remember how to use it next time.
- If a task requires a service that isn't connected yet, use search_web to find the best API for the job, then use request_integration to connect it.
- **IMPORTANT:** If the owner already provided an API key in the conversation, pass it in the api_key field of request_integration to activate the integration immediately. Do NOT just request it — activate it.
- For API calls that cost money (POST/PUT that trigger paid actions), use request_approval first.
- **INTEGRATION DISCIPLINE:**
  - Request ONE integration at a time. Do NOT request multiple alternatives for the same capability.
  - After requesting an integration, WAIT for the owner's response before requesting another.
  - If an integration fails (401/404), report the specific error and ask the owner to verify the key — do NOT immediately request a different service.
  - NEVER request integrations on your own initiative. Only request when the owner asks for a specific capability.

## BROWSER AUTOMATION (browse_web)
You can control a REAL cloud browser to interact with any website:
- Use browse_web when you need to CLICK, TYPE, LOG IN, FILL FORMS, CREATE LISTINGS, or perform any interactive web action.
- For simple reading/searching, prefer search_web or scrape_page (cheaper and faster).
- Be specific in your task description: include URLs, exact text to type, buttons to click.
- For actions that cost money or are irreversible (publishing listings, placing orders), use request_approval FIRST.
- After a successful browser workflow, save_memory with category "tool_recipe" so you remember the steps next time.

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

IMPORTANT: When your task is complete, always write the full, exact report. You may provide it inside the \`send_report\` tool, or simply as your final chat output without making any tool calls.`;
}
