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
import { sendWhatsAppWithCreds, type EvolutionCredentials } from '@/lib/evolution';
import { discoverMcpTools, executeMcpTool, isMcpTool } from './mcp';

// ─── Launchfly CEO instance credentials (for tool updates & reports) ─────
// All agent status messages must go through THIS instance so the webhook
// correctly detects them as fromMe/bot_echo and doesn't re-process them.
function getLaunchflyCreds(): EvolutionCredentials | null {
  const baseUrl = process.env.EVOLUTION_BASE_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.LAUNCHFLY_INSTANCE_NAME;
  if (!baseUrl || !apiKey || !instanceName) return null;
  return { baseUrl, apiKey, instanceName };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_STEPS_PER_INVOCATION = 12;  // 12 steps — reduces continuation gaps (biggest perf win)
const MAX_TOTAL_STEPS = 10_000;       // Effectively unlimited — agents run until done (safety: owner can send 'stop' via WhatsApp)
const AGENT_MODEL = 'deepseek-chat';
const WALL_CLOCK_LIMIT_MS = 290_000;  // 290s (Vercel Pro w/ Fluid Compute default is 300s, 10s buffer)
const STALE_TASK_MINUTES = 2;         // Auto-resume tasks stuck longer than this (Vercel max=60s, so 2min is generous)
const BUDGET_WARNING_STEPS = 50;      // Warn agent to wrap up when this many steps remain globally
const RESEARCH_SOFT_CAP = 50;         // After this many search/scrape steps, nudge to wrap up
const RESEARCH_HARD_CAP = 100;        // After this many, forcefully demand send_report
const TOOL_RESULT_MAX = 6000;         // Max chars per tool result stored in messages
const TOOL_TIMEOUT_MS = 12_000;       // Max time for a single tool execution (12s — fail fast)
// Some tools legitimately need more time (e.g. Apify actor runs, browser automation)
const TOOL_TIMEOUT_OVERRIDES: Record<string, number> = {
  search_google_maps: 55_000,  // Apify actor runs take 30-50s
  browse_web: 125_000,         // Browserbase sessions up to 2 min
  make_call: 30_000,           // Retell API call setup
  send_voice_note: 30_000,    // TTS generation + upload + send
  generate_video: 55_000,      // Vast.ai boot + generate (capped by Vercel 60s — prefer workflow-runner)
  generate_long_video: 55_000, // Multi-scene (capped by Vercel 60s — prefer workflow-runner)
  execute_python: 55_000,      // E2B sandbox (capped by Vercel — prefer workflow-runner for long tasks)
  process_document: 55_000,    // Document download + parse (capped by Vercel)
  deep_research: 55_000,       // Multi-step search (capped by Vercel)
  generate_document: 55_000,   // Doc gen (capped by Vercel)
  manage_calendar: 15_000,     // Google Calendar API
  process_payment: 15_000,     // Stripe API
};
const LLM_TIMEOUT_MS = 48_000;        // Max time for a single LLM call (48s — give DeepSeek maximum possible runway)
const LLM_MAX_RETRIES = 1;            // Single retry for transient DeepSeek errors (was 2 — too slow)

// ─── Context Compression ─────────────────────────────────────────────────

const CONTEXT_COMPRESS_THRESHOLD = 8_000;  // Estimated tokens (highly aggressive to keep TTFT low)
const CONTEXT_COMPRESS_KEEP_TAIL = 4;      // Messages to preserve at end (most recent context)
const CHARS_PER_TOKEN = 3.5;               // Rough estimate for English/mixed content

// ─── Parallel Tool Execution ─────────────────────────────────────────────
// Read-only tools that can safely run in parallel (no side effects)
const PARALLEL_SAFE_TOOLS = new Set([
  'search_web', 'scrape_page', 'search_memory', 'query_database', 'search_google_maps',
  'save_memory', 'save_leads', 'validate_memory',
  'translate', 'knowledge_base', 'analyze_image',
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

/**
 * Parse XML-style tool calls from model content (MiMo, Qwen format).
 * Converts: <tool_call>\n<function=NAME>\n<parameter=KEY>VALUE</parameter>\n</function>\n</tool_call>
 * Into: [{ id, type: 'function', function: { name, arguments } }]
 */
function parseXmlToolCalls(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match: RegExpExecArray | null;

  while ((match = toolCallRegex.exec(content)) !== null) {
    const block = match[1];
    const fnMatch = block.match(/<function=([^>]+)>/);
    if (!fnMatch) continue;
    const fnName = fnMatch[1].trim();

    const params: Record<string, unknown> = {};
    const paramRegex = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRegex.exec(block)) !== null) {
      const key = paramMatch[1].trim();
      let value: unknown = paramMatch[2];
      try { value = JSON.parse(value as string); } catch { /* keep as string */ }
      params[key] = value;
    }

    toolCalls.push({
      id: `xmltc_${Date.now()}_${toolCalls.length}`,
      type: 'function',
      function: { name: fnName, arguments: JSON.stringify(params) },
    });
  }

  return toolCalls;
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
  updated_at?: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Create a new agent task in the DB and dispatch it via Upstash Workflow.
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

  // Dispatch via Upstash Workflow
  const dispatched = await triggerAgentWorkflow(taskId);

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

  // Guard against concurrent execution: try to claim the task using DB-level constraint
  const { data: claimedTask, error: claimErr } = await supabase
    .from('agent_tasks')
    .update({
      status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    // Only claim if it's pending OR if it's been stuck in running state for too long
    .or(`status.eq.pending,and(status.eq.running,updated_at.lt.${new Date(Date.now() - STALE_TASK_MINUTES * 60_000).toISOString()})`)
    .select('id')
    .single();

  if (claimErr || !claimedTask) {
    if (claimErr?.code === 'PGRST116') {
      // 0 rows updated -> someone else claimed it, or it was recently started
      console.log(`[agent:${taskId}] Task is already claimed by another worker, skipping duplicate invocation`);
      return { status: 'continued' as const, taskId, stepsUsed: row.steps_used };
    }
    throw new Error(`Failed to claim task ${taskId} for running: ${claimErr?.message}`);
  }

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
    .select('name, custom_rules')
    .eq('business_id', row.business_id)
    .eq('active', true)
    .not('goal', 'is', null)
    .limit(1)
    .maybeSingle();

  // Use custom role name for report header (e.g. "Trend Scout — Weekly..." → "Trend Scout")
  // Fall back to well-known OS names, then to the active assistant name.
  let repName: string | undefined;
  if (row.role) {
    // Extract a short display name from the role string.
    // Patterns: "You are the AI Chief of Staff" → "Chief of Staff"
    //           "Trend Scout — Weekly..." → "Trend Scout"
    const dashIdx = row.role.search(/\s[—–-]\s/);
    if (dashIdx > 0 && dashIdx < 60) {
      repName = row.role.substring(0, dashIdx).trim();
    } else {
      // Try to extract role title from "You are the [ROLE] for ..."
      const roleMatch = row.role.match(/You are (?:the |an? )?(?:AI )?(.+?)(?:\s+for\s|\s+working\s|\.\s|\n)/i);
      if (roleMatch) {
        repName = roleMatch[1].trim().substring(0, 40);
      } else {
        repName = row.role.substring(0, 30).trim();
      }
    }
  }
  if (!repName) repName = assistant?.name;

  // Resolve owner phone — trust explicit owner_phone from webhook; only guess from DB if missing.
  // NEVER route to the bot's own WhatsApp number; that causes self-chat loops.
  const botWhatsApp = (biz?.whatsapp_number || '').replace(/^\+/, '');
  let resolvedOwnerPhone: string | undefined;
  if (row.owner_phone) {
    // Explicitly set by webhook — the sender's real phone. Trust it.
    resolvedOwnerPhone = row.owner_phone;
  } else {
    // Guess from DB fields, but avoid sending to the bot's own number
    resolvedOwnerPhone = biz?.whatsapp_notify_number || biz?.phone_number || undefined;
    if (resolvedOwnerPhone && botWhatsApp && resolvedOwnerPhone.replace(/^\+/, '') === botWhatsApp) {
      const altPhone = (biz?.phone_number || '').replace(/^\+/, '');
      resolvedOwnerPhone = (altPhone && altPhone !== botWhatsApp) ? biz!.phone_number! : undefined;
      if (resolvedOwnerPhone) {
        console.warn(`[agent] ownerPhone was bot number, falling back to phone_number: ${resolvedOwnerPhone}`);
      } else {
        console.warn(`[agent] ownerPhone was bot number — no safe fallback, reports will be skipped`);
      }
    }
  }

  const toolCtx: ToolContext = {
    businessId: row.business_id,
    businessName: biz?.name || undefined,
    ownerPhone: resolvedOwnerPhone,
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

    // Lazy context: only load heavy queries for goals that likely need them.
    // Simple goals (send_whatsapp, single action) skip conversation history, jobs, etc.
    const goalLower = (row.goal || '').toLowerCase();
    const needsFullContext = goalLower.length > 200
      || /report|insight|analyz|review|follow.?up|prospect|lead|campaign|schedule|plan|strateg|morning|daily|inventory|job|supplier|purchase/i.test(goalLower);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contextPromises = needsFullContext
      ? [
          ownerPhoneNorm
            ? getConversationHistory(ownerPhoneNorm, row.business_id)
            : Promise.resolve([]),
          Promise.resolve(supabase
            .from('agent_tasks')
            .select('goal, result, updated_at')
            .eq('business_id', row.business_id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(5)
            .then(r => r.data || [])),
          Promise.resolve(supabase
            .from('jobs')
            .select('id, title, status, description, materials_needed, blockers, updated_at')
            .eq('business_id', row.business_id)
            .in('status', ['draft', 'quoting', 'ready', 'blocked'])
            .order('updated_at', { ascending: false })
            .limit(10)
            .then(r => r.data || [])),
        ] as const
      : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])] as const;

    const [conversationHistory, recentTasks, activeJobs] = await Promise.all(contextPromises);

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

    // ── Skills auto-recall: semantic search via embeddings (language-agnostic) ──
    recalledSkillIds = [];
    try {
      const goalText = (row.goal as string || '').trim();
      if (goalText.length > 2) {
        // Generate embedding for the goal — works in any language
        const OpenAIEmbed = (await import('openai')).default;
        const embedClient = new OpenAIEmbed({ apiKey: process.env.OPENAI_API_KEY! });
        const embRes = await embedClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: goalText.substring(0, 8000),
        });
        const goalEmbedding = embRes.data[0]?.embedding;

        if (goalEmbedding) {
          // Use dedicated RPC with similarity threshold (language-agnostic)
          const { data: skills, error: rpcErr } = await supabase.rpc('search_skills', {
            query_embedding: goalEmbedding,
            match_business_id: row.business_id,
            match_count: 2,
            min_similarity: 0.3,
          });

          if (!rpcErr && skills?.length) {
            recalledSkillIds = skills.map((s: any) => s.id);
            toolLog.push({ tool: '__recalled_skills__', args: { ids: recalledSkillIds } as Record<string, unknown>, result: 'ok', timestamp: new Date().toISOString() });
            memoryContext += '\n\n## YOUR PROVEN PLAYBOOK (follow these steps — they worked before)\n';
            for (const s of skills) {
              memoryContext += `${((s as any).content || '').substring(0, 600)}\n---\n`;
            }
          }

          // ── Auto-inject relevant memories (eliminates "agent forgot to search" problem) ──
          try {
            const { data: autoMemories, error: memErr } = await supabase.rpc('search_memories', {
              query_embedding: goalEmbedding,
              match_business_id: row.business_id,
              match_category: null,
              match_count: 5,
            });

            if (!memErr && autoMemories?.length) {
              // Only inject memories with reasonable similarity (> 0.25)
              const relevant = autoMemories.filter((m: any) => (m.similarity || 0) > 0.25);
              if (relevant.length > 0) {
                memoryContext += '\n\n## IMPORTANT CONTEXT FROM PAST EXPERIENCE (use this — don\'t start from scratch)\n';
                for (const m of relevant) {
                  const cat = (m as any).category || 'general';
                  const imp = (m as any).importance_score || 0.5;
                  const sim = ((m as any).similarity || 0).toFixed(2);
                  memoryContext += `- [${cat}] (importance: ${imp}, relevance: ${sim}) ${((m as any).content || '').substring(0, 400)}\n`;
                }
                // Track auto-recall for last_recalled_at updates
                const recalledIds = relevant.map((m: any) => m.id).filter(Boolean);
                if (recalledIds.length > 0) {
                  try {
                    await supabase.rpc('touch_recalled_memories', { memory_ids: recalledIds });
                  } catch { /* columns not yet migrated — non-fatal */ }
                }
              }
            }
          } catch (memAutoErr) {
            console.warn(`[agent:${taskId}] Auto-recall memories failed (non-fatal):`, memAutoErr);
          }
        }
      }
    } catch (e) {
      console.warn(`[agent:${taskId}] Skills recall failed (non-fatal):`, e);
    }

    // ── Business DNA: inject playbooks (these may not overlap with auto-recall since they're category-filtered) ──
    try {
      const { data: dnaMemories } = await supabase
        .from('ai_memories')
        .select('id, content, category, importance_score')
        .eq('business_id', row.business_id)
        .eq('category', 'playbook')
        .eq('archived', false)
        .gte('importance_score', 0.5)
        .order('importance_score', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(3);

      if (dnaMemories?.length) {
        memoryContext += '\n\n## BUSINESS PLAYBOOKS (proven strategies for this business)\n';
        for (const m of dnaMemories) {
          memoryContext += `📋 (confidence: ${m.importance_score}): ${(m.content || '').substring(0, 500)}\n---\n`;
        }
        // Touch playbook recall too
        const playbookIds = dnaMemories.map(m => m.id).filter(Boolean);
        if (playbookIds.length > 0) {
          try { await supabase.rpc('touch_recalled_memories', { memory_ids: playbookIds }); } catch { /* non-fatal */ }
        }
      }
    } catch (e) {
      console.warn(`[agent:${taskId}] Business DNA recall failed (non-fatal):`, e);
    }

    messages = [
      { role: 'system', content: buildSystemPrompt(toolCtx, row.role || undefined, industry, location, memoryContext, (assistant?.custom_rules as string[]) || []) },
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
    const provider = await getAgentProvider(null, LLM_TIMEOUT_MS);
    const client = provider.client;
    const agentModel = provider.model;
    // Dynamic compression threshold: cap at CONTEXT_COMPRESS_THRESHOLD for fast response times
    const compressThreshold = Math.min(Math.floor(provider.contextWindow * 0.75), CONTEXT_COMPRESS_THRESHOLD);
    const nativeTools = getToolsForAgent(row.enabled_tools);

    // ── Discover MCP tools (dynamic tools from external servers) ──
    type McpToolMapping = { server: { id: string; name: string; transport: 'http' | 'sse'; url: string; api_key?: string; headers?: Record<string, string>; tool_filter?: string[] }; originalToolName: string };
    let mcpServerMap = new Map<string, McpToolMapping>();
    let agentTools: typeof nativeTools = nativeTools;
    try {
      const { tools: mcpTools, serverMap } = await discoverMcpTools(row.business_id);
      if (mcpTools.length > 0) {
        agentTools = [...nativeTools, ...mcpTools as typeof nativeTools];
        mcpServerMap = serverMap as Map<string, McpToolMapping>;
        console.log(`[agent:${taskId}] Loaded ${mcpTools.length} MCP tools from external servers`);
      }
    } catch (mcpErr) {
      console.warn(`[agent:${taskId}] MCP discovery failed (non-fatal):`, mcpErr);
    }

    let stepsThisInvocation = 0;

    // ── Continuation awareness: if resuming, inject a nudge so the LLM knows it's a new round ──
    const isContinuation = stepsUsed > 0 && messages.length > 2;
    if (isContinuation) {
      // Count how many times we've continued (each continuation adds ≤ MAX_STEPS_PER_INVOCATION)
      const continuationRound = Math.floor(stepsUsed / MAX_STEPS_PER_INVOCATION) + 1;
      const stepsLeft = MAX_TOTAL_STEPS - stepsUsed;

      // Count research-type tool calls from previous invocations
      const researchTools = new Set(['search_web', 'scrape_page', 'search_google_maps']);
      const researchSteps = toolLog.filter(t => researchTools.has(t.tool)).length;
      
      let contMessage = `⚡ CONTINUATION (round ${continuationRound}): Server execution paused to prevent timeouts. You have used ${stepsUsed} steps (${researchSteps} research calls) with ${stepsLeft} remaining.\n\n`;
      
      if (stepsLeft <= BUDGET_WARNING_STEPS) {
        contMessage += `CRITICAL BUDGET WARNING: You only have ${stepsLeft} steps left. Summarize what you have and deliver your answer NOW via send_report.`;
      } else if (researchSteps >= RESEARCH_HARD_CAP) {
        contMessage += `🛑 RESEARCH COMPLETE: You have made ${researchSteps} research calls — that is MORE than enough data. You MUST now synthesize your findings and call send_report immediately. Do NOT make any more search_web or scrape_page calls.`;
      } else if (researchSteps >= RESEARCH_SOFT_CAP) {
        contMessage += `⚠️ You have made ${researchSteps} research calls. You likely have enough data now. Unless you are missing critical information, you should synthesize your findings and call send_report. Prefer wrapping up over making more searches.`;
      } else {
        contMessage += `Continue your task where you left off. If you have gathered enough research data, synthesize and call send_report. Otherwise, continue researching.`;
      }

      messages.push({
        role: 'system',
        content: contMessage,
      });
    }

    // ── Duplicate tool call tracker ──
    const executedToolCalls = new Set<string>();
    // Seed with existing tool_log entries (from previous invocations)
    for (const entry of toolLog) {
      if (entry.tool && entry.tool !== '__recalled_skills__') {
        executedToolCalls.add(`${entry.tool}:${JSON.stringify(entry.args)}`);
      }
    }

    while (stepsThisInvocation < MAX_STEPS_PER_INVOCATION && stepsUsed < MAX_TOTAL_STEPS) {
      // ── Wall-clock check for LLM call ──
      // Need at least 10s for an LLM call + 3s for saves. If we're past that, break.
      const elapsedBeforeLLM = Date.now() - startTime;
      if (elapsedBeforeLLM > (WALL_CLOCK_LIMIT_MS - 13_000)) {
        console.log(`[agent:${taskId}] Not enough time for next LLM call (${Math.round(elapsedBeforeLLM / 1000)}s elapsed), scheduling continuation`);
        break;
      }

      // ── Mid-task steering: pick up owner corrections appended to the task ──
      if (stepsThisInvocation > 0) {
        try {
          const { data: taskCheck } = await supabase
            .from('agent_tasks')
            .select('status, messages')
            .eq('id', taskId)
            .single();
          if (taskCheck?.status !== 'running') {
            console.log(`[agent:${taskId}] Task no longer running (${taskCheck?.status}), aborting`);
            break;
          }
          const dbMessages = (taskCheck?.messages || []) as AgentMessage[];
          if (dbMessages.length > messages.length) {
            const injected = dbMessages.slice(messages.length);
            const corrections = injected.filter(m => m.role === 'user');
            if (corrections.length > 0) {
              messages.push(...corrections);
              console.log(`[agent:${taskId}] Injected ${corrections.length} mid-task owner correction(s)`);
            }
          }
        } catch { /* non-critical — continue with existing messages */ }
      }

      // ── Context compression — prevent blowing the context window ──
      messages = await compressContextIfNeeded(messages, client, taskId, agentModel, compressThreshold);

      // ── Budget warning + research cap ──
      const stepsRemainingGlobal = MAX_TOTAL_STEPS - stepsUsed;
      const stepsRemainingInvocation = MAX_STEPS_PER_INVOCATION - stepsThisInvocation;
      const currentResearchSteps = toolLog.filter(t => ['search_web', 'scrape_page', 'search_google_maps'].includes(t.tool)).length;
      const shouldWarn = stepsRemainingGlobal <= BUDGET_WARNING_STEPS || stepsRemainingInvocation <= 1;
      const researchExhausted = currentResearchSteps >= RESEARCH_HARD_CAP;

      let warningMessage = '';
      if (shouldWarn) {
        warningMessage = `⚠️ URGENT: You only have ${Math.min(stepsRemainingGlobal, stepsRemainingInvocation)} tool calls left. You MUST call send_report NOW with whatever data you have. Do NOT make more research calls.`;
      } else if (researchExhausted) {
        warningMessage = `🛑 RESEARCH COMPLETE (${currentResearchSteps} research calls made). You have gathered enough data. Call send_report NOW to deliver your findings. Do NOT call search_web or scrape_page again.`;
      } else if (currentResearchSteps >= RESEARCH_SOFT_CAP) {
        warningMessage = `⚠️ You've made ${currentResearchSteps} research calls. Consider wrapping up and calling send_report unless you are missing critical data.`;
      }

      // ── Memory nudge: prompt agent to persist learnings at step 5 boundaries ──
      let memoryNudge = '';
      if (stepsUsed >= 5 && stepsUsed % 5 === 0) {
        memoryNudge = '🧠 MEMORY CHECK: You\'ve completed 5 steps. Pause and reflect — have you discovered any important facts, contacts, prices, patterns, or preferences worth saving? If so, call save_memory now before continuing. This ensures you don\'t lose valuable learnings if the task ends unexpectedly.';
      }

      const systemNudges = [warningMessage, memoryNudge].filter(Boolean);
      const llmMessages = systemNudges.length > 0
        ? [...messages, ...systemNudges.map(n => ({ role: 'system' as const, content: n }))]
        : messages;

      let completion;
      let llmErr: Error | null = null;

      for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
        try {
          // Dynamic LLM timeout: use remaining wall-clock budget (minus buffer for DB saves)
          const elapsedMs = Date.now() - startTime;
          const remainingMs = WALL_CLOCK_LIMIT_MS - elapsedMs - 3000; // 3s buffer for saves
          const llmTimeout = Math.max(remainingMs, 5000); // at least 5s, no upper cap beyond wall clock
          const llmAbort = new AbortController();
          const llmTimer = setTimeout(() => llmAbort.abort(), llmTimeout);
          try {
            completion = await client.chat.completions.create({
              model: agentModel,
              messages: sanitizeMessages(llmMessages) as Parameters<typeof client.chat.completions.create>[0]['messages'],
              tools: agentTools,
              tool_choice: 'auto',
            }, { signal: llmAbort.signal });
          } finally {
            clearTimeout(llmTimer);
          }
          llmErr = null;
          break; // Success
        } catch (err: any) {
          llmErr = err;
          // Abort errors are wall-clock timeouts, don't retry
          if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
            console.warn(`[agent:${taskId}] LLM aborted (wall-clock limit), scheduling continuation`);
            break;
          }
          // Don't retry 400 Bad Request, these are formatting/validation errors
          if (err?.status === 400 || attempt === LLM_MAX_RETRIES) break;
          console.warn(`[agent:${taskId}] LLM transient error, retrying (${attempt + 1}/${LLM_MAX_RETRIES}):`, err.message);
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }

      if (llmErr || !completion) {
        // If aborted due to wall-clock, break to continuation instead of throwing
        if (llmErr?.name === 'AbortError' || llmErr?.message?.includes('abort')) {
          // Safety: if LLM keeps timing out with 0 progress, don't loop forever
          if (stepsThisInvocation === 0) {
            console.warn(`[agent:${taskId}] LLM aborted with 0 steps this invocation — DeepSeek too slow for context size. Failing task.`);
            await supabase.from('agent_tasks').update({
              status: 'failed',
              result: 'LLM call consistently exceeds time limit. Context may be too large. Try a simpler request.',
              messages,
              steps_used: stepsUsed,
              tool_log: toolLog,
              updated_at: new Date().toISOString(),
            }).eq('id', taskId);
            return { status: 'failed' as const, result: 'LLM timeout', taskId, stepsUsed };
          }
          await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
          break;
        }
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
            messages.push({ role: 'tool', tool_call_id: tc.id, content: 'System Execution Time Limit hit. This tool call was safely aborted before completion. The agent is being moved to a continuation round. Please re-evaluate if you still need this tool output and retry it in the next message if necessary.' });
          }
          await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
        }
        break;
      }

      const assistantMessage = completion.choices[0].message;

      // ── Tool calls ──
      // Some models (MiMo, Qwen) emit tool calls as XML text in content instead of structured tool_calls.
      if ((!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) && assistantMessage.content) {
        const xmlToolCalls = parseXmlToolCalls(assistantMessage.content);
        if (xmlToolCalls.length > 0) {
          (assistantMessage as unknown as Record<string, unknown>).tool_calls = xmlToolCalls;
          assistantMessage.content = assistantMessage.content
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
            .trim() || null;
          console.log(`[agent:${taskId}] Parsed ${xmlToolCalls.length} XML tool call(s) from model content`);
        }
      }

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
              query_database: '🗄️',
              call_api: '⚡',
              manage_job: '📋',
              analyze_inventory: '📦',
              request_approval: '👍',
              manage_automation: '🤖',
              update_instructions: '🧠',
              send_email: '📧',
              make_call: '📞'
            };
            const icon = iconMap[tc.function.name] || '⚙️';

            // Build a more descriptive hint from args so the owner understands what's happening
            const a = toolArgs;
            let hint = '';
            switch (tc.function.name) {
              case 'search_web':        hint = `"${(a.query as string || '').substring(0, 80)}"`; break;
              case 'scrape_page':       { const u = (a.url as string || ''); hint = u.replace(/^https?:\/\/(www\.)?/, '').substring(0, 60); if (a.extract) hint += ` → extracting: ${(a.extract as string).substring(0, 40)}`; break; }
              case 'search_google_maps': hint = `"${(a.query as string || '').substring(0, 40)}"${a.location ? ` in ${a.location as string}` : ''}${a.maxResults ? ` (max ${a.maxResults})` : ''}`; break;
              case 'save_leads':        { const action = (a.action as string) || 'save'; const count = (a.leads as unknown[] || a.updates as unknown[] || []).length; hint = action === 'update' ? `updating ${count} lead(s)` : `saving ${count} lead(s)`; break; }
              case 'query_database': {
                const act = (a.action as string) || 'SELECT';
                const tbl = (a.table as string) || '';
                const sel = (a.select as string) || '*';
                const lim = a.limit ? ` limit ${a.limit}` : '';
                let filterDesc = '';
                if (a.filters && typeof a.filters === 'object') {
                  filterDesc = ' where ' + Object.entries(a.filters as Record<string, unknown>).map(([k, v]) => {
                    if (typeof v === 'object' && v !== null) {
                      const ops = Object.entries(v as Record<string, unknown>);
                      return ops.map(([op, val]) => `${k} ${op} "${String(val).substring(0, 20)}"`).join(', ');
                    }
                    return `${k}="${String(v).substring(0, 20)}"`;
                  }).join(', ');
                }
                hint = act === 'select' || act === 'SELECT'
                  ? `SELECT ${sel === '*' ? '*' : sel.substring(0, 30)} FROM ${tbl}${filterDesc}${lim}`
                  : `${act.toUpperCase()} ${tbl}${filterDesc}`;
                break;
              }
              case 'search_memory':     hint = `"${(a.query as string || '').substring(0, 60)}"${a.category ? ` [${a.category}]` : ''}`; break;
              case 'save_memory':       hint = `[${a.category || '?'}] "${(a.content as string || '').substring(0, 50)}"`; break;
              case 'manage_job':        hint = `${a.action || ''}${a.title ? ` "${(a.title as string).substring(0, 40)}"` : ''}${a.status ? ` → ${a.status}` : ''}`; break;
              case 'manage_automation': hint = `${a.action || 'list'}${a.name ? ` "${(a.name as string).substring(0, 40)}"` : ''}${a.trigger ? ` (${a.trigger})` : ''}`; break;
              case 'call_api':          hint = `${(a.method as string || 'GET')} ${a.service_name || ''}${a.path as string || ''}`; break;
              case 'delegate_task':
              case 'browse_web':        hint = (a.task as string || a.url as string || '').substring(0, 60); break;
              case 'request_integration': hint = `requesting "${a.display_name || a.service_name || '?'}" integration`; break;
              case 'analyze_inventory': hint = (a.action as string || ''); break;
              case 'update_instructions': hint = `"${(a.rule as string || '').substring(0, 60)}"`; break;
              case 'send_email':        hint = `→ ${(a.to as string || '').substring(0, 30)}${a.subject ? `: ${(a.subject as string).substring(0, 40)}` : ''}`; break;
              case 'make_call':         hint = `→ ${(a.phone as string || '')}${a.purpose ? ` (${(a.purpose as string).substring(0, 30)})` : ''}`; break;
              case 'request_approval':  hint = `"${(a.question as string || '').substring(0, 60)}"`; break;
              case 'send_whatsapp':     hint = `→ ${(a.phone as string || '').substring(0, 15)}`; break;
              case 'send_voice_note':   hint = `→ ${(a.phone as string || '').substring(0, 15)}`; break;
              case 'post_social':       hint = `${(a.platform as string || 'social')}: ${(a.content as string || '').substring(0, 40)}`; break;
            }
            // Cap hint length for WhatsApp readability
            if (hint.length > 120) hint = hint.substring(0, 117) + '...';
            const statusMsg = hint ? `_${icon} ${tc.function.name}: ${hint}_` : `_${icon} ${tc.function.name}..._`;

            // Fire-and-forget via the Launchfly CEO instance — NOT the business instance.
            // Using the business instance would cause the OTHER WhatsApp instance's webhook
            // to pick up the message as a new inbound, creating an infinite agent loop.
            const creds = getLaunchflyCreds();
            if (creds && !toolCtx.ownerPhone?.startsWith('test-chat')) {
              sendWhatsAppWithCreds(
                toolCtx.ownerPhone,
                statusMsg,
                creds
              ).catch(() => {});
            }
          }

          let toolResult: string;

          // ── Duplicate tool call detection ──
          // Side-effect tools (send_whatsapp, send_report, etc.) are allowed to repeat
          const IDEMPOTENT_TOOLS = new Set([
            'search_web', 'scrape_page', 'search_memory', 'query_database', 'search_google_maps',
            'call_api', ]);
          const callKey = `${tc.function.name}:${JSON.stringify(toolArgs)}`;
          if (IDEMPOTENT_TOOLS.has(tc.function.name) && executedToolCalls.has(callKey)) {
            console.log(`[agent:${taskId}] Blocked duplicate tool call: ${tc.function.name}`);
            toolResult = `Duplicate call blocked — you already called ${tc.function.name} with these exact arguments earlier. Use the previous result from the conversation. Do NOT retry.`;
          } else {
            executedToolCalls.add(callKey);
            try {
              const defaultMaxTimeout = TOOL_TIMEOUT_OVERRIDES[tc.function.name] || TOOL_TIMEOUT_MS;
              // Compute exact time remaining for Vercel wall-clock limit, minus small buffer
              const remainingTimeMs = Math.max(1000, WALL_CLOCK_LIMIT_MS - (Date.now() - startTime) - 1000);
              const toolTimeout = Math.min(defaultMaxTimeout, remainingTimeMs);
              
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), toolTimeout);
              try {
                const toolPromise = isMcpTool(tc.function.name)
                  ? executeMcpTool(tc.function.name, toolArgs, mcpServerMap)
                  : executeTool(tc.function.name, toolArgs, toolCtx, toolTimeout);
                toolPromise.catch(() => {});
                toolResult = await Promise.race([
                  toolPromise,
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
            }
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

          // Save immediately after parallel batch — prevents losing all progress on crash
          try {
            await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
          } catch (saveErr) {
            console.error(`[agent:${taskId}] Failed to save progress after parallel batch:`, saveErr);
          }

          // Wall-clock check after parallel batch
          if (Date.now() - startTime > (WALL_CLOCK_LIMIT_MS - 3000)) {
            // Defer any remaining sequential calls
            for (const tc of sequentialCalls) {
              messages.push({ role: 'tool', tool_call_id: tc.id, content: 'System Execution Time Limit hit. This tool call was safely aborted before completion. The agent is being moved to a continuation round. Please re-evaluate if you still need this tool output and retry it in the next message if necessary.' });
            }
            await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
            shouldBreak = true;
          }
        }

        // ── Execute sequential tools one by one ──
        if (!shouldBreak) {
          let seqSinceLastSave = 0;
          for (const tc of sequentialCalls) {
            const r = await runTool(tc);

            messages.push({ role: 'tool', tool_call_id: r.id, content: safeSlice(r.result, TOOL_RESULT_MAX) });
            toolLog.push({ tool: r.name, args: r.args, result: safeSlice(r.result, 500), timestamp: new Date().toISOString() });
            stepsUsed++;
            stepsThisInvocation++;
            seqSinceLastSave++;

            // Save after every tool — prevents losing progress on crash
            try {
              await saveProgress(supabase, taskId, messages, stepsUsed, toolLog);
            } catch (saveErr) {
              console.error(`[agent:${taskId}] Failed to save progress:`, saveErr);
            }
            seqSinceLastSave = 0;

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

            // Wall-clock check after each sequential tool (leave 3s buffer to safely save and schedule)
            if (Date.now() - startTime > (WALL_CLOCK_LIMIT_MS - 3000)) {
              const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
              for (const unexecuted of fnCalls) {
                if (!executedIds.has(unexecuted.id)) {
                  messages.push({ role: 'tool', tool_call_id: unexecuted.id, content: 'System Execution Time Limit hit. This tool call was safely aborted before completion. The agent is being moved to a continuation round. Please re-evaluate if you still need this tool output and retry it in the next message if necessary.' });
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
        await autoCreateSkill(supabase, client, taskId, row.goal, row.business_id, toolLog, agentModel, recalledSkillIds);

        // ── Memory reflection at task completion ──
        if (toolLog.length >= 3 && !row.goal.startsWith('[DELEGATED TASK]')) {
          try {
            const toolSummary = toolLog.slice(-10).map(t =>
              `${t.tool}(${JSON.stringify(t.args).substring(0, 80)}) → ${safeSlice(t.result, 100)}`
            ).join('\n');
            const reflection = await client.chat.completions.create({
              model: agentModel,
              messages: [
                { role: 'system', content: 'You are reviewing a completed agent task. Extract 1-3 key learnings worth remembering for future tasks. Focus on: new contacts/prices discovered, what worked vs failed, owner preferences revealed, patterns spotted. Return JSON array: [{"content":"...","category":"supplier|decision|pattern|preference|market_insight|tool_recipe|general","importance":0.5}]. Return [] if nothing worth saving.' },
                { role: 'user', content: `Goal: ${row.goal}\n\nTool log:\n${toolSummary}\n\nFinal result: ${safeSlice(finalResult, 500)}` },
              ],
              max_tokens: 500,
            });
            const reflectionText = reflection.choices[0]?.message?.content?.trim() || '[]';
            let memories: Array<{ content?: string; category?: string; importance?: number }> = [];
            try {
              memories = JSON.parse(reflectionText.replace(/^```json?\n?|\n?```$/g, ''));
            } catch { /* LLM returned non-JSON — skip reflection */ }
            if (Array.isArray(memories) && memories.length > 0) {
              for (const mem of memories.slice(0, 3)) {
                if (mem.content && mem.content.length > 10) {
                  await executeTool('save_memory', {
                    content: mem.content,
                    category: mem.category || 'general',
                    importance: mem.importance || 0.5,
                  }, toolCtx);
                }
              }
              console.log(`[agent:${taskId}] Memory reflection saved ${memories.length} learnings`);
            }
          } catch (reflErr) {
            console.warn(`[agent:${taskId}] Memory reflection failed (non-fatal):`, reflErr);
          }
        }

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

    // On timeout, always try to continue via QStash instead of failing
    const isTimeout = errMsg.includes('timed out') || errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')
      || errMsg.includes('ECONNRESET') || errMsg.includes('network') || errMsg.includes('502')
      || errMsg.includes('503') || errMsg.includes('504') || errMsg.includes('rate limit');
    if (isTimeout) {
      console.log(`[agent:${taskId}] Transient error — saving progress and scheduling continuation`);
      await supabase.from('agent_tasks').update({
        messages, steps_used: stepsUsed, tool_log: toolLog,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', taskId);
      const retried = await scheduleContinuation(taskId, 3);
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
      const forceProvider = await getAgentProvider(null, LLM_TIMEOUT_MS);
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

  // Save progress and reset status to 'pending' so the QStash continuation picks it up
  // CRITICAL: must set status='pending' BEFORE scheduling, otherwise the continuation
  // may see status='running' and create a race condition, or the stale-task cleaner
  // may nuke it between invocations.
  await supabase.from('agent_tasks').update({
    messages,
    steps_used: stepsUsed,
    tool_log: toolLog,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  const continued = await scheduleContinuation(taskId);

  if (!continued) {
    // QStash failed — try once more with a small delay
    console.warn(`[agent:${taskId}] First continuation attempt failed, retrying in 2s...`);
    const retried = await scheduleContinuation(taskId, 2);
    if (!retried) {
      const partial = `Agent paused after ${stepsUsed} steps (continuation failed).`;
      await supabase.from('agent_tasks').update({
        status: 'failed', result: partial, updated_at: new Date().toISOString(),
      }).eq('id', taskId);
      return { status: 'failed', result: partial, taskId, stepsUsed };
    }
  }

  return { status: 'continued', taskId, stepsUsed };
}

// ─── Cancel all running/pending tasks for a business ─────────────────────

export async function cancelRunningTasks(
  businessId: string,
  reason: string = 'Cancelled by owner',
): Promise<number> {
  const supabase = getSupabase();

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, status')
    .eq('business_id', businessId)
    .in('status', ['pending', 'running'])
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!tasks?.length) return 0;

  const ids = tasks.map(t => t.id);
  await supabase.from('agent_tasks').update({
    status: 'failed',
    result: reason,
    updated_at: new Date().toISOString(),
  }).in('id', ids);

  console.log(`[agent:cancel] Cancelled ${ids.length} tasks for business ${businessId}: ${ids.join(', ')}`);
  return ids.length;
}

// ─── EMERGENCY KILL SWITCH: Stop everything globally ─────────────────────

export async function emergencyStopAllTasks(): Promise<number> {
  const supabase = getSupabase();

  // Wipe the queue by marking every single active task as failed
  const { data: tasks, error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'failed',
      result: 'EMERGENCY STOP - Global kill switch activated',
      updated_at: new Date().toISOString(),
    })
    .in('status', ['pending', 'running'])
    .select('id');

  if (error) {
    console.error('[agent:emergency-stop] Failed to stop tasks:', error);
    return 0;
  }

  const count = tasks?.length || 0;
  console.log(`[agent:emergency-stop] 🛑 SYSTEM PURGE: Killed ${count} running/pending tasks globally.`);

  // Cancel all Upstash workflow runs so they stop replaying
  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    if (qstashToken) {
      const { Client } = await import('@upstash/workflow');
      const client = new Client({ token: qstashToken });
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai').replace(/\/$/, '');
      const { cancelled } = await client.cancel({
        urlStartingWith: `${appUrl}/api/agent/workflow-run`,
      });
      console.log(`[agent:emergency-stop] 🛑 Cancelled ${cancelled} Upstash workflow runs.`);
    }
  } catch (wfErr) {
    console.error('[agent:emergency-stop] Failed to cancel Upstash workflows:', wfErr);
  }

  return count;
}

// ─── Resume a completed task (user said "Continue") ──────────────────────

export async function resumeCompletedTask(
  taskId: string,
  userMessage: string,
): Promise<boolean> {
  const supabase = getSupabase();

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('status, messages, steps_used')
    .eq('id', taskId)
    .maybeSingle();

  if (!task) {
    console.warn(`[agent:resume-completed] Task ${taskId} not found`);
    return false;
  }

  // Only resume tasks that are completed (not failed — those may have bad state)
  if (task.status !== 'completed') {
    console.warn(`[agent:resume-completed] Task ${taskId} is ${task.status}, not 'completed'`);
    return false;
  }

  // Check step budget — if already at max, can't continue
  if ((task.steps_used || 0) >= MAX_TOTAL_STEPS) {
    console.warn(`[agent:resume-completed] Task ${taskId} already exhausted step budget (${task.steps_used}/${MAX_TOTAL_STEPS})`);
    return false;
  }

  // Inject the user's message and reset status to pending
  const messages: AgentMessage[] = Array.isArray(task.messages) ? task.messages : [];
  messages.push({
    role: 'user',
    content: `The owner says: "${userMessage}"\n\nPlease continue where you left off. Review the conversation above, check what work is still incomplete, and keep going until the original goal is fully achieved. Then deliver a final report via send_report.`,
  });

  await supabase.from('agent_tasks').update({
    status: 'pending',
    result: null,
    messages,
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  // Wake up via QStash
  const dispatched = await scheduleContinuation(taskId);
  if (dispatched) {
    console.log(`[agent:resume-completed] Task ${taskId} resumed (${task.steps_used} steps used so far)`);
  }
  return dispatched;
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

  // Try Upstash Workflow notify (the workflow is waiting on waitForEvent)
  const qstashToken = process.env.QSTASH_TOKEN;
  if (qstashToken) {
    try {
      const { Client } = await import('@upstash/workflow');
      const client = new Client({ token: qstashToken });
      await client.notify({
        eventId: `approval-${taskId}`,
        eventData: { response: approvalResponse },
      });
      console.log(`[agent:resume] Task ${taskId} notified via workflow: "${approvalResponse.substring(0, 50)}"`);
      return true;
    } catch (err) {
      console.warn(`[agent:resume] Workflow notify failed, falling back to legacy:`, err);
    }
  }

  // Fallback: legacy QStash continuation (for tasks started before migration)
  const messages: AgentMessage[] = Array.isArray(task.messages) ? task.messages : [];
  messages.push({
    role: 'user',
    content: `Owner's response to your approval request: "${approvalResponse}"`,
  });

  await supabase.from('agent_tasks').update({
    status: 'pending',
    messages,
    updated_at: new Date().toISOString(),
  }).eq('id', taskId);

  const dispatched = await scheduleContinuation(taskId);
  if (dispatched) {
    console.log(`[agent:resume] Task ${taskId} resumed via legacy QStash: "${approvalResponse.substring(0, 50)}"`);
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

/** Trigger agent workflow via Upstash Workflow client.trigger(). */
async function triggerAgentWorkflow(taskId: string): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai').replace(/\/$/, '');

  if (!qstashToken) {
    console.warn('[agent] No QSTASH_TOKEN — cannot trigger workflow');
    return false;
  }

  try {
    const { Client } = await import('@upstash/workflow');
    const client = new Client({ token: qstashToken });
    await client.trigger({
      url: `${appUrl}/api/agent/workflow-run`,
      body: { taskId },
      retries: 3,
    });
    console.log(`[agent:${taskId}] Workflow triggered`);
    return true;
  } catch (err) {
    console.error('[agent] Workflow trigger failed:', err);
    // Fallback to legacy QStash
    console.warn(`[agent:${taskId}] Falling back to legacy QStash continuation`);
    return scheduleContinuation(taskId);
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

    // Trigger workflow for parent (with legacy fallback)
    await triggerAgentWorkflow(parentId);
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
  recalledSkillIds: string[] = [],
): Promise<void> {
  try {
    // Skip delegated tasks and tasks with few tool calls
    if (goal.startsWith('[DELEGATED TASK]')) return;
    const uniqueTools = new Set(toolLog.map(t => t.tool));
    if (toolLog.length < SKILL_AUTO_CREATE_MIN_TOOLS) return;
    // Skip if the agent already saved a skill during this task
    if (toolLog.some(t => t.tool === 'save_memory' && String(t.args?.category) === 'skill')) return;

    // Check if a similar skill already exists (avoid duplicates) — semantic search
    const goalTrimmed = goal.trim();
    if (goalTrimmed.length < 3) return;

    const OpenAIEmbed = (await import('openai')).default;
    const embedClient = new OpenAIEmbed({ apiKey: process.env.OPENAI_API_KEY! });
    const embRes = await embedClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: goalTrimmed.substring(0, 8000),
    });
    const goalEmbedding = embRes.data[0]?.embedding;
    if (!goalEmbedding) return;

    const { data: existing } = await supabase.rpc('search_skills', {
      query_embedding: goalEmbedding,
      match_business_id: businessId,
      match_count: 1,
      min_similarity: 0.40,
    });

    // Generate tool sequence summary for LLM
    const toolSequence = toolLog.map((t, i) =>
      `${i + 1}. ${t.tool}(${JSON.stringify(t.args).substring(0, 120)}) → ${safeSlice(t.result, 100)}`
    ).join('\n');

    // ── Skill rewrite: if a recalled skill exists, evolve it instead of creating new ──
    if (existing?.length) {
      const existingSkill = existing[0] as { id: string; content: string; similarity: number };
      const isRecalled = recalledSkillIds.includes(existingSkill.id);

      if (existingSkill.content) {
        const rewriteCompletion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are improving an existing SKILL document based on a new execution. Compare the original skill with what actually happened. Update the STEPS, TIPS, and TRIGGER if the new execution reveals better approaches, new pitfalls, or refined parameters. Keep the same format:\n\nSKILL: [name]\nTRIGGER: [when to use]\nSTEPS:\n1. [tool] — [what and why]\nTIPS: [improved tips]\n\nPreserve wisdom from the original. Add new learnings. Output ONLY the updated skill.' },
            { role: 'user', content: `ORIGINAL SKILL:\n${existingSkill.content}\n\nNEW EXECUTION:\nGoal: ${goal}\nTool sequence:\n${toolSequence}` },
          ],
          max_tokens: 600,
        });

        const rewrittenContent = rewriteCompletion.choices[0]?.message?.content?.trim();
        if (rewrittenContent && rewrittenContent.length > 30) {
          const newEmbedding = await embedClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: rewrittenContent.substring(0, 8000),
          });

          await supabase.from('ai_memories').update({
            content: rewrittenContent,
            embedding: newEmbedding.data[0]?.embedding || null,
            updated_at: new Date().toISOString(),
            metadata: { source: 'auto_skill_rewrite', task_id: taskId, tools_used: Array.from(uniqueTools), rewrite_count: ((existingSkill as any).metadata?.rewrite_count || 0) + 1 },
          }).eq('id', existingSkill.id);

          console.log(`[agent:${taskId}] Rewrote existing skill ${existingSkill.id} with improved steps`);
        }
      }
      return;
    }

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

    // Generate embedding and save (reuse the embed client from dedup check)
    const embeddingRes = await embedClient.embeddings.create({
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
  customRules?: string[],
): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const identity = role
    ? role
    : `You are an autonomous AI agent working for ${toolCtx.businessName || 'a business'}.`;

  const customRulesBlock = customRules?.length
    ? `\n\n## LEARNED RULES (self-updated — these override general rules when relevant)\n${customRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  return `${identity}

TODAY'S DATE: ${todayStr}
BUSINESS: ${toolCtx.businessName || 'Unknown'}
${industry ? `INDUSTRY: ${industry}` : ''}
${location ? `LOCATION: ${location}` : ''}
${customRulesBlock}

## CORE RULES
1. Think step-by-step. Plan before acting.
2. Use search_memory FIRST — you may already know the answer.
3. NEVER invent or hallucinate facts. Only report what tools actually returned.
4. BE EFFICIENT — minimize tool calls. Prefer bulk tools (search_google_maps returns up to 50 leads in ONE call) over manual scraping loops.
5. If a tool fails, try an alternative approach instead of repeating.
6. Save valuable leads with save_leads — don't just list them in text.
7. Use request_approval BEFORE costly or irreversible actions (orders, campaigns, outreach to new contacts).
8. Deliver final results via send_report, or write the full report in your last message.

## STRUCTURED REASONING
Before complex multi-tool sequences (3+ tools), mentally plan your approach:
- What is the exact goal of this step?
- Which tools will get me there most efficiently?
- After each tool result, reflect: did it succeed? Do I have enough data to proceed, or should I pivot?

Do NOT output your plan as text — execute it directly with tool calls.

## PROPORTIONALITY
- Match your response to the request. Simple greetings ("Hello", "Hi") get a brief friendly reply — do NOT launch campaigns, create automations, or do deep analysis unless asked.
- For vague messages, respond conversationally and ask what they need help with — max 1-2 tool calls.
- Only go deep (5+ tools) when the goal explicitly requires research, outreach, analysis, or multi-step work.

## FAILURE RECOVERY
- If scrape_page fails 2 times in a row, STOP scraping. The sites are likely down or blocking. Use search_web instead, or report what you have.
- If query_database returns a column error, do NOT guess again. Instead query with select "*" and limit 1 to discover the real columns, then retry.
- If call_api returns 404, the path is likely wrong. Check search_memory for "tool_recipe" with the service name before trying more paths.
- NEVER call the same tool with the same arguments twice. If it failed once it will fail again.

## MEMORY
- Relevant memories are AUTO-INJECTED into your context above — check them before calling search_memory.
- Only call search_memory if you need memories on a DIFFERENT topic than your current goal.
- save_memory after discovering important facts (contacts, prices, preferences, patterns).
- validate_memory when you confirm or disprove a past memory (boosts validated ones, archives wrong ones).
- After multi-step workflows (3+ tools), save the workflow as a skill: SKILL name, TRIGGER, STEPS, TIPS.
- If the owner corrects you → save_memory (preference) AND update_instructions to permanently learn the rule.

## DELEGATION
- To see what specialized agents exist, query the \`assistants\` table.
- If the owner asks you to use a specific agent, or the task clearly matches one, delegate to it.
- delegate_task = delegate to another agent. Use wait_for_completion=true if you need the result to continue.

## KEY TOOL TIPS
- **manage_automation**: Default to \`agent_task\` action type (spawns full agent with all tools). Only use \`notify_owner\` for static hardcoded text with no AI logic.
  Config by type: agent_task={agentGoal, agentRole?} | notify_owner={message} | send_whatsapp={message} | delay={hours} | ai_response=(no config) | search_leads={searchQuery, searchLocation, maxResults, dailyCap}
- **execute_python**: Full cloud Python sandbox (E2B) — has network, pip, filesystem. Use for data analysis, chart generation, web scraping, file processing, complex calculations. Install any package with packages param. Use print() for output. Charts auto-upload.
- **process_document**: Extracts text/tables from PDF, Excel, CSV, Word, PPTX files. Give it a URL. Use extract param to filter for specific info. ALWAYS try this when a supplier sends a document — you CAN read PDFs.
- **knowledge_base**: Persistent searchable document library. Add SOPs, manuals, price lists. Search with natural language.
- **browse_web**: Real cloud browser for clicking, typing, forms. Use search_web/scrape_page for simple reads (cheaper).
- **manage_calendar**: Google Calendar integration — list events, check availability, create/update/delete events. Requires google_calendar integration.
- **process_payment**: Stripe integration — create payment links, send invoices, check balance. Requires stripe integration. Use request_approval before sending invoices.
- **generate_document**: Create PDFs (reports, invoices, proposals), Excel spreadsheets, PowerPoint presentations. Use # headings, - bullets, --- slide breaks.
- **analyze_image**: GPT-4o vision — read text from photos, analyze receipts, screenshots, charts, product photos, handwriting. Use extract_schema for structured extraction. This is the DEFAULT for any attached image. Only use analyze_inventory if the owner explicitly mentions inventory/stock/shelf.
- **deep_research**: Multi-source research engine. Decomposes questions, runs parallel searches, synthesizes report with citations. Use for market analysis, competitor research.
- **translate**: Translate text between any languages. Uses DeepL (high quality) or AI fallback. Good for multilingual customer support.
- **manage_project**: Lightweight project tracking with subtasks, priorities, assignees, deadlines. Projects group related tasks.
- **query_database**: Supports SUM/AVG/MIN/MAX aggregations. Use select: "status, COUNT(*) as count" for grouping, or "SUM(amount) as total" for totals.
- **call_api / request_integration**: Check search_memory for "tool_recipe" first. Save recipes after success. Request ONE integration at a time. NEVER request integrations on your own initiative — only when the owner asks.
- **request_integration (webhook mode)**: When the owner says "set up a webhook for X" or "I connected X, wake up when it fires", use request_integration with webhook=true and webhook_instructions describing what to do when events arrive. This generates a URL the owner pastes into the external service settings.
- **send_email / make_call**: For cold outreach, use request_approval first.
- **update_instructions**: Save permanent behavioral rules, not one-time facts (use save_memory for those).
- **save_memory**: Auto-detects contradictions — if a new memory contradicts an existing one, the old one is auto-superseded.

## CRITICAL THINKING & STRATEGY
- Act as a proactive, high-leverage business partner. Don't just execute blindly—suggest optimizations, identify bottlenecks, and flag risks.
- If a task is vague, ask clarifying questions before guessing.
- Verify your findings before reporting. Did you actually solve the core problem?

## BUSINESS EVOLUTION (compounding intelligence)
You get smarter with every conversation. Follow this loop:

1. **OBSERVE**: During each interaction, notice recurring pain points, objections, wishes, or praise from customers. What do they keep asking for? What frustrates them? What delights them?
2. **TAG**: When you spot something significant, save it with save_memory using category "strategic_insight" and importance 0.8–1.0. Be specific: "3 out of 5 salon owners this week asked about online booking — high unmet demand" not "customers want features."
3. **VALIDATE**: Before elevating an insight, use search_web or search_memory to check if it's a real trend or an outlier. Cross-reference with industry best practices.
4. **COMPOUND**: Each new conversation, search your memories FIRST. Build on previous insights, don't rediscover the same thing. If an old pattern keeps recurring, raise its importance.
5. **ALERT**: When an insight crosses the breakthrough threshold (importance >= 0.8, validated, actionable), message the owner directly: "Hi ${toolCtx.businessName ? 'boss' : 'Alex'}, I noticed something that could elevate the business..." — be specific, cite the evidence, and propose the next action.

This creates a compounding business identity — you don't just answer questions, you form a perspective on what works for THIS business and THIS market, getting sharper every single day.
${memoryContext || '\n(No prior conversation history available.)'}`;
}
