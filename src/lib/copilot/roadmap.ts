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
// 1. A number the input did not contain does not survive (`unsourced`).
//    Targets, prices, counts and dates the person gave pass; "a 20% reply rate",
//    "€3,000 by March", "in 45 days" and "by mid-October" do not, whether the
//    number is written in digits or in words, and the line carrying one is
//    dropped rather than shown with the number blanked. In a step or a
//    milestone a small count ("two calls", "send three") is an instruction and
//    passes; in a reason it is a claim ("five sales cover the fine") and needs
//    a source like any other number. Invariant 2.
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

import type { DecisionDraft } from './decision';
import { dueLabel, goalDue } from './due';
import {
  ANGLES, ANGLE_PROMPT, experimentView, parseExperiment, storedExperiment,
  type Experiment, type ExperimentMark, type ExperimentState, type ExperimentView,
} from './experiment';
import { hoursLabel, type FocusLog } from './focus';
import type { Stake } from './stake';
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
const DIRECTION_MAX = 420;
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
  /**
   * Items of this plan that the person's own recent words say are done ("booked
   * two markets for October"). A question, never a tick: the screen asks "Did
   * you finish this?" and only the person's tap marks it (rule 2). Absent on
   * plans drawn before it existed.
   */
  suggestedDone?: string[];
  /** The one experiment, or none (experiment.ts). Carried unchanged while it is open. */
  experiment?: Experiment | null;
  /**
   * What the record said when this was drawn — an opener nobody answers, a step
   * carried plan after plan — computed from rows (outlook.ts), never written by
   * the model. Shown beside the plan that had to answer it.
   */
  signals?: string[];
}

/* ─── What goes in ────────────────────────────────────────────────────────── */

export interface RoadmapGoal {
  id: string;
  title: string;
  metric: Goal['metric'];
  unit: string | null;
  target: number | null;
  current: number | null;
  /** Its date and the days left to it (due.ts) — never the horizon it was written with, which does not count down. */
  dueOn: string | null;
  daysLeft: number | null;
  /** The date is the table's default rather than one they picked, so the planner is told it may not be theirs. */
  defaultDate?: boolean;
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
  /**
   * Openers already written and waiting to be sent. The plan decides whether
   * sending them is this week's work — "Now" follows it — so it has to know
   * they exist. Null on a blank offer, where nothing is shown to send.
   */
  drafts?: { count: number; oldestDays: number } | null;
  /**
   * What the app's checks found and are waiting on an answer for, one line
   * each: "Casa Blanca paid 3 days ago and nothing was delivered". Computed by
   * jobs from rows. Proposals are left out — a model wrote those, and the plan
   * is not fed another model's view (rule 3).
   */
  found?: string[];
  /** Will it work, per goal, computed from rows (outlook.ts): the arithmetic the planner may not do itself. */
  outlook?: string[];
  /** What the record says to stop or change (outlook.ts). The plan must answer each. */
  signals?: string[];
  /** Messages they sent and whether each was answered — both halves, as the brief is shown them. */
  openers?: Array<{ text: string; replied: boolean }>;
  /** What people wrote back, in their own words. */
  replies?: Array<{ business: string | null; text: string }>;
  /** The calls the app made, newest first, and what happened to each. */
  calls?: string[];
  /** The experiments so far and the open one (experiment.ts). */
  experiments?: {
    ledger: string[];
    angles: string[];
    open: Experiment | null;
    openState: ExperimentState | null;
    /** They set the last ones aside: offer none this time. */
    paused: boolean;
  };
  /** What the connected agent can do alone (COPILOT_AGENT_CAN), when one is connected. */
  agentCan?: string | null;
}

export const ROADMAP_SYSTEM = `You draw one person's plan, from where they are now to the goals they set, over weeks and months, and you say honestly whether it can get there. You are the planner who decides the order and the judge who tells the truth about it, not a coach writing encouragement.

You get who they are, the goals they wrote in their own priority order with their dates, what they told the app in their own words, the time they have each day, and what the record shows actually happened: replies, payments, hours logged, messages sent and which were answered, the calls the app made and what they did with them, the experiments they ran and how each came out, and what they did with each step of the last plan. Two blocks are computed by the app from their rows, not guessed: WILL IT WORK and WHAT THE RECORD SAYS.

How to draw it:
- Start from what is achievable now. "week" holds quick wins that make the next phase possible, sized to the minutes they have each day. Do not put more in "week" than those minutes hold.
- A milestone is an outcome, not an activity: "A first paying client for the renovation work", not "Work on marketing". Give each a done_when a person can check without arguing: "One person has paid", "The listing is live", "Three offers compared side by side".
- Steps are the next concrete actions under a milestone, each one person can do. Start each with a verb. Size each: quick (under 30 minutes), sitting (one focused sitting), days (several days of work).
- Tag each step: quick_win (small, fast, a visible result), leverage (one action that unlocks or compounds several later ones), foundation (unglamorous and necessary).
- Order by dependency and leverage: what has to be true before the next thing is possible. Say the reasoning for the order once, in direction.
- Goals compete for the same hours. When two pull against each other, say which comes first and why in direction, and put the other later.
- Plan for what each goal actually needs: a job search, a skill, a move, savings, a qualification, a product, a business. Selling is one path among several. Plan outreach only for a goal that needs it, and never turn a goal that is not about selling into outreach.
- If they seem lost — goals vague, nothing working — the first milestone is getting clear: a small experiment or one conversation that produces a fact. Do not make the decision for them.
- What the app's checks found is real and computed from their records: money owed, a client waiting, a goal falling behind. Plan around it; money due soon belongs in "week".
- Drafts already written are listed when there are any. If sending them serves this week, make it a step ("Send the waiting drafts"). If the record says the opener or the list is wrong, the step is to fix that first — never send more of what is not working.
- Use what happened. A step marked done is done: build on it, never repeat it. A step marked dropped stays out in that form. When something has brought results, lean into it; when the record shows effort and nothing back, change the approach and say what you changed in changed.
- Later phases can be one milestone with no steps. A plan past the next quarter is a direction, not a schedule.

Tell the truth about whether it works:
- WILL IT WORK says, for each goal, whether the pace the record shows gets there by its date. When a goal is off track or too early to tell, here.line says so plainly, and the plan changes something that could change the answer — the approach, the size of the offer, the target, the date, or a fast test of the thing it all rests on — instead of asking for more of the same effort. Never call a goal on track when that block does not.
- Each line under WHAT THE RECORD SAYS is evidence to act on. Change the plan because of it and say so in changed, or keep going and say why in direction. Never leave one unanswered.
- Never say one thing caused another unless the record shows it. A message never sent caused nothing.
- Messages that were answered and ones that were ignored are listed when there are any. Plan around the difference; with fewer than three on either side, say the sample is small instead of drawing a rule from it.

One experiment:
- experiment is one move they would probably not have written themselves that could change a goal's outcome more than steady effort would. Search before you choose. Weigh at least eight candidates across these angles: ${ANGLES.map((a) => `${a} (${ANGLE_PROMPT[a]})`).join('; ')}. Throw out anything already in their notes, in this plan or the last one, anything the record contradicts, and anything that needs money or time they do not have. Keep the one with the most evidence behind it and the cheapest test.
- why cites their record or their own words. test is what to do, sized to one day's minutes. watch is the result that would show it worked, visible within check_days (2 to 14). Lean into angles the experiments so far say worked; never offer an angle that failed twice.
- Most weeks the plan itself is plain, and the experiment is where a considered risk goes. If nothing clears that bar, experiment is null: a plain week beats a clever guess.
- When an experiment is open, or experiments are paused, return experiment null: the open one is carried as it is. The experiment is never also a step.

Hard rules:
- Never invent a number about them. Use only numbers that appear in the input: their targets, prices, counts, days, and the arithmetic under WILL IT WORK. Do not estimate rates, percentages, income, costs or durations, in digits or in words, and do not multiply the input's numbers into new ones. A line with a number not in the input is thrown away. In a step or a milestone a small count of things to do ("send three", "two calls") is fine; in why, here, direction and changed it is not.
- Never name a month or a date the input does not contain. "By mid-October" is a promise nobody made.
- Never state as fact anything the input does not say.
- Reuse the id of an earlier milestone or step when it is the same thing, even reworded. New things get a new short id in kebab-case.
- who is "ai" only for a step the connected agent can finish alone, within what THE AGENT says it can do, and only when ai_available is true. Never for contacting anyone, sending, posting, applying, spending, signing, or anything that needs their accounts or their name. Everything else is "you".
- At most ${MAX_MILESTONES_PER_PHASE} milestones per phase and ${MAX_STEPS_PER_MILESTONE} steps per milestone. Fewer is better.
- Plain words, second person, short. No filler, no motivation, no exclamation marks.

probably_done lists the ids of steps or milestones from the last plan, still open, that their own recent words say they have already done — "booked two markets" for a step about booking markets. Only from their words, never from silence or a guess. Keep those items in the plan: the person ticks them, you do not. Empty when nothing they wrote says so.

here.title is where they stand in at most eight words ("Job search, two interviews in"). here.line is one sentence: what is true now, and whether the pace gets their first goal there in time. why is one sentence. direction is at most two sentences, under 300 characters. changed is one sentence, and null on a first plan.

Return only JSON:
{"here":{"title":"...","line":"..."},"direction":"...","changed":null,"probably_done":[],"experiment":{"id":"...","title":"...","angle":"fast_test","goal_id":null,"why":"...","test":"...","watch":"...","check_days":7},"phases":[{"key":"week","milestones":[{"id":"...","title":"...","why":"...","done_when":"...","goal_id":null,"steps":[{"id":"...","title":"...","size":"quick","tag":"quick_win","who":"you"}]}]}]}
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
    // The date and the days left today — never the horizon it was written with,
    // which a model reads as "ninety days left" every day (due.ts).
    if (g.dueOn && g.daysLeft != null) {
      const left = g.daysLeft > 0 ? `${g.daysLeft} days left` : g.daysLeft === 0 ? 'due today' : `${-g.daysLeft} days past its date`;
      parts.push(`due ${g.dueOn}, ${left}${g.defaultDate ? ' (the app gave it this date by default; they may not have chosen it)' : ''}`);
    } else {
      parts.push('no date');
    }
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

  if (input.outlook?.length) {
    lines.push('WILL IT WORK, computed by the app from their rows:');
    for (const o of input.outlook) lines.push(`- ${o}`);
    lines.push('');
  }
  if (input.signals?.length) {
    lines.push('WHAT THE RECORD SAYS, act on each:');
    for (const sig of input.signals) lines.push(`- ${sig}`);
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
  if (input.found?.length) {
    lines.push("WHAT THE APP'S CHECKS FOUND, waiting on an answer:");
    for (const f of input.found) lines.push(`- ${f}`);
  }
  if (input.drafts && input.drafts.count > 0) {
    lines.push(`DRAFTS WRITTEN AND WAITING: ${input.drafts.count}, the oldest ${input.drafts.oldestDays} days old`);
  }
  // Both halves or neither (conversations.ts): shown only the answered ones, a
  // model concludes that everything works. "Rewrite the opener" was written by
  // a planner that had never seen the opener.
  if (input.openers?.length) {
    lines.push('');
    lines.push('MESSAGES THEY SENT, and whether each was answered (silence counts after three days):');
    for (const o of input.openers) lines.push(`- ${o.replied ? 'answered' : 'ignored'}: "${o.text}"`);
  }
  if (input.replies?.length) {
    lines.push('');
    lines.push('WHAT PEOPLE WROTE BACK, in their words:');
    for (const r of input.replies) lines.push(`- ${r.business ? `${r.business}: ` : ''}"${r.text}"`);
  }
  if (input.calls?.length) {
    lines.push('');
    lines.push('CALLS THE APP MADE, newest first, and what happened:');
    for (const c of input.calls) lines.push(`- ${c}`);
  }
  const x = input.experiments;
  if (x) {
    lines.push('');
    if (x.ledger.length) {
      lines.push('EXPERIMENTS SO FAR, newest first:');
      for (const l of x.ledger) lines.push(`- ${l}`);
      if (x.angles.length) lines.push(`By angle: ${x.angles.join(' · ')}`);
    } else {
      lines.push('EXPERIMENTS SO FAR: none yet.');
    }
    if (x.open) lines.push(`THE OPEN EXPERIMENT, carried as it is — offer no other: ${x.open.title} (${x.openState === 'started' ? 'they are trying it' : 'offered, not started yet'})`);
    else if (x.paused) lines.push('EXPERIMENTS ARE PAUSED: they set the last ones aside. Offer none this time.');
  }
  lines.push('');
  lines.push(`ai_available: ${input.aiAvailable}`);
  if (input.aiAvailable) lines.push(`THE AGENT can do, alone: ${input.agentCan?.trim() || DEFAULT_AGENT_CAN}. It never contacts anyone, posts, applies, spends or signs.`);
  return lines.join('\n');
}

/**
 * What a connected agent is assumed to do when COPILOT_AGENT_CAN does not say:
 * the reference n8n worker's reach — it searches, reads pages, compares and
 * writes. An agent that can build, code or fill a spreadsheet says so in that
 * variable, and the planner hands it those steps too (invariant 7: nothing is
 * handed to it that it has not said it can do).
 */
export const DEFAULT_AGENT_CAN = 'research on the open web, reading pages, comparisons, written drafts and documents';

/** Open findings the plan is shown, at most. */
export const MAX_FOUND = 8;

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

const UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12,
};
const SCALE_WORDS: Record<string, number> = { hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };
/** A run of number words: "five", "twenty-five", "two thousand", "a hundred and ten". */
const WORD_RUN = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|dozen|hundred|thousand|million|billion)(?:(?:[\s-]+|\s+and\s+)(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion))*\b/gi;

function wordValue(run: string): number {
  let total = 0;
  let current = 0;
  for (const w of run.toLowerCase().split(/[\s-]+/)) {
    if (w === 'and') continue;
    if (w in UNIT_WORDS) current += UNIT_WORDS[w];
    else if (w === 'hundred') current = (current || 1) * 100;
    else if (w in SCALE_WORDS) { total += (current || 1) * SCALE_WORDS[w]; current = 0; }
  }
  return total + current;
}

/**
 * Every number in a piece of text, written as digits or as words. The guard
 * read digits only, and "Five sales at $150 covers the fine and a ticket" went
 * straight through it: five was never in the input, and neither was the price
 * of the fine or the ticket.
 */
function numbersIn(text: string): Found[] {
  const out: Found[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const base = parseFloat(`${m[2].replace(/,/g, '')}${m[3] ? `.${m[3]}` : ''}`);
    if (!Number.isFinite(base)) continue;
    const suffix = (m[4] ?? '').trim().toLowerCase();
    const value = suffix === 'k' ? base * 1000 : base;
    out.push({ raw: m[0].trim(), value, marked: !!m[1] || !!suffix || !!m[3] });
  }
  for (const m of text.matchAll(WORD_RUN)) out.push({ raw: m[0], value: wordValue(m[0]), marked: false });
  return out;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthOf = (w: string): number => {
  const l = w.toLowerCase().replace(/^sept$/, 'sep');
  const full = MONTHS.indexOf(l);
  return full >= 0 ? full : MONTH_ABBR.indexOf(l);
};
/**
 * A month named in the plan's own words. Capitalised, or an abbreviation in
 * capitals ("NOV"), so "march on" and "a mar" are not months. May is left out
 * altogether: it cannot be told apart from the verb, and a guard that drops
 * every "you may" is worse than one that misses a May.
 */
const MONTH_IN_PLAN = /\b(?:(January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)|(JAN|FEB|MAR|APR|JUN|JUL|AUG|SEPT?|OCT|NOV|DEC))\b/g;
const MONTH_IN_INPUT = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/gi;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?\b/g;
/** "- [id] title" — the ids the prompt lists items by. A UUID is full of digits nobody said. */
const LISTED_ID = /^(\s*- )\[[^\]\s]+\] /gm;

/**
 * What the input carried: every number as a value, the bare ones apart, and
 * every month it named. Counts are kept apart because a value is not a meaning:
 * "five sales" matched the €5 price and passed, when nobody had said five of
 * anything. A small bare number has to match a bare one.
 */
export interface Sourced { numbers: Set<number>; counts: Set<number>; months: Set<number> }

/**
 * The numbers and months the plan may use: the ones in the prompt the model was
 * shown, with two kinds of noise taken out first. Ids ("[3f2a…]") and the
 * digits of dates are not quantities anybody gave — a day of the month let any
 * small number through by accident. A date's month is kept: "the 25 Sep reply"
 * may say September.
 */
export function sourcedFrom(prompt: string): Sourced {
  const months = new Set<number>();
  const clean = prompt
    .replace(LISTED_ID, '$1')
    .replace(ISO_DATE, (_m, _y, mo: string) => { months.add(Number(mo) - 1); return ' '; });
  for (const m of clean.matchAll(MONTH_IN_INPUT)) {
    const i = monthOf(m[1]);
    if (i >= 0) months.add(i);
  }
  const numbers = new Set<number>();
  const counts = new Set<number>();
  for (const n of numbersIn(clean)) {
    numbers.add(n.value);
    if (!n.marked) counts.add(n.value);
  }
  return { numbers, counts, months };
}

/**
 * Where a line sits decides what a small number means in it.
 *
 * - `target`: a step, a milestone, what makes it done — "send three", "two
 *   market days booked". A count up to SMALL_COUNT is an instruction, not a
 *   claim about the person, and passes.
 * - `claim`: a reason, where you are, why this order, what changed. A number
 *   there asserts something ("five sales cover the fine"), so every one must
 *   come from the input. Only "one" passes, because English cannot say "the
 *   one channel that works" without it.
 */
export type LineKind = 'target' | 'claim';

/**
 * The first number or month in `text` that the input did not contain, or null.
 * Money, a percentage and a decimal always need a source, whichever the kind.
 * A month is a timeline — "by mid-October you will know" — and a timeline the
 * person did not give is a promise the plan cannot keep.
 */
export function unsourced(text: string, src: Sourced, kind: LineKind): string | null {
  for (const n of numbersIn(text)) {
    const small = !n.marked && Number.isInteger(n.value) && n.value <= SMALL_COUNT;
    if (small && (n.value === 1 || kind === 'target' || src.counts.has(n.value))) continue;
    if (!small && src.numbers.has(n.value)) continue;
    return n.raw;
  }
  for (const m of text.matchAll(MONTH_IN_PLAN)) {
    const i = monthOf(m[1] ?? m[2]);
    if (i >= 0 && !src.months.has(i)) return m[0];
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
  if (t.length <= max) return t;
  // Cut at the last whole sentence that fits. "…nothing new on renovation…" was
  // the reasoning for the order stopped mid-thought, which reads as the app
  // losing its train of thought about somebody's life. Only when no sentence
  // ends early enough is it cut at a word, never mid-word.
  const head = t.slice(0, max);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '), /[.?!]$/.test(head) ? head.length - 1 : -1);
  if (end >= max * 0.4) return head.slice(0, end + 1);
  return `${head.replace(/\s+\S*$/, '')}…`;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : dflt);

export function slugId(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, ID_MAX) || 'item';
}

export interface ParseContext {
  /** sourcedFrom() over the prompt the model was shown. */
  allowed: Sourced;
  goalIds: string[];
  aiAvailable: boolean;
  /** The last plan's ids by lower-cased title, so a model that forgot the id still carries the marks. */
  previousIds?: Map<string, string>;
  /** The last plan's items still open, the only ones probably_done may name. */
  previousOpen?: Set<string>;
  /**
   * The experiment rules for this draw (experiment.ts): the open one, carried as
   * it is whatever the model returns; whether offering one is paused; and what
   * the person already has, which a new one must not restate.
   */
  experiment?: { carry: Experiment | null; paused: boolean; known: string[]; today: string };
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
  const clean = (v: unknown, max: number, kind: LineKind): string | null => {
    const t = text(v, max);
    if (!t) return null;
    if (unsourced(t, ctx.allowed, kind)) { withheld += 1; return null; }
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
      const title = clean(mo.title, TITLE_MAX, 'target');
      if (!title) continue;
      const steps: RoadmapStep[] = [];
      for (const s of arr(mo.steps)) {
        if (steps.length >= MAX_STEPS_PER_MILESTONE) break;
        const so = obj(s);
        const st = clean(so.title, TITLE_MAX, 'target');
        if (!st) continue;
        const who = so.who === 'ai' && ctx.aiAvailable ? 'ai' : 'you';
        steps.push({ id: uniqueId(so.id, st), title: st, size: oneOf(so.size, SIZES, 'sitting'), tag: oneOf(so.tag, TAGS, 'foundation'), who });
      }
      const goal = typeof mo.goal_id === 'string' && ctx.goalIds.includes(mo.goal_id) ? mo.goal_id : null;
      list.push({ id: uniqueId(mo.id, title), title, why: clean(mo.why, TEXT_MAX, 'claim'), doneWhen: clean(mo.done_when, TEXT_MAX, 'target'), goalId: goal, steps });
    }
    byKey.set(key, list);
  }
  const phases = PHASES.map((key) => ({ key, milestones: byKey.get(key) ?? [] })).filter((p) => p.milestones.length > 0);
  if (!phases.length) return null;

  // One experiment at a time. An open one is carried as it was offered, so a
  // redraw cannot swap out what somebody is in the middle of trying; otherwise
  // the model's, held to the same guard as every line, and to being new.
  const x = ctx.experiment;
  let experiment: Experiment | null = null;
  if (x?.carry) experiment = x.carry;
  else if (x && !x.paused && r.experiment) {
    const steps = phases.flatMap((p) => p.milestones.flatMap((m) => [m.title, ...m.steps.map((st) => st.title)]));
    experiment = parseExperiment(r.experiment, {
      keep: (v, kind) => clean(v, TEXT_MAX, kind),
      goalIds: ctx.goalIds,
      today: x.today,
      known: [...x.known, ...steps],
    });
  }

  const h = obj(r.here);
  const hereTitle = clean(h.title, 60, 'claim');
  // Only ids that were open on the last plan and are on this one: a suggestion
  // about something the person cannot see, or already ticked, asks nothing.
  const onPlan = new Set(phases.flatMap((p) => p.milestones.flatMap((m) => [m.id, ...m.steps.map((st) => st.id)])));
  const suggestedDone = [...new Set(arr(r.probably_done).filter((x): x is string => typeof x === 'string').map(slugId))]
    .filter((id) => onPlan.has(id) && !!ctx.previousOpen?.has(id));
  return {
    roadmap: {
      ...(suggestedDone.length ? { suggestedDone } : {}),
      ...(experiment ? { experiment } : {}),
      here: hereTitle ? { title: hereTitle, line: clean(h.line, TEXT_MAX, 'claim') } : null,
      // Room for the two sentences the prompt asks for, and a little over: a
      // model that runs long loses a sentence, not half of one.
      direction: clean(r.direction, DIRECTION_MAX, 'claim'),
      changed: clean(r.changed, DIRECTION_MAX, 'claim'),
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
  /** The plan saved, and today's call could not be moved to follow it (refreshCallFromPlan). */
  callError?: string | null;
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
        suggestedDone: arr(plan.suggestedDone).filter((x): x is string => typeof x === 'string'),
        experiment: storedExperiment(plan.experiment),
        signals: arr(plan.signals).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 6),
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
    callError: typeof out.callError === 'string' && out.callError ? out.callError : null,
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

/** The last plan's items nobody has ticked or set aside: what probably_done may name. */
export function openIds(roadmap: Roadmap | null, marks: RoadmapMark[]): Set<string> {
  const m = markMap(marks);
  const ids = new Set<string>();
  for (const p of roadmap?.phases ?? []) for (const ms of p.milestones) {
    for (const id of [ms.id, ...ms.steps.map((st) => st.id)]) if ((m.get(id)?.state ?? 'open') === 'open') ids.add(id);
  }
  return ids;
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
      /** Items the person's own words say are done and nobody has ticked: asked about, one tap each. */
      suggested: Array<{ id: string; title: string }>;
      /** The experiment, offered or being tried; null once answered, set aside, or never offered. */
      experiment: ExperimentView | null;
      /** What the record said when this plan was drawn (outlook.ts). */
      signals: string[];
      /** Today's call could not be moved to follow this plan, and why. */
      callError: string | null;
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
  /** The experiment marks, for its stage. Absent: an offered one reads as offered. */
  experimentMarks?: ExperimentMark[];
  /** Their calendar day, for an experiment's check date. */
  today?: string;
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
    // Still open by the marks, so a tick — or a "not for me" — answers it.
    suggested: (plan.suggestedDone ?? []).flatMap((id) => {
      if (stateOf(id) !== 'open') return [];
      const item = roadmapItem(plan, id);
      return item ? [{ id, title: item.title }] : [];
    }),
    experiment: experimentView(plan.experiment, input.experimentMarks ?? [], input.today ?? input.now.toISOString().slice(0, 10)),
    signals: plan.signals ?? [],
    callError: input.current.callError ?? null,
  };
}

/** A step of this plan and the milestone it sits under, by id: what a handover is written from. */
export function roadmapStep(roadmap: Roadmap | null, id: string): { step: RoadmapStep; milestone: RoadmapMilestone } | null {
  for (const p of roadmap?.phases ?? []) for (const m of p.milestones) {
    const step = m.steps.find((x) => x.id === id);
    if (step) return { step, milestone: m };
  }
  return null;
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
  /**
   * "By 30 Nov · 63 days left": the goal's date, counted down (due.ts). It said
   * "Within 90 days, as you set it" — the horizon it was written with, which
   * never moved, under goals whose sheet had no date field to set.
   */
  horizon: string | null;
  /** Milestones on the plan that point at it and are not reached yet. */
  toward: number;
  /** Will it work, in a word, from outlook.ts: "Off track", "Too early to tell". */
  verdict?: string | null;
}

/**
 * Every active goal, in the person's order, with where it stands. The plan's
 * milestones name which goal they serve; a goal nothing on the plan serves is
 * shown anyway, because a goal the plan quietly dropped is a goal the person
 * should be able to see was dropped.
 */
export function goalMarkers(
  goals: Array<Pick<Goal, 'id' | 'title' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days' | 'created_at'>>,
  view: RoadmapView,
  currency: string,
  today: string,
  verdicts?: Map<string, string>,
): GoalMarker[] {
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
      horizon: dueLabel(goalDue(g, today), today),
      toward: toward.get(g.id) ?? 0,
      verdict: verdicts?.get(g.id) ?? null,
    };
  });
}

/**
 * The goals the plan is working on, and the ones it is not. The first goal by
 * the person's order always shows; so does any goal a milestone leads to. The
 * rest wait, folded into one line: Alex's plan ended in five goals in a row
 * that each said "Nothing on the plan leads here yet", which is one fact —
 * the plan put the exit first — said five times.
 */
export function goalLayout(goals: GoalMarker[]): { shown: GoalMarker[]; waiting: GoalMarker[] } {
  const shown = goals.filter((g, i) => i === 0 || g.toward > 0);
  return { shown, waiting: goals.filter((g) => !shown.includes(g)) };
}

/** Whether the plan serves one goal at most — then "For <goal>" on every milestone says nothing new. */
export function planServesOneGoal(view: RoadmapView): boolean {
  if (view.state !== 'ready') return true;
  const ids = new Set(view.phases.flatMap((p) => p.milestones.map((m) => m.goalId ?? '')));
  return ids.size <= 1;
}

/* ─── The plan as the day's call ──────────────────────────────────────────── */

/** The topic a call drawn from the plan is recorded under, so answering it can tick the step. */
export const PLAN_TOPIC = 'plan';
/** Money due within this many days is the one thing that still outranks the plan for the call. */
export const MONEY_WAITING_DAYS = 7;

/**
 * Real money, due soon: a deposit owed, a client who paid and is waiting for
 * the work. A job computes both from rows, and a plan drawn last night may not
 * have seen it yet. A goal's gap carries a value too, but it is due at the
 * goal's horizon, weeks out, and it is exactly what the plan is ordered against.
 */
export function moneyWaiting(stake: Pick<Stake, 'value' | 'withinDays'> | null | undefined): boolean {
  return !!stake && (stake.value ?? 0) > 0 && stake.withinDays <= MONEY_WAITING_DAYS;
}

/**
 * The day's call, from the plan: its first step of the person's own that fits
 * today, and what it was chosen over.
 *
 * Why the plan leads. Three things each answered "what should I do": the call,
 * the Moves and the plan. They agreed only by luck — Alex's plan put the exit
 * fund and a rewritten opener first, and the call the same evening was to apply
 * for a maintenance coordinator role. The plan is the one drawn against every
 * goal, with the record of what was done, so the call is its next step, and the
 * Move arbitration would have picked is named as what it was chosen over. That
 * Move stays on the list; it is not answered by this.
 *
 * Confidence is 'high': the call is not a guess about a category of work, it is
 * the next step of the plan the person is following. It stakes nothing on a
 * number, so it is graded as done or not, like any call with no metric.
 */
export function planCall(first: { step: Pick<StepView, 'title'>; milestone: Pick<MilestoneView, 'title' | 'why'> } | null, runnerUp: { headline: string } | null): DecisionDraft | null {
  if (!first) return null;
  return {
    headline: first.step.title,
    because: [`It is the next step toward: ${first.milestone.title}.`, ...(first.milestone.why ? [first.milestone.why] : [])],
    instead_of: runnerUp && runnerUp.headline !== first.step.title ? runnerUp.headline : undefined,
    confidence: 'high',
    topic: PLAN_TOPIC,
    verify_metric: 'none',
  };
}

/**
 * Whether a call drawn from a plan just redrawn takes today's place.
 *
 * The call is picked once, by the brief; the plan can be redrawn after it —
 * when the app is opened, when somebody tells it something. Nothing re-picked
 * the call, so a plan drawn "just now" sat under a call picked before it: the
 * card said to send ten of the old drafts while the plan below it said the old
 * opener had never been answered and to rewrite it first.
 *
 * Only an unanswered call moves — an answer is part of the record and stays
 * where it was given. Money due this week keeps the call it has, the same rule
 * persistBrief follows. And a plan with no step of the person's that fits today
 * leaves the call alone rather than taking it away.
 */
export function replacesCall(
  current: { response: string; headline: string } | null,
  planned: { headline: string } | null,
  moneyFirst: boolean,
): boolean {
  if (!current || current.response !== 'pending') return false;
  if (moneyFirst || !planned) return false;
  return planned.headline.trim() !== current.headline.trim();
}

/** The step a call was drawn from, found by its words: the call carries no column for it, and needs none. */
export function stepForCall(roadmap: Roadmap | null, headline: string): { id: string; title: string } | null {
  for (const p of roadmap?.phases ?? []) for (const m of p.milestones) {
    const s = m.steps.find((x) => x.title === headline);
    if (s) return { id: s.id, title: s.title };
  }
  return null;
}

/* ─── What the plan is working on, for the rest of the app ─────────────────── */

/** Lines of plan the ranker and the search planner are shown, at most. */
export const MAX_FOCUS = 6;

/**
 * The plan's open milestones this week and this month, with the steps not yet
 * ticked, one line each: "This week: Have your next market days booked — next:
 * Contact market organizers and confirm your next stall dates".
 *
 * What finds matches and what ranks them were never told where the person is
 * going, so they kept looking for buyers of the offer while Alex's plan said
 * "a job offer" and Maria's said "market days booked". This hands them the
 * plan's words — titles the person sees and ticks, never its reasons (rule 3) —
 * so the searching serves the plan the person is following.
 */
export function planFocus(roadmap: Roadmap | null, marks: RoadmapMark[]): string[] {
  if (!roadmap) return [];
  const m = markMap(marks);
  const open = (id: string) => (m.get(id)?.state ?? 'open') === 'open';
  const lines: string[] = [];
  for (const p of roadmap.phases) {
    if (p.key !== 'week' && p.key !== 'month') continue;
    for (const ms of p.milestones) {
      if (!open(ms.id)) continue;
      const next = ms.steps.filter((st) => open(st.id)).map((st) => st.title);
      lines.push(`${PHASE_LABEL[p.key]}: ${ms.title}${next.length ? ` — next: ${next.join('; ')}` : ''}`);
      if (lines.length >= MAX_FOCUS) return lines;
    }
  }
  return lines;
}
