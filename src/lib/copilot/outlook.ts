// src/lib/copilot/outlook.ts
// Will it work? The plan's honest read, worked out from rows.
//
// Why this exists. The drawn plan put the goals in a sensible order and never
// said whether the order could get anywhere in time. Ten sales at $150 before a
// November deadline, from nine sends and no rate yet, was the whole question —
// and the planner could not ask it: it may not do arithmetic (roadmap.ts rule 1)
// and it did not know how many days were left (due.ts). The person had to work
// it out alone, which is the one thing a plan is for.
//
// So the arithmetic is done here and handed over. The planner reads these lines
// in its prompt, which is what lets it cite them past the number guard, and the
// Path shows them under "Will it work?" because they are facts, not its view.
//
// What this will not do is print a probability. Estimated percentages were
// deleted from this app once (invariant 2); a verdict here is a word with the
// counts behind it, and "too early to tell" says what would tell.
//
// Signals are the other half: the record saying stop or change something — an
// opener that is not being answered, a step carried plan after plan and never
// done, calls made again and again and never acted on. Each is computed from
// rows with a threshold that already means something in this app.
//
// Pure: no DB import. agent/roadmap.ts gathers the rows; the Path's derive reads
// the verdicts live.

import { daysPhrase, goalDue, type Due } from './due';
import { phraseFor } from './phrase';
import { RATE_SAMPLE, WORKING_REPLIES, sendsPerDay } from './plan';
import { moneyLabel } from './review';
import { CAPACITY_META, type Capacity, type Goal } from './types';

export type Verdict = 'reached' | 'on_track' | 'tight' | 'off_track' | 'too_early' | 'no_date' | 'no_number';

export const VERDICT_WORDS: Record<Verdict, string> = {
  reached: 'Reached',
  on_track: 'On track',
  tight: 'Tight',
  off_track: 'Off track',
  too_early: 'Too early to tell',
  no_date: 'No date on it',
  no_number: 'No number on it',
};

/**
 * On track when what it takes fits in this share of the days left; tight up to
 * all of them. Below one, a plan that needs every remaining day at full pace is
 * called what it is: a plan with no room for a bad week.
 */
export const ON_TRACK_SHARE = 0.7;
/** Under this many days a rate reads better per day than per week. */
const DAILY_UNDER = 14;

export type OutlookGoal = Pick<Goal, 'id' | 'title' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days' | 'created_at'>;

export interface OutlookInput {
  /** Their calendar day. */
  today: string;
  /** The low end of their price (priceOf). */
  price: number | null;
  /** Whether they sell something: the chain from sends to sales applies only then. */
  selling: boolean;
  /**
   * Whether buyers come through what the app sends, as the person said. False
   * walks no goal back to sends: "about 40,500 sends" was the live account's
   * goal line for an app its buyers find online, from a rate earned writing to
   * plumbers. Absent — nobody said — reads as it always did.
   */
  viaSends?: boolean;
  currency: string;
  capacity: Capacity;
  /** Counts over the metrics window. */
  funnel: { windowDays: number; sent: number; won: number; wonAmount: number };
  /** The drawn plan's milestones per goal, reached and still open — the measure of a goal with no number. */
  milestones?: Record<string, { done: number; open: number }>;
}

export interface GoalOutlook {
  goalId: string;
  title: string;
  verdict: Verdict;
  /** One or two sentences. Every number in it is computed here, from the input. */
  line: string;
  due: Due | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One goal's verdict and the sentence behind it.
 *
 * In order: a goal with no number is measured by its milestones, if the plan has
 * any; one already reached says so; one with no date cannot be on or off track
 * and asks for a date; a date that has passed is off track whatever the pace.
 * Then a money goal somebody is selling toward walks the chain — sales at their
 * price, sends at what their sends have earned, days at the time they set —
 * and only once RATE_SAMPLE sends have gone out, because before that the rate
 * is a guess. Anything else says the pace it needs and what the app can see of
 * the pace they keep.
 */
export function goalOutlook(g: OutlookGoal, input: OutlookInput): GoalOutlook {
  const unit = g.metric === 'currency' ? (g.unit || input.currency) : '';
  const money = (n: number) => moneyLabel(n, unit);
  const amount = (n: number) => (g.metric === 'currency' ? money(n) : `${Math.ceil(n).toLocaleString('en-US')}${g.unit ? ` ${g.unit}` : ''}`);
  const due = goalDue(g, input.today);
  const base = { goalId: g.id, title: g.title, due };
  const target = g.target_value && g.target_value > 0 ? g.target_value : null;

  if (!target || g.metric === 'none') {
    const m = input.milestones?.[g.id];
    const total = m ? m.done + m.open : 0;
    return {
      ...base, verdict: 'no_number',
      // The chip already says "No number on it"; the line says what stands in for one.
      line: total
        ? `The plan's milestones are the measure: ${m!.done} of ${plural(total, 'milestone')} reached${due ? `, ${daysPhrase(due)}` : ''}.`
        : 'Nothing here can say whether it is on track. Give it a number and this will.',
    };
  }
  const gap = Math.max(0, target - (g.current_value ?? 0));
  if (gap === 0) return { ...base, verdict: 'reached', line: 'Reached.' };
  if (!due) return { ...base, verdict: 'no_date', line: `${capital(amount(gap))} to go. Give it a date and this says whether your pace gets there.` };
  if (due.daysLeft <= 0) return { ...base, verdict: 'off_track', line: `Its date has passed with ${amount(gap)} to go. Move the date, or change what the plan does about it.` };

  const f = input.funnel;
  const priced = g.metric === 'currency' && input.selling && !!input.price && input.price > 0;
  if (priced && input.viaSends !== false) {
    const sales = Math.ceil(gap / input.price!);
    const need = `${plural(sales, 'sale')} at your ${money(input.price!)} in ${plural(due.daysLeft, 'day')}`;
    if (f.sent < RATE_SAMPLE) {
      return {
        ...base, verdict: 'too_early',
        line: f.sent === 0
          ? `${capital(need)}. Nothing sent yet, so there is no rate to plan on.`
          : `${capital(need)}. ${plural(f.sent, 'send')} so far: ${RATE_SAMPLE - f.sent} more and the rate is a number.`,
      };
    }
    if (f.won === 0 && f.wonAmount <= 0) {
      return { ...base, verdict: 'off_track', line: `${capital(need)}, and no sale from ${plural(f.sent, 'send')} in the last ${f.windowDays} days. At that rate nothing closes it.` };
    }
    // Money per send, when the wins carried amounts: it holds both how often a
    // send turns into a sale and what a sale turned out to be worth. A $1 win
    // counted as a sale at $150 would call a plan on track that is not.
    const perSend = f.wonAmount > 0 ? f.wonAmount / f.sent : (f.won * input.price!) / f.sent;
    const earned = f.wonAmount > 0 ? `${money(f.wonAmount)} earned` : plural(f.won, 'sale');
    const sends = Math.ceil(gap / perSend);
    const days = Math.ceil(sends / sendsPerDay(input.capacity));
    const verdict: Verdict = days <= due.daysLeft * ON_TRACK_SHARE ? 'on_track' : days <= due.daysLeft ? 'tight' : 'off_track';
    // What is needed, what the sends did, what that adds up to: three short
    // sentences in that order. One sentence with the rate in brackets in the
    // middle ("…about 30,000 sends at what yours have earned ($1 from 20
    // sends), 3,000 days of sending…") hid the one comparison that matters —
    // the days it takes against the days left.
    return {
      ...base, verdict,
      line: `${capital(need)}. Last ${f.windowDays} days: ${plural(f.sent, 'send')}, ${earned}. At that rate it takes about ${plural(sends, 'send')}, ${plural(days, 'day')} of sending at ${CAPACITY_META[input.capacity].label}.`,
    };
  }

  const daily = due.daysLeft < DAILY_UNDER;
  const per = daily ? 'day' : 'week';
  const needed = daily ? gap / due.daysLeft : gap / (due.daysLeft / 7);
  // The rate without its unit for a count: "about 1 a day", never "1 applications a day".
  const rate = g.metric === 'currency' ? money(needed) : Math.ceil(needed).toLocaleString('en-US');
  // Selling at a price to buyers who do not come through sends: the goal in
  // sales, and the pace beside it is the money that came in, not a send rate.
  const needs = priced
    ? `${capital(plural(Math.ceil(gap / input.price!), 'sale'))} at your ${money(input.price!)} in ${plural(due.daysLeft, 'day')}: about ${rate} a ${per}`
    : `${capital(amount(gap))} to go in ${plural(due.daysLeft, 'day')}: about ${rate} a ${per}`;
  // What they were paid is the only pace the app sees for money it is not
  // selling toward. It is said as what it is, beside what the goal needs.
  if (g.metric === 'currency' && f.wonAmount > 0 && f.windowDays > 0) {
    const pace = daily ? f.wonAmount / f.windowDays : f.wonAmount / (f.windowDays / 7);
    const ratio = pace / needed;
    const verdict: Verdict = ratio * ON_TRACK_SHARE >= 1 ? 'on_track' : ratio >= 1 ? 'tight' : 'off_track';
    // "About $0 a week" beside "you were paid $1" read as a broken sum: a pace
    // that rounds to nothing is said as under the smallest whole amount.
    const paceWords = Math.round(pace) >= 1 ? `about ${money(pace)}` : `under ${money(1)}`;
    return { ...base, verdict, line: `${needs}. You were paid ${money(f.wonAmount)} in the last ${f.windowDays} days, ${paceWords} a ${per}.` };
  }
  return { ...base, verdict: 'too_early', line: `${needs}. Nothing in the app measures your pace on it yet.` };
}

export function goalOutlooks(goals: OutlookGoal[], input: OutlookInput): GoalOutlook[] {
  return goals.map((g) => goalOutlook(g, input));
}

/** "Save Exit PH [NOV] — Too early to tell. 10 sales at your $150 in 63 days. …" — one line for the planner's prompt. */
export function outlookLine(o: GoalOutlook): string {
  return `${o.title} — ${VERDICT_WORDS[o.verdict]}. ${o.line}`;
}

/* ─── Signals: the record saying stop or change something ─────────────────── */

export interface Signal {
  key: string;
  line: string;
}

/** A step on this many plans in a row, never done, is one the plan should stop carrying as it is. */
export const CARRIED_PLANS = 3;
export const MAX_SIGNALS = 4;
/** Stuck steps named in the one line that says they are stuck, at most. */
const MAX_STUCK_NAMED = 3;

export interface SignalInput {
  /** Messages old enough to have been answered (NO_REPLY_AFTER_DAYS) or answered already, and how many were. */
  settled?: { sends: number; answered: number } | null;
  /** Steps of the current plan still open, with how many plans in a row have carried them. */
  carried?: Array<{ title: string; plans: number }>;
  /**
   * decisionReview's reading of the call record, when it found a pattern: calls
   * made again and again and never acted on, or acted on and nothing moved.
   */
  calls?: { avoided: { topic: string; count: number } | null; dead: { topic: string; count: number } | null; total: number } | null;
}

/**
 * What the record says to stop or change, one line each, strongest first.
 *
 * The opener line uses the rule the funnel plan already prints at its
 * checkpoint — at RATE_SAMPLE sends, fewer than WORKING_REPLIES replies means
 * the first line or the list is wrong — so the plan and the checkpoint cannot
 * disagree about when the evidence is clear. Below that sample nothing is said:
 * nine sends with no reply is a bad week, not a verdict.
 */
export function outlookSignals(input: SignalInput): Signal[] {
  const out: Signal[] = [];
  const s = input.settled;
  if (s && s.sends >= RATE_SAMPLE && s.answered < WORKING_REPLIES) {
    out.push({
      key: 'opener',
      line: s.answered === 0
        ? `No reply from the last ${plural(s.sends, 'message')} that have had three days to answer. Change the first line or the list before sending more like them.`
        : `${plural(s.answered, 'reply', 'replies')} from the last ${plural(s.sends, 'message')} that have had three days to answer, under the ${WORKING_REPLIES} in ${RATE_SAMPLE} this app plans on. Change the first line or the list before sending more like them.`,
    });
  }
  const c = input.calls;
  if (c?.avoided) out.push({ key: 'avoided', line: `${c.avoided.count} of the last ${c.total} calls were about ${phraseFor(c.avoided.topic)} and none was done. Either it is the wrong move or something is in the way.` });
  else if (c?.dead) out.push({ key: 'dead', line: `${c.dead.count} of the last ${c.total} calls were about ${phraseFor(c.dead.topic)}; they were done and the number did not move.` });
  // One line for every stuck step, not one each: Alex's plan printed three rows
  // of "On 3 plans in a row and still not done", which is one fact — the plan
  // keeps carrying what does not get done — said three times.
  const stuck = (input.carried ?? []).filter((x) => x.plans >= CARRIED_PLANS);
  if (stuck.length === 1) {
    out.push({ key: 'carried', line: `On ${stuck[0].plans} plans in a row and still not done: ${stuck[0].title}. Drop it, make it smaller, or hand it over.` });
  } else if (stuck.length > 1) {
    const named = stuck.slice(0, MAX_STUCK_NAMED).map((x) => x.title).join('; ');
    const more = stuck.length > MAX_STUCK_NAMED ? `; and ${stuck.length - MAX_STUCK_NAMED} more` : '';
    out.push({ key: 'carried', line: `${stuck.length} steps on ${CARRIED_PLANS} or more plans in a row and still not done: ${named}${more}. Drop them, make them smaller, or hand them over.` });
  }
  return out.slice(0, MAX_SIGNALS);
}

/**
 * Steps of the newest plan still open, with how many plans in a row carried
 * each (by id, which a redraw keeps for the same step even when reworded).
 * Plans newest first; `open` says whether the person has ticked or set it aside.
 */
export function carriedSteps(
  plans: Array<{ phases: Array<{ milestones: Array<{ steps: Array<{ id: string; title: string }> }> }> }>,
  open: (id: string) => boolean,
): Array<{ title: string; plans: number }> {
  const [current, ...older] = plans;
  if (!current) return [];
  const ids = (p: (typeof plans)[number]) => new Set(p.phases.flatMap((ph) => ph.milestones.flatMap((m) => m.steps.map((st) => st.id))));
  const olderIds = older.map(ids);
  const out: Array<{ title: string; plans: number }> = [];
  for (const ph of current.phases) for (const m of ph.milestones) for (const st of m.steps) {
    if (!open(st.id)) continue;
    let n = 1;
    for (const set of olderIds) { if (!set.has(st.id)) break; n += 1; }
    out.push({ title: st.title, plans: n });
  }
  return out.sort((a, b) => b.plans - a.plans);
}
