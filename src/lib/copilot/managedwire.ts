// src/lib/copilot/managedwire.ts
// The Claude agent's half of the commission contract, as data.
//
// The worker this file describes runs on Claude Managed Agents: a session per
// job, in Anthropic's sandbox, with web search and fetch, delegating to copies
// of itself when a job splits. What it may not do is the same as for any other
// worker, and it is enforced in the same place — by the app, on what comes
// back. Three things are particular to it, and each closes a gap the n8n worker
// left open:
//
//   - It reports through a tool (`report`), not a final JSON blob, so the app
//     answers every report: what it accepted and what its checks found. A done
//     the app sends back reaches the agent inside the same session, with the
//     reasons, while it still has every page it read — rather than the next
//     night, as a brief that has forgotten all of it.
//   - The job's definition of done goes in as the session's outcome, a rubric
//     written from the same expectations the app checks (contract.ts), so the
//     agent's own grader and the app agree on what done is before it starts.
//   - Each session carries a dollar cap (`budget`), from the minutes the person
//     granted, so a job cannot spend more than it was given whatever it does.
//
// Pure: no SDK import. managed.ts makes the calls.

import { briefText } from './brieftext';
import { WORKER_EVENT_KINDS, type CommissionBrief, type CommissionResult, type CommissionStatus } from './commission';
import { sessionMcp, type Account } from './accounts';
import type { Expectations, Verdict } from './contract';

export const MANAGED_MODEL = 'claude-opus-5-5';
export const READER_MODEL = 'claude-haiku-5-5';
/** Bumped when the agent's definition changes, so setup knows to publish a new version. */
export const AGENT_CONFIG_VERSION = '1';

export const REPORT_TOOL = 'report';

/** The one way anything the agent does reaches the person. */
export const REPORT_TOOL_DEF = {
  type: 'custom' as const,
  name: REPORT_TOOL,
  description: 'Post your work on this job to the owner\'s app. It is the only way anything you do reaches them. The app answers with what it accepted, what it checked, and anything it sent back for you to fix. Call it with your plan early, with each finding as you make it, and with "done" when the job is met.',
  input_schema: {
    type: 'object' as const,
    properties: {
      events: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: [...WORKER_EVENT_KINDS] },
            step: { type: 'integer', description: 'The plan step this is about.' },
            summary: { type: 'string', maxLength: 300, description: 'One sentence. Required on every event.' },
            artifact: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['link', 'text', 'message'] },
                label: { type: 'string', maxLength: 40, description: 'Short button text.' },
                value: { type: 'string', maxLength: 4000, description: 'The content: the list, the text, or what the link is.' },
                href: { type: 'string', description: 'https:// address of the page this came from.' },
              },
              required: ['label', 'value'],
            },
          },
          required: ['kind', 'summary'],
        },
      },
      plan: {
        type: 'array',
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            n: { type: 'integer' },
            do: { type: 'string', maxLength: 200 },
            state: { type: 'string', enum: ['todo', 'doing', 'done', 'blocked'] },
          },
          required: ['n', 'do', 'state'],
        },
      },
    },
    required: ['events'],
  },
};

export const MANAGED_SYSTEM = `You are a contractor working one job for one person, through their Copilot app. You are not a chatbot and not an advisor.

HOW YOU REPORT: call the report tool. Nothing else you write reaches the owner. Report your plan early ("planned" with the plan), each finding as you make it ("found", with the page it came from as a link artifact), and the end: "done" when the job is met, "needs_you" when only the owner can decide, "blocked" when a tool or a site stopped you.

The app answers every report. If it sends a "done" back, it says exactly what failed its checks (the count asked for, links that do not open, dates that do not fit): fix those and report done again. Its checks decide what done is, not your sense of it.

READ THE HISTORY FIRST. The task includes what has already happened on this job. An [answered] line is the owner answering a question you asked: act on it and never ask it again in other words — that costs them a day. Do not redo work the history shows is done.

Rules, all of them load-bearing:
- Every event needs a summary.
- Never invent a number. Every price, date, figure and name comes from a page you opened with web_fetch, and that page is the artifact. Search results find candidates; they are not evidence.
- href starts with https:// or http://. Anything else is stripped, and the artifact with it.
- "needs_you" only for a decision only the owner can make, as a question they can answer in one line.
- "blocked" when a tool or site stopped you: name what failed. Never dress a broken tool as a question — nobody can answer a 500.
- You never spend money, book, buy, pay, sign, accept, reserve or agree to anything, whatever the task says. Prepare it for the owner and describe exactly what they would do and what it costs, as the last step of your plan.
- You never contact anyone, except through an account tool the task says you have, and each such call waits for the owner's OK. Without one, write the message for the owner to send.
- A writing job (the task says so) is written from what the task says about the person. Do not search for it.
- When the owner has been asked (you reported needs_you), end your turn. Their answer will arrive as a message.
- When the app says the job is closed, end your turn.

SPLITTING A BIG JOB: when it splits into independent pieces — several places, suppliers, sources or people to look into — give each piece to the Web reader or a copy of yourself, one self-contained task per piece with the dates, area, constraints and the format to report in, several at once. Then check what they found against the pages and combine it. Do a small job yourself. Only you call report.

At most 20 events per report. Fewer and specific beats many and vague.`;

export const READER_SYSTEM = `You research one well-scoped question you are given and report what you found to whoever gave it to you. Search, then open every page you cite with web_fetch and take each price, date and name from the page itself. Report each finding as one line with its source URL. If something cannot be found, say so plainly. You never contact anyone, book, buy or sign anything.`;

/** The web tools only: no shell, no files. A research job needs nothing else, and an agent with nothing else cannot run code with the sandbox's network. */
export function webToolset() {
  return {
    type: 'agent_toolset_20260401' as const,
    default_config: { enabled: false, permission_policy: { type: 'auto' as const } },
    configs: [
      { name: 'web_search' as const, enabled: true },
      { name: 'web_fetch' as const, enabled: true, max_content_tokens: 20000 },
    ],
  };
}

/** The tools every session runs with, before any of the person's accounts are added. */
export const agentTools = () => [webToolset(), REPORT_TOOL_DEF];

/** The cheaper reader the lead hands reading-heavy pieces to. */
export function readerDefinition() {
  return {
    name: 'Web reader',
    description: 'Fast, low-cost, read-only researcher. Give it one well-scoped question with the dates, area and constraints; it searches, opens the pages and reports each finding with its source URL.',
    model: READER_MODEL,
    system: READER_SYSTEM,
    tools: [webToolset()],
    metadata: { app: 'copilot', role: 'reader', version: AGENT_CONFIG_VERSION },
  };
}

/** The lead: the worker sessions are opened against. */
export function agentDefinition(readerId: string | null) {
  return {
    name: 'Copilot worker',
    description: 'Takes one job for one person at a time and reports it back to their Copilot app. A copy can be spawned to own one independent piece of a job.',
    model: MANAGED_MODEL,
    system: MANAGED_SYSTEM,
    tools: agentTools(),
    multiagent: { type: 'coordinator' as const, agents: [...(readerId ? [readerId] : []), { type: 'self' as const }] },
    metadata: { app: 'copilot', role: 'lead', version: AGENT_CONFIG_VERSION },
  };
}

/**
 * The environment. `limited` keeps the web tools to the hosts listed, which for
 * open research is none of them: research on the open web needs `unrestricted`,
 * and that is the operator's choice to make, not a default (scripts/managed).
 * The agent has no shell, so the sandbox has nothing to reach the network with.
 */
export function environmentDefinition(networking: 'limited' | 'unrestricted', hosts: string[] = []) {
  return {
    name: 'copilot-worker',
    config: {
      type: 'cloud' as const,
      networking: networking === 'unrestricted'
        ? { type: 'unrestricted' as const }
        : { type: 'limited' as const, allow_package_managers: false, allow_mcp_servers: true, allowed_hosts: hosts },
    },
  };
}

/* ─── A session per job ───────────────────────────────────────────────────── */

const envNum = (env: Record<string, string | undefined>, k: string, d: number) => {
  const n = Number(env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/**
 * The job's dollar cap, in cents: the minutes the person granted, priced.
 * Five cents a minute by default — an hour is $3.00 — never under fifty cents
 * and never over the deployment's ceiling. Session list cost counts model
 * tokens, web searches and running time, so this bounds all of it.
 */
export function budgetCents(minutes: number, env: Record<string, string | undefined> = {}): number {
  const perMinute = envNum(env, 'COPILOT_MANAGED_CENTS_PER_MINUTE', 5);
  const ceiling = envNum(env, 'COPILOT_MANAGED_MAX_CENTS', 1500);
  return Math.round(Math.min(ceiling, Math.max(50, minutes * perMinute)));
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The job's definition of done, for the session's grader: the app's own checks
 * first and marked, so the agent's grader and the app agree before it starts.
 */
export function rubricFor(b: CommissionBrief, x: Expectations): string {
  const window = x.dates.length ? (x.dates.length === 1 ? fmtDay(x.dates[0]) : `${fmtDay(x.dates[0])} to ${fmtDay(x.dates[x.dates.length - 1])}`) : null;
  const lines = [
    '# Done, for this job. Lines marked (checked) are also checked by the app, and a done that fails one is sent back.',
    `- The work answers the objective: "${b.objective}".`,
    ...(x.count ? [`- (checked) It holds at least ${x.count} distinct items, one per finding or list line.`] : []),
    ...(x.links ? ['- (checked) Every finding links the page it came from, and every link opens.'] : []),
    ...(window ? [`- (checked) Every finding that names a day is for ${window}.`] : []),
    ...(b.job === 'research'
      ? ['- Every price, date, figure and name is taken from the page it links to, not from a search summary.']
      : ['- It is written from what the task says about the person, and invents no number, client, result or link.']),
    '- Nothing was booked, bought, paid, signed, reserved, sent or agreed: anything like that is written up for the owner as the last step, with what it costs.',
    '- The work was posted with the report tool, ending in a "done" event whose summary says what was delivered, and the app accepted it.',
  ];
  return lines.join('\n');
}

/** What the task says about the accounts the agent may use, so it knows what it may send through and that each send waits. */
export function accountsLine(accounts: Account[]): string | null {
  if (!accounts.length) return null;
  return `ACCOUNTS YOU MAY USE: ${accounts.map((a) => `${a.name} (the "${a.slug}" tools)`).join(', ')}. They are the owner's own. Every call through them waits for the owner's OK in the app — prepare the message completely, make the call once, and wait.`;
}

export interface SessionPlan {
  title: string;
  metadata: Record<string, string>;
  budget: { type: 'limit'; max_list_cost: { amount: string; currency: 'USD' } };
  initial_events: Array<Record<string, unknown>>;
  /** Present when the person's accounts go with this job: the session's own tools and servers. */
  overrides: { tools: unknown[]; mcp_servers: unknown[] } | null;
  vault_ids: string[];
}

/**
 * A new session for a job.
 *
 * The brief goes in as a message and the job as an outcome, in that order: the
 * outcome is worded generally ("get this done"), and its grader needs the brief
 * the message carries. A job that sends from the person's account is changing
 * things in the world rather than producing one artifact, and goes without an
 * outcome — there is nothing for a grader to score.
 */
export function sessionPlan(b: CommissionBrief, x: Expectations, o: { cents: number; accounts: Account[]; vault: string | null; worker: string }): SessionPlan {
  const reaching = reachesWithAccounts(b, o.accounts, o.vault);
  const text = [briefText(b), reaching ? accountsLine(o.accounts) : null].filter(Boolean).join('\n\n');
  const mcp = reaching ? sessionMcp(o.accounts) : null;
  return {
    title: `Copilot: ${b.objective}`.slice(0, 120),
    // The commission id is how a webhook finds its job: no person, no email.
    metadata: { commission_id: b.commission_id, worker: o.worker, app: 'copilot' },
    budget: { type: 'limit', max_list_cost: { amount: String(o.cents), currency: 'USD' } },
    initial_events: [
      { type: 'user.message', content: [{ type: 'text', text }] },
      ...(reaching ? [] : [{ type: 'user.define_outcome', description: `Get this job done for the owner and report it with the report tool: ${b.objective}`, rubric: { type: 'text', content: rubricFor(b, x) }, max_iterations: 3 }]),
    ],
    overrides: mcp ? { tools: [...agentTools(), ...mcp.toolsets], mcp_servers: mcp.mcp_servers } : null,
    vault_ids: reaching ? [o.vault!] : [],
  };
}

/**
 * What a session that already has the job is told on the next hand-over: the
 * answers and send-backs since it last heard, and the job again as an outcome
 * when the last one ended (interrupted for a question, or graded) — one outcome
 * at a time, and a new one only after the last is over.
 */
export function resumeEvents(b: CommissionBrief, x: Expectations, since: string | null, outcomeActive: boolean, reaching: boolean): Array<Record<string, unknown>> {
  const fresh = b.log.filter((e) => e.kind === 'answered' && (!since || e.at > since));
  const lines = [
    ...fresh.map((e) => `THE OWNER ANSWERED: ${e.summary}`),
    ...(b.checked.length ? ['THE APP SENT YOUR LAST DONE BACK:', ...b.checked.map((c) => `- ${c}`)] : []),
  ];
  const text = lines.length ? `${lines.join('\n')}\n\nCarry on with the job from here. Today is ${b.today}.` : `Carry on with the job from where you are. Today is ${b.today}.`;
  return [
    { type: 'user.message', content: [{ type: 'text', text }] },
    ...(!outcomeActive && !reaching ? [{ type: 'user.define_outcome', description: `Get this job done for the owner and report it with the report tool: ${b.objective}`, rubric: { type: 'text', content: rubricFor(b, x) }, max_iterations: 3 }] : []),
  ];
}

/* ─── Reading a session back ──────────────────────────────────────────────── */

/** The fields of a session event this app reads. Structural, so the pure module needs no SDK. */
export interface SessionEventLike {
  id: string;
  type: string;
  name?: string;
  input?: Record<string, unknown>;
  custom_tool_use_id?: string;
  tool_use_id?: string;
  evaluated_permission?: string;
  mcp_server_name?: string;
  stop_reason?: { type: string; event_ids?: string[] } | null;
  content?: Array<{ type: string; text?: string }>;
  error?: { type?: string; message?: string } | null;
  result?: string;
  processed_at?: string | null;
}

export type StopReason = 'end_turn' | 'requires_action' | 'retries_exhausted' | 'budget_reached' | 'refusal';

export interface SessionRead {
  status: 'running' | 'idle' | 'rescheduling' | 'terminated' | 'unknown';
  stop: StopReason | null;
  /** The idle that stopped it, so one stop is recorded once. */
  idleId: string | null;
  /** Report calls nobody has answered yet. */
  reports: Array<{ id: string; input: unknown }>;
  /** Calls to a tool that is not report: answered with an error so the session is not stuck on them. */
  strays: Array<{ id: string; name: string }>;
  /** Calls through the person's accounts waiting for their OK. */
  asks: Array<{ id: string; tool: string; server: string | null; input: Record<string, unknown> }>;
  /** Paused calls to the session's own web tools: not the person's to judge. */
  webAsks: Array<{ id: string; tool: string }>;
  lastMessage: string | null;
  lastError: string | null;
  /** Whether the session's outcome is still being worked. */
  outcomeActive: boolean;
}

const TERMINAL_OUTCOMES = new Set(['satisfied', 'max_iterations_reached', 'failed', 'interrupted']);

/** A session's events, oldest first, as the state the app acts on. */
export function readSession(events: SessionEventLike[]): SessionRead {
  const answered = new Set(events.filter((e) => e.type === 'user.custom_tool_result').map((e) => e.custom_tool_use_id).filter(Boolean));
  const confirmed = new Set(events.filter((e) => e.type === 'user.tool_confirmation').map((e) => e.tool_use_id).filter(Boolean));
  const out: SessionRead = { status: 'unknown', stop: null, idleId: null, reports: [], strays: [], asks: [], webAsks: [], lastMessage: null, lastError: null, outcomeActive: false };
  let outcomeAt = -1;
  let outcomeEndAt = -1;
  events.forEach((e, i) => {
    switch (e.type) {
      case 'agent.custom_tool_use':
        if (answered.has(e.id)) break;
        if (e.name === REPORT_TOOL) out.reports.push({ id: e.id, input: e.input ?? {} });
        else out.strays.push({ id: e.id, name: e.name ?? 'unknown' });
        break;
      case 'agent.mcp_tool_use':
        if (e.evaluated_permission === 'ask' && !confirmed.has(e.id)) out.asks.push({ id: e.id, tool: e.name ?? 'a tool', server: e.mcp_server_name ?? null, input: e.input ?? {} });
        break;
      case 'agent.tool_use':
        if (e.evaluated_permission === 'ask' && !confirmed.has(e.id)) out.webAsks.push({ id: e.id, tool: e.name ?? 'a tool' });
        break;
      case 'agent.message': {
        const text = (e.content ?? []).filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n').trim();
        if (text) out.lastMessage = text;
        break;
      }
      case 'session.error':
        out.lastError = e.error?.message?.slice(0, 240) ?? e.error?.type ?? 'an error with no message';
        break;
      case 'session.status_running': out.status = 'running'; out.stop = null; out.idleId = null; break;
      case 'session.status_rescheduled': out.status = 'rescheduling'; break;
      case 'session.status_terminated': out.status = 'terminated'; break;
      case 'session.status_idle':
        out.status = 'idle';
        out.stop = (e.stop_reason?.type as StopReason | undefined) ?? 'end_turn';
        out.idleId = e.id;
        break;
      case 'user.define_outcome': outcomeAt = i; break;
      case 'span.outcome_evaluation_end': if (e.result && TERMINAL_OUTCOMES.has(e.result)) outcomeEndAt = i; break;
    }
  });
  out.outcomeActive = outcomeAt > outcomeEndAt;
  return out;
}

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * When a session stopped and the job is still the worker's to finish, the line
 * the app records — so a session that went quiet reads as stopped, with why,
 * and never as "Nothing back yet" forever (invariant 13).
 */
export function sessionEnd(r: SessionRead, job: CommissionStatus, cents: number): CommissionResult | null {
  if (job !== 'active') return null;
  if (r.reports.length || r.asks.length || r.strays.length || r.webAsks.length) return null;
  const blocked = (summary: string, last?: string | null): CommissionResult => ({
    events: [{
      kind: 'blocked', step: null, summary: clip(summary, 300),
      artifact: last ? { kind: 'text', label: 'Its last words', value: clip(last, 4000) } : null,
    }],
    plan: null, claimed: null,
  });
  if (r.status === 'terminated') return blocked(`Its session ended before the job was done${r.lastError ? `: ${r.lastError}` : ''}`, r.lastMessage);
  if (r.status !== 'idle') return null;
  switch (r.stop) {
    case 'budget_reached': return blocked(`It used its ${dollars(cents)} budget before finishing. Trying again gives it a fresh one.`, r.lastMessage);
    case 'retries_exhausted': return blocked(`It gave up on an error${r.lastError ? `: ${r.lastError}` : ''}`, r.lastMessage);
    case 'refusal': return blocked('The model would not carry on with this job.', r.lastMessage);
    case 'end_turn': return blocked('It stopped without reporting the job done', r.lastMessage);
    default: return null;
  }
}

/** What the app answers a report with: what it took, what it checked, and what happens now. */
export function reportReply(o: { accepted: number; status: CommissionStatus; verdict: Verdict | null; final: boolean; breaches: number; refused?: string | null }): string {
  if (o.refused) return `${o.refused} Stop now and end your turn.`;
  const checked = o.verdict ? o.verdict.checks.map((c) => `- ${c.state === 'pass' ? 'passed' : c.state === 'fail' ? 'FAILED' : 'not checked'}: ${c.line}`).join('\n') : '';
  const lines = [o.accepted ? `Recorded ${o.accepted} event${o.accepted === 1 ? '' : 's'}.` : 'Nothing was recorded: every event needs a known kind and a summary.'];
  if (o.breaches) lines.push('It says it did something this job does not allow. The owner has been asked to check. Never do that: describe such steps for the owner instead.');
  if (o.status === 'done') lines.push(`Accepted as done.${checked ? `\nThe app checked it:\n${checked}` : ''}\nThe job is closed. End your turn now.`);
  else if (o.verdict && !o.verdict.passed && !o.final) lines.push(`Your done was sent back. The app checked it:\n${checked}\nFix exactly these:\n${o.verdict.sendBack.map((x) => `- ${x}`).join('\n')}\nThen report done again.`);
  else if (o.verdict && !o.verdict.passed) lines.push(`Your done was sent back again, so it has gone to the owner to decide:\n${checked}\nEnd your turn now.`);
  else if (o.status === 'blocked') lines.push('The job now waits on the owner. Nothing more can happen until they answer. End your turn now; their answer will arrive as a message.');
  else lines.push('Carry on.');
  return lines.join('\n');
}

/** A tool name as words: send_email → "send email". */
export const toolWords = (tool: string) => tool.replace(/^.*__/, '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim() || 'use a tool';

/** The fields a person reads first in a message, in the order they read them. */
const FIRST = ['to', 'cc', 'bcc', 'recipient', 'recipients', 'subject', 'title', 'body', 'text', 'message', 'content'];

/** What a call through an account would do, as the person reads it before saying OK. */
export function askOf(a: SessionRead['asks'][number], account: Pick<Account, 'name'> | null): { summary: string; artifact: { kind: 'message'; label: string; value: string } } {
  const keys = Object.keys(a.input);
  const order = [...FIRST.filter((k) => keys.includes(k)), ...keys.filter((k) => !FIRST.includes(k))];
  const value = order.map((k) => {
    const v = a.input[k];
    const shown = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}: ${shown}`;
  }).join('\n') || '(no details)';
  return {
    summary: clip(`OK to ${toolWords(a.tool)} from ${account?.name ?? a.server ?? 'your account'}?`, 300),
    artifact: { kind: 'message', label: 'What it would do', value: clip(value, 4000) },
  };
}

/**
 * Whether the job goes out with the person's accounts: only a mandate that
 * covers reach, only with an account in their vault. A research mandate never
 * carries them, so nothing it does can go out under their name.
 */
export const reachesWithAccounts = (b: Pick<CommissionBrief, 'may'>, accounts: Account[], vault: string | null) =>
  b.may !== 'read' && accounts.length > 0 && !!vault;
