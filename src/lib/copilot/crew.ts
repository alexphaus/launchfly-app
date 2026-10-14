// src/lib/copilot/crew.ts
// The crew: who works the engine, part by part.
//
// Engine draws the business as five parts (business.ts). This says who does the
// work on each — the app's own agents, a model, and the person — so the screen
// can show a business being run rather than a form being filled in. Its owner
// put the want as "building a startup, automated": later the same parts will be
// worked by newer models, by people taken on for a part, and by machines doing
// physical work. So a worker is described by what it is and what it may do, not
// by which of today's five agents it happens to be, and `person` and `robot`
// are kinds the screen already knows how to draw. The hands a job can be given
// to come from the registry (workers.ts): the Claude agent, the n8n workflow, a
// person or a robot on a webhook — each shown only when it is registered
// (invariant 7), with the record the app counted for it, never one it claimed.
//
// What each worker says is read, never claimed. An agent's state and line are
// the roster's (machine.ts), computed from when it last ran and what it last
// produced; the parts it works are the ones the chain itself names it on
// (BusinessLink.runner), so the crew and the chain cannot disagree about who
// runs what. The person's line is the count of what waits on them.
//
// Pure: no DB import.

import type { BusinessLink, LinkKey } from './business';
import type { Agent, AgentKey } from './machine';
import type { WorkerCard } from './workers';

export const WORKER_KINDS = ['agent', 'model', 'you', 'person', 'robot'] as const;
export type WorkerKind = (typeof WORKER_KINDS)[number];

export const WORKER_KIND_LABEL: Record<WorkerKind, string> = {
  agent: 'AI agent',
  model: 'Model',
  you: 'You',
  person: 'Person',
  robot: 'Robot',
};

export type WorkerState = 'working' | 'waiting' | 'stopped' | 'ready' | 'idle' | 'setup';

/** Every state ships with its word. A coloured dot alone is not a status. */
export const WORKER_STATE_LABEL: Record<WorkerState, string> = {
  working: 'Working',
  waiting: 'Needed',
  stopped: 'Stopped',
  ready: 'Ready',
  idle: 'Idle',
  setup: 'Needs setup',
};

export interface Worker {
  key: string;
  name: string;
  kind: WorkerKind;
  /** What it does, in one line. */
  role: string;
  state: WorkerState;
  /** What it is doing or last did, counted. */
  line: string;
  /** The parts of the engine it works on; empty for one that works across the whole business. */
  parts: LinkKey[];
  /** The roster's agent behind it, for the screen's glyph and where a tap goes. */
  agent: AgentKey | null;
}

export interface CrewInput {
  agents: Agent[];
  links: BusinessLink[];
  /** Everything waiting on the person (today.ts needsYou). */
  asks: number;
  /** What Claude proposed and the person has not kept or dropped (proposals.ts). */
  proposals: number;
  /** The part the running bet is on, and how many live projects are tied to it. */
  bet: { part: LinkKey; projects: number } | null;
  /** The registered hands (workers.ts workerCards). One that is the app's own roster agent is not drawn twice. */
  hired?: WorkerCard[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Where the chain names an agent, by its name: "Scout and Watcher", "Writer drafts, you send". */
const names = (runnerName: string, agentName: string) => new RegExp(`\\b${agentName}\\b`).test(runnerName);

function agentState(a: Agent): WorkerState {
  if (a.state === 'failed') return 'stopped';
  // A Watcher with no source is not trouble: following feeds is optional (business.ts teamLine).
  if (a.state === 'setup' && a.key === 'watcher') return 'idle';
  return a.state;
}

/**
 * The crew, in a fixed order — the agents as the roster lists them, the hands
 * as the registry lists them, then Claude, then the person — so a worker keeps
 * its place on screen from one day to the next and a change of state is the
 * only thing that moves.
 */
export function crewOf(i: CrewInput): Worker[] {
  const agents: Worker[] = i.agents.map((a) => {
    const parts = i.links.filter((l) => l.runner.by !== 'you' && names(l.runner.name, a.name)).map((l) => l.key);
    // The Researcher works whatever it is handed; it is placed on a part only
    // through work tied to the bet on that part, which is a row, not a guess.
    if (a.key === 'researcher' && i.bet && i.bet.projects > 0 && !parts.includes(i.bet.part)) parts.push(i.bet.part);
    return { key: `agent:${a.key}`, name: a.name, kind: 'agent', role: a.role, state: agentState(a), line: a.line, parts, agent: a.key };
  });
  // The hands, after the app's own agents: each registered worker with what it
  // has on now and what it has delivered. Unreachable is a stop, said by name.
  const hired: Worker[] = (i.hired ?? []).filter((h) => !h.agent).map((h) => ({
    key: `hired:${h.key}`, name: h.name, kind: h.kind, role: h.role,
    state: h.record.unreachable ? 'stopped' : h.record.live ? 'working' : 'ready',
    line: h.record.unreachable ? h.line : h.record.live ? `${plural(h.record.live, 'job')} on the go · ${h.line}` : h.line,
    parts: [], agent: null,
  }));
  // The Writer also takes the writing that is handed over, when the app has a model to write it with.
  const writes = (i.hired ?? []).some((h) => h.agent === 'writer');
  for (const a of agents) if (writes && a.agent === 'writer') a.role = 'Drafts openers in your words, and writes what you hand over';
  const claude: Worker = {
    key: 'model:claude', name: 'Claude', kind: 'model', role: 'Thinks it through with your whole record', state: 'ready',
    line: i.proposals ? `${plural(i.proposals, 'proposal')} for you to keep or drop` : 'On call: Ask Claude hands it your record',
    parts: [], agent: null,
  };
  const you: Worker = {
    key: 'you', name: 'You', kind: 'you', role: 'What only you can do: send as yourself, say yes, spend',
    state: i.asks ? 'waiting' : 'ready',
    line: i.asks ? `${plural(i.asks, 'thing')} ${i.asks === 1 ? 'waits' : 'wait'} on you` : 'Nothing waits on you',
    parts: i.links.filter((l) => l.runner.by === 'you' || l.runner.by === 'both').map((l) => l.key),
    agent: null,
  };
  return [...agents, ...hired, claude, you];
}

/** Who works one part: the ones the chain names on it. */
export function crewOn(crew: Worker[], part: LinkKey): Worker[] {
  return crew.filter((w) => w.parts.includes(part));
}

/**
 * The crew as one line: how many are at work, and every one that stopped or
 * waits on setup, by name (invariant 13). The person is not counted as at work:
 * the line is about what runs without them.
 */
export function crewLine(crew: Worker[]): { line: string; trouble: number } {
  const working = crew.filter((w) => w.kind !== 'you' && w.state === 'working').length;
  const trouble = crew.filter((w) => w.state === 'stopped' || w.state === 'setup');
  return {
    line: [working ? `${working} at work` : 'Nothing at work', ...trouble.map((w) => `${w.name} ${w.state === 'stopped' ? 'stopped' : 'needs setup'}`)].join(' · '),
    trouble: trouble.length,
  };
}

/**
 * The crew on the engine itself, where a face per worker leaves room for two
 * short lines: what runs without the person, and what is not well — by name when
 * it is one worker, by count when it is more, with every name on the crew's own
 * sheet a tap away. Several names beside seven faces ran seven lines tall.
 */
export function crewHeadline(crew: Worker[]): { working: string; trouble: string | null } {
  const working = crew.filter((w) => w.kind !== 'you' && w.state === 'working').length;
  const trouble = crew.filter((w) => w.state === 'stopped' || w.state === 'setup');
  return {
    working: working ? `${working} at work` : 'Nothing at work',
    trouble: trouble.length === 1
      ? `${trouble[0].name} ${trouble[0].state === 'stopped' ? 'stopped' : 'needs setup'}`
      : trouble.length > 1 ? `${trouble.length} need a look` : null,
  };
}
