// src/lib/copilot/propose.ts
// The app proposing work for itself to do, instead of waiting to be told.
//
// The gap this closes, and it is the shape of the product rather than a feature.
// Every surface on Now is something the app FOUND and the user DOES:
//
//   the Call    app chose it        you do it       "I did it"
//   a Move      app produced it     you do it       "Did it" / "Not this one"
//   a mandate   YOU thought of it   app does it     type it into a blank box
//
// The gradient is inverted. The one thing that asks least of the user to carry
// out asks most of them to conceive — and the app's only real edge, knowing
// which of forty things matters from this person's own rows, was spent on work
// they then did themselves and withheld from the one surface where it would do
// the work for them. "Put something to work" is also, precisely, the thing
// somebody can already get by typing into a chat window, which makes it the
// worst possible place for this product to ask for effort.
//
// So a proposal is not a fourth surface. It is a Move whose artifact is a plan:
//
//   MoveDraft   job, kind, headline, why[], artifact, cost_label, stake
//   Commission  objective,     why,  plan[], budget_minutes, goal_id
//
// headline is the objective, why[] is the reason, cost_label is what approving
// costs, stake is the goal it claims to move, and the plan is the artifact. It
// enters the same pool arbitrate() ranks, so it cannot add a card: it either
// wins and IS the Call with a different verb, or it places among the Moves, or
// it is under CALL_FLOOR and nothing renders. The permanent "Hand something
// over" button, which says the same thing every morning forever whether or not
// there is anything worth handing over, is the noisy design.
//
// THE DIVISION OF LABOUR IS THE SAFETY PROPERTY. The model writes WHAT — an
// objective and a plan. The job writes WHY, from rows, with proposalFrom. A
// model handed the numbers will round them, paraphrase them and eventually
// invent one; a `why` computed here cannot, because it never passes through a
// model at all. That is invariant 2 made structural rather than promised.
//
// Pure — no DB import — so copilot-core.test.ts covers the gate, the reasons and
// the parse. jobs/propose.ts does the reading and the one model call.

import { MOVE_KINDS, type MoveDraft, type MoveKind } from './moves';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX } from './commission';
import type { BusinessMetric } from './stake';
import type { WorthRecord } from './worth';
import type { Goal, Metrics } from './types';

/**
 * Its own job key, and deliberately not `commission`.
 *
 * Sharing the key would be tidier for the worth rollup and wrong everywhere
 * else: runJobs bars a stood-down job from producing at all, so "stop proposing
 * work to me" would also silence commissionJob — and a mandate the user already
 * approved could no longer ask them the question it is blocked on. Refusing
 * suggestions and refusing to be asked are different sentences.
 */
export const PROPOSE_JOB = 'propose';

/** One open proposal at a time, and one per run. See shouldPropose. */
export const MAX_OPEN_PROPOSALS = 1;

/**
 * Plan bounds for a PROPOSED mandate, tighter than MAX_STEPS.
 *
 * A worker may revise its plan up to twelve steps once it is running. A plan
 * somebody is reading on a phone before deciding whether to approve it is a
 * different document: past five steps nobody reads it, and an unread plan
 * approved anyway is the ceremony the approve button exists to avoid.
 */
export const PROPOSAL_STEPS_MAX = 5;
export const PROPOSAL_STEPS_MIN = 2;
export const PROPOSAL_STEP_MAX_CHARS = 200;

/**
 * Worker minutes a proposed mandate is granted.
 *
 * Exported and used by BOTH the card that renders it and the route that creates
 * the commission, so the number the user reads before approving is the number
 * they approved. Two copies of it is how a card promises an hour and a mandate
 * books three.
 */
export const PROPOSAL_BUDGET_MINUTES = 60;

/**
 * Closed mandates, all worth nothing, before the job goes quiet.
 *
 * Matches MIN_WORTH_RUN in stake.ts and does the same work from a better place.
 * The ranker can only rank a card down; this stops it being made. That is the
 * stronger instrument and the same reasoning as the three-place bar on a
 * standing refusal: "stop suggesting this" plainly means stop making the card.
 *
 * It reads the `commission` worth record rather than `propose`'s own, because
 * the question the user answered at close — was handing this over worth
 * anything — is the same question a proposal is asking them to bet on again.
 */
export const QUIET_AFTER_WORTHLESS = 3;

/**
 * Proposals binned in a row before the job goes quiet.
 *
 * The same number as MAX_RESTATE_DISMISSALS, and a gate here rather than the
 * `standing` flag that would have bought it for free in runJobs. `standing`
 * means something specific in this codebase — a state that stays true until it
 * is fixed and restates weekly under a period-keyed external_id, `runway:2026-W37`
 * then `-W38` — and a proposal is not that: each one is different work. Setting
 * the flag to borrow its dismissal check would have made the job claim something
 * about itself that is false, and a test asserting which jobs are standing
 * caught exactly that.
 *
 * But the suppression is still wanted, and for a reason the flag's own rule
 * argues against: event-driven jobs are exempt because "a dismissed draft says
 * nothing about tomorrow's different one". A feed item is news from outside; a
 * proposal is the app's OWN idea about what is worth doing. Two binned running
 * is not a judgement about two pieces of work, it is an answer about the
 * proposer — and this whole layer exists so that a no gets heard.
 */
export const QUIET_AFTER_BINNED = 2;

export interface ProposeGate {
  /** Live mandates: draft, active or blocked. */
  held: number;
  /** Open, unanswered proposal Moves already on the screen. */
  openProposals: number;
  /** Proposals dismissed in a row, newest first. From dismissedStreak. */
  binnedInARow?: number;
  /** Whether this profile has an active goal to move. */
  hasGoal: boolean;
  /** The worth record for `commission`, when there is one. */
  worth?: WorthRecord;
}

/**
 * Whether to propose at all tonight, and why not when not.
 *
 * Returns a reason rather than a bare false so a quiet job can say which kind of
 * quiet it is. "Nothing worth proposing" and "you already have three" are
 * different sentences and the jobs run summary carries them.
 */
export function shouldPropose(g: ProposeGate): { ok: true } | { ok: false; reason: string } {
  // A proposal with no goal behind it is the app inventing a direction for
  // somebody's business, which is the one thing invariant 12 exists to forbid.
  if (!g.hasGoal) return { ok: false, reason: 'no active goal to move' };
  if (g.held >= MAX_ACTIVE_COMMISSIONS) return { ok: false, reason: `${g.held} already on the go` };
  // Proposing a second while the first is unanswered is how a suggestion
  // becomes a backlog — the failure mode the send queue already demonstrated.
  if (g.openProposals >= MAX_OPEN_PROPOSALS) return { ok: false, reason: 'one is already waiting on you' };
  if ((g.binnedInARow ?? 0) >= QUIET_AFTER_BINNED) {
    return { ok: false, reason: `you have binned the last ${g.binnedInARow} of these` };
  }
  if (g.worth && g.worth.closes >= QUIET_AFTER_WORTHLESS && g.worth.nothing === g.worth.closes) {
    return { ok: false, reason: `${g.worth.closes} handed over and none of it was worth anything` };
  }
  return { ok: true };
}

/* ─── What the model is asked, and what it may answer ─────────────────────── */

export const PROPOSE_SYSTEM = [
  'You propose ONE piece of work for an assistant to carry out on behalf of a solo operator.',
  '',
  'The assistant can read, search, compare, draft and document. It cannot contact anyone, cannot spend money, cannot sign anything and cannot touch the operator\'s accounts. Propose only work that fits inside that.',
  '',
  'Good work to propose is work the operator would otherwise do themselves and keeps not doing: a comparison, a shortlist with real options, a piece of research that ends in a decision they can make in one sitting.',
  '',
  'Rules:',
  '- One objective, in the operator\'s own terms, under 120 characters. No preamble.',
  '- 2 to 5 plan steps. Each one a concrete thing to go and find out, not a stage name like "research" or "analyse".',
  '- Never propose sending, messaging, posting, buying, booking or hiring.',
  '- Never state a number, a percentage or a currency amount. You do not have the figures and the app writes those itself.',
  '- If nothing in the context is worth a person\'s assistant spending an hour on, answer {"objective": null}.',
  '',
  'Answer with JSON only: {"objective": string|null, "kind": one of ' + MOVE_KINDS.join('|') + ', "steps": string[]}',
].join('\n');

export interface ProposalDraft {
  objective: string;
  kind: MoveKind;
  steps: string[];
}

/**
 * Read the model's answer, or null when it declined or produced nothing usable.
 *
 * Declining is a first-class answer and the prompt asks for it explicitly. A
 * proposer that must always propose will propose on a quiet week, and a mandate
 * invented to fill a slot costs worker minutes and the user's trust in every
 * one that follows.
 */
export function parseProposal(raw: unknown): ProposalDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const objective = typeof o.objective === 'string' ? o.objective.trim().slice(0, OBJECTIVE_MAX) : '';
  if (!objective) return null;

  const steps = Array.isArray(o.steps)
    ? o.steps.filter((s): s is string => typeof s === 'string' && !!s.trim())
        .map((s) => s.trim().slice(0, PROPOSAL_STEP_MAX_CHARS)).slice(0, PROPOSAL_STEPS_MAX)
    : [];
  // A mandate with no plan is a wish. The user is being asked to approve
  // something on the strength of what it says it will do, so it has to say.
  if (steps.length < PROPOSAL_STEPS_MIN) return null;

  // Anything unrecognised lands on `decide` — mid-prior, so a model that cannot
  // pick a kind neither buries the proposal nor floats it to the top of the day.
  const kind: MoveKind = MOVE_KINDS.includes(o.kind as MoveKind) ? (o.kind as MoveKind) : 'decide';
  return { objective, kind, steps };
}

/* ─── The reasons, written here and never by a model ──────────────────────── */

export interface ProposeFacts {
  goal: Pick<Goal, 'title' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days'>;
  metrics: Metrics;
  /** Mandates closed and graded so far, for "you have done this before". */
  worth?: WorthRecord;
}

/** Goal metric → what a Move may stake itself on. Only money maps. */
export function stakeMetricFor(metric: Goal['metric']): BusinessMetric {
  return metric === 'currency' ? 'won_amount' : 'none';
}

/**
 * Why this is worth an hour of somebody else's time, in numbers from rows.
 *
 * Every line here is arithmetic over columns. Nothing in this function has been
 * near a model, which is the point: the objective is a suggestion and may be
 * wrong, but the case made for it is checkable, and the user can tell the two
 * apart because one of them is numbers they recognise.
 */
export function whyFor(f: ProposeFacts): string[] {
  const why: string[] = [];
  const g = f.goal;
  const m = f.metrics;

  const target = g.target_value ?? 0;
  const current = g.current_value ?? 0;
  const gap = target - current;
  if (target > 0 && gap > 0) {
    const unit = g.metric === 'currency' ? (g.unit || '') : '';
    why.push(g.horizon_days
      ? `${g.title} is ${unit}${Math.round(gap).toLocaleString()} short with ${g.horizon_days} days on it.`
      : `${g.title} is ${unit}${Math.round(gap).toLocaleString()} short.`);
  } else {
    why.push(`It is meant to move ${g.title}.`);
  }

  // The funnel's own verdict on the work the user is already doing. This is the
  // sentence that makes handing something over an argument rather than an
  // offer: forty-four sent and one reply is a case for spending the next hour
  // on something else.
  if (m.sent > 0) {
    why.push(m.replies > 0
      ? `${m.sent} sent in ${m.window_days} days for ${m.replies} repl${m.replies === 1 ? 'y' : 'ies'}. This is not that.`
      : `${m.sent} sent in ${m.window_days} days and nothing has come back. This is not that.`);
  }

  if (m.runway_months != null && m.runway_months < 6) {
    why.push(`${m.runway_months} months of runway, so an hour you do not spend yourself is worth more than usual.`);
  }

  if (f.worth?.closes) {
    const paid = f.worth.closes - f.worth.nothing;
    why.push(`You have closed ${f.worth.closes} of these and said ${paid === 0 ? 'none of them' : `${paid} of them`} were worth something.`);
  }

  return why.slice(0, 4);
}

/**
 * The proposal as a Move, or null when it does not hold together.
 *
 * `value` is deliberately absent from the stake. A mandate's worth is genuinely
 * unknown when it is proposed, and the house rule is that a job which cannot say
 * is better off silent than inventing a figure — the kind prior carries it, and
 * the worth ledger supplies the real number once there is one.
 */
export function proposalFrom(p: ProposalDraft, f: ProposeFacts, budgetMinutes: number): MoveDraft | null {
  const why = whyFor(f);
  if (!why.length) return null;
  return {
    job: PROPOSE_JOB,
    kind: p.kind,
    // Deduped on the objective, so a model that lands on the same idea two
    // nights running writes one row rather than two.
    external_id: `propose:${p.objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
    headline: p.objective,
    why,
    artifact: {
      kind: 'plan',
      label: 'Hand it over',
      // The human rendering, so the plan is readable even where nothing knows
      // what a `plan` artifact is — an older client, the context pack, a log.
      // The budget is part of what is being authorised, so it is on the card
      // rather than discovered afterwards inside the mandate.
      value: [
        ...p.steps.map((s, i) => `${i + 1}. ${s}`),
        '',
        `Up to ${budgetMinutes} minutes of its time. It reads, compares and drafts — it contacts nobody and spends nothing.`,
      ].join('\n'),
      // The structured version, which is what becomes CommissionStep[]. Parsing
      // `value` back apart would break the first time a step contained a
      // newline, and this costs one optional field in a jsonb column.
      steps: p.steps,
      href: null,
    },
    // What it costs YOU, which is a tap — not what it costs the worker. That is
    // the honest input to the fit factor, and it means a proposal rises on a day
    // with no time in it. Correct: a day you cannot do anything yourself is
    // exactly the day to hand something over.
    cost_label: '1 min to approve',
    stake: {
      metric: stakeMetricFor(f.goal.metric),
      direction: 'up',
      by: Math.max(0, (f.goal.target_value ?? 0) - (f.goal.current_value ?? 0)),
      withinDays: f.goal.horizon_days ?? 30,
    },
  } satisfies MoveDraft;
}

/** Longest brief handed to the proposer. It reads context, not a corpus. */
export const PROPOSE_BRIEF_MAX = 3_000;

/** What the model is shown. Numbers are included so it can judge; it may not repeat them. */
export function proposePrompt(input: {
  goalTitle: string;
  offer: string;
  working: string;
  metricsLine: string;
  recentObjectives: string[];
  refusedPhrases: string[];
}): string {
  const parts = [
    `Goal: ${input.goalTitle}`,
    input.offer ? `They sell: ${input.offer}` : 'They have not written down what they sell.',
    `Where they are: ${input.metricsLine}`,
  ];
  if (input.working.trim()) parts.push('', 'What they have told the app about their own work:', input.working.trim().slice(0, PROPOSE_BRIEF_MAX));
  // Both lists are the whole reason this is worth doing from inside the app
  // rather than from a chat window: a general model cannot know what has
  // already been tried or already been refused.
  if (input.recentObjectives.length) {
    parts.push('', 'Already handed over — do not propose these again:', ...input.recentObjectives.map((o) => `- ${o}`));
  }
  if (input.refusedPhrases.length) {
    parts.push('', 'They have told the app to stop suggesting:', ...input.refusedPhrases.map((r) => `- ${r}`));
  }
  parts.push('', 'Propose one piece of work, or decline.');
  return parts.join('\n');
}
