// src/lib/copilot/workers.ts
// Who can be handed a job, which one gets it, and what each has delivered.
//
// There was one worker: whatever COPILOT_JOBS_URL named. Every mandate went to
// it, so a writing job went to a browsing agent, nothing could be compared with
// anything, and the only way to try a better model was to repoint the URL and
// lose the old one's record with it. The owner put the want as "it gets more
// done as newer things come" — newer models, other agents, a person taken on
// for a part, later a machine — and none of that fits behind one URL.
//
// So a worker is an entry, and an entry says three things the app needs before
// it hands anything over: what kind of hands they are, which kinds of job they
// take, and the highest ring they may be handed (`maxRing`). The contract is the
// same for every one of them — the brief out, events back, and the app, not the
// worker, deciding what the job now is (invariant 10). A person is held to it
// exactly as an agent is.
//
// What a worker has delivered is read off the app's own rows — dispatches,
// checks, closes, the worth the person gave — never off anything the worker
// said about itself. That record is what routing uses when nothing else decides,
// and what the crew shows.
//
// Pure: no DB import. store.ts reads the rows; jobs/commission.ts dispatches.

import { AUTHORITIES, AUTHORITY, type Authority, type Commission, type CommissionStatus } from './commission';
import { JOB_KIND_LABEL, JOB_KINDS, type JobKind } from './contract';
import type { WorkerKind } from './crew';

export const WORKER_VIAS = ['webhook', 'managed', 'inapp'] as const;
export type WorkerVia = (typeof WORKER_VIAS)[number];

/** The kinds of hands. `you` is not one: the person is never handed their own job. */
export const HIRED_KINDS = ['agent', 'model', 'person', 'robot'] as const;
export type HiredKind = (typeof HIRED_KINDS)[number] & WorkerKind;

export interface WorkerSpec {
  /** Stable: dispatches are recorded against it, so renaming one keeps its record. */
  key: string;
  name: string;
  kind: HiredKind;
  via: WorkerVia;
  takes: JobKind[];
  /**
   * The highest ring this worker may be handed. A mandate granted more than
   * this does not go to it — handing it the brief would tell it it may do what
   * it is not trusted to (`may` in the brief). Granting a ring is still not
   * acting in it: canAct decides what runs by itself, for every worker.
   */
  maxRing: Authority;
  /** What it is, in one line, for the crew. */
  role: string;
  /** webhook: where the brief is POSTed. */
  url?: string;
  /** The env var holding the bearer it is called with. A name, never the value: this list is shown. */
  secretEnv?: string;
  /** The env var holding the bearer its post-backs carry. Absent: the shared COPILOT_INBOUND_SECRET. */
  inboundSecretEnv?: string;
  /** managed: the agent and environment it runs as. */
  agentId?: string;
  environmentId?: string;
  /** The app's own roster agent this worker is, so the crew does not draw it twice. */
  agent?: 'writer';
}

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

const isLocal = (u: URL) => u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';

/** https, or http on this machine — a brief carries the person's working file. */
export function workerUrlOk(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || (u.protocol === 'http:' && isLocal(u));
  } catch {
    return false;
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const envName = (v: unknown) => (typeof v === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(v) ? v : undefined);

/**
 * One entry of COPILOT_WORKERS, or why it was refused. Refused rather than
 * repaired: a worker registered with a typo in its ring must not be quietly
 * handed more than was meant.
 */
export function workerFrom(raw: unknown, at: number): { worker: WorkerSpec } | { problem: string } {
  const where = `COPILOT_WORKERS entry ${at + 1}`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { problem: `${where} is not an object` };
  const r = raw as Record<string, unknown>;
  const key = typeof r.key === 'string' ? r.key.trim().toLowerCase() : '';
  if (!KEY_RE.test(key)) return { problem: `${where}: key must be lowercase letters, digits, - or _` };
  const name = str(r.name, 40);
  if (!name) return { problem: `${where} (${key}): it needs a name` };
  if (!(HIRED_KINDS as readonly string[]).includes(r.kind as string)) return { problem: `${where} (${key}): kind must be one of ${HIRED_KINDS.join(', ')}` };
  const via = (r.via ?? 'webhook') as WorkerVia;
  if (via !== 'webhook' && via !== 'managed') return { problem: `${where} (${key}): via must be webhook or managed` };
  const takes = Array.isArray(r.takes) ? r.takes : ['research'];
  if (!takes.length || takes.some((t) => !(JOB_KINDS as readonly string[]).includes(t as string))) return { problem: `${where} (${key}): takes must list ${JOB_KINDS.join(' and/or ')}` };
  const maxRing = (r.max_ring ?? 'read') as Authority;
  if (!(AUTHORITIES as readonly string[]).includes(maxRing)) return { problem: `${where} (${key}): max_ring must be one of ${AUTHORITIES.join(', ')}` };
  const base = {
    key, name, kind: r.kind as HiredKind, via, takes: [...new Set(takes as JobKind[])], maxRing,
    role: str(r.role, 80) ?? (r.kind === 'person' ? 'Takes the jobs handed to them' : r.kind === 'robot' ? 'Does physical work it is handed' : 'Takes the jobs handed to it'),
  };
  if (via === 'webhook') {
    if (!workerUrlOk(r.url)) return { problem: `${where} (${key}): url must be https` };
    return { worker: { ...base, url: r.url as string, secretEnv: envName(r.secret_env), inboundSecretEnv: envName(r.inbound_secret_env) } };
  }
  const agentId = str(r.agent_id, 80);
  const environmentId = str(r.environment_id, 80);
  if (!agentId || !environmentId) return { problem: `${where} (${key}): a managed worker needs agent_id and environment_id` };
  return { worker: { ...base, agentId, environmentId } };
}

export interface Registry {
  workers: WorkerSpec[];
  /** Entries refused, said where the crew is (invariant 13). */
  problems: string[];
  /** Workers being compared on the person's own jobs: new jobs alternate between them. */
  compare: string[];
}

/**
 * Everything that can be handed a job on this deployment.
 *
 * The built-ins first, in the order a job of each kind should prefer them when
 * no record says otherwise: the app's own Writer for writing (it holds the
 * person's words already and costs one call), the Claude agent, then the n8n
 * worker COPILOT_JOBS_URL has always named — which keeps working untouched,
 * with its own record from here on. Then whatever COPILOT_WORKERS adds.
 */
export function registryFrom(env: Record<string, string | undefined>, opts: { llm: boolean }): Registry {
  const workers: WorkerSpec[] = [];
  const problems: string[] = [];
  const add = (w: WorkerSpec) => {
    if (workers.some((x) => x.key === w.key)) problems.push(`Two workers are registered as "${w.key}"; the second was left out`);
    else workers.push(w);
  };

  if (opts.llm) {
    add({
      key: 'writer', name: 'Writer', kind: 'model', via: 'inapp', takes: ['write'], maxRing: 'read',
      role: 'Writes what you hand over, in your words', agent: 'writer',
    });
  }
  if (env.ANTHROPIC_API_KEY && env.COPILOT_MANAGED_AGENT_ID && env.COPILOT_MANAGED_ENVIRONMENT_ID) {
    add({
      key: 'claude', name: 'Claude agent', kind: 'agent', via: 'managed', takes: ['research', 'write'],
      // Reach because it can send from the person's own account through a vault,
      // one OK at a time. Without an account the reach part still comes back as
      // theirs: maxRing is what it may be handed, not what it does alone.
      maxRing: 'reach',
      role: 'Researches on the live web and reports back with sources',
      agentId: env.COPILOT_MANAGED_AGENT_ID, environmentId: env.COPILOT_MANAGED_ENVIRONMENT_ID,
    });
  }
  if (env.COPILOT_JOBS_URL) {
    if (workerUrlOk(env.COPILOT_JOBS_URL)) {
      add({
        key: 'n8n', name: 'n8n worker', kind: 'agent', via: 'webhook', takes: ['research', 'write'], maxRing: 'read',
        role: 'Your own workflow: researches and reports back', url: env.COPILOT_JOBS_URL,
        secretEnv: 'COPILOT_JOBS_SECRET',
      });
    } else {
      problems.push('COPILOT_JOBS_URL is not an https address, so nothing is sent to it');
    }
  }

  const raw = env.COPILOT_WORKERS?.trim();
  if (raw) {
    let list: unknown;
    try { list = JSON.parse(raw); } catch { list = null; }
    if (!Array.isArray(list)) problems.push('COPILOT_WORKERS is not a JSON list, so none of it was read');
    else list.forEach((entry, i) => {
      const r = workerFrom(entry, i);
      if ('problem' in r) problems.push(r.problem);
      else add(r.worker);
    });
  }

  const compare = (env.COPILOT_COMPARE ?? '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  const known = compare.filter((k) => workers.some((w) => w.key === k));
  if (compare.length && known.length < 2) problems.push(`COPILOT_COMPARE needs two registered workers; ${known.length ? `only "${known[0]}" is` : 'none of those are'}`);
  return { workers, problems, compare: known.length >= 2 ? known : [] };
}

/* ─── The record ──────────────────────────────────────────────────────────── */

/** One hand-over, as recorded (a `commission_dispatch` event). */
export interface Dispatch {
  commission_id: string;
  worker: string;
  job: JobKind;
  /** Whether it reached the worker. A dispatch that never got there is not work, and is said. */
  ok: boolean;
  error: string | null;
  /** The Claude agent's session, when that is where it went: the job continues there. */
  session: string | null;
  at: string;
}

export interface WorkerRecord {
  /** Jobs it has had, counted once each however many times they were handed back. */
  handed: number;
  /** Closed as done. Every done passed the app's checks, or it would not have closed. */
  done: number;
  /** Jobs it reported done that the app sent back at least once. */
  sentBack: number;
  /** Jobs the person called off while it had them. */
  stopped: number;
  /** Jobs the person said were worth something when they closed them. */
  worth: number;
  /** Live jobs it has now. */
  live: number;
  /** Why the newest hand-over did not reach it, when that is newer than its last one that did. */
  unreachable: string | null;
}

export interface RecordInput {
  dispatches: Dispatch[];
  commissions: Array<Pick<Commission, 'id' | 'status'>>;
  /** Commission ids with a done the app sent back. */
  sentBack: ReadonlySet<string>;
  /** commission id → what the person said it was worth, when they said. */
  worth: ReadonlyMap<string, string>;
}

const empty = (): WorkerRecord => ({ handed: 0, done: 0, sentBack: 0, stopped: 0, worth: 0, live: 0, unreachable: null });

/**
 * Each worker's record, from the app's rows.
 *
 * A job belongs to the worker its newest successful hand-over went to: a job
 * that moved from one worker to another is the second one's to finish, and
 * counting it twice would credit both with one result.
 */
export function recordsOf(i: RecordInput): Record<string, WorkerRecord> {
  const out: Record<string, WorkerRecord> = {};
  const rec = (k: string) => (out[k] ??= empty());
  const newest = [...i.dispatches].sort((a, b) => b.at.localeCompare(a.at));
  const owner = new Map<string, string>();
  for (const d of newest) if (d.ok && !owner.has(d.commission_id)) owner.set(d.commission_id, d.worker);

  const status = new Map<string, CommissionStatus>(i.commissions.map((c) => [c.id, c.status]));
  for (const [id, worker] of owner) {
    const r = rec(worker);
    const s = status.get(id);
    if (!s) continue;
    r.handed += 1;
    if (s === 'done') r.done += 1;
    if (s === 'stopped') r.stopped += 1;
    if (s === 'active' || s === 'blocked') r.live += 1;
    if (i.sentBack.has(id)) r.sentBack += 1;
    const w = i.worth.get(id);
    if (w && w !== 'nothing') r.worth += 1;
  }
  // The newest attempt per worker decides whether it is reachable now.
  const seen = new Set<string>();
  for (const d of newest) {
    if (seen.has(d.worker)) continue;
    seen.add(d.worker);
    if (!d.ok) rec(d.worker).unreachable = d.error ?? 'It did not answer';
  }
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The record as one line: counts, never adjectives. */
export function recordLine(r: WorkerRecord | undefined): string {
  if (!r || !r.handed) return 'Nothing handed to it yet';
  return [
    `${plural(r.handed, 'job')} handed`,
    `${r.done} done`,
    ...(r.sentBack ? [`${r.sentBack} sent back`] : []),
    ...(r.worth ? [`${r.worth} worth something`] : []),
  ].join(' · ');
}

/* ─── Who gets it ─────────────────────────────────────────────────────────── */

const rank = (a: Authority) => AUTHORITIES.indexOf(a);

/** Whether this worker may be handed this job at all. */
export const canTake = (w: WorkerSpec, job: JobKind, granted: Authority) => w.takes.includes(job) && rank(w.maxRing) >= rank(granted);

/** A stable 32-bit hash, so the same job lands on the same side of a comparison every time. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type PickReason = 'assigned' | 'sticky' | 'compare' | 'record' | 'only';
export type Picked = { worker: WorkerSpec; why: PickReason } | { worker: null; why: string };

export interface PickInput {
  commission: Pick<Commission, 'id' | 'authority'>;
  job: JobKind;
  registry: Registry;
  /** Who the person chose for it, if they did. */
  assigned: string | null;
  /** Who it was last handed to. */
  last: string | null;
  records: Record<string, WorkerRecord>;
}

/**
 * Which worker gets this job, in a fixed order of reasons:
 *
 *   1. the one the person chose, when it may take the job
 *   2. the one it was last handed to — a question answered goes back to whoever
 *      asked it, and the Claude agent's session still holds what it read
 *   3. a comparison, when one is set: new jobs split between the workers named,
 *      by the job's id, so each gets a share of the person's own work and the
 *      record says which delivers
 *   4. the best record: done out of handed, with one of each assumed, so a new
 *      worker is not ranked above a proven one on no evidence, nor buried
 *   5. the registry's order
 *
 * None may take it: the reason, said on the job's card instead of the job
 * waiting for a worker that will never come.
 */
export function pickWorker(i: PickInput): Picked {
  const eligible = i.registry.workers.filter((w) => canTake(w, i.job, i.commission.authority));
  if (!eligible.length) {
    const takers = i.registry.workers.filter((w) => w.takes.includes(i.job));
    if (takers.length) {
      return { worker: null, why: `No worker here may be handed "${AUTHORITY[i.commission.authority].label}" work — the most any of them takes is "${AUTHORITY[takers.map((w) => w.maxRing).sort((a, b) => rank(b) - rank(a))[0]].label}".` };
    }
    return {
      worker: null,
      why: i.job === 'write'
        ? 'Nothing here takes writing: the app needs a model (COPILOT_AI_API_KEY) to write it.'
        : 'Nothing here takes research: connect a worker (the Claude agent, or COPILOT_JOBS_URL).',
    };
  }
  const byKey = (k: string | null) => (k ? eligible.find((w) => w.key === k) ?? null : null);
  const assigned = byKey(i.assigned);
  if (assigned) return { worker: assigned, why: 'assigned' };
  const last = byKey(i.last);
  if (last) return { worker: last, why: 'sticky' };
  const comparing = eligible.filter((w) => i.registry.compare.includes(w.key));
  if (comparing.length >= 2) return { worker: comparing[hash(i.commission.id) % comparing.length], why: 'compare' };
  if (eligible.length === 1) return { worker: eligible[0], why: 'only' };
  const score = (w: WorkerSpec) => {
    const r = i.records[w.key];
    return ((r?.done ?? 0) + 1) / ((r?.handed ?? 0) + 2);
  };
  const best = [...eligible].sort((a, b) => score(b) - score(a))[0];
  return { worker: best, why: 'record' };
}

/** The workers a person may choose from for a job of this kind and ring, for the composer. */
export const choosable = (r: Registry, job: JobKind, granted: Authority) => r.workers.filter((w) => canTake(w, job, granted));

/** What is being compared, as one line for the crew: each side's record. */
export function compareLine(r: Registry, records: Record<string, WorkerRecord>): string | null {
  if (r.compare.length < 2) return null;
  return r.compare
    .map((k) => r.workers.find((w) => w.key === k))
    .filter((w): w is WorkerSpec => !!w)
    .map((w) => `${w.name}: ${recordLine(records[w.key])}`)
    .join(' — ');
}

/** What a worker takes, in words: "Research and writing, up to Contact people". */
export function takesLine(w: WorkerSpec): string {
  const kinds = w.takes.map((k) => JOB_KIND_LABEL[k]).join(' and ').toLowerCase();
  return `${kinds.charAt(0).toUpperCase()}${kinds.slice(1)}, up to ${AUTHORITY[w.maxRing].label.toLowerCase()}`;
}

/** What the screen is told about a worker: never a URL, a secret's name or an id. */
export interface WorkerCard {
  key: string;
  name: string;
  kind: HiredKind;
  role: string;
  takes: string;
  /** The kinds of job it takes and the most it may be handed, for the composer to say who would take a job. */
  jobs: JobKind[];
  maxRing: Authority;
  /** The app's own roster agent this is, when it is one. */
  agent: 'writer' | null;
  record: WorkerRecord;
  line: string;
}

export function workerCards(r: Registry, records: Record<string, WorkerRecord>): WorkerCard[] {
  return r.workers.map((w) => ({
    key: w.key, name: w.name, kind: w.kind, role: w.role, takes: takesLine(w), jobs: w.takes, maxRing: w.maxRing, agent: w.agent ?? null,
    record: records[w.key] ?? empty(),
    line: records[w.key]?.unreachable ? `Not reached: ${records[w.key]!.unreachable!.slice(0, 120)}` : recordLine(records[w.key]),
  }));
}

/** Who would take a job of this kind and ring, as the composer says it before anything is written. */
export function takerOf(cards: Array<Pick<WorkerCard, 'name' | 'jobs' | 'maxRing' | 'agent'>>, job: JobKind, granted: Authority): Pick<WorkerCard, 'name' | 'agent'> | null {
  return cards.find((w) => w.jobs.includes(job) && rank(w.maxRing) >= rank(granted)) ?? null;
}
