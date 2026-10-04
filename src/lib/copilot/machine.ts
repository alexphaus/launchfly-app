// src/lib/copilot/machine.ts
// The agents that run parts of the business, and whether each is well.
//
// It began as the Work tab's whole picture: the business drawn as a machine
// (find → reach → convert → get paid) beside a roster of five agents. Its
// owner's verdict on that picture was that the four stages were the same for
// everybody and the roster was "too heavy for a status", so the business is now
// a chain of bets (business.ts) and the agents are placed on the part each one
// runs. What is left here is the roster itself, with one rule behind it: every
// state comes from when an agent last actually ran and what it last produced. A
// Scout that has never run says so, and a Researcher with no worker connected
// says "needs setup" rather than looking busy.
//
// Pure: no DB import.

import { blockedOn } from './commission';
import type { CommissionThread } from './types';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
