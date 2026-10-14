// src/lib/copilot/managed.ts
// The Claude agent, as a worker: a Managed Agents session per job.
//
// Everything about what the agent may do and what counts as done is decided in
// managedwire.ts (the wire) and deliver.ts (the door). This file only talks to
// the API: it opens a session, tells a session that already has the job what
// changed, reads a session back and answers what is waiting in it, and passes
// the person's OK or no on a call through their account.
//
// The session is where the job lives while it runs, and Anthropic only tells
// this app that something happened, never what (webhooks are thin, and can be
// dropped). So every path — the webhook, the nightly pass, a tap — ends in the
// same `syncSession`, which reads the session's own event list and acts on what
// is unanswered in it. That list is the record of what was answered, so running
// it twice answers nothing twice.

import Anthropic from '@anthropic-ai/sdk';
import type { SessionCreateParams } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import type { EventSendParams } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { normalizeResult, type Commission, type CommissionBrief, type CommissionStatus } from './commission';
import type { Account } from './accounts';
import type { Expectations } from './contract';
import { acceptWork } from './deliver';
import { askOf, readSession, reachesWithAccounts, reportReply, resumeEvents, sessionEnd, sessionPlan, type SessionEventLike, type SessionRead } from './managedwire';
import { insertAnswered, unblockCommission } from './store';
import type { WorkerSpec } from './workers';
import { WORK_REPORT, WORK_SESSION_END, WORK_TOOL_ANSWER, WORK_TOOL_ASK, type ToolAsk, type WorkLog } from './worklog';
import { recordWork } from './workstore';

/** Whether this deployment can reach Managed Agents at all. */
export const managedKey = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
/**
 * One client per process. COPILOT_ANTHROPIC_BASE_URL points it at a stand-in,
 * the way COPILOT_FX_URL does for rates — its own variable, so pointing this at
 * a test server cannot move any other Anthropic call this deployment makes.
 */
export function managedClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set, so the Claude agent cannot be reached.');
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.COPILOT_ANTHROPIC_BASE_URL || undefined,
    maxRetries: 2,
    timeout: 30_000,
  });
  return client;
}

/** Everything a session has said, oldest first. Capped: a job's session is not a novel. */
export async function sessionEvents(sessionId: string, cap = 5000): Promise<SessionEventLike[]> {
  const out: SessionEventLike[] = [];
  for await (const e of managedClient().beta.sessions.events.list(sessionId, { order: 'asc', limit: 1000 })) {
    out.push(e as unknown as SessionEventLike);
    if (out.length >= cap) break;
  }
  return out;
}

const send = (sessionId: string, events: Array<Record<string, unknown>>) =>
  managedClient().beta.sessions.events.send(sessionId, { events } as unknown as EventSendParams);

/** A new session for a job. Returns its id, which every later step of the job is keyed by. */
export async function startSession(spec: WorkerSpec, brief: CommissionBrief, x: Expectations, o: { cents: number; accounts: Account[]; vault: string | null }): Promise<string> {
  if (!spec.agentId || !spec.environmentId) throw new Error(`${spec.name} has no agent or environment to run as.`);
  const plan = sessionPlan(brief, x, { cents: o.cents, accounts: o.accounts, vault: o.vault, worker: spec.key });
  const params = {
    // The latest version of the agent unless the job needs its own tools: an
    // account's tools are the session's alone, never written onto the agent.
    agent: plan.overrides
      ? { type: 'agent_with_overrides', id: spec.agentId, tools: plan.overrides.tools, mcp_servers: plan.overrides.mcp_servers }
      : spec.agentId,
    environment_id: spec.environmentId,
    title: plan.title,
    metadata: plan.metadata,
    budget: plan.budget,
    initial_events: plan.initial_events,
    ...(plan.vault_ids.length ? { vault_ids: plan.vault_ids } : {}),
  };
  const session = await managedClient().beta.sessions.create(params as unknown as SessionCreateParams);
  return session.id;
}

export type Resumed = 'sent' | 'busy' | 'ended';

/**
 * Tell a session that already has the job what changed since it last heard.
 *
 * `busy` is a session at work, or one waiting on an answer this app owes it —
 * a user.message is refused there, and the sync answers it instead. `ended` is
 * a session that cannot go on (over, or at its budget, which only a new budget
 * moves): the caller opens a new one, and the job's log carries the history.
 */
export async function resumeSession(sessionId: string, brief: CommissionBrief, x: Expectations, since: string | null, o: { accounts: Account[]; vault: string | null }): Promise<Resumed> {
  const read = readSession(await sessionEvents(sessionId));
  if (read.status === 'terminated') return 'ended';
  if (read.status === 'running' || read.status === 'rescheduling') return 'busy';
  if (read.status === 'idle' && read.stop === 'budget_reached') return 'ended';
  if (read.status === 'idle' && read.stop === 'requires_action') return 'busy';
  await send(sessionId, resumeEvents(brief, x, since, read.outcomeActive, reachesWithAccounts(brief, o.accounts, o.vault)));
  return 'sent';
}

/** Sessions being read right now, so a webhook and the nightly pass do not answer one report twice. */
const syncing = new Set<string>();
/** Sessions asked for again while being read: read once more when the current read ends, so what arrived meanwhile is not left for the next night. */
const again = new Set<string>();

export interface Synced {
  status: CommissionStatus;
  /** Reports taken, calls raised to the person, stops recorded. */
  took: number;
  notes: string[];
}

/**
 * Read a session and answer everything waiting in it.
 *
 *   report calls   → through the door (acceptWork), answered with what the app
 *                    accepted and checked; a closed or blocked job is also
 *                    interrupted, so the agent does not keep spending on it
 *   account calls  → a question for the person, once each: "OK to send email
 *                    from My Gmail?", with what it would send
 *   web calls the server could not judge → refused: not the person's to judge,
 *                    and nobody is watching
 *   a stop with the job unfinished → recorded once, with why (invariant 13)
 */
export async function syncSession(profileId: string, c: Commission, sessionId: string, o: { log: WorkLog; accounts: Account[]; cents: number; deadline?: number }): Promise<Synced> {
  if (syncing.has(sessionId)) {
    again.add(sessionId);
    return { status: c.status, took: 0, notes: [] };
  }
  syncing.add(sessionId);
  try {
    let current = c;
    const total: Synced = { status: c.status, took: 0, notes: [] };
    // At most a few rounds: each answers what was waiting, and a session that
    // keeps producing faster than this reads is read again by its next webhook.
    for (let round = 0; round < 3; round++) {
      again.delete(sessionId);
      const r = await syncOnce(profileId, current, sessionId, o);
      current = { ...current, status: r.status };
      total.status = r.status; total.took += r.took; total.notes.push(...r.notes);
      if (!again.has(sessionId)) break;
    }
    return total;
  } finally {
    syncing.delete(sessionId);
    again.delete(sessionId);
  }
}

async function syncOnce(profileId: string, c: Commission, sessionId: string, o: { log: WorkLog; accounts: Account[]; cents: number; deadline?: number }): Promise<Synced> {
  const read: SessionRead = readSession(await sessionEvents(sessionId));
  let current: Commission = c;
  let took = 0;
  const notes: string[] = [];
  const askEach = o.accounts.length > 0 && current.authority !== 'read';
  // Reach can have happened only through an account the person said OK on.
  const mayClaim = askEach ? (['read', 'reach'] as const) : (['read'] as const);

  for (const r of read.reports) {
    const kept = o.log.reports.get(r.id);
    if (kept !== undefined) {
      // Taken before and the answer never landed: send the same answer, record nothing twice.
      await send(sessionId, [{ type: 'user.custom_tool_result', custom_tool_use_id: r.id, content: [{ type: 'text', text: kept || 'Recorded.' }] }]);
      continue;
    }
    let reply: string;
    let stop = false;
    if (current.status === 'draft' || current.status === 'stopped' || current.status === 'done') {
      reply = reportReply({ accepted: 0, status: current.status, verdict: null, final: false, breaches: 0, refused: current.status === 'done' ? 'This job is already closed.' : `This job is ${current.status === 'stopped' ? 'called off' : 'not approved'} and is not taking work.` });
      stop = true;
    } else {
      const acc = await acceptWork(profileId, current, normalizeResult(r.input), { log: o.log, askEach, mayClaim, deadline: o.deadline });
      current = { ...current, status: acc.status };
      if (acc.note) notes.push(acc.note);
      reply = reportReply({ accepted: acc.accepted, status: acc.status, verdict: acc.verdict, final: acc.final, breaches: acc.breaches });
      stop = acc.status === 'done' || acc.status === 'blocked';
      took += 1;
    }
    // Kept before it is sent: a send that fails is retried with this same text.
    try { await recordWork(profileId, WORK_REPORT, { commission_id: c.id, session: sessionId, tool_use_id: r.id, reply: reply.slice(0, 4000) }); }
    catch (e) { notes.push(e instanceof Error ? e.message : String(e)); }
    o.log.reports.set(r.id, reply);
    await send(sessionId, [
      { type: 'user.custom_tool_result', custom_tool_use_id: r.id, content: [{ type: 'text', text: reply }] },
      // Closed, or waiting on the person: stop the turn, and with it the outcome's
      // grader, rather than let it revise work nobody is waiting for.
      ...(stop ? [{ type: 'user.interrupt' }] : []),
    ]);
  }

  if (read.strays.length) {
    await send(sessionId, read.strays.map((t) => ({
      type: 'user.custom_tool_result', custom_tool_use_id: t.id, is_error: true,
      content: [{ type: 'text', text: `There is no tool called ${t.name} here. Report your work with the report tool.` }],
    })));
  }

  if (read.webAsks.length) {
    await send(sessionId, read.webAsks.map((t) => ({
      type: 'user.tool_confirmation', tool_use_id: t.id, result: 'deny',
      deny_message: 'Not approved: nobody is watching this job to judge a paused web call. Use another source.',
    })));
  }

  const asked = new Set([...o.log.asks.values()].flat().map((a) => a.tool_use_id));
  for (const a of read.asks) {
    if (asked.has(a.id) || o.log.askIds.has(a.id)) continue;
    const account = o.accounts.find((x) => x.slug === a.server) ?? null;
    const { summary, artifact } = askOf(a, account);
    const acc = await acceptWork(profileId, current, { events: [{ kind: 'needs_you', step: null, summary, artifact }], plan: null, claimed: null }, { log: o.log });
    current = { ...current, status: acc.status };
    const row = {
      commission_id: c.id, session: sessionId, tool_use_id: a.id, event_id: acc.events[0]?.id ?? null,
      tool: a.tool.slice(0, 80), account: (account?.name ?? a.server ?? '').slice(0, 80) || null,
    };
    await recordWork(profileId, WORK_TOOL_ASK, row);
    // Into the log as it is held: one call is one question, however many times this session is read.
    o.log.askIds.add(a.id);
    o.log.asks.set(c.id, [...(o.log.asks.get(c.id) ?? []), { ...row, at: new Date().toISOString() }]);
    took += 1;
  }

  const end = sessionEnd(read, current.status, o.cents);
  const endKey = read.status === 'terminated' ? `terminated:${sessionId}` : read.idleId;
  if (end && endKey && !o.log.ends.has(endKey)) {
    const acc = await acceptWork(profileId, current, end, { log: o.log });
    current = { ...current, status: acc.status };
    await recordWork(profileId, WORK_SESSION_END, { commission_id: c.id, session: sessionId, idle_id: endKey });
    o.log.ends.add(endKey);
    took += 1;
  }
  return { status: current.status, took, notes };
}

/**
 * The person's OK or no on one call through their account.
 *
 * The answer goes to the session first, then the record, then the job: if the
 * session refuses it (the call was already settled, or the session ended), the
 * person is told and nothing is recorded as answered that was not. The job is
 * cleared only when no other call of it is still waiting — a job that sent two
 * messages at once has two OKs to give.
 */
export async function answerAsk(profileId: string, c: Commission, ask: ToolAsk, allow: boolean, note: string | null, stillWaiting: number): Promise<void> {
  await send(ask.session, [{
    type: 'user.tool_confirmation', tool_use_id: ask.tool_use_id, result: allow ? 'allow' : 'deny',
    ...(allow ? {} : { deny_message: `The owner said no${note ? `: ${note}` : '.'}` }),
  }]);
  await recordWork(profileId, WORK_TOOL_ANSWER, { commission_id: c.id, tool_use_id: ask.tool_use_id, allow });
  const said = allow ? `OK — go ahead (${ask.tool.replace(/[_-]+/g, ' ')})` : `No${note ? `: ${note}` : ''}`;
  if (stillWaiting > 0) await insertAnswered(profileId, c.id, said);
  else await unblockCommission(profileId, c.id, said);
}

/**
 * Stop the agent on a job the person closed. Interrupt, then archive when it has
 * settled: an agent left running on a called-off job spends on work nobody will
 * read. Returns why it could not be told, for the screen to say.
 */
export async function stopSession(sessionId: string): Promise<string | null> {
  let s: Awaited<ReturnType<ReturnType<typeof managedClient>['beta']['sessions']['retrieve']>>;
  try {
    s = await managedClient().beta.sessions.retrieve(sessionId);
  } catch (e) {
    return `the Claude agent could not be reached to stop it: ${e instanceof Error ? e.message : String(e)}`;
  }
  // Over already, or put away: nothing is spending, and saying it could not be
  // stopped would be a false alarm on every job closed after the agent finished.
  if (s.status === 'terminated' || s.archived_at) return null;
  if (s.status === 'running' || s.status === 'rescheduling') {
    try {
      await send(sessionId, [{ type: 'user.interrupt' }]);
    } catch (e) {
      return `the Claude agent could not be told to stop: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  // Archiving waits for the interrupt to land; a session still running refuses
  // it, and an interrupted session idles without spending, so that is fine.
  for (let i = 0; i < 5; i++) {
    const now = i === 0 && s.status === 'idle' ? s : await managedClient().beta.sessions.retrieve(sessionId).catch(() => null);
    if (now && now.status !== 'running') { await managedClient().beta.sessions.archive(sessionId).catch(() => null); break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

/** The commission a session is for, from its own metadata. */
export async function sessionCommission(sessionId: string): Promise<string | null> {
  const s = await managedClient().beta.sessions.retrieve(sessionId);
  const id = s.metadata?.commission_id;
  return typeof id === 'string' && id ? id : null;
}
