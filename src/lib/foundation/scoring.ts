// src/lib/foundation/scoring.ts
// ═══════════════════════════════════════════════════════════════════════════
// Deterministic opportunity scoring
//
// The UI puts "92% MATCH" next to a dollar figure. That number has to survive
// the operator asking "why?" three times, so:
//
//   1. The score is computed here, in code, from named factors. A model never
//      produces or adjusts it.
//   2. Every factor writes a plain-language note. `See the reasoning →` renders
//      those notes — it is not a second generation pass.
//   3. The same inputs always give the same score. Ranking a list twice must
//      not shuffle it.
//
// A model's only job downstream is to compress these notes into one sentence.
// ═══════════════════════════════════════════════════════════════════════════

import { capacityFit, capacityForMinutes } from './capacity';
import type {
  CapacityMode,
  FoundationGoal,
  FoundationOpportunity,
  FoundationSkill,
  ScoreBreakdown,
} from './types';

/** Weights sum to 1. Tune here, nowhere else. */
export const WEIGHTS = {
  skillFit: 0.4,
  valueFit: 0.25,
  urgency: 0.15,
  goalAlignment: 0.2,
} as const;

export interface ScoreInput {
  opportunity: Pick<
    FoundationOpportunity,
    | 'type' | 'title' | 'value_amount' | 'value_kind' | 'effort_hours'
    | 'required_skills' | 'deadline_at' | 'posted_at'
  >;
  skills: FoundationSkill[];
  goals: FoundationGoal[];
  /** Cosine similarity of the opportunity against the operator's positioning, 0-1. */
  semanticSimilarity?: number | null;
  /** Hourly floor below which work costs more than it earns. */
  minDealValue: number;
  capacityMode: CapacityMode;
  now?: Date;
}

export interface ScoreResult {
  score: number;               // 0-100, capacity-neutral
  breakdown: ScoreBreakdown;
  requiredCapacity: CapacityMode;
  /** score adjusted for the operator's current capacity — what the list sorts on */
  adjustedScore: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ─── Factor 1: can they actually do it? ──────────────────────────────────
function scoreSkillFit(
  required: string[],
  skills: FoundationSkill[],
  semantic: number | null | undefined,
  notes: string[],
): { value: number; matched: string[]; missing: string[] } {
  const bySlug = new Map(skills.map((s) => [s.slug, s]));
  const matched: string[] = [];
  const missing: string[] = [];

  // Semantic similarity is the fallback when an opportunity arrives untagged,
  // which is most of them. Cosine on text-embedding-3-small clusters around
  // 0.6-0.85 for related work, so rescale before treating it as a 0-1 signal.
  const semanticScore = semantic == null ? null : clamp01((semantic - 0.55) / 0.35);

  if (required.length === 0) {
    if (semanticScore == null) {
      notes.push('No skills tagged and no embedding yet — skill fit is a guess.');
      return { value: 0.4, matched, missing };
    }
    notes.push(`No explicit skill tags; ${Math.round((semantic ?? 0) * 100)}% semantic overlap with your positioning.`);
    return { value: semanticScore, matched, missing };
  }

  let earned = 0;
  for (const slug of required) {
    const skill = bySlug.get(slug);
    if (skill && skill.proficiency > 0) {
      matched.push(slug);
      earned += skill.proficiency / 100;
    } else {
      missing.push(slug);
    }
  }
  const explicit = clamp01(earned / required.length);

  if (matched.length) {
    const labels = matched
      .map((slug) => bySlug.get(slug)?.label ?? slug)
      .slice(0, 3)
      .join(', ');
    notes.push(`Matches your ${labels}.`);
  }
  if (missing.length) {
    notes.push(`Wants ${missing.slice(0, 3).join(', ')}, which you haven't logged.`);
  }

  // Blend: explicit tags dominate, semantics break ties and cover partial tags.
  const value = semanticScore == null ? explicit : explicit * 0.75 + semanticScore * 0.25;
  return { value: clamp01(value), matched, missing };
}

// ─── Factor 2: is it worth an hour of their time? ────────────────────────
function scoreValueFit(
  opp: ScoreInput['opportunity'],
  minDealValue: number,
  notes: string[],
): number {
  // Non-monetary opportunities (communities, signals) are not penalised for
  // having no price — they are judged on the other three factors.
  if (opp.value_kind === 'none' || opp.value_amount == null) {
    notes.push('No direct revenue attached — judged on fit, timing and goal impact.');
    return 0.5;
  }

  const amount = Number(opp.value_amount) || 0;
  if (minDealValue > 0 && amount < minDealValue) {
    notes.push(
      `${formatMoney(amount)} is below your ${formatMoney(minDealValue)} floor — it costs more time than it returns.`,
    );
    return clamp01((amount / minDealValue) * 0.4);
  }

  const floor = minDealValue > 0 ? minDealValue : 500;
  // Diminishing returns: 1x floor ≈ 0.5, 3x floor ≈ 0.85, 10x ≈ ~1.
  const ratio = amount / floor;
  const value = clamp01(1 - Math.exp(-0.7 * ratio));

  if (opp.effort_hours && opp.effort_hours > 0) {
    const rate = amount / opp.effort_hours;
    notes.push(`${formatMoney(amount)} over ~${opp.effort_hours}h is ${formatMoney(Math.round(rate))}/hour.`);
  } else {
    notes.push(`${formatMoney(amount)}, effort not yet estimated.`);
  }
  return value;
}

// ─── Factor 3: does it decay if ignored? ─────────────────────────────────
function scoreUrgency(
  opp: ScoreInput['opportunity'],
  now: Date,
  notes: string[],
): number {
  let value = 0.4;

  if (opp.deadline_at) {
    const days = (new Date(opp.deadline_at).getTime() - now.getTime()) / 86_400_000;
    if (days < 0) {
      notes.push('Deadline has passed.');
      return 0;
    }
    value = clamp01(1 - days / 14);   // inside two weeks, urgency climbs
    notes.push(days < 1 ? 'Closes today.' : `Closes in ${Math.round(days)} days.`);
  }

  // Freshness: a job post loses most of its value in the first week.
  const ageDays = (now.getTime() - new Date(opp.posted_at).getTime()) / 86_400_000;
  const freshness = clamp01(1 - ageDays / 10);
  if (ageDays > 7) notes.push(`Posted ${Math.round(ageDays)} days ago — likely cooling.`);

  return clamp01(Math.max(value, freshness * 0.8));
}

// ─── Factor 4: does it move the goal they said matters? ──────────────────
function scoreGoalAlignment(
  opp: ScoreInput['opportunity'],
  goals: FoundationGoal[],
  notes: string[],
): number {
  const active = goals.filter((g) => g.status === 'active');
  if (!active.length) return 0.5;

  let best = 0.35;

  const revenue = active.find((g) => g.kind === 'revenue' && g.target_value);
  if (revenue && opp.value_amount) {
    const gap = Math.max(0, (revenue.target_value ?? 0) - revenue.current_value);
    if (gap > 0) {
      const share = clamp01(Number(opp.value_amount) / gap);
      best = Math.max(best, 0.4 + share * 0.6);
      notes.push(
        share >= 1
          ? `Closes your entire ${formatMoney(gap)} ${revenue.label.toLowerCase()} gap.`
          : `Covers ${Math.round(share * 100)}% of the ${formatMoney(gap)} still needed for ${revenue.label.toLowerCase()}.`,
      );
    } else {
      best = Math.max(best, 0.5);
    }
  }

  // Short runway makes fast cash disproportionately valuable.
  const runway = active.find((g) => g.kind === 'runway');
  if (runway && runway.current_value > 0 && runway.current_value < 6 && opp.value_amount) {
    const pressure = clamp01((6 - runway.current_value) / 6);
    best = clamp01(best + pressure * 0.25);
    notes.push(`Runway is ${runway.current_value} months — cash-in-hand work is weighted up.`);
  }

  return clamp01(best);
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Score one opportunity. Pure: same inputs, same output, no IO. */
export function scoreOpportunity(input: ScoreInput): ScoreResult {
  const now = input.now ?? new Date();
  const notes: string[] = [];

  const skill = scoreSkillFit(
    input.opportunity.required_skills ?? [],
    input.skills,
    input.semanticSimilarity,
    notes,
  );
  const valueFit = scoreValueFit(input.opportunity, input.minDealValue, notes);
  const urgency = scoreUrgency(input.opportunity, now, notes);
  const goalAlignment = scoreGoalAlignment(input.opportunity, input.goals, notes);

  const base =
    skill.value * WEIGHTS.skillFit +
    valueFit * WEIGHTS.valueFit +
    urgency * WEIGHTS.urgency +
    goalAlignment * WEIGHTS.goalAlignment;

  const requiredCapacity = capacityForMinutes(
    input.opportunity.effort_hours ? input.opportunity.effort_hours * 60 : null,
  );
  const fit = capacityFit(requiredCapacity, input.capacityMode);

  const breakdown: ScoreBreakdown = {
    skillFit: round2(skill.value),
    valueFit: round2(valueFit),
    urgency: round2(urgency),
    goalAlignment: round2(goalAlignment),
    capacityFit: round2(fit),
    notes,
    matchedSkills: skill.matched,
    missingSkills: skill.missing,
  };

  const score = Math.round(clamp01(base) * 100);
  return {
    score,
    breakdown,
    requiredCapacity,
    adjustedScore: Math.round(score * fit),
  };
}

/**
 * Confidence in a score, from how much of the picture we actually have.
 * The prototype is explicit that nothing is connected on day one — so this is
 * shown, not hidden, and rises as sources come online.
 */
export function scoreConfidence(args: {
  connectedSources: number;
  hasPositioning: boolean;
  declaredSkills: number;
  taggedRequirements: boolean;
}): number {
  let c = 0.25;
  if (args.hasPositioning) c += 0.15;
  c += Math.min(args.declaredSkills, 6) * 0.03;   // up to +0.18
  c += Math.min(args.connectedSources, 4) * 0.08; // up to +0.32
  if (args.taggedRequirements) c += 0.1;
  return Math.round(Math.min(c, 0.95) * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
