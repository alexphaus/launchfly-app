// src/lib/copilot/roadmap.ts
// The Path's plan, drawn for the person rather than for the funnel.
//
// What it replaced. Below "you are here" the Path used to walk the first goal
// back through the outbound funnel: first message → first reply → first paying
// client → three → the goal, with a checkpoint at twenty sends. Accurate, and
// the same ladder for everybody. Somebody saving for a property renovation was
// told "11800 clients at your €5"; somebody applying for jobs was told how many
// sends to their third client. Its owner's verdict: static, hardcoded, centric
// to outbound — "what I'm looking for is dynamic": a plan that understands the
// goals, puts quick wins before the long pulls, names milestones and the
// actions with leverage, and redraws itself as things work or do not.
//
// So a model draws it, and the rows keep it honest. The division of labour is
// the one propose.ts uses:
//
//   the model writes   the order, the milestones, the steps, the reasons
//   the rows write     every number, every "done", and when it is redrawn
//
// Four rules make that structural rather than promised:
//
// 1. A number the input did not contain does not survive (`unsourcedNumber`).
//    Targets, prices, counts and dates the person gave pass; "a 20% reply rate",
//    "€3,000 by March" and "in 6 weeks" do not, and the line carrying one is
//    dropped rather than shown with the number blanked. Small counts of things
//    to do ("two calls", "send three") are instructions, not claims about the
//    person, and pass. Invariant 2.
// 2. Done is the person's tap, never the model's say-so. A step is done when a
//    `roadmap_marked` event says so; the model is shown those marks and cannot
//    write one. Invariant 10, the same shape.
// 3. What goes back in is the record, not the view. The next draw sees the
//    earlier milestones' and steps' titles and what the person did with each —
//    rows they created — and never the earlier `here`, `direction` or `why`.
//    The app does not feed its own reading of somebody's life back to itself as
//    context. Invariant 12.
// 4. A draw that fails says so, on the Path, beside the plan it could not
//    replace. Invariant 13.
//
// Stored as copilot_agent_runs rows of kind 'roadmap' (the plan in `output`)
// and copilot_events rows of type 'roadmap_marked' — both tables take a new
// kind without a migration, so this ships without waiting on the SQL editor.
//
// Pure: no DB import. agent/roadmap.ts does the reading, the one call and the
// write; copilot-core.test.ts covers everything here.

import { hoursLabel, type FocusLog } from './focus';
import { moneyLabel, type AnsweredMove, type RecentOutcome } from './review';
import type { Capacity, Goal } from './types';
import { CAPACITY_META } from './types';

export const ROADMAP_RUN_KIND = 'roadmap';
export const ROADMAP_MARK_EVENT = 'roadmap_marked';

/** Redrawn at least this often while anything happens, so a plan does not quietly rot. */
export const ROADMAP_MAX_AGE_DAYS = 7;
/** A draw still "running" after this belongs to a process that is gone (a redeploy kills after() work). */
export const ROADMAP_STALE_MS = 5 * 60_000;
/** After a failed draw, opening the app does not retry on its own for this long. The button still does. */
export const ROADMAP_RETRY_MS = 60 * 60_000;

export const MAX_MILESTONES_PER_PHASE = 3;
export const MAX_STEPS_PER_MILESTONE = 3;
/** A count up to this is an instruction ("send three"), not a measurement. Above it, it must come from the input. */
export const SMALL_COUNT = 10;
const TITLE_MAX = 110;
const TEXT_MAX = 240;
const ID_MAX = 48;

export type PhaseKey = 'week' | 'month' | 'quarter' | 'later';
export const PHASES: PhaseKey[] = ['week', 'month', 'quarter', 'later'];
export const PHASE_LABEL: Record<PhaseKey, string> = { week: 'This week', month: 'This month', quarter: 'This quarter', later: 'After that' };

export type StepTag = 'quick_win' | 'leverage' | 'foundation';
const TAGS: StepTag[] = ['quick_win', 'leverage', 'foundation'];
export const TAG_LABEL: Record<StepTag, string> = { quick_win: 'Quick win', leverage: 'High leverage', foundation: 'Groundwork' };

export type StepSize = 'quick' | 'sitting' | 'days';
const SIZES: StepSize[] = ['quick', 'sitting', 'days'];
export const SIZE_LABEL: Record<StepSize, string> = { quick: 'Under 30 min', sitting: 'One sitting', days: 'A few days' };
/** What a size asks of a day, against the time the person set. A few days never fits one. */
export const SIZE_MINUTES: Record<StepSize, number> = { quick: 30, sitting: 60, days: Number.POSITIVE_INFINITY };

export interface RoadmapStep {
  id: string;
  title: string;
  size: StepSize;
  tag: StepTag;
  /** 'ai' only where a worker is connected to hand it to — never advertised otherwise (invariant 7). */
  who: 'you' | 'ai';
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  why: string | null;
  /** What makes it checkable: "One person has paid", "The listing is live". */
  doneWhen: string | null;
  goalId: string | null;
  steps: RoadmapStep[];
}

export interface RoadmapPhase { key: PhaseKey; milestones: RoadmapMilestone[] }

export interface Roadmap {
  /** Where they stand, short enough for the header, and one sentence under it. */
  here: { title: string; line: string | null } | null;
  /** Why this order, once. */
  direction: string | null;
  /** What it changed since the last plan, and why — in its own words, marked as such on screen. */
  changed: string | null;
  phases: RoadmapPhase[];
}

/* ─── What goes in ────────────────────────────────────────────────────────── */

export interface RoadmapGoal {
  id: string;
  title: string;
  metric: Goal['metric'];
  unit: string | null;
  target: number | null;
  current: number | null;
  horizonDays: number | null;
  note: string | null;
}

export type MarkState = 'done' | 'dropped' | 'open';
export interface RoadmapMark { item: string; title: string; state: MarkState; at: string }

export interface RoadmapInput {
  today: string;
  name: string;
  headline: string | null;
  location: string | null;
  capacity: Capacity;
  currency: string;
  runwayMonths: number | null;
  offer: { sells?: string; for_who?: string; price_band?: string } | null;
  /** The price the funnel plans on — the low end of what they wrote — so a money goal can be said in clients. */
  price: number | null;
  /** In the person's priority order. */
  goals: RoadmapGoal[];
  /** workingBrief(): what they said about how they work. Live entries only. */
  working: string;
  /** Their own recent words, newest first: "Something changed?" and every note like it. */
  notes: string[];
  /** Counts over the metrics window. */
  funnel: { windowDays: number; sent: number; replied: number; won: number; wonAmount: number };
  /** What came back in the last fortnight, one line each, already said from rows. */
  happened: string[];
  /** The earlier plan's items and what the person did with each. Titles and marks only — see rule 3. */
  previous: Array<{ id: string; phase: PhaseKey; title: string; state: MarkState; steps: Array<{ id: string; title: string; state: MarkState }> }>;
  /** Whether research can be handed to a worker at all. */
  aiAvailable: boolean;
}

export const ROADMAP_SYSTEM = `You draw one person's plan: from where they are now to the goals they set, over weeks and months. You are the planner who decides the order, not a coach writing encouragement.

You get who they are, the goals they wrote in their own priority order, what they told the app in their own words, the time they have each day, and what the record shows actually happened — replies, payments, hours logged, and what they did with each step of the last plan.

How to draw it:
- Start from what is achievable now. "week" holds quick wins that make the next phase possible, sized to the minutes they have each day. Do not put more in "week" than those minutes hold.
- A milestone is an outcome, not an activity: "A first paying client for the renovation work", not "Work on marketing". Give each a done_when a person can check without arguing: "One person has paid", "The listing is live", "Three offers compared side by side".
- Steps are the next concrete actions under a milestone, each one person can do. Start each with a verb. Size each: quick (under 30 minutes), sitting (one focused sitting), days (several days of work).
- Tag each step: quick_win (small, fast, a visible result), leverage (one action that unlocks or compounds several later ones), foundation (unglamorous and necessary).
- Order by dependency and leverage: what has to be true before the next thing is possible. Say the reasoning for the order once, in direction.
- Goals compete for the same hours. When two pull against each other, say which comes first and why in direction, and put the other later.
- Plan for what the goals actually need. It is not always selling: a job search, learning a skill, building a product, getting money under control, a move, a qualification.
- If they seem lost — goals vague, nothing working — the first milestone is getting clear: a small experiment or one conversation that produces a fact. Do not make the decision for them.
- Use what happened. A step marked done is done: build on it, never repeat it. A step marked dropped stays out in that form. When something has brought results, lean into it; when the record shows effort and nothing back, change the approach and say what you changed in changed.
- Later phases can be one milestone with no steps. A plan past the next quarter is a direction, not a schedule.

Hard rules:
- Never invent a number about them. Use only numbers that appear in the input: their targets, prices, counts, days. Do not estimate rates, percentages, income or durations as numbers. A line with a number not in the input is thrown away. Small counts of things to do ("send three", "two calls") are fine.
- Never state as fact anything the input does not say.
- Reuse the id of an earlier milestone or step when it is the same thing, even reworded. New things get a new short id in kebab-case.
- who is "ai" only for research or drafting a machine can do alone on the open web, and only when ai_available is true. Everything else is "you".
- At most ${MAX_MILESTONES_PER_PHASE} milestones per phase and ${MAX_STEPS_PER_MILESTONE} steps per milestone. Fewer is better.
- Plain words, second person, short. No filler, no motivation, no exclamation marks.

here.title is where they stand in at most eight words ("Job search, two interviews in"). here.line is one sentence on what is true now and what matters next. changed is null on a first plan.

Return only JSON:
{"here":{"title":"...","line":"..."},"direction":"...","changed":null,"phases":[{"key":"week","milestones":[{"id":"...","title":"...","why":"...","done_when":"...","goal_id":null,"steps":[{"id":"...","title":"...","size":"quick","tag":"quick_win","who":"you"}]}]}]}
Phase keys, in order: week, month, quarter, later.`;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The input as the model reads it. Every number the plan may use is written
 * here, which is what makes "only numbers in the input" checkable afterwards:
 * the guard reads this same text.
 */
export function roadmapPrompt(input: RoadmapInput): string {
  const cap = CAPACITY_META[input.capacity];
  const money = (n: number) => moneyLabel(n, input.currency);
  const lines: string[] = [];
  lines.push(`Today: ${input.today}`);
  lines.push(`Name: ${input.name}${input.headline ? ` — ${input.headline}` : ''}${input.location ? ` · ${input.location}` : ''}`);
  lines.push(`Time each day: ${cap.minutes} minutes (${cap.label})`);
  if (input.runwayMonths != null) lines.push(`Runway: ${input.runwayMonths} months of cash at their burn`);
  lines.push('');

  lines.push('GOALS, in their priority order:');
  if (!input.goals.length) lines.push('- none written yet');
  for (const g of input.goals) {
    const unit = g.metric === 'currency' ? (g.unit || input.currency) : '';
    const fmt = (n: number) => (g.metric === 'currency' ? moneyLabel(n, unit) : `${n}${g.unit ? ` ${g.unit}` : ''}`);
    const parts = [`- [${g.id}] ${g.title}`];
    if (g.target != null && g.target > 0) parts.push(`${fmt(g.current ?? 0)} of ${fmt(g.target)}`);
    if (g.horizonDays) parts.push(`within ${g.horizonDays} days`);
    if (g.note?.trim()) parts.push(`their note: ${g.note.trim()}`);
    lines.push(parts.join(' · '));
    // The one piece of arithmetic worth handing over: a money goal said in
    // clients at their own price. It is how "€5 jewellery toward a €59,000 gap"
    // becomes visible to the planner rather than to nobody.
    if (g.metric === 'currency' && g.target && input.price) {
      const gap = Math.max(0, g.target - (g.current ?? 0));
      if (gap > 0) lines.push(`  at their price of ${money(input.price)}: ${money(gap)} to go is ${Math.ceil(gap / input.price)} clients`);
    }
  }
  lines.push('');

  const o = input.offer;
  lines.push('WHAT THEY SELL:');
  lines.push(o?.sells?.trim() ? `- ${o.sells.trim()}${o.for_who ? ` to ${o.for_who}` : ''}${o.price_band ? ` · price ${o.price_band}` : ''}` : '- nothing written');
  lines.push('');

  if (input.working.trim()) {
    lines.push('WHAT THEY TOLD THE APP ABOUT HOW THEY WORK:');
    lines.push(input.working.trim());
    lines.push('');
  }
  if (input.notes.length) {
    lines.push('THEIR OWN RECENT WORDS, newest first:');
    for (const n of input.notes) lines.push(`- ${n}`);
    lines.push('');
  }

  const f = input.funnel;
  lines.push(`THE RECORD (last ${f.windowDays} days): ${f.sent} messages sent · ${f.replied} replies · ${f.won} won${f.wonAmount > 0 ? ` for ${money(f.wonAmount)}` : ''}`);
  lines.push('WHAT HAPPENED IN THE LAST TWO WEEKS:');
  if (!input.happened.length) lines.push('- nothing recorded');
  for (const h of input.happened) lines.push(`- ${h}`);
  lines.push('');

  if (input.previous.length) {
    lines.push('THE LAST PLAN, and what they did with each item:');
    for (const m of input.previous) {
      lines.push(`- [${m.id}] (${m.phase}) ${m.title} — ${m.state}`);
      for (const s of m.steps) lines.push(`  - [${s.id}] ${s.title} — ${s.state}`);
    }
  } else {
    lines.push('THE LAST PLAN: none, this is the first.');
  }
  lines.push('');
  lines.push(`ai_available: ${input.aiAvailable}`);
  return lines.join('\n');
}

/** Lines about the fortnight, at most this many: the prompt's budget, not the record's. */
export const MAX_HAPPENED = 24;

const OUTCOME_LINE: Partial<Record<RecentOutcome['kind'], string>> = {
  reply: 'a reply', meeting: 'a meeting', proposal: 'a proposal sent', won: 'a client won', lost: 'a no',
  delivered: 'work delivered', saved: 'time or money saved', nothing: 'a result that came to nothing',
};

/**
 * What came back in the last two weeks, said from rows, newest first: answers
 * and payments, hours logged and on what, suggestions taken or turned down,
 * research that finished. What the app itself did — finds, drafts — is left
 * out, as on the Path's evidence: it teaches the planner nothing about the
 * person.
 */
export function happenedLines(input: {
  outcomes: RecentOutcome[];
  focus: FocusLog[];
  answered: AnsweredMove[];
  finished: Array<{ objective: string; closedAt: string; outcome: string | null }>;
  currency: string;
}): string[] {
  const rows: Array<{ at: string; line: string }> = [];
  for (const o of input.outcomes) {
    const what = OUTCOME_LINE[o.kind];
    if (!what) continue;
    const money = o.amount && o.amount > 0 ? ` for ${moneyLabel(o.amount, o.currency || input.currency)}` : '';
    const who = o.who ? ` (${o.who})` : '';
    const note = o.note?.trim() ? ` — "${o.note.trim().slice(0, 140)}"` : '';
    rows.push({ at: o.occurred_at, line: `${o.occurred_at.slice(0, 10)}: ${what}${who}${money}${note}` });
  }
  // Hours by what they were on, summed: "4h on Reshaped app" says more than four rows.
  const byOn = new Map<string, { minutes: number; at: string }>();
  for (const f of input.focus) {
    const on = f.note?.trim() || 'deep work';
    const was = byOn.get(on);
    byOn.set(on, { minutes: (was?.minutes ?? 0) + f.minutes, at: was && was.at > f.at ? was.at : f.at });
  }
  for (const [on, v] of byOn) rows.push({ at: v.at, line: `${hoursLabel(v.minutes)} logged on ${on}` });
  for (const a of input.answered) {
    rows.push({ at: a.acted_at, line: `${a.status === 'done' ? 'Did' : 'Turned down'} a suggestion: ${a.headline.slice(0, 140)}` });
  }
  for (const c of input.finished) {
    rows.push({ at: c.closedAt, line: `Research finished: ${c.objective.slice(0, 120)}${c.outcome?.trim() ? ` — ${c.outcome.trim().slice(0, 160)}` : ''}` });
  }
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_HAPPENED).map((r) => r.line);
}

/* ─── The number guard ────────────────────────────────────────────────────── */

const NUMBER = /([$€£₱¥]\s?)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\s?(?:k\b|%))?/gi;

interface Found { raw: string; value: number; marked: boolean }

function numbersIn(text: string): Found[] {
  const out: Found[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const base = parseFloat(`${m[2].replace(/,/g, '')}${m[3] ? `.${m[3]}` : ''}`);
    if (!Number.isFinite(base)) continue;
    const suffix = (m[4] ?? '').trim().toLowerCase();
    const value = suffix === 'k' ? base * 1000 : base;
    out.push({ raw: m[0].trim(), value, marked: !!m[1] || !!suffix || !!m[3] });
  }
  return out;
}

/** Every number the input carried, as values — so "€60,000", "60000" and "60k" are one number. */
export function sourcedNumbers(corpus: string): Set<number> {
  const set = new Set<number>();
  for (const n of numbersIn(corpus)) set.add(n.value);
  return set;
}

/**
 * The first number in `text` that the input did not contain, or null. A bare
 * count up to SMALL_COUNT passes: "two calls" is an instruction. Money, a
 * percentage, a decimal or anything larger has to have come from the input.
 */
export function unsourcedNumber(text: string, allowed: Set<number>): string | null {
  for (const n of numbersIn(text)) {
    if (!n.marked && Number.isInteger(n.value) && n.value <= SMALL_COUNT) continue;
    if (allowed.has(n.value)) continue;
    return n.raw;
  }
  return null;
}

/* ─── What comes back ─────────────────────────────────────────────────────── */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || /^(null|none|n\/a)$/i.test(t)) return null;
  // Cut at a word, never mid-word: half a word reads as a typo in somebody's own plan.
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, '')}…`;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : dflt);

export function slugId(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, ID_MAX) || 'item';
}

export interface ParseContext {
  /** sourcedNumbers() over the prompt and the system text. */
  allowed: Set<number>;
  goalIds: string[];
  aiAvailable: boolean;
  /** The last plan's ids by lower-cased title, so a model that forgot the id still carries the marks. */
  previousIds?: Map<string, string>;
}

export interface Parsed { roadmap: Roadmap; withheld: number }

/**
 * The model's plan, held to the rules. Null when nothing usable is left — a
 * plan with no milestone is a failed draw, not an empty one, and is reported
 * as such rather than rendered as a blank section.
 */
export function parseRoadmap(raw: unknown, ctx: ParseContext): Parsed | null {
  const r = obj(raw);
  let withheld = 0;
  // A line with an invented number is dropped whole: "about €3,000 by March"
  // with the number removed still reads as a promise.
  const clean = (v: unknown, max: number): string | null => {
    const t = text(v, max);
    if (!t) return null;
    if (unsourcedNumber(t, ctx.allowed)) { withheld += 1; return null; }
    return t;
  };
  const ids = new Set<string>();
  const earlier = new Set(ctx.previousIds?.values() ?? []);
  // An id the last plan used wins; then the last plan's id for the same title,
  // so a model that forgot to carry an id still carries the person's marks.
  const uniqueId = (candidate: unknown, title: string): string => {
    const given = typeof candidate === 'string' && candidate.trim() ? slugId(candidate) : null;
    const known = ctx.previousIds?.get(title.toLowerCase()) ?? null;
    let id = given && earlier.has(given) ? given : known ?? given ?? slugId(title);
    let n = 2;
    const base = id;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    return id;
  };

  const byKey = new Map<PhaseKey, RoadmapMilestone[]>();
  for (const p of arr(r.phases)) {
    const po = obj(p);
    const key = oneOf(po.key, PHASES, 'later');
    const list = byKey.get(key) ?? [];
    for (const m of arr(po.milestones)) {
      if (list.length >= MAX_MILESTONES_PER_PHASE) break;
      const mo = obj(m);
      const title = clean(mo.title, TITLE_MAX);
      if (!title) continue;
      const steps: RoadmapStep[] = [];
      for (const s of arr(mo.steps)) {
        if (steps.length >= MAX_STEPS_PER_MILESTONE) break;
        const so = obj(s);
        const st = clean(so.title, TITLE_MAX);
        if (!st) continue;
        const who = so.who === 'ai' && ctx.aiAvailable ? 'ai' : 'you';
        steps.push({ id: uniqueId(so.id, st), title: st, size: oneOf(so.size, SIZES, 'sitting'), tag: oneOf(so.tag, TAGS, 'foundation'), who });
      }
      const goal = typeof mo.goal_id === 'string' && ctx.goalIds.includes(mo.goal_id) ? mo.goal_id : null;
      list.push({ id: uniqueId(mo.id, title), title, why: clean(mo.why, TEXT_MAX), doneWhen: clean(mo.done_when, TEXT_MAX), goalId: goal, steps });
    }
    byKey.set(key, list);
  }
  const phases = PHASES.map((key) => ({ key, milestones: byKey.get(key) ?? [] })).filter((p) => p.milestones.length > 0);
  if (!phases.length) return null;

  const h = obj(r.here);
  const hereTitle = clean(h.title, 60);
  return {
    roadmap: {
      here: hereTitle ? { title: hereTitle, line: clean(h.line, TEXT_MAX) } : null,
      direction: clean(r.direction, 320),
      changed: clean(r.changed, 320),
      phases,
    },
    withheld,
  };
}

/* ─── The stored run ──────────────────────────────────────────────────────── */

export interface RoadmapRun {
  id: string;
  status: 'running' | 'ok' | 'error';
  reason: string | null;
  signature: string | null;
  startedAt: string;
  finishedAt: string | null;
  roadmap: Roadmap | null;
  error: string | null;
}

export const ROADMAP_COLUMNS = 'id, status, started_at, finished_at, output, error, input_summary';

/**
 * A row as stored. Written by whichever version ran it, so read defensively: a
 * plan that does not parse as one is a failure with a reason, never a blank.
 */
export function roadmapRunFromRow(row: Record<string, unknown>): RoadmapRun {
  const summary = obj(row.input_summary);
  const out = obj(row.output);
  const status = row.status === 'running' || row.status === 'ok' || row.status === 'error' ? row.status : 'error';
  const plan = obj(out.roadmap);
  const phases = storedPhases(plan.phases);
  const here = obj(plan.here);
  const roadmap: Roadmap | null = phases.length
    ? {
        here: typeof here.title === 'string' && here.title ? { title: here.title, line: typeof here.line === 'string' ? here.line : null } : null,
        direction: typeof plan.direction === 'string' ? plan.direction : null,
        changed: typeof plan.changed === 'string' ? plan.changed : null,
        phases,
      }
    : null;
  const unreadable = status === 'ok' && !roadmap;
  return {
    id: String(row.id),
    status: unreadable ? 'error' : status,
    reason: typeof summary.reason === 'string' ? summary.reason : null,
    signature: typeof summary.signature === 'string' ? summary.signature : null,
    startedAt: String(row.started_at),
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
    roadmap,
    error: typeof row.error === 'string' && row.error ? row.error
      : unreadable ? 'The stored plan could not be read.'
      : status === 'error' && row.status !== 'error' ? `unknown status "${String(row.status)}"` : null,
  };
}

/** Phases as stored, reshaped rather than trusted: one malformed milestone must not take the tab down. */
function storedPhases(v: unknown): RoadmapPhase[] {
  const str = (x: unknown) => (typeof x === 'string' ? x : null);
  return arr(v).map((p) => obj(p)).filter((p) => PHASES.includes(p.key as PhaseKey)).map((p) => ({
    key: p.key as PhaseKey,
    milestones: arr(p.milestones).map((m) => obj(m)).filter((m) => str(m.id) && str(m.title)).map((m) => ({
      id: String(m.id), title: String(m.title), why: str(m.why), doneWhen: str(m.doneWhen), goalId: str(m.goalId),
      steps: arr(m.steps).map((s) => obj(s)).filter((s) => str(s.id) && str(s.title)).map((s) => ({
        id: String(s.id), title: String(s.title),
        size: oneOf(s.size, SIZES, 'sitting'), tag: oneOf(s.tag, TAGS, 'foundation'), who: s.who === 'ai' ? 'ai' as const : 'you' as const,
      })),
    })),
  })).filter((p) => p.milestones.length > 0);
}

export function roadmapInFlight(run: Pick<RoadmapRun, 'status' | 'startedAt'> | null | undefined, now: Date): boolean {
  if (!run || run.status !== 'running') return false;
  const age = now.getTime() - Date.parse(run.startedAt);
  return Number.isFinite(age) && age <= ROADMAP_STALE_MS;
}

/* ─── When it is redrawn ──────────────────────────────────────────────────── */

export interface SignatureInput {
  goals: Array<Pick<Goal, 'id' | 'title' | 'target_value' | 'current_value' | 'horizon_days' | 'priority' | 'note'>>;
  /** Live working-file entries. */
  working: Array<{ id: string; body: string }>;
  /** How many things the person has told it — a new note is a new count. */
  contextCount: number;
  capacity: Capacity;
  offer: { sells?: string; price_band?: string } | null;
}

/**
 * What the person has SAID, as one string. A change here is a reason to redraw
 * the moment the app is open: a new goal, a changed target, a note in the
 * composer, a different day's capacity. What the record shows — a reply, a
 * step ticked — waits for the night, so ticking a box does not rewrite the
 * plan under the thumb that ticked it.
 */
export function roadmapSignature(s: SignatureInput): string {
  const goals = [...s.goals].sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => [g.id, g.title, g.target_value ?? '', g.current_value ?? '', g.horizon_days ?? '', g.priority, g.note ?? ''].join('~'));
  const working = [...s.working].sort((a, b) => a.id.localeCompare(b.id)).map((w) => `${w.id}~${w.body}`);
  const raw = [goals.join('|'), working.join('|'), s.contextCount, s.capacity, s.offer?.sells ?? '', s.offer?.price_band ?? ''].join('#');
  // djb2: a short stable digest, so the row carries a fingerprint and not a copy of somebody's notes.
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type DueReason = 'first' | 'changed' | 'progress' | 'weekly';

export interface DueInput {
  /** The newest draw of any status, and the newest that produced a plan. */
  latest: RoadmapRun | null;
  current: RoadmapRun | null;
  signature: string;
  now: Date;
  /** 'open' is the app being looked at; 'nightly' is the pass. */
  trigger: 'open' | 'nightly';
  /** When the newest outcome and the newest mark landed — the record moving. */
  lastOutcomeAt?: string | null;
  lastMarkAt?: string | null;
}

/**
 * Whether to draw now, and why. Null is "the plan on screen still holds".
 *
 * Opening the app draws only for what the person said (a new goal, a note) or
 * when there is no plan at all, and never straight after a failure — a broken
 * key must not cost a model call every time the tab is opened. The night also
 * redraws for what the record did since the last plan, and once a week
 * regardless.
 */
export function roadmapDue(input: DueInput): DueReason | null {
  const { latest, current, now } = input;
  if (roadmapInFlight(latest, now)) return null;
  if (input.trigger === 'open' && latest?.status === 'error' && now.getTime() - Date.parse(latest.finishedAt ?? latest.startedAt) < ROADMAP_RETRY_MS) return null;
  if (!current) return 'first';
  if (current.signature !== input.signature) return 'changed';
  if (input.trigger === 'open') return null;
  const drawn = Date.parse(current.startedAt);
  const after = (iso?: string | null) => !!iso && Date.parse(iso) > drawn;
  if (after(input.lastOutcomeAt) || after(input.lastMarkAt)) return 'progress';
  if (now.getTime() - drawn >= ROADMAP_MAX_AGE_DAYS * 86_400_000) return 'weekly';
  return null;
}

/* ─── Marks ───────────────────────────────────────────────────────────────── */

/** The newest mark per item wins, so "undo" is just another mark. */
export function markMap(marks: RoadmapMark[]): Map<string, RoadmapMark> {
  const map = new Map<string, RoadmapMark>();
  for (const m of [...marks].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) map.set(m.item, m);
  return map;
}

export function markFromEvent(e: { payload: unknown; created_at: string }): RoadmapMark | null {
  const p = obj(e.payload);
  const item = typeof p.item === 'string' ? p.item.slice(0, ID_MAX * 2) : '';
  const state = oneOf(p.state, ['done', 'dropped', 'open'] as const, 'open');
  if (!item) return null;
  return { item, title: typeof p.title === 'string' ? p.title.slice(0, TITLE_MAX) : '', state, at: e.created_at };
}

/** The last plan as the next draw sees it: titles and what the person did, nothing it concluded (rule 3). */
export function previousForPrompt(roadmap: Roadmap | null, marks: RoadmapMark[]): RoadmapInput['previous'] {
  if (!roadmap) return [];
  const m = markMap(marks);
  const state = (id: string): MarkState => m.get(id)?.state ?? 'open';
  return roadmap.phases.flatMap((p) => p.milestones.map((ms) => ({
    id: ms.id, phase: p.key, title: ms.title, state: state(ms.id),
    steps: ms.steps.map((s) => ({ id: s.id, title: s.title, state: state(s.id) })),
  })));
}

/** Last plan's ids by title, for parseRoadmap. */
export function idsByTitle(roadmap: Roadmap | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of roadmap?.phases ?? []) for (const m of p.milestones) {
    map.set(m.title.toLowerCase(), m.id);
    for (const s of m.steps) map.set(s.title.toLowerCase(), s.id);
  }
  return map;
}

/** A milestone or step of this plan, by id — so a mark names something that exists, in the plan's own words. */
export function roadmapItem(roadmap: Roadmap | null, id: string): { kind: 'milestone' | 'step'; title: string } | null {
  for (const p of roadmap?.phases ?? []) for (const m of p.milestones) {
    if (m.id === id) return { kind: 'milestone', title: m.title };
    const s = m.steps.find((x) => x.id === id);
    if (s) return { kind: 'step', title: s.title };
  }
  return null;
}

/* ─── What the tab renders ────────────────────────────────────────────────── */

export interface StepView extends RoadmapStep { state: MarkState; fits: boolean }
export interface MilestoneView {
  id: string;
  title: string;
  why: string | null;
  doneWhen: string | null;
  goalId: string | null;
  goalTitle: string | null;
  state: MarkState;
  steps: StepView[];
  /** Steps still open under it. */
  open: number;
}
export interface PhaseView { key: PhaseKey; label: string; milestones: MilestoneView[] }

export interface RoadmapChanges { added: string[]; dropped: string[]; note: string | null }

export type RoadmapView =
  /** No model on this server and nothing ever drawn: the funnel plan stands in, and nothing mentions a plan that cannot be drawn. */
  | { state: 'off' }
  | { state: 'none'; drawing: boolean; failed: string | null }
  | {
      state: 'ready';
      here: Roadmap['here'];
      direction: string | null;
      phases: PhaseView[];
      drawnAt: string;
      drawing: boolean;
      /** The last draw failed; the plan shown is the one before it. */
      failed: string | null;
      changes: RoadmapChanges | null;
      done: number;
      total: number;
    };

export interface ViewInput {
  enabled: boolean;
  latest: RoadmapRun | null;
  current: RoadmapRun | null;
  /** The plan before `current`, for what changed. */
  previous: RoadmapRun | null;
  marks: RoadmapMark[];
  goals: Array<Pick<Goal, 'id' | 'title'>>;
  capacity: Capacity;
  now: Date;
}

export function roadmapView(input: ViewInput): RoadmapView {
  const drawing = roadmapInFlight(input.latest, input.now);
  const failed = input.latest && input.latest !== input.current && input.latest.status !== 'ok' && !drawing
    ? (input.latest.status === 'running' ? 'The last redraw stopped without finishing.' : input.latest.error?.trim() || 'The last redraw failed without saying why.')
    : null;
  const plan = input.current?.roadmap ?? null;
  if (!plan || !input.current) {
    if (!input.enabled && !input.latest) return { state: 'off' };
    return { state: 'none', drawing, failed };
  }
  const marks = markMap(input.marks);
  const stateOf = (id: string): MarkState => marks.get(id)?.state ?? 'open';
  const minutes = CAPACITY_META[input.capacity].minutes;
  const goalTitle = new Map(input.goals.map((g) => [g.id, g.title]));
  let done = 0;
  let total = 0;
  const phases: PhaseView[] = plan.phases.map((p) => ({
    key: p.key,
    label: PHASE_LABEL[p.key] ?? p.key,
    milestones: p.milestones.map((m) => {
      const mState = stateOf(m.id);
      const steps: StepView[] = m.steps.map((s) => ({
        ...s,
        // Done under a milestone that is done: it is not waiting on anyone.
        state: mState === 'done' && stateOf(s.id) === 'open' ? 'done' : stateOf(s.id),
        fits: SIZE_MINUTES[s.size] <= minutes,
      }));
      total += 1;
      if (mState === 'done') done += 1;
      return {
        id: m.id, title: m.title, why: m.why, doneWhen: m.doneWhen,
        goalId: m.goalId,
        goalTitle: m.goalId ? goalTitle.get(m.goalId) ?? null : null,
        state: mState, steps, open: steps.filter((s) => s.state === 'open').length,
      };
    }),
  }));
  return {
    state: 'ready', here: plan.here, direction: plan.direction, phases,
    drawnAt: input.current.finishedAt ?? input.current.startedAt,
    drawing, failed,
    changes: roadmapChanges(input.previous?.roadmap ?? null, plan),
    done, total,
  };
}

/** Milestones new in this plan and ones that left it, by id. The model's own sentence rides along, labelled as its own. */
export function roadmapChanges(before: Roadmap | null, after: Roadmap): RoadmapChanges | null {
  if (!before) return null;
  const titles = (r: Roadmap) => new Map(r.phases.flatMap((p) => p.milestones.map((m) => [m.id, m.title] as const)));
  const a = titles(before);
  const b = titles(after);
  const added = [...b.entries()].filter(([id]) => !a.has(id)).map(([, t]) => t);
  const dropped = [...a.entries()].filter(([id]) => !b.has(id)).map(([, t]) => t);
  if (!added.length && !dropped.length && !after.changed) return null;
  return { added, dropped, note: after.changed };
}

/**
 * The step the plan puts first: the earliest open one of yours in this week or
 * this month that fits the time you set, under a milestone not yet reached.
 * Handed-over work is not a thing to do now — it is a thing to hand over, and
 * it has its own button on its row.
 */
export function roadmapFirstStep(view: RoadmapView): { step: StepView; milestone: MilestoneView } | null {
  if (view.state !== 'ready') return null;
  for (const p of view.phases) {
    if (p.key !== 'week' && p.key !== 'month') continue;
    for (const m of p.milestones) {
      if (m.state !== 'open') continue;
      const step = m.steps.find((s) => s.state === 'open' && s.who === 'you' && s.fits);
      if (step) return { step, milestone: m };
    }
  }
  return null;
}

/** "3 of 7 milestones" — counted from taps, never estimated. */
export function roadmapProgress(view: RoadmapView): string | null {
  if (view.state !== 'ready' || !view.total) return null;
  return view.done ? `${view.done} of ${plural(view.total, 'milestone')} reached` : plural(view.total, 'milestone');
}

/* ─── The goals, where the plan ends ──────────────────────────────────────── */

export interface GoalMarker {
  id: string;
  title: string;
  /** "€1,000 of €60,000", "2 of 10" — only where the person gave a target. */
  status: string | null;
  progress: { done: number; of: number } | null;
  /** "Within 180 days, as you set it". Their number, said as theirs. */
  horizon: string | null;
  /** Milestones on the plan that point at it and are not reached yet. */
  toward: number;
}

/**
 * Every active goal, in the person's order, with where it stands. The plan's
 * milestones name which goal they serve; a goal nothing on the plan serves is
 * shown anyway, because a goal the plan quietly dropped is a goal the person
 * should be able to see was dropped.
 */
export function goalMarkers(goals: Array<Pick<Goal, 'id' | 'title' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days'>>, view: RoadmapView, currency: string): GoalMarker[] {
  const toward = new Map<string, number>();
  if (view.state === 'ready') {
    for (const p of view.phases) for (const m of p.milestones) {
      if (m.state === 'open' && m.goalId) toward.set(m.goalId, (toward.get(m.goalId) ?? 0) + 1);
    }
  }
  return goals.map((g) => {
    const target = g.target_value && g.target_value > 0 ? g.target_value : null;
    const current = g.current_value ?? 0;
    const fmt = (n: number) => (g.metric === 'currency' ? moneyLabel(n, g.unit || currency) : `${Math.round(n).toLocaleString('en-US')}${g.unit && g.metric !== 'percent' ? ` ${g.unit}` : g.metric === 'percent' ? '%' : ''}`);
    return {
      id: g.id,
      title: g.title,
      status: target ? `${fmt(current)} of ${fmt(target)}` : null,
      progress: target ? { done: Math.min(current, target), of: target } : null,
      horizon: g.horizon_days ? `Within ${g.horizon_days} days, as you set it` : null,
      toward: toward.get(g.id) ?? 0,
    };
  });
}
