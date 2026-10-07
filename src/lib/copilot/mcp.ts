// src/lib/copilot/mcp.ts
// The record, read from Claude: the MCP server's protocol and its tools.
//
// Why this exists, since DIRECTION.md declines "an assistant to talk things over
// with". It still declines one. Talking an idea through is what Claude does, and
// better than this app would build it; what Claude cannot do is know the
// business. The handoff export (handoff.ts) answered that with a paste, which
// goes stale the moment it is made and has to be made again for every chat. A
// connector is the same record, read when the conversation needs it: what the
// offer says, which part of the business the rows call weak, the bet running,
// what the people who could buy actually said.
//
// Read only, and the tools say so (annotations.readOnlyHint). Nothing here
// sends, logs, changes or deletes — not "not yet" in the copy and a write in the
// code: the tool list has no write in it, and a test fails if one appears before
// it has its own scope and its own consent (invariant 7). What somebody tells
// Claude that belongs in the record goes in through the app, where it is kept
// by their tap.
//
// Every number a tool returns is one the app counted from the person's rows,
// as the screens count it (invariant 2), and the instructions ask Claude to say
// so when a figure is its own.
//
// Pure — no DB import — so copilot-core.test.ts covers the protocol. The route
// (api/copilot/mcp) checks the token and runs the tools.

/** Newest first. A client asking for one of these gets it; anything else gets the newest. */
export const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const MCP_LATEST = MCP_VERSIONS[0];

export const SERVER_INFO = { name: 'copilot', title: 'Copilot', version: '1.0.0' } as const;

/**
 * Said to Claude when it connects. What the record is, where its numbers come
 * from, that nothing here writes, and what to do with something the person says
 * that belongs in it — so Claude does not tell them it saved what it cannot.
 */
export const INSTRUCTIONS = [
  'This is the user\'s own business record, from their Copilot app: what they sell and to whom, their goals, the plan, the tests they are running, the conversations they logged, and what their rows count.',
  'Every number in it was counted by the app from rows the user created. When you estimate, project or compute a rate yourself, say it is your estimate and not the app\'s.',
  'The tools speak to the user as the app does, so "you" in them is the user. Lines the user wrote are marked as theirs, and a plan or draft a model wrote is marked as one; keep the two apart from what the rows show.',
  'It is read-only: these tools cannot send, log, change or delete anything. When the user tells you something that belongs in the record — a conversation, a sale, a meeting, a new price — tell them to log it in their Copilot app, where saying it into the mic opens it filled in for them to keep, and never say it was saved.',
  'Start with get_overview.',
].join(' ');

export const TOOL_NAMES = ['get_overview', 'get_plan', 'get_proof', 'get_conversations', 'get_record', 'get_counted_answers'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolDef {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; additionalProperties?: boolean };
  annotations: { title: string; readOnlyHint: true; destructiveHint: false; idempotentHint: true; openWorldHint: false };
}

const READ = (title: string) => ({ title, readOnlyHint: true as const, destructiveHint: false as const, idempotentHint: true as const, openWorldHint: false as const });
const NO_ARGS = { type: 'object' as const, properties: {}, additionalProperties: false };

/** Conversations returned when none is asked for, and the most there are. */
export const TALKS_DEFAULT = 20;
export const TALKS_MAX = 100;

export const TOOLS: ToolDef[] = [
  {
    name: 'get_overview',
    title: 'The business at a glance',
    description: 'Start here. What the user sells, to whom and at what price; their goals and whether each is on track; where the business stands, part by part, as the rows read it and which part is weakest; the test they are running; and the one move the app says is next.',
    inputSchema: NO_ARGS,
    annotations: READ('The business at a glance'),
  },
  {
    name: 'get_plan',
    title: 'What is next',
    description: 'The move the app says is next and why, everything waiting on the user (questions, introductions to follow up, drafts to send), and the plan: milestones and steps by week, month and quarter, with what is done.',
    inputSchema: NO_ARGS,
    annotations: READ('What is next'),
  },
  {
    name: 'get_proof',
    title: 'Is it proven',
    description: 'Whether the business is proven: each part (who buys, how they hear, how they say yes, what they pay, how it is delivered) with its state and the counts behind it; every test run, with its pass line and how the rows judged it; the last checkpoint decision (keep going, or change one part); and the history of what was tried.',
    inputSchema: NO_ARGS,
    annotations: READ('Is it proven'),
  },
  {
    name: 'get_conversations',
    title: 'Conversations',
    description: 'The conversations the user logged by hand, newest first: who it was with and what they were to the business (could buy, sells to them, runs the work, already earns in it, knows people), whether they had the problem, how it ended, and their words. With the month\'s count by kind of person and the introductions still waiting to be followed up.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: TALKS_MAX, description: `How many conversations, newest first. Default ${TALKS_DEFAULT}.` } },
      additionalProperties: false,
    },
    annotations: READ('Conversations'),
  },
  {
    name: 'get_record',
    title: 'The whole record',
    description: 'Everything the app knows, as one document, in the user\'s own voice ("I sell…"), as the app\'s copy-for-Claude export writes it: the user, their offer and how they work, goals, the last 30 days of sending and replies, money from their bank statements, what the app suggested and what they did about it, what they said no to, what is running, what people wrote back, and their notes. Long; use it when the overview is not enough.',
    inputSchema: NO_ARGS,
    annotations: READ('The whole record'),
  },
  {
    name: 'get_counted_answers',
    title: 'Counted answers',
    description: 'Five questions the app answers by counting the user\'s rows: which segments reply, what they have stood down, what has worked, how many drafts wait, and what the app has been worth. Each answer says when there is too little to count.',
    inputSchema: NO_ARGS,
    annotations: READ('Counted answers'),
  },
];

export interface ToolOutcome { text: string; isError?: boolean }

export interface RpcContext {
  /** Runs a tool for the signed-in person. A throw is caught here and said, never swallowed (invariant 13). */
  call: (name: ToolName, args: Record<string, unknown>) => Promise<ToolOutcome>;
}

export function negotiateVersion(asked: unknown): string {
  return typeof asked === 'string' && (MCP_VERSIONS as readonly string[]).includes(asked) ? asked : MCP_LATEST;
}

/** The MCP-Protocol-Version header, which only a request after initialize carries. Absent is the oldest version, as the spec says. */
export function headerVersionOk(v: string | null): boolean {
  return v == null || (MCP_VERSIONS as readonly string[]).includes(v) || v === '2024-11-05';
}

type Id = string | number | null;
const isId = (v: unknown): v is Id => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) || v === null;
const reply = (id: Id, result: unknown) => ({ jsonrpc: '2.0', id, result });
const failure = (id: Id, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

/** A tool's arguments, checked. What is wrong is said as a tool error, so the model can correct the call rather than give up on it. */
export function toolArgs(name: ToolName, raw: unknown): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) return { ok: false, error: 'arguments must be an object.' };
  const a = (raw ?? {}) as Record<string, unknown>;
  if (name === 'get_conversations' && a.limit !== undefined) {
    const n = a.limit;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > TALKS_MAX) return { ok: false, error: `limit must be a whole number from 1 to ${TALKS_MAX}.` };
    return { ok: true, args: { limit: n } };
  }
  return { ok: true, args: name === 'get_conversations' ? { limit: TALKS_DEFAULT } : {} };
}

/**
 * One JSON-RPC message in, its reply out — or null for a notification, which
 * gets none. A request that is not one gets -32600; a method this server does
 * not offer, -32601; a tool it does not have, -32602. A tool that fails is not
 * a protocol error: it is a result with isError and the reason, which Claude
 * reads and can tell the person.
 */
export async function handleRpc(msg: unknown, ctx: RpcContext): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return failure(null, -32600, 'Invalid request');
  const m = msg as Record<string, unknown>;
  const hasId = 'id' in m;
  if (m.jsonrpc !== '2.0' || (hasId && !isId(m.id))) return failure(hasId && isId(m.id) ? m.id : null, -32600, 'Invalid request');
  // A reply to something this server never asks, or a notification: nothing to answer.
  if (typeof m.method !== 'string') return hasId ? null : failure(null, -32600, 'Invalid request');
  if (!hasId) return null;
  const id = m.id as Id;
  const params = m.params && typeof m.params === 'object' && !Array.isArray(m.params) ? (m.params as Record<string, unknown>) : {};
  switch (m.method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: negotiateVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params.name;
      if (typeof name !== 'string' || !(TOOL_NAMES as readonly string[]).includes(name)) return failure(id, -32602, `Unknown tool: ${typeof name === 'string' ? name : '(none)'}`);
      const checked = toolArgs(name as ToolName, params.arguments);
      if (!checked.ok) return reply(id, { content: [{ type: 'text', text: checked.error }], isError: true });
      let out: ToolOutcome;
      try {
        out = await ctx.call(name as ToolName, checked.args);
      } catch (e) {
        out = { text: `The app could not read that: ${e instanceof Error ? e.message : String(e)}`, isError: true };
      }
      return reply(id, { content: [{ type: 'text', text: out.text }], ...(out.isError ? { isError: true } : {}) });
    }
    default:
      return failure(id, -32601, `Method not found: ${m.method}`);
  }
}

/**
 * A POST body: one message or, from a client on the 2025-03-26 spec, a batch.
 * Nothing to answer (only notifications) is a 202 with no body, as Streamable
 * HTTP says.
 */
export async function handleBody(body: unknown, ctx: RpcContext): Promise<{ status: 200; json: unknown } | { status: 202 }> {
  if (Array.isArray(body)) {
    if (!body.length) return { status: 200, json: failure(null, -32600, 'Empty batch') };
    const out = (await Promise.all(body.map((b) => handleRpc(b, ctx)))).filter((r): r is Record<string, unknown> => r !== null);
    return out.length ? { status: 200, json: out } : { status: 202 };
  }
  const r = await handleRpc(body, ctx);
  return r ? { status: 200, json: r } : { status: 202 };
}

/** A body that is not JSON at all. */
export function parseError() {
  return failure(null, -32700, 'Parse error');
}
