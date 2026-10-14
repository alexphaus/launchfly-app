// src/lib/copilot/repeats.ts
// A job done again on a schedule: the same objective, a fresh run each time.
//
// Some work is not a project but a habit — "List this week's grants for
// freelance designers", "Find new guesthouses under $40 in Makati". Before this,
// each week meant writing the same mandate and approving it again, and a job
// that has to be remembered to be started is a job the app is not doing.
//
// A repeat is a standing grant the person makes on a job they already approved:
// "do this again every week". Each run is its own commission — its own log, its
// own checks, its own close — written and approved by the nightly pass under
// that grant, so a run is never a draft waiting on a tap the person already gave.
// Two limits, both load-bearing:
//
//   - Research and draft only. A standing grant to contact people would be
//     reach without anyone looking at each time, which AUTHORITY.reach exists to
//     refuse; a standing grant to spend is commit, which is never.
//   - One run at a time, and inside the three on the go. A run that finds no
//     room is skipped and says so on the job, rather than pushing out something
//     the person started by hand.
//
// Pure: no DB import. store.ts reads the rows; jobs/commission.ts spawns.

import type { Commission } from './commission';

export const REPEAT_ON = 'commission_repeat';
export const REPEAT_OFF = 'commission_repeat_off';
export const REPEAT_SPAWNED = 'commission_spawned';
export const REPEAT_SKIPPED = 'commission_repeat_skipped';
export const REPEAT_EVENTS = [REPEAT_ON, REPEAT_OFF, REPEAT_SPAWNED, REPEAT_SKIPPED] as const;

export const REPEAT_EVERY = ['day', 'week', 'month'] as const;
export type RepeatEvery = (typeof REPEAT_EVERY)[number];

export const REPEAT_LABEL: Record<RepeatEvery, string> = { day: 'Every day', week: 'Every week', month: 'Every month' };
const REPEAT_ADVERB: Record<RepeatEvery, string> = { day: 'daily', week: 'weekly', month: 'monthly' };

export const isRepeatEvery = (v: unknown): v is RepeatEvery => typeof v === 'string' && (REPEAT_EVERY as readonly string[]).includes(v);

export interface RepeatRule {
  /** The job the repeat was set on. Every run copies its objective. */
  template: string;
  every: RepeatEvery;
  since: string;
}

export interface RepeatRun { id: string; from: string; at: string }
export interface RepeatSkip { template: string; why: string; at: string }

interface Row { event_type: string; payload: unknown; created_at: string }
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const id = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** The live rules, the runs and the skips, from the event rows. The newest on or off per job decides. */
export function repeatsOf(rows: Row[]): { rules: RepeatRule[]; runs: RepeatRun[]; skips: RepeatSkip[] } {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rules = new Map<string, RepeatRule>();
  const runs: RepeatRun[] = [];
  const skips: RepeatSkip[] = [];
  for (const r of sorted) {
    const p = obj(r.payload);
    const c = id(p.commission_id);
    if (!c) continue;
    if (r.event_type === REPEAT_ON && isRepeatEvery(p.every)) rules.set(c, { template: c, every: p.every, since: r.created_at });
    if (r.event_type === REPEAT_OFF) rules.delete(c);
    if (r.event_type === REPEAT_SPAWNED && id(p.from)) runs.push({ id: c, from: p.from as string, at: r.created_at });
    if (r.event_type === REPEAT_SKIPPED && typeof p.why === 'string') skips.push({ template: c, why: p.why.slice(0, 200), at: r.created_at });
  }
  return { rules: [...rules.values()], runs, skips };
}

/** The rule a job falls under: its own, or the one of the job it is a run of. */
export function ruleFor(commissionId: string, rules: RepeatRule[], runs: RepeatRun[]): RepeatRule | null {
  const from = runs.find((r) => r.id === commissionId)?.from ?? commissionId;
  return rules.find((r) => r.template === from) ?? null;
}

const dayMs = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The day the next run is due, from the day the last one started (or the job itself). */
export function nextRunDay(last: string, every: RepeatEvery): string {
  const t = Date.parse(`${last.slice(0, 10)}T00:00:00Z`);
  if (every === 'day') return isoDay(t + dayMs);
  if (every === 'week') return isoDay(t + 7 * dayMs);
  const d = new Date(t);
  // The same day next month, or its last day when next month is shorter.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDay(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d.getUTCDate(), lastDay)));
}

const LIVE = new Set(['draft', 'active', 'blocked']);

/**
 * The rules due a run today: a research job, not called off, with no run of it
 * still on the go, whose last run (or the job itself) started a period ago.
 */
export function dueRepeats(rules: RepeatRule[], runs: RepeatRun[], all: Array<Pick<Commission, 'id' | 'status' | 'authority' | 'created_at'>>, today: string): Array<{ rule: RepeatRule; template: Pick<Commission, 'id' | 'status' | 'authority' | 'created_at'> }> {
  const byId = new Map(all.map((c) => [c.id, c]));
  const out: Array<{ rule: RepeatRule; template: Pick<Commission, 'id' | 'status' | 'authority' | 'created_at'> }> = [];
  for (const rule of rules) {
    const template = byId.get(rule.template);
    // Calling the job off ends the line; a job that is not research never repeats.
    if (!template || template.status === 'stopped' || template.authority !== 'read') continue;
    const mine = runs.filter((r) => r.from === rule.template);
    const statusOf = (rid: string) => byId.get(rid)?.status;
    if (LIVE.has(template.status) || mine.some((r) => LIVE.has(statusOf(r.id) ?? ''))) continue;
    const last = [template.created_at, ...mine.map((r) => r.at)].sort().pop()!;
    if (nextRunDay(last, rule.every) <= today) out.push({ rule, template });
  }
  return out;
}

const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The repeat as a line on the job: how often, and when next — or why the last one was skipped. */
export function repeatLine(rule: RepeatRule, runs: RepeatRun[], skips: RepeatSkip[], templateCreated: string): string {
  const mine = runs.filter((r) => r.from === rule.template);
  const last = [templateCreated, ...mine.map((r) => r.at)].sort().pop()!;
  const skip = skips.filter((s) => s.template === rule.template && s.at > last).sort((a, b) => b.at.localeCompare(a.at))[0];
  const head = `Runs ${REPEAT_ADVERB[rule.every]}${mine.length ? ` · ${mine.length} run${mine.length === 1 ? '' : 's'} so far` : ''}`;
  if (skip) return `${head} · skipped ${fmtDay(skip.at)}: ${skip.why}`;
  return `${head} · next ${fmtDay(nextRunDay(last, rule.every))}`;
}
