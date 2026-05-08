// src/lib/agent/workflow-runner.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Workflow Runner — Upstash Workflow-based Durable Execution (v3)
// ═══════════════════════════════════════════════════════════════════════════
//
// Architecture:
//   - Each step (LLM call, tool execution, DB save) is a separate `context.run()`
//     or `context.call()` — no wall-clock juggling, no manual QStash continuations
//   - LLM calls use `context.call()` → HTTP request executed by Upstash infrastructure,
//     can wait up to 12 hours (no Vercel 60s limit)
//   - Tool calls use `context.run()` → each gets its own invocation budget
//   - Approval pauses use `context.waitForEvent()` → native durable pause/resume
//   - State persisted to Supabase `agent_tasks` table for UI/dashboard visibility
//
// Flow:
//   createAgentTask() → client.trigger({ url: /api/agent/workflow-run, body: { taskId } })
//   ↓
//   serve() → init step → [LLM → tools → save] loop → complete step

import { createClient } from '@supabase/supabase-js';
import { type WorkflowContext } from '@upstash/workflow';

import { getToolsForAgent, executeTool, type ToolContext } from './tools';
import { getConversationHistory, saveMessage } from '@/lib/ai-receptionist/history';
import { getAgentProvider } from './provider';
import { sendWhatsAppWithCreds, type EvolutionCredentials } from '@/lib/evolution';
import { discoverMcpTools, executeMcpTool, isMcpTool, type McpToolSchema } from './mcp';
import { consolidateMemoryGraph } from './memory-consolidator';

// ─── Launchfly CEO instance credentials (for tool updates & reports) ─────
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

const MAX_TOTAL_STEPS = 10_000;       // Effectively unlimited — agents run until done
const BUDGET_WARNING_STEPS = 50;
const RESEARCH_SOFT_CAP = 50;
const RESEARCH_HARD_CAP = 100;
const TOOL_RESULT_MAX = 6000;
const TOOL_TIMEOUT_MS = 25_000; // More generous — no wall-clock pressure
const TOOL_TIMEOUT_OVERRIDES: Record<string, number> = {
  search_google_maps: 120_000,
  browse_web: 180_000,
  make_call: 60_000,
  send_voice_note: 60_000,
  // Video tools are offloaded via context.call() to /api/agent/video-generate,
  // so these timeouts only apply if somehow run via context.run() fallback
  generate_media: 55_000,
  execute_python: 330_000,     // E2B sandbox up to 5min
  process_document: 150_000,   // Document download + parse
  generate_document: 120_000,  // Sandbox-based doc generation
  manage_calendar: 15_000,     // Google Calendar API
  process_payment: 15_000,     // Stripe API
};

const CONTEXT_COMPRESS_DEFAULT = 20_000;
const CONTEXT_COMPRESS_MAX = 100_000;
const CONTEXT_COMPRESS_KEEP_TAIL = 4;
const CHARS_PER_TOKEN = 3.5;

/** Read provider API key from env. Accepts optional resolved provider name (from DB) to override env var. */
function getProviderApiKey(resolvedProvider?: string): string {
  const p = resolvedProvider || process.env.AGENT_PROVIDER || 'deepseek';
  switch (p) {
    case 'openai': return process.env.OPENAI_API_KEY!;
    case 'openrouter': return process.env.OPENROUTER_API_KEY!;
    default: return process.env.DEEPSEEK_API_KEY!;
  }
}

const PARALLEL_SAFE_TOOLS = new Set([
  'search_web', 'scrape_page', 'search_memory',
  'query_database', 'search_google_maps',
  'save_memory', 'save_leads', 'validate_memory',
  'translate', 'knowledge_base', 'analyze_image',
  'process_document'
]);

const SKILL_AUTO_CREATE_MIN_TOOLS = 3;

// ─── Types ───────────────────────────────────────────────────────────────

export interface AgentMessage {
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

export interface ToolLogEntry {
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
  plan_dag: Record<string, unknown> | null;
  updated_at?: string | null;
}

// ─── Payload for workflow trigger ────────────────────────────────────────

export interface WorkflowPayload {
  taskId: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────

function safeSlice(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  const codePoints = Array.from(str);
  if (codePoints.length <= maxLen) return str;
  return codePoints.slice(0, maxLen).join('');
}

function sanitizeString(str: string | null | undefined): string {
  if (!str) return str ?? '';
  // Remove unpaired surrogates using regex instead of manual loops
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|([^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
}

function sanitizeMessages(msgs: AgentMessage[]): AgentMessage[] {
  return msgs.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? sanitizeString(m.content) : m.content,
  }));
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
    // Extract function name: <function=NAME> or <function=NAME>
    const fnMatch = block.match(/<function=([^>]+)>/);
    if (!fnMatch) continue;
    const fnName = fnMatch[1].trim();

    // Extract parameters: <parameter=KEY>VALUE</parameter>
    const params: Record<string, unknown> = {};
    const paramRegex = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRegex.exec(block)) !== null) {
      const key = paramMatch[1].trim();
      let value: unknown = paramMatch[2];
      // Try to parse as JSON (numbers, booleans, arrays, objects)
      try {
        value = JSON.parse(value as string);
      } catch {
        // Keep as string
      }
      params[key] = value;
    }

    toolCalls.push({
      id: `xmltc_${Date.now()}_${toolCalls.length}`,
      type: 'function',
      function: {
        name: fnName,
        arguments: JSON.stringify(params),
      },
    });
  }

  return toolCalls;
}

import { getEncoding } from 'js-tiktoken';

function estimateTokens(msgs: AgentMessage[]): number {
  let text = '';
  for (const m of msgs) {
    if (m.content) text += m.content;
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        text += tc.function.name + tc.function.arguments;
      }
    }
  }
  
  try {
    const enc = getEncoding('cl100k_base');
    return enc.encode(text).length;
  } catch (err) {
    console.warn('Token estimation failed with js-tiktoken, falling back to heuristic', err);
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
}

// ─── Context Compression ─────────────────────────────────────────────────

interface CompressContextParams {
  messages: AgentMessage[];
  apiKey: string;
  baseURL: string;
  model: string;
  taskId: string;
  threshold?: number;
}

/**
 * Compress context via a separate LLM call. Returns the raw HTTP request
 * params so the caller can use context.call() or direct fetch.
 */
export async function compressContext(params: CompressContextParams): Promise<AgentMessage[]> {
  const { messages, apiKey, baseURL, model, taskId, threshold = CONTEXT_COMPRESS_DEFAULT } = params;
  const tokenEstimate = estimateTokens(messages);
  if (tokenEstimate < threshold || messages.length <= CONTEXT_COMPRESS_KEEP_TAIL + 2) {
    return messages;
  }

  console.log(`[agent:${taskId}] Context compression triggered: ~${tokenEstimate} tokens, ${messages.length} messages`);

  const systemMsg = messages[0];
  let splitIdx = messages.length - CONTEXT_COMPRESS_KEEP_TAIL;
  while (splitIdx > 2 && messages[splitIdx]?.role === 'tool') {
    splitIdx--;
  }
  const tail = messages.slice(splitIdx);
  const middle = messages.slice(1, splitIdx);
  if (middle.length < 3) return messages;

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
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, baseURL });
    const summaryCompletion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Summarize this agent conversation history into key facts, decisions made, tool results obtained, and pending actions. Be concise but preserve ALL important data points (numbers, names, prices, URLs). Output only the summary, no preamble.' },
        { role: 'user', content: middleSummaryInput },
      ],
      max_tokens: 1500,
    });
    const summary = summaryCompletion.choices[0]?.message?.content || '';
    if (!summary) return messages;

    const compressedMessages: AgentMessage[] = [
      systemMsg,
      { role: 'system', content: `[CONTEXT SUMMARY — compressed from ${middle.length} earlier messages]\n${summary}` },
      ...tail,
    ];
    const newTokens = estimateTokens(compressedMessages);
    console.log(`[agent:${taskId}] Compressed: ${tokenEstimate} → ~${newTokens} tokens (${messages.length} → ${compressedMessages.length} messages)`);
    return compressedMessages;
  } catch (err) {
    console.warn(`[agent:${taskId}] Context compression failed (non-fatal):`, err);
    return messages;
  }
}

// ─── Build Initial Messages ──────────────────────────────────────────────

export async function buildInitialMessages(
  row: TaskRow,
  toolCtx: ToolContext,
  toolLog: ToolLogEntry[],
): Promise<{ messages: AgentMessage[]; recalledSkillIds: string[] }> {
  const supabase = getSupabase();

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

  const bd = biz?.business_data as Record<string, unknown> | null;
  const industry = (bd?.industry || bd?.category || '') as string;
  const location = (bd?.city || bd?.location || '') as string;

  const ownerPhoneNorm = (toolCtx.ownerPhone || '').replace(/^\+/, '');
  const goalLower = (row.goal || '').toLowerCase();
  const needsFullContext = goalLower.length > 200
    || /report|insight|analyz|review|follow.?up|prospect|lead|campaign|schedule|plan|strateg|morning|daily|inventory|job|supplier|purchase/i.test(goalLower);

  // ALWAYS fetch conversation history and recent tasks so the agent doesn't get amnesia
  const contextPromises = [
    ownerPhoneNorm
      ? getConversationHistory(ownerPhoneNorm, row.business_id)
      : Promise.resolve([]),
    supabase
      .from('agent_tasks')
      .select('goal, result, updated_at')
      .eq('business_id', row.business_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(10)
      .then(r => r.data || []),
    needsFullContext
      ? supabase
          .from('jobs')
          .select('id, title, status, description, materials_needed, blockers, updated_at')
          .eq('business_id', row.business_id)
          .in('status', ['draft', 'quoting', 'ready', 'blocked'])
          .order('updated_at', { ascending: false })
          .limit(10)
          .then(r => r.data || [])
      : Promise.resolve([]),
    (async () => {
      const goalText = (row.goal || '').trim();
      if (goalText.length <= 2) return { skills: null, autoMemories: null };
      try {
        const OpenAIEmbed = (await import('openai')).default;
        const embedClient = new OpenAIEmbed({ apiKey: process.env.OPENAI_API_KEY! });
        const embRes = await embedClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: goalText.substring(0, 8000),
        });
        const goalEmbedding = embRes.data[0]?.embedding;
        if (!goalEmbedding) return { skills: null, autoMemories: null };
        
        const [skillsRes, memRes, graphNodesRes] = await Promise.all([
          supabase.rpc('search_skills', {
            query_embedding: goalEmbedding, match_business_id: row.business_id, match_count: 2, min_similarity: 0.3,
          }),
          supabase.rpc('search_memories', {
            query_embedding: goalEmbedding, match_business_id: row.business_id, match_category: null, match_count: 5,
          }),
          supabase.rpc('search_graph_nodes', {
            query_embedding: goalEmbedding, match_business_id: row.business_id, match_count: 5, min_similarity: 0.3,
          })
        ]);

        let graphEdges = null;
        if (!graphNodesRes.error && graphNodesRes.data && graphNodesRes.data.length > 0) {
           const nodeIds = graphNodesRes.data.map((n: any) => n.id);
           const edgesRes = await supabase.rpc('get_subgraph', { node_ids: nodeIds, match_business_id: row.business_id });
           if (!edgesRes.error) graphEdges = edgesRes.data;
        }
        
        return { 
          skills: !skillsRes.error ? skillsRes.data : null, 
          autoMemories: !memRes.error ? memRes.data : null,
          graphNodes: !graphNodesRes.error ? graphNodesRes.data : null,
          graphEdges: graphEdges
        };
      } catch (e) {
        console.warn(`[agent:${row.id}] Embedding auto-recall failed (non-fatal):`, e);
        return { skills: null, autoMemories: null };
      }
    })()
  ] as const;

  const [conversationHistory, recentTasks, activeJobs, vectorData] = await Promise.all(contextPromises);

  let memoryContext = '';
  let recalledSkillIds: string[] = [];

  if (conversationHistory.length > 0) {
    memoryContext += '\n\n## RECENT CONVERSATION HISTORY (owner ↔ you)\n';
    for (const msg of conversationHistory.slice(-20)) {
      memoryContext += `${msg.role === 'user' ? 'OWNER' : 'YOU'}: ${safeSlice(msg.content, 800)}\n`;
    }
  }

  if (recentTasks.length > 0) {
    memoryContext += '\n\n## RECENT COMPLETED TASKS\n';
    for (const t of recentTasks) {
      const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3600000);
      const goalStr = (t.goal as string) || '';
      const prefix = goalStr.startsWith('[DELEGATED TASK]') ? '🤖 ' : '';
      memoryContext += `- ${prefix}[${ago}h ago] ${safeSlice(goalStr, 200)} → ${safeSlice((t.result as string) || '', 600)}\n`;
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

  // ── Skills & Memories auto-recall ──
  const { skills, autoMemories, graphNodes, graphEdges } = vectorData || {};
  
  if (skills && skills.length > 0) {
    recalledSkillIds = skills.map((s: any) => s.id);
    toolLog.push({ tool: '__recalled_skills__', args: { ids: recalledSkillIds } as Record<string, unknown>, result: 'ok', timestamp: new Date().toISOString() });
    memoryContext += '\n\n## YOUR PROVEN PLAYBOOK (follow these steps — they worked before)\n';
    for (const s of skills) {
      memoryContext += `${((s as any).content || '').substring(0, 600)}\n---\n`;
    }
  }

  if (autoMemories && autoMemories.length > 0) {
    const relevant = autoMemories.filter((m: any) => (m.similarity || 0) > 0.25);
    if (relevant.length > 0) {
      memoryContext += '\n\n## IMPORTANT CONTEXT FROM PAST EXPERIENCE (use this — don\'t start from scratch)\n';
      for (const m of relevant) {
        const cat = (m as any).category || 'general';
        const imp = (m as any).importance_score || 0.5;
        const sim = ((m as any).similarity || 0).toFixed(2);
        memoryContext += `- [${cat}] (importance: ${imp}, relevance: ${sim}) ${((m as any).content || '').substring(0, 400)}\n`;
      }
      const recalledIds = relevant.map((m: any) => m.id).filter(Boolean);
      if (recalledIds.length > 0) {
        try { await supabase.rpc('touch_recalled_memories', { memory_ids: recalledIds }); } catch { /* non-fatal */ }
      }
    }
  }

  if (graphNodes && graphNodes.length > 0) {
    memoryContext += '\n\n## KNOWLEDGE GRAPH CONTEXT (Related Entities & Relationships)\n';
    const edges = graphEdges || [];
    if (edges.length > 0) {
      for (const e of edges) {
        memoryContext += `- (${e.source_label}: ${e.source_name}) -[${e.relation}]-> (${e.target_label}: ${e.target_name})\n`;
      }
    }
    // Also include isolated nodes properties that might not have edges
    for (const n of graphNodes) {
      if (n.properties && Object.keys(n.properties).length > 0) {
         memoryContext += `- Entity: ${n.label} (${n.name}) - Properties: ${JSON.stringify(n.properties)}\n`;
      }
    }
  }

  // ── Playbooks ──
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
      const playbookIds = dnaMemories.map(m => m.id).filter(Boolean);
      if (playbookIds.length > 0) {
        try { await supabase.rpc('touch_recalled_memories', { memory_ids: playbookIds }); } catch { /* non-fatal */ }
      }
    }
  } catch (e) {
    console.warn(`[agent:${row.id}] Business DNA recall failed (non-fatal):`, e);
  }

  // ── Business Directives (shared announcements ALL agents MUST see) ──
  try {
    const { data: directives } = await supabase
      .from('ai_memories')
      .select('content, importance_score, updated_at')
      .eq('business_id', row.business_id)
      .eq('category', 'directive')
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (directives?.length) {
      memoryContext += '\n\n## 📢 ACTIVE BUSINESS DIRECTIVES (MANDATORY — follow these)\n';
      for (const d of directives) {
        const age = Math.round((Date.now() - new Date(d.updated_at).getTime()) / 3600000);
        memoryContext += `- [${age}h ago] ${(d.content || '').substring(0, 500)}\n`;
      }
    }
  } catch (e) {
    console.warn(`[agent:${row.id}] Directives recall failed (non-fatal):`, e);
  }

  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(toolCtx, row.role || undefined, industry, location, memoryContext, (assistant?.custom_rules as string[]) || []) },
    { role: 'user', content: row.goal },
  ];

  return { messages, recalledSkillIds };
}

// ─── Main Workflow Loop (called by the serve() handler) ──────────────────

export async function runAgentWorkflow(context: WorkflowContext<WorkflowPayload>, taskId: string): Promise<void> {
  const supabase = getSupabase();

  // ─── Step: Init — Load task and build context ───
  // NOTE: taskId validation MUST happen inside context.run(), not before it.
  // The Upstash SDK auth check requires at least one context.run() to be called.
  const initResult = await context.run('init', async () => {
    if (!taskId) {
      throw new Error('[agent/workflow-run] Missing taskId in workflow payload');
    }

    const { data: task, error: loadErr } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (loadErr || !task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const row = task as TaskRow;

    if (row.status === 'completed' || row.status === 'failed') {
      return { done: true as const, status: row.status, result: row.result };
    }

    // Mark as running
    await supabase.from('agent_tasks').update({
      status: 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', taskId);

    // Resolve business context
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

    // Resolve report name
    let repName: string | undefined;
    if (row.role) {
      const dashIdx = row.role.search(/\s[—–-]\s/);
      if (dashIdx > 0 && dashIdx < 60) {
        repName = row.role.substring(0, dashIdx).trim();
      } else {
        const roleMatch = row.role.match(/You are (?:the |an? )?(?:AI )?(.+?)(?:\s+for\s|\s+working\s|\.\s|\n)/i);
        if (roleMatch) {
          repName = roleMatch[1].trim().substring(0, 40);
        } else {
          repName = row.role.substring(0, 30).trim();
        }
      }
    }
    if (!repName) repName = assistant?.name;

    // Resolve owner phone — trust explicit owner_phone from webhook; only guess from DB if missing
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
      }
    }

    const toolCtx: ToolContext = {
      businessId: row.business_id,
      businessName: biz?.name || undefined,
      ownerPhone: resolvedOwnerPhone,
      assistantName: repName,
      taskId,
    };

    // Build or restore messages
    let messages: AgentMessage[] = Array.isArray(row.messages) ? row.messages : [];
    let stepsUsed = row.steps_used || 0;
    const toolLog: ToolLogEntry[] = Array.isArray(row.tool_log) ? row.tool_log : [];
    let recalledSkillIds: string[] = [];

    const recalledEntry = toolLog.find(t => t.tool === '__recalled_skills__');
    if (recalledEntry && Array.isArray(recalledEntry.args?.ids)) {
      recalledSkillIds = recalledEntry.args.ids as string[];
    }

    if (messages.length === 0) {
      const built = await buildInitialMessages(row, toolCtx, toolLog);
      messages = built.messages;
      recalledSkillIds = built.recalledSkillIds;

      await supabase.from('agent_tasks').update({
        messages,
        owner_phone: toolCtx.ownerPhone || null,
        updated_at: new Date().toISOString(),
      }).eq('id', taskId);
    }

    return {
      done: false as const,
      toolCtx,
      messages,
      stepsUsed,
      toolLog,
      recalledSkillIds,
      enabledTools: row.enabled_tools,
      goal: row.goal,
      parentTaskId: row.parent_task_id,
    };
  });

  if (initResult.done) {
    console.log(`[agent:${taskId}] Already ${initResult.status}, skipping`);
    return;
  }

  let { toolCtx, messages, stepsUsed, toolLog, recalledSkillIds } = initResult;
  const { enabledTools, goal, parentTaskId } = initResult;

  // ─── Step: Setup — Resolve provider + discover MCP tools in ONE step ───
  // Merging these avoids extra Upstash Workflow HTTP round-trips (each context.run() = ~3-5s overhead)
  type SerializedMcpMapping = { originalToolName: string; server: { id: string; name: string; transport: string; url: string; api_key?: string; headers?: Record<string, string>; tool_filter?: string[] } };
  const setupResult = await context.run('setup', async () => {
    // Resolve provider config
    const provider = await getAgentProvider(toolCtx.businessId);

    const providerConfig = {
      name: provider.providerName,
      baseURL: provider.baseURL,
      model: provider.model,
      contextWindow: provider.contextWindow,
      compressThreshold: Math.max(15_000, Math.min(Math.floor(provider.contextWindow * 0.3), CONTEXT_COMPRESS_MAX)),
    };

    // Discover MCP tools
    let mcpTools: McpToolSchema[] = [];
    let serializedMap: Record<string, SerializedMcpMapping> = {};
    try {
      const { tools, serverMap } = await discoverMcpTools(toolCtx.businessId);
      mcpTools = tools;
      // serverMap is a Map — serialize for Upstash step storage (Maps aren't JSON-safe)
      serverMap.forEach((mapping, key) => {
        serializedMap[key] = {
          originalToolName: mapping.originalToolName,
          server: {
            id: mapping.server.id,
            name: mapping.server.name,
            transport: mapping.server.transport,
            url: mapping.server.url,
            api_key: mapping.server.api_key,
            headers: mapping.server.headers,
            tool_filter: mapping.server.tool_filter,
          },
        };
      });
    } catch (err) {
      console.warn(`[agent:${taskId}] MCP discovery failed (non-fatal):`, err);
    }

    return { providerConfig, mcpTools, serializedMap };
  });

  const { providerConfig } = setupResult;
  const nativeTools = getToolsForAgent(enabledTools);
  const agentTools = [...nativeTools, ...setupResult.mcpTools];

  // Rebuild serverMap from serialized data (restore Map<string, McpToolMapping>)
  const mcpServerMap = new Map<string, { server: { id: string; name: string; transport: 'http' | 'sse'; url: string; api_key?: string; headers?: Record<string, string>; tool_filter?: string[] }; originalToolName: string }>();
  for (const [key, val] of Object.entries(setupResult.serializedMap)) {
    mcpServerMap.set(key, {
      originalToolName: val.originalToolName,
      server: { ...val.server, transport: val.server.transport as 'http' | 'sse' },
    });
  }

  if (setupResult.mcpTools.length > 0) {
    console.log(`[agent:${taskId}] Loaded ${setupResult.mcpTools.length} MCP tools from external servers`);
  }

  const executedToolCalls = new Set<string>();

  // Seed dedup tracker from existing tool_log
  for (const entry of toolLog) {
    if (entry.tool && entry.tool !== '__recalled_skills__') {
      executedToolCalls.add(`${entry.tool}:${JSON.stringify(entry.args)}`);
    }
  }

  // ─── Main Agent Loop ───
  let loopIteration = 0;
  let baselineDbLength = messages.length;

  while (stepsUsed < MAX_TOTAL_STEPS) {
    loopIteration++;


    // ── Pre-flight check: alive + context compression ──
    // Skip on first iteration — we just set status to 'running' in the init step
    if (loopIteration > 1) {
      const tokenEstimate = estimateTokens(messages);
      const needsCompression = tokenEstimate >= providerConfig.compressThreshold;

      const preFlightResult = await context.run(`pre-flight-${loopIteration}`, async () => {
        const { data } = await supabase
          .from('agent_tasks')
          .select('status, messages')
          .eq('id', taskId)
          .single();
        const alive = data?.status === 'running';
        const dbMessages = (data?.messages || []) as AgentMessage[];

        let compressedMessages = messages;
        if (alive && needsCompression) {
          let compressModel = providerConfig.model;
          if (providerConfig.name === 'openai') compressModel = 'gpt-4o-mini';
          else if (providerConfig.name === 'openrouter') compressModel = 'openai/gpt-4o-mini';

          compressedMessages = await compressContext({
            messages,
            apiKey: getProviderApiKey(providerConfig.name),
            baseURL: providerConfig.baseURL,
            model: compressModel,
            taskId,
            threshold: providerConfig.compressThreshold,
          });
        }

        return { alive, dbMessages, compressedMessages };
      });

      if (!preFlightResult.alive) {
        console.log(`[agent:${taskId}] Task no longer running — aborting workflow`);
        return; // Workflow exits cleanly; Upstash marks it as complete
      }

      messages = preFlightResult.compressedMessages;

      // Check if owner appended corrections while we were working
      if (preFlightResult.dbMessages.length > baselineDbLength) {
        const injected = preFlightResult.dbMessages.slice(baselineDbLength);
        const corrections = injected.filter(m => m.role === 'user');
        if (corrections.length > 0) {
          messages.push(...corrections);
          console.log(`[agent:${taskId}] Injected ${corrections.length} mid-task owner correction(s)`);
        }
        baselineDbLength = preFlightResult.dbMessages.length;
      }
    }

    // ── Build budget/research warnings ──
    const currentResearchSteps = toolLog.filter(t =>
      ['search_web', 'scrape_page', 'search_google_maps'].includes(t.tool)
    ).length;
    const stepsRemainingGlobal = MAX_TOTAL_STEPS - stepsUsed;

    let warningMessage = '';
    if (stepsRemainingGlobal <= BUDGET_WARNING_STEPS) {
      warningMessage = `⚠️ URGENT: You only have ${stepsRemainingGlobal} tool calls left. You MUST call send_report NOW with whatever data you have. Do NOT make more research calls.`;
    } else if (currentResearchSteps >= RESEARCH_HARD_CAP) {
      warningMessage = `🛑 RESEARCH COMPLETE (${currentResearchSteps} research calls made). You have gathered enough data. Call send_report NOW to deliver your findings. Do NOT call search_web or scrape_page again.`;
    } else if (currentResearchSteps >= RESEARCH_SOFT_CAP) {
      warningMessage = `⚠️ You've made ${currentResearchSteps} research calls. Consider wrapping up and calling send_report unless you are missing critical data.`;
    }

    // ── Memory nudge: prompt agent to persist learnings at step 5 boundaries ──
    let memoryNudge = '';
    if (stepsUsed >= 5 && stepsUsed % 5 === 0) {
      memoryNudge = '🧠 MEMORY CHECK: You\'ve completed 5 steps. Pause and reflect — have you discovered any important facts, contacts, prices, patterns, or preferences worth saving? If so, call save_memory now before continuing. This ensures you don\'t lose valuable learnings if the task ends unexpectedly.';
    }

    // ── Self-Reflection Critic Nudge ──
    let criticNudge = '';
    const COMPLEX_TOOLS = new Set(['execute_python', 'browse_web', 'scrape_page', 'call_api', 'query_database']);
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.tool_calls) {
        const hasComplex = msg.tool_calls.some((tc: any) => tc.type === 'function' && COMPLEX_TOOLS.has(tc.function.name));
        if (hasComplex) {
          criticNudge = '🧠 CRITIC NODE: Review the output of your recent tool calls. Did they succeed and return the exact data you needed? If they failed or returned unexpected results, DO NOT blindly repeat the exact same tool call. Formulate a new hypothesis and try a different approach. If code failed, read the error and fix it.';
        }
        break;
      }
      if (msg.role === 'user') break;
    }

    const systemNudges = [warningMessage, memoryNudge, criticNudge].filter(Boolean);
    const llmMessages = systemNudges.length > 0
      ? [...messages, ...systemNudges.map(n => ({ role: 'system' as const, content: n }))]
      : messages;

    // ── LLM call via context.call() — offloaded to Upstash, no Vercel timeout ──
    type LlmResponseBody = {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    let llmResult: { status: number; body: LlmResponseBody };

    llmResult = await context.call<LlmResponseBody>(`llm-${loopIteration}`, {
      url: `${providerConfig.baseURL}/chat/completions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getProviderApiKey(providerConfig.name)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: sanitizeMessages(llmMessages),
        tools: agentTools,
        tool_choice: 'auto',
      }),
      timeout: '2m',
    });

    if (llmResult.status < 200 || llmResult.status >= 300) {
      console.error(`[agent:${taskId}] LLM returned ${llmResult.status}:`, JSON.stringify(llmResult.body).substring(0, 500));

      // Retry once on transient errors
      if (llmResult.status >= 500 || llmResult.status === 429) {
        await context.sleep(`llm-retry-wait-${loopIteration}`, 3);
        const retryResult = await context.call<typeof llmResult.body>(`llm-retry-${loopIteration}`, {
          url: `${providerConfig.baseURL}/chat/completions`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getProviderApiKey(providerConfig.name)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: providerConfig.model,
            messages: sanitizeMessages(llmMessages),
            tools: agentTools,
            tool_choice: 'auto',
          }),
          timeout: '2m',
        });
        if (retryResult.status < 200 || retryResult.status >= 300) {
          // Fatal — fail the task
          await context.run(`fail-llm-${loopIteration}`, async () => {
            await supabase.from('agent_tasks').update({
              status: 'failed',
              result: `LLM error ${retryResult.status}: ${JSON.stringify(retryResult.body).substring(0, 200)}`,
              messages, steps_used: stepsUsed, tool_log: toolLog,
              updated_at: new Date().toISOString(),
            }).eq('id', taskId);
          });
          return;
        }
        // Use retry result (reassign, don't mutate — step results may be frozen)
        llmResult = retryResult;
      } else {
        await context.run(`fail-llm-${loopIteration}`, async () => {
          await supabase.from('agent_tasks').update({
            status: 'failed',
            result: `LLM error ${llmResult.status}: ${JSON.stringify(llmResult.body).substring(0, 200)}`,
            messages, steps_used: stepsUsed, tool_log: toolLog,
            updated_at: new Date().toISOString(),
          }).eq('id', taskId);
        });
        return;
      }
    }


    const assistantMessage = llmResult.body.choices?.[0]?.message;
    if (!assistantMessage) {
      await context.run(`fail-no-message-${loopIteration}`, async () => {
        await supabase.from('agent_tasks').update({
          status: 'failed',
          result: 'LLM returned no message',
          messages, steps_used: stepsUsed, tool_log: toolLog,
          updated_at: new Date().toISOString(),
        }).eq('id', taskId);
      });
      return;
    }

    // ── Tool calls ──
    // Some models (MiMo, Qwen) emit tool calls as XML text in content instead of structured tool_calls.
    // Detect and convert: <tool_call>\n<function=NAME>\n<parameter=KEY>VALUE</parameter>\n</function>\n</tool_call>
    if ((!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) && assistantMessage.content) {
      const xmlToolCalls = parseXmlToolCalls(assistantMessage.content);
      if (xmlToolCalls.length > 0) {
        assistantMessage.tool_calls = xmlToolCalls;
        // Strip the XML from content so it doesn't pollute the conversation
        assistantMessage.content = assistantMessage.content
          .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
          .trim() || null;
        console.log(`[agent:${taskId}] Parsed ${xmlToolCalls.length} XML tool call(s) from model content`);
      }
    }

    const rawToolCalls = assistantMessage.tool_calls?.filter(
      (tc: { type: string }) => tc.type === 'function'
    ) || [];

    if (rawToolCalls.length > 0) {
      type FnToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
      const fnCalls = rawToolCalls as FnToolCall[];

      messages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: fnCalls.map(tc => ({
          id: tc.id, type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      // Parse all args
      const parsedArgs = new Map<string, Record<string, unknown>>();
      const parseErrors = new Map<string, boolean>();
      
      for (const tc of fnCalls) {
        let toolArgs: Record<string, unknown>;
        try {
          toolArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          toolArgs = {};
          parseErrors.set(tc.id, true);
        }

        parsedArgs.set(tc.id, toolArgs);
      }

      // Classify parallel-safe vs sequential
      const parallelCalls: FnToolCall[] = [];
      const sequentialCalls: FnToolCall[] = [];
      for (const tc of fnCalls) {
        if (PARALLEL_SAFE_TOOLS.has(tc.function.name) && fnCalls.length > 1) {
          parallelCalls.push(tc);
        } else {
          sequentialCalls.push(tc);
        }
      }

      // Helper: execute one tool
      const runToolInStep = async (tc: FnToolCall, stepSuffix: string): Promise<{ id: string; name: string; args: Record<string, unknown>; result: string }> => {
        const toolArgs = parsedArgs.get(tc.id)!;
        
        if (parseErrors.has(tc.id)) {
          return {
            id: tc.id,
            name: tc.function.name,
            args: toolArgs,
            result: `[Tool Error] Invalid JSON arguments provided. Please fix your formatting and try again.`,
          };
        }

        const RESEARCH_TOOLS = new Set(['search_web', 'scrape_page', 'search_google_maps']);
        const IDEMPOTENT_TOOLS = new Set([
          'search_web', 'scrape_page', 'search_memory',
          'query_database', 'search_google_maps',
          'call_api', 'process_document', 'search_leads'
        ]);

        // Research hard cap enforcement
        if (RESEARCH_TOOLS.has(tc.function.name)) {
          const currentResearch = toolLog.filter(t => RESEARCH_TOOLS.has(t.tool)).length;
          if (currentResearch >= RESEARCH_HARD_CAP) {
            console.log(`[agent:${taskId}] Blocked research call (hard cap ${RESEARCH_HARD_CAP}): ${tc.function.name}`);
            return {
              id: tc.id,
              name: tc.function.name,
              args: toolArgs,
              result: `RESEARCH BLOCKED: You have already made ${currentResearch} research calls (limit: ${RESEARCH_HARD_CAP}). Call send_report NOW to deliver your findings.`,
            };
          }
        }

        // Duplicate detection
        const callKey = `${tc.function.name}:${JSON.stringify(toolArgs)}`;
        if (IDEMPOTENT_TOOLS.has(tc.function.name) && executedToolCalls.has(callKey)) {
          console.log(`[agent:${taskId}] Blocked duplicate: ${tc.function.name}`);
          return {
            id: tc.id,
            name: tc.function.name,
            args: toolArgs,
            result: `Duplicate call blocked — you already called ${tc.function.name} with these exact arguments. Use the previous result.`,
          };
        }
        executedToolCalls.add(callKey);

        console.log(`[agent:${taskId}] Step ${stepsUsed + 1}: ${tc.function.name}(${JSON.stringify(toolArgs).substring(0, 100)})`);

        // Send live status via WhatsApp (fire-and-forget)
        sendToolStatus(toolCtx, tc.function.name, toolArgs);

        // Execute tool (route MCP tools through MCP adapter)
        const timeout = TOOL_TIMEOUT_OVERRIDES[tc.function.name] || TOOL_TIMEOUT_MS;
        try {
          let result: string;
          if (isMcpTool(tc.function.name)) {
            result = await executeMcpTool(tc.function.name, toolArgs, mcpServerMap);
          } else {
            result = await executeTool(tc.function.name, toolArgs, toolCtx, timeout);
          }
          return { id: tc.id, name: tc.function.name, args: toolArgs, result };
        } catch (err) {
          return { id: tc.id, name: tc.function.name, args: toolArgs, result: `Tool error: ${err instanceof Error ? err.message : String(err)}` };
        }
      };

      // ── Execute parallel tools ──
      if (parallelCalls.length > 0) {
        const parallelResults = await context.run(`tools-parallel-${loopIteration}`, async () => {
          console.log(`[agent:${taskId}] Running ${parallelCalls.length} tools in parallel: ${parallelCalls.map(tc => tc.function.name).join(', ')}`);
          const results = await Promise.allSettled(
            parallelCalls.map((tc, i) => runToolInStep(tc, `p${i}`))
          );
          return results.map((r, i) =>
            r.status === 'fulfilled'
              ? r.value
              : { id: parallelCalls[i].id, name: parallelCalls[i].function.name, args: parsedArgs.get(parallelCalls[i].id)!, result: `Tool error: ${(r as PromiseRejectedResult).reason}` }
          );
        });

        for (const r of parallelResults) {
          messages.push({ role: 'tool', tool_call_id: r.id, content: safeSlice(r.result, TOOL_RESULT_MAX) });
          toolLog.push({ tool: r.name, args: r.args, result: safeSlice(r.result, 500), timestamp: new Date().toISOString() });
          stepsUsed++;
          // Keep dedup set in sync outside context.run() so it survives replays
          executedToolCalls.add(`${r.name}:${JSON.stringify(r.args)}`);
        }
      }

      // ── Execute sequential tools ──
      let paused = false;
      for (let i = 0; i < sequentialCalls.length; i++) {
        const tc = sequentialCalls[i];
        const toolArgs = parsedArgs.get(tc.id)!;

        let result: { id: string; name: string; args: Record<string, unknown>; result: string };

        const isPhasedVideo = tc.function.name === 'generate_media' && 
          ['short_video', 'long_video', 'video'].includes(String(toolArgs.media_type || '').toLowerCase());

        if (isPhasedVideo) {
          // ── Offload video tools via phased context.call() loop ──
          // Each call handles one phase (boot → scene × N → finalize).
          // State is passed between calls — each fits within Vercel's 800s maxDuration.
          const callKey = `${tc.function.name}:${JSON.stringify(toolArgs)}`;
          if (executedToolCalls.has(callKey)) {
            result = { id: tc.id, name: tc.function.name, args: toolArgs, result: `Duplicate call blocked — you already called ${tc.function.name} with these exact arguments.` };
          } else {
            executedToolCalls.add(callKey);

            // Send WhatsApp status ONCE (durable step — won't re-fire on Upstash replays)
            await context.run(`video-notify-${loopIteration}-${i}`, async () => {
              sendToolStatus(toolCtx, tc.function.name, toolArgs);
              await new Promise(r => setTimeout(r, 1500));
            });

            console.log(`[agent:${taskId}] Starting phased video generation for ${tc.function.name}`);
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai').replace(/\/$/, '');
            let videoState: Record<string, unknown> | undefined;
            let videoResult: string | undefined;

            // Loop through phases: boot → scene(s) → finalize
            // Max 20 steps = 1 boot + up to 6 scenes + 1 finalize + safety margin
            for (let step = 0; step < 20 && !videoResult; step++) {
              const callResult = await context.call<{ done: boolean; result?: string; state?: Record<string, unknown> }>(
                `video-${loopIteration}-${i}-s${step}`,
                {
                  url: `${appUrl}/api/agent/video-generate`,
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ toolName: tc.function.name, args: toolArgs, toolCtx, state: videoState }),
                  retries: 1,
                  timeout: '15m',
                },
              );

              console.log(`[agent:${taskId}] video phase ${step} status=${callResult.status} done=${callResult.body?.done}`);

              if (callResult.status >= 200 && callResult.status < 300) {
                if (callResult.body?.done) {
                  videoResult = callResult.body.result ?? 'Video generation completed (no result text).';
                } else {
                  videoState = callResult.body?.state;
                }
              } else {
                videoResult = `Video tool HTTP error ${callResult.status}: ${JSON.stringify(callResult.body).substring(0, 300)}`;
              }
            }

            if (!videoResult) videoResult = 'Video generation failed: exceeded maximum phases (20).';

            // ── FALLBACK TO RUNWARE IF VAST.AI FAILS ──
            if (videoResult.toLowerCase().includes('fail') || videoResult.toLowerCase().includes('error')) {
              console.log(`[agent:${taskId}] Vast.ai failed (${videoResult}). Falling back to Runware...`);
              try {
                const fallbackRes = await context.run(`video-fallback-${loopIteration}-${i}`, async () => {
                  return await runToolInStep(tc, `fallback-seq${i}`);
                });
                videoResult = fallbackRes.result;
              } catch (err) {
                videoResult += `\nFallback to Runware also failed: ${err instanceof Error ? err.message : String(err)}`;
              }
            }

            result = { id: tc.id, name: tc.function.name, args: toolArgs, result: videoResult };
          }
        } else {
          // ── Normal tool via context.run() ──
          result = await context.run(`tool-seq-${loopIteration}-${i}`, async () => {
            return runToolInStep(tc, `s${i}`);
          });
        }

        messages.push({ role: 'tool', tool_call_id: result.id, content: safeSlice(result.result, TOOL_RESULT_MAX) });
        toolLog.push({ tool: result.name, args: result.args, result: safeSlice(result.result, 500), timestamp: new Date().toISOString() });
        stepsUsed++;
        // Keep dedup set in sync outside context.run() so it survives replays
        executedToolCalls.add(`${result.name}:${JSON.stringify(result.args)}`);

        // ── PAUSE: Approval gate ──
        if (result.result.startsWith('__PAUSE__:')) {
          const pauseType = result.result.includes('waiting_approval') ? 'waiting_approval' : 'waiting_subtask';

          // Fill in skipped tool calls
          const executedIds = new Set(messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
          for (const unexecuted of fnCalls) {
            if (!executedIds.has(unexecuted.id)) {
              messages.push({ role: 'tool', tool_call_id: unexecuted.id, content: 'Skipped — task is pausing.' });
            }
          }

          // Save state with pause status
          messages = await context.run(`save-pause-${loopIteration}`, async () => {
            const { data: latest } = await supabase.from('agent_tasks').select('messages').eq('id', taskId).single();
            let finalMessages = messages;
            if (latest && Array.isArray(latest.messages)) {
              const latestMsgs = latest.messages as AgentMessage[];
              if (latestMsgs.length > baselineDbLength) {
                const injected = latestMsgs.slice(baselineDbLength).filter(m => m.role === 'user');
                if (injected.length > 0) finalMessages = [...messages, ...injected];
              }
            }
            await supabase.from('agent_tasks').update({
              status: pauseType, messages: finalMessages, steps_used: stepsUsed, tool_log: toolLog,
              updated_at: new Date().toISOString(),
            }).eq('id', taskId);
            return finalMessages;
          });
          baselineDbLength = messages.length;

          if (pauseType === 'waiting_approval') {
            // Wait for approval event (up to 7 days)
            const { eventData, timeout: timedOut } = await context.waitForEvent(
              `approval-${loopIteration}`,
              `approval-${taskId}`,
              { timeout: '7d' },
            );

            if (timedOut) {
              // Approval timed out — fail the task
              await context.run(`fail-approval-timeout-${loopIteration}`, async () => {
                await supabase.from('agent_tasks').update({
                  status: 'failed',
                  result: 'Approval request timed out after 7 days.',
                  messages, steps_used: stepsUsed, tool_log: toolLog,
                  updated_at: new Date().toISOString(),
                }).eq('id', taskId);
              });
              return;
            }

            // Resume with approval response
            const ed = eventData as Record<string, unknown> | string;
            const approvalText = typeof ed === 'string' ? ed : ((ed?.response as string) || JSON.stringify(ed));
            messages.push({
              role: 'user',
              content: `Owner's response to your approval request: "${approvalText}"`,
            });

            await context.run(`save-resume-approval-${loopIteration}`, async () => {
              await supabase.from('agent_tasks').update({
                status: 'running', messages, steps_used: stepsUsed, tool_log: toolLog,
                updated_at: new Date().toISOString(),
              }).eq('id', taskId);
            });
            baselineDbLength = messages.length;

            paused = false; // Continue the main loop
            break; // Break out of sequential tool loop
          } else {
            // waiting_subtask — the sub-task will trigger a new workflow run when it completes
            // For now, we'll poll. In future, use waitForEvent.
            paused = true;
            break;
          }
        }
      }

      if (paused) {
        // Task is paused waiting for subtask — end workflow, will be re-triggered
        return;
      }

      // ── Save progress after all tools ──
      messages = await context.run(`save-${loopIteration}`, async () => {
        const { data: latest } = await supabase.from('agent_tasks').select('messages').eq('id', taskId).single();
        let finalMessages = messages;
        if (latest && Array.isArray(latest.messages)) {
          const latestMsgs = latest.messages as AgentMessage[];
          if (latestMsgs.length > baselineDbLength) {
            const injected = latestMsgs.slice(baselineDbLength).filter(m => m.role === 'user');
            if (injected.length > 0) finalMessages = [...messages, ...injected];
          }
        }
        await supabase.from('agent_tasks').update({
          messages: finalMessages, steps_used: stepsUsed, tool_log: toolLog,
          updated_at: new Date().toISOString(),
        }).eq('id', taskId);
        return finalMessages;
      });
      baselineDbLength = messages.length;

    } else {
      // ── No tool calls — task complete ──
      const finalResult = assistantMessage.content || 'Task completed (no output).';

      // ── Phase 4: LLM-as-a-Judge Evaluation ──
      const MAX_EVAL_RETRIES = 2;
      let evalRetryCount = 0;
      if (providerConfig.name !== 'mock') {
        // Count how many times the evaluator has already rejected in this task
        evalRetryCount = messages.filter(m => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('CRITIC EVALUATION FAILED')).length;
        
        if (evalRetryCount < MAX_EVAL_RETRIES) {
          const evalResult = await context.call<any>(`evaluate-task-${loopIteration}`, {
            url: `${providerConfig.baseURL}/chat/completions`,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getProviderApiKey(providerConfig.name)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: providerConfig.name === 'openai' ? 'gpt-4o-mini' : (providerConfig.name === 'openrouter' ? 'openai/gpt-4o-mini' : providerConfig.model),
              messages: [
                { role: 'system', content: 'You are an objective QA evaluator. Review the agent\'s final output against the original goal. Score the output from 1 to 10. If the score is less than 8, explain exactly why it failed. Output JSON: { "score": 8, "reasoning": "..." }' },
                { role: 'user', content: `GOAL: ${goal}\n\nFINAL OUTPUT:\n${finalResult}` }
              ]
            }),
            timeout: '1m'
          });

          if (evalResult.status >= 200 && evalResult.status < 300) {
            try {
              const content = evalResult.body?.choices?.[0]?.message?.content || '{}';
              const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
              const evaluation = JSON.parse(cleanContent);
              
              if (evaluation.score < 8) {
                console.log(`[agent:${taskId}] Evaluator rejected completion (Score ${evaluation.score}, attempt ${evalRetryCount + 1}/${MAX_EVAL_RETRIES}): ${evaluation.reasoning}`);
                messages.push({ role: 'assistant', content: finalResult });
                messages.push({ role: 'user', content: `CRITIC EVALUATION FAILED (Score ${evaluation.score}/10): ${evaluation.reasoning}\n\nPlease correct these issues and try completing the task again.` });
                stepsUsed++; // Count eval rejection as a step to prevent runaway loops
                
                await context.run(`save-eval-fail-${loopIteration}`, async () => {
                  await supabase.from('agent_tasks').update({
                    messages, steps_used: stepsUsed, tool_log: toolLog,
                    updated_at: new Date().toISOString(),
                  }).eq('id', taskId);
                });
                
                continue; // Re-enter the loop!
              } else {
                console.log(`[agent:${taskId}] Evaluator approved completion (Score ${evaluation.score}).`);
              }
            } catch (e) {
              console.error(`[agent:${taskId}] Evaluator parsing failed, proceeding anyway:`, e);
            }
          }
        } else {
          console.log(`[agent:${taskId}] Max eval retries (${MAX_EVAL_RETRIES}) reached, accepting result as-is.`);
        }
      }

      // Push final assistant message into conversation history
      messages.push({ role: 'assistant', content: finalResult });

      await context.run('complete', async () => {
        // Auto-deliver if agent forgot send_report
        const calledSendReport = toolLog.some(t => t.tool === 'send_report' && !t.result.startsWith('REJECTED'));
        if (!calledSendReport && toolCtx.ownerPhone && !goal.startsWith('[DELEGATED TASK]')) {
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
            const sendResult = await executeTool('send_report', { message: safeSlice(reportContent || finalResult, 3500) }, toolCtx);
            if (sendResult.includes('Failed') || sendResult.includes('Cannot')) {
              console.error(`[agent:${taskId}] Auto send_report FAILED: ${sendResult}`);
            } else {
              console.log(`[agent:${taskId}] Auto send_report delivered to ${toolCtx.ownerPhone}`);
            }
          } catch (e) {
            console.error(`[agent:${taskId}] Auto send_report threw:`, e);
          }
        }

        const { data: latest } = await supabase.from('agent_tasks').select('messages').eq('id', taskId).single();
        let finalMessages = messages;
        if (latest && Array.isArray(latest.messages)) {
          const latestMsgs = latest.messages as AgentMessage[];
          const injected = latestMsgs.filter(m => m.role === 'user' && !messages.some(existing => existing.content === m.content));
          if (injected.length > 0) finalMessages = [...messages, ...injected];
        }

        await supabase.from('agent_tasks').update({
          status: 'completed', result: finalResult, messages: finalMessages, steps_used: stepsUsed, tool_log: toolLog,
          updated_at: new Date().toISOString(),
        }).eq('id', taskId);

        // Save conversation for memory continuity
        const ownerPhoneNorm = (toolCtx.ownerPhone || '').replace(/^\+/, '');
        if (ownerPhoneNorm && !goal.startsWith('[DELEGATED TASK]')) {
          try {
            await saveMessage(ownerPhoneNorm, 'user', safeSlice(goal, 2000), toolCtx.businessId);
            await saveMessage(ownerPhoneNorm, 'assistant', safeSlice(finalResult, 2000), toolCtx.businessId);
          } catch (err) {
            console.error(`[agent:${taskId}] Failed to save conversation history:`, err);
          }
        }

        // Resume parent if sub-task
        if (parentTaskId) {
          await resumeParentWorkflow(supabase, taskId, parentTaskId, finalResult);
        }
      });

      // ── Auto-create skill (separate step to not block completion) ──
      await context.run('auto-skill', async () => {
        await autoCreateSkill(supabase, taskId, goal, toolCtx.businessId, toolLog, providerConfig, recalledSkillIds);
      });

      // ── Memory reflection at task completion ──
      if (toolLog.length >= 3 && !goal.startsWith('[DELEGATED TASK]')) {
        await context.run('memory-reflection', async () => {
          try {
            await consolidateMemoryGraph(goal, toolLog, finalResult, toolCtx.businessId, providerConfig, getProviderApiKey(providerConfig.name));
          } catch (err) {
            console.warn(`[agent:${taskId}] Memory reflection graph extraction failed (non-fatal):`, err);
          }
        });
      }

      // ── Update skill effectiveness ──
      if (recalledSkillIds.length > 0) {
        await context.run('update-skills', async () => {
          await updateSkillEffectiveness(supabase, recalledSkillIds, true, taskId);
        });
      }

      return; // Done!
    }
  }

  // ── MAX_TOTAL_STEPS exhausted — force send_report ──
  await context.run('force-complete', async () => {
    console.log(`[agent:${taskId}] MAX_TOTAL_STEPS reached (${stepsUsed}), forcing send_report`);

    try {
      const agentToolsDefs = getToolsForAgent(enabledTools);
      const forceResult = await fetch(`${providerConfig.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getProviderApiKey(providerConfig.name)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.model,
          messages: sanitizeMessages([...messages, {
            role: 'system' as const,
            content: 'CRITICAL: You have run out of tool budget. Call send_report NOW with all collected data. This is your FINAL action.',
          }]),
          tools: agentToolsDefs,
          tool_choice: { type: 'function', function: { name: 'send_report' } },
        }),
      });

      if (forceResult.ok) {
        const forceBody = await forceResult.json();
        const forcedMsg = forceBody.choices?.[0]?.message;
        if (forcedMsg?.tool_calls?.length) {
          for (const tc of forcedMsg.tool_calls) {
            if (tc.type === 'function' && tc.function.name === 'send_report') {
              const args = JSON.parse(tc.function.arguments || '{}');
              await executeTool('send_report', args, toolCtx);
            }
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
  });

  if (recalledSkillIds.length > 0) {
    await context.run('update-skills-exhausted', async () => {
      await updateSkillEffectiveness(supabase, recalledSkillIds, true, taskId);
    });
  }
}

// ─── Send Tool Status via WhatsApp ───────────────────────────────────────

function sendToolStatus(toolCtx: ToolContext, toolName: string, toolArgs: Record<string, unknown>): void {
  if (!toolCtx.ownerPhone || toolName.startsWith('send_')) return;

  const iconMap: Record<string, string> = {
    request_integration: '🔌', browse_web: '🌐', scrape_page: '🕷️',
    search_web: '🔍', search_google_maps: '🗺️', save_leads: '📥',
    search_memory: '🧠', save_memory: '💾', delegate_task: '🔀',
    query_database: '🗄️', call_api: '⚡', manage_job: '📋', analyze_inventory: '📦',
    request_approval: '👍', manage_automation: '🤖', update_instructions: '🧠',
    send_email: '📧', make_call: '📞',
  };
  const icon = iconMap[toolName] || '⚙️';

  let hint = '';
  const a = toolArgs;
  switch (toolName) {
    case 'search_web': hint = `"${(a.query as string || '').substring(0, 80)}"`; break;
    case 'scrape_page': { const u = (a.url as string || ''); hint = u.replace(/^https?:\/\/(www\.)?/, '').substring(0, 60); break; }
    case 'search_google_maps': hint = `"${(a.query as string || '').substring(0, 40)}"${a.location ? ` in ${a.location as string}` : ''}`; break;
    case 'query_database': hint = `${(a.action as string || 'SELECT')} ${(a.table as string || '')}`; break;
    case 'search_memory': hint = `"${(a.query as string || '').substring(0, 60)}"`; break;
    case 'save_memory': hint = `[${a.category || '?'}] "${(a.content as string || '').substring(0, 50)}"`; break;
    case 'delegate_task': hint = `→ ${(a.goal as string || '').substring(0, 50)}`; break;
    default: hint = JSON.stringify(a).substring(0, 60);
  }

  if (hint.length > 120) hint = hint.substring(0, 117) + '...';
  const statusMsg = hint ? `_${icon} ${toolName}: ${hint}_` : `_${icon} ${toolName}..._`;

  const creds = getLaunchflyCreds();
  if (creds && !toolCtx.ownerPhone?.startsWith('test-chat')) {
    sendWhatsAppWithCreds(toolCtx.ownerPhone, statusMsg, creds).catch(() => {});
  }
}

// ─── Resume Parent Workflow ──────────────────────────────────────────────

async function resumeParentWorkflow(
  supabase: ReturnType<typeof getSupabase>,
  childTaskId: string,
  parentTaskId: string,
  result: string,
): Promise<void> {
  try {
    const { data: parent } = await supabase
      .from('agent_tasks')
      .select('status, messages')
      .eq('id', parentTaskId)
      .maybeSingle();

    if (!parent || parent.status !== 'waiting_subtask') return;

    const parentMessages: AgentMessage[] = Array.isArray(parent.messages) ? parent.messages : [];
    parentMessages.push({
      role: 'user',
      content: `Sub-agent completed. Result:\n\n${safeSlice(result, 3000)}`,
    });

    await supabase.from('agent_tasks').update({
      status: 'pending',
      messages: parentMessages,
      updated_at: new Date().toISOString(),
    }).eq('id', parentTaskId);

    // Trigger parent workflow via QStash client
    const { Client } = await import('@upstash/workflow');
    const client = new Client({ token: process.env.QSTASH_TOKEN! });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai').replace(/\/$/, '');
    await client.trigger({
      url: `${appUrl}/api/agent/workflow-run`,
      body: { taskId: parentTaskId },
    });

    console.log(`[agent:${childTaskId}] Sub-task done, re-triggered parent workflow ${parentTaskId}`);
  } catch (err) {
    console.error(`[agent:${childTaskId}] Error resuming parent:`, err);
  }
}

// ─── Auto-Create Skill ──────────────────────────────────────────────────

async function autoCreateSkill(
  supabase: ReturnType<typeof getSupabase>,
  taskId: string,
  goal: string,
  businessId: string,
  toolLog: ToolLogEntry[],
  providerConfig: { name: string; baseURL: string; model: string },
  recalledSkillIds: string[] = [],
): Promise<void> {
  try {
    if (goal.startsWith('[DELEGATED TASK]')) return;
    const uniqueTools = new Set(toolLog.map(t => t.tool));
    if (toolLog.length < SKILL_AUTO_CREATE_MIN_TOOLS) return;
    if (toolLog.some(t => t.tool === 'save_memory' && String(t.args?.category) === 'skill')) return;

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

    const toolSequence = toolLog.map((t, i) =>
      `${i + 1}. ${t.tool}(${JSON.stringify(t.args).substring(0, 120)}) → ${safeSlice(t.result, 100)}`
    ).join('\n');

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: getProviderApiKey(providerConfig.name), baseURL: providerConfig.baseURL });

    // ── Skill rewrite: if a recalled skill exists, evolve it instead of creating new ──
    if (existing?.length) {
      const existingSkill = existing[0] as { id: string; content: string; similarity: number };
      const isRecalled = recalledSkillIds.includes(existingSkill.id);

      if (existingSkill.content) {
        // The agent used this skill — rewrite it with improvements from this execution
        const rewriteCompletion = await client.chat.completions.create({
          model: providerConfig.model,
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
      // If not recalled, skip (don't create duplicate)
      return;
    }

    const skillCompletion = await client.chat.completions.create({
      model: providerConfig.model,
      messages: [
        { role: 'system', content: 'Create a concise reusable SKILL document from this completed agent task. Use this exact format:\n\nSKILL: [2-5 word name]\nTRIGGER: [when to use this skill]\nSTEPS:\n1. [tool_name] — [what and why]\n2. [tool_name] — [what and why]\nTIPS: [what worked, pitfalls to avoid]\n\nBe specific and actionable. Output ONLY the skill document.' },
        { role: 'user', content: `Goal: ${goal}\n\nTool sequence:\n${toolSequence}` },
      ],
      max_tokens: 500,
    });

    const skillContent = skillCompletion.choices[0]?.message?.content?.trim();
    if (!skillContent || skillContent.length < 30) return;

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
    console.warn(`[agent:${taskId}] Auto-skill creation failed:`, err);
  }
}

// ─── Update Skill Effectiveness ──────────────────────────────────────────

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
        ? Math.min(1.0, currentScore + 0.02)
        : Math.max(0.1, currentScore - 0.05);

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
8. Deliver final results via send_report. ALWAYS place the FULL content of your report in the "message" parameter of the send_report tool, not in your regular text response.

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

1. **OBSERVE**: During each interaction, notice recurring pain points, objections, wishes, or praise from customers.
2. **TAG**: When you spot something significant, save it with save_memory using category "strategic_insight" and importance 0.8–1.0.
3. **VALIDATE**: Before elevating an insight, use search_web or search_memory to check if it's a real trend or an outlier.
4. **COMPOUND**: Each new conversation, search your memories FIRST. Build on previous insights, don't rediscover the same thing.
5. **ALERT**: When an insight crosses the breakthrough threshold (importance >= 0.8, validated, actionable), message the owner directly.

This creates a compounding business identity — you don't just answer questions, you form a perspective on what works for THIS business and THIS market, getting sharper every single day.
${memoryContext || '\n(No prior conversation history available.)'}`;
}
