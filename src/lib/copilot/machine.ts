// src/lib/copilot/machine.ts
// The path to money and the team, on You: the business drawn as the machine it
// is, and the agents that run parts of it.
//
// What was asked for, in its owner's words: "the system or business the user is
// working on … steps, processes, how the business is formed … see the path to
// money … employees/AI agents that do work … not another n8n, just an
// illustration". So this is an illustration with one rule behind it: every
// stage and every agent is drawn from rows. A stage shows the count the funnel
// already computes; an agent's state comes from when it last actually ran and
// what it last actually produced. Nothing is a mock-up of a system the app does
// not have — a Scout that has never run says so, and a Researcher with no
// worker connected says "needs setup" rather than looking busy.
//
// Four stages, not the funnel's six. The funnel is a measurement; this is the
// shape of the business — find someone, reach them, turn them into a
// conversation, get paid — with who does each part. That is what makes it
// something being built rather than a report being read.
//
// Pure: no DB import.

import { blockedOn } from './commission';
import type { FunnelStage } from './diagnose';
import type { CommissionThread } from './types';

export type StageKey = 'find' | 'reach' | 'convert' | 'paid';
export type Owner = 'ai' | 'you' | 'both';

export interface MachineStage {
  key: StageKey;
  label: string;
  owner: Owner;
  /** Who runs it, in words: "Scout", "Writer drafts, you send". */
  who: string;
  count: number;
  /** "243 found" — the count and what it counts. */
  countLabel: string;
  detail: string;
  /**
   * Set on the one stage where most is lost, with the count that proves it.
   * The funnel's bottleneck, placed on the part of the business it belongs to.
   */
  weak: string | null;
}

export interface MachineInput {
  stages: FunnelStage[];
  bottleneck: FunnelStage | null;
  outsideFunnel: number;
  segments: string[];
  area: string | null;
  queueCount: number;
  wonAmount: number;
  currency: string;
  /** The primary currency goal, when there is one. */
  goal: { title: string; target: number | null; current: number | null } | null;
  /** The web is searched too, from the offer. Find is not only Maps, and the stage says so. */
  web?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const money = (n: number, c: string) => `${c}${Math.round(n).toLocaleString('en-US')}`;

/**
 * Which part of the business a funnel bottleneck belongs to. The bottleneck is
 * named for the stage the count arrives AT, so "sent" being worst means most
 * stopped at drafted — a reach problem — and "replied" being worst means the
 * messages went out and nobody answered, which is where conversion starts.
 */
const STAGE_OF_BOTTLENECK: Record<FunnelStage['key'], StageKey> = {
  matched: 'find', drafted: 'reach', sent: 'reach', replied: 'convert', meeting: 'convert', won: 'paid',
};

export function businessMachine(input: MachineInput): MachineStage[] {
  const at = (k: FunnelStage['key']) => input.stages.find((s) => s.key === k)?.count ?? 0;
  const matched = at('matched');
  const drafted = at('drafted');
  const sent = at('sent');
  const replied = at('replied');
  const meetings = at('meeting');
  const won = at('won');

  let weakAt: StageKey | null = null;
  let weak: string | null = null;
  if (input.bottleneck) {
    const i = input.stages.findIndex((s) => s.key === input.bottleneck!.key);
    const prev = i > 0 ? input.stages[i - 1] : null;
    if (prev && prev.count > input.bottleneck.count) {
      weakAt = STAGE_OF_BOTTLENECK[input.bottleneck.key];
      weak = `${prev.count - input.bottleneck.count} of ${prev.count} stopped at ${prev.label.toLowerCase()} — most is lost here`;
    }
  }

  const segs = input.segments.length
    ? `${input.segments.slice(0, 2).join(', ')}${input.segments.length > 2 ? ` +${input.segments.length - 2}` : ''}`
    : 'No segments set';
  const goal = input.goal?.target
    ? `${input.goal.title}: ${money(input.goal.current ?? 0, input.currency)} of ${money(input.goal.target, input.currency)}`
    : null;

  const stage = (s: Omit<MachineStage, 'weak'>): MachineStage => ({ ...s, weak: weakAt === s.key ? weak : null });
  return [
    stage({
      key: 'find', label: 'Find', owner: 'ai', who: 'Scout',
      count: matched, countLabel: `${matched} found`,
      detail: [
        input.segments.length ? `${segs}${input.area ? ` in ${input.area}` : ''}` : null,
        input.web ? (input.segments.length ? 'and the web' : 'The web, from what you sell') : null,
        !input.segments.length && !input.web ? 'Nothing to search yet' : null,
      ].filter(Boolean).join(' · '),
    }),
    stage({
      key: 'reach', label: 'Reach', owner: 'both', who: 'Writer drafts, you send',
      count: sent, countLabel: `${sent} sent`,
      detail: `${plural(drafted, 'draft')} written${input.queueCount ? ` · ${input.queueCount} waiting on you` : ''}`,
    }),
    stage({
      key: 'convert', label: 'Convert', owner: 'you', who: 'You',
      count: replied, countLabel: `${replied} replied`,
      detail: `${plural(meetings, 'meeting')}${input.outsideFunnel ? ` · ${input.outsideFunnel} logged outside the app` : ''}`,
    }),
    stage({
      key: 'paid', label: 'Get paid', owner: 'you', who: 'You',
      count: won, countLabel: `${won} won`,
      detail: [input.wonAmount > 0 ? `${money(input.wonAmount, input.currency)} in the last 30 days` : 'Nothing won in the last 30 days', goal].filter(Boolean).join(' · '),
    }),
  ];
}

/* ─── The team ────────────────────────────────────────────────────────────── */

export type AgentKey = 'scout' | 'watcher' | 'writer' | 'researcher' | 'planner';
export type AgentState = 'working' | 'ready' | 'idle' | 'setup' | 'failed';

/** Every state ships with its word. A coloured dot alone is not a status. */
export const AGENT_STATE_LABEL: Record<AgentState, string> = {
  working: 'Working',
  ready: 'Ready',
  idle: 'Idle',
  setup: 'Needs setup',
  failed: 'Failed',
};

export interface Agent {
  key: AgentKey;
  name: string;
  /** What it does, in one line. */
  role: string;
  state: AgentState;
  /** What it last did, counted. */
  line: string;
}

export interface RosterInput {
  now: Date;
  supplyLastRun: string | null;
  sourced: number;
  hasTargeting: boolean;
  matchesLeft: number;
  sources: Array<{ lastCheckedAt: string | null; error: string | null; status: string }>;
  finds: number;
  offerEmpty: boolean;
  queueCount: number;
  drafted: number;
  workerConnected: boolean;
  commissions: CommissionThread[];
  lastCronRun: string | null;
  lastRun: { status: string } | null;
  jobsRan: number | null;
  broke: string[];
  /**
   * Why the web search cannot run or failed last time — the table missing, the
   * index refusing — or null. The searches are the app's own and have no screen
   * of their own, so this row is the one place a broken search can be seen.
   */
  searchProblem?: string | null;
}

/** A night, give or take: past this an agent that should run nightly has not. */
export const AGENT_FRESH_HOURS = 36;
/** A source read within this long counts as read last night — same as motion's. */
export const SOURCE_FRESH_HOURS = 30;

/** "7h ago", "3d ago". Coarse on purpose: this is a status line, not a log. */
export function agoLabel(iso: string, now: Date): string {
  const h = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 3_600_000));
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const fresh = (iso: string | null, now: Date, hours: number) => !!iso && now.getTime() - Date.parse(iso) <= hours * 3_600_000;

/**
 * Which agent a broken sensor belongs to. The watcher and the commission
 * dispatcher have agents of their own; every other job feeds the call, so a
 * failure there is the Planner's — it is the thing that did not get to weigh it.
 */
function brokeBy(broke: string[]): Record<'watcher' | 'researcher' | 'planner', string[]> {
  const out = { watcher: [] as string[], researcher: [] as string[], planner: [] as string[] };
  for (const b of broke) {
    const key = b.split(':')[0].trim();
    if (key === 'watch') out.watcher.push(b);
    else if (key === 'commission') out.researcher.push(b);
    else out.planner.push(b);
  }
  return out;
}

export function agentRoster(input: RosterInput): Agent[] {
  const { now } = input;
  const broken = brokeBy(input.broke);

  // Scout — supply.
  const scout: Agent = input.searchProblem
    ? { key: 'scout', name: 'Scout', role: 'Finds businesses that match who you sell to', state: 'failed', line: input.searchProblem.slice(0, 120) }
    : !input.hasTargeting
    ? { key: 'scout', name: 'Scout', role: 'Finds businesses that match who you sell to', state: 'setup', line: 'Say what you sell and it works out who to look for' }
    : input.matchesLeft <= 0
    ? { key: 'scout', name: 'Scout', role: 'Finds businesses that match who you sell to', state: 'idle', line: `Out of matches this month · ${input.sourced} found so far` }
    : {
      key: 'scout', name: 'Scout', role: 'Finds businesses that match who you sell to',
      state: fresh(input.supplyLastRun, now, AGENT_FRESH_HOURS) ? 'working' : 'idle',
      line: `${input.sourced} found so far · ${input.supplyLastRun ? `last looked ${agoLabel(input.supplyLastRun, now)}` : 'has not looked yet'}`,
    };

  // Watcher — the feeds.
  const active = input.sources.filter((s) => s.status !== 'paused');
  const recent = active.filter((s) => fresh(s.lastCheckedAt, now, SOURCE_FRESH_HOURS));
  const failing = active.filter((s) => !!s.error).length;
  const watcherRole = 'Reads the sources you follow, every night';
  const watcher: Agent = !active.length
    ? { key: 'watcher', name: 'Watcher', role: watcherRole, state: 'setup', line: 'Nothing to read yet — add a source' }
    : broken.watcher.length || (recent.length > 0 && recent.every((s) => !!s.error))
    ? { key: 'watcher', name: 'Watcher', role: watcherRole, state: 'failed', line: broken.watcher[0] ?? `${failing} of ${plural(active.length, 'source')} failing` }
    : {
      key: 'watcher', name: 'Watcher', role: watcherRole,
      state: recent.length ? 'working' : 'idle',
      line: [
        plural(active.length, 'source'),
        input.finds ? `${input.finds} worth a look` : recent.length ? 'nothing new worth your morning' : 'not read in the last day',
        failing ? `${failing} failing` : null,
      ].filter(Boolean).join(' · '),
    };

  // Writer — openers. Never drafts from a blank offer (invariant 1), so a blank
  // offer is not idleness, it is the setup it is waiting on.
  const writer: Agent = input.offerEmpty
    ? { key: 'writer', name: 'Writer', role: 'Drafts openers in your words when you pick a lead', state: 'setup', line: 'Needs your offer before it writes anything' }
    : {
      key: 'writer', name: 'Writer', role: 'Drafts openers in your words when you pick a lead', state: 'ready',
      line: input.queueCount ? `${plural(input.drafted, 'draft')} written · ${input.queueCount} waiting on you` : `${plural(input.drafted, 'draft')} written · ready when you pick a lead`,
    };

  // Researcher — the worker that takes handed-over projects.
  const live = input.commissions.filter((t) => t.commission.status === 'active' || t.commission.status === 'blocked');
  const faulted = live.filter((t) => blockedOn(t.commission, t.report) === 'worker');
  const asking = live.filter((t) => blockedOn(t.commission, t.report) === 'you');
  const finished = input.commissions.filter((t) => t.commission.status === 'done' || t.commission.status === 'stopped').length;
  const researcherRole = 'Takes on work you hand over — research, comparisons, drafts';
  const researcher: Agent = !input.workerConnected
    ? { key: 'researcher', name: 'Researcher', role: researcherRole, state: 'setup', line: 'No worker is connected to this server, so handed-over work is not picked up' }
    : faulted.length || broken.researcher.length
    ? { key: 'researcher', name: 'Researcher', role: researcherRole, state: 'failed', line: faulted.length ? `${plural(faulted.length, 'project')} stopped — open it to try again` : broken.researcher[0] }
    : live.length
    ? {
      key: 'researcher', name: 'Researcher', role: researcherRole, state: 'working',
      line: `${plural(live.length, 'project')} running${asking.length ? ` · ${asking.length} waiting on you` : ''}`,
    }
    : { key: 'researcher', name: 'Researcher', role: researcherRole, state: 'ready', line: finished ? `${finished} finished · give it the next one` : 'Give it something you would otherwise do yourself' };

  // Planner — the nightly pass that weighs everything and picks the call.
  const plannerRole = 'Weighs everything above and picks today’s call';
  const planner: Agent = broken.planner.length
    ? { key: 'planner', name: 'Planner', role: plannerRole, state: 'failed', line: `${plural(broken.planner.length, 'check')} failed last run — ${broken.planner[0]}` }
    : input.lastRun?.status === 'error'
    ? { key: 'planner', name: 'Planner', role: plannerRole, state: 'failed', line: 'Its last run failed, so today’s call came from the fallback rules' }
    : fresh(input.lastCronRun, now, AGENT_FRESH_HOURS)
    ? { key: 'planner', name: 'Planner', role: plannerRole, state: 'working', line: `Ran ${agoLabel(input.lastCronRun!, now)}${input.jobsRan ? ` · ${plural(input.jobsRan, 'check')}` : ''}` }
    : { key: 'planner', name: 'Planner', role: plannerRole, state: 'idle', line: 'Nothing runs overnight — it only plans when you open the app' };

  return [scout, watcher, writer, researcher, planner];
}

/** The line under the greeting on You when there is no runway to report. One line beside the capacity pill at 390px. */
export function workStatus(agents: Agent[], running: number): string {
  const working = agents.filter((a) => a.state === 'working').length;
  return [
    `${working} of ${agents.length} agents working`,
    running ? plural(running, 'project') : null,
  ].filter(Boolean).join(' · ');
}
