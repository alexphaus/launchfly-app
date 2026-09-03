// src/lib/foundation/capacity.ts
// ═══════════════════════════════════════════════════════════════════════════
// Capacity model
//
// The capacity switch in the header is the product's core promise: "matches and
// today's plan re-rank instantly". Instantly means NO model call and NO network
// round trip beyond one read — everything here is pure, so a capacity change is
// a re-sort of rows we already scored.
// ═══════════════════════════════════════════════════════════════════════════

import type { CapacityMode, ScoreBreakdown } from './types';

export interface CapacityProfile {
  mode: CapacityMode;
  label: string;
  blurb: string;
  /** Minutes of focused work realistically available in this state. */
  budgetMinutes: number;
  /** Work above this cognitive weight gets pushed down, not hidden. */
  maxDepth: 1 | 2 | 3;
}

export const CAPACITY: Record<CapacityMode, CapacityProfile> = {
  deep: {
    mode: 'deep',
    label: 'Deep focus',
    blurb: '2+ hours, high-value work',
    budgetMinutes: 150,
    maxDepth: 3,
  },
  moderate: {
    mode: 'moderate',
    label: 'Moderate',
    blurb: '~1 hour, calls and reviews',
    budgetMinutes: 60,
    maxDepth: 2,
  },
  low: {
    mode: 'low',
    label: 'Low energy',
    blurb: '30 min, light admin only',
    budgetMinutes: 30,
    maxDepth: 1,
  },
};

export const CAPACITY_MODES: CapacityMode[] = ['deep', 'moderate', 'low'];

const DEPTH: Record<CapacityMode, 1 | 2 | 3> = { low: 1, moderate: 2, deep: 3 };

export function isCapacityMode(value: unknown): value is CapacityMode {
  return typeof value === 'string' && value in CAPACITY;
}

/**
 * The capacity a piece of work demands, from its time cost.
 * Used both for opportunities (effort_hours) and actions (estimated_minutes).
 */
export function capacityForMinutes(minutes: number | null | undefined): CapacityMode {
  if (minutes == null) return 'moderate';
  if (minutes <= CAPACITY.low.budgetMinutes) return 'low';
  if (minutes <= CAPACITY.moderate.budgetMinutes) return 'moderate';
  return 'deep';
}

/**
 * How well work of `required` depth fits an operator currently in `available`.
 * 1.0 = fits comfortably. Never returns 0: over-sized work is demoted, not
 * deleted — hiding the $1,800 job because someone is tired is the wrong call.
 */
export function capacityFit(required: CapacityMode, available: CapacityMode): number {
  const gap = DEPTH[required] - DEPTH[available];
  if (gap <= 0) return 1;        // fits, or lighter than what they have
  if (gap === 1) return 0.55;    // a stretch
  return 0.25;                   // genuinely wrong moment
}

/**
 * Re-rank an already-scored list for the capacity the operator just selected.
 * Pure and synchronous — this is what makes the sheet feel instant.
 */
export function rerankForCapacity<T extends { score: number; capacity_fit: CapacityMode }>(
  items: T[],
  mode: CapacityMode,
): Array<T & { adjusted_score: number }> {
  return items
    .map((item) => ({
      ...item,
      adjusted_score: Math.round(item.score * capacityFit(item.capacity_fit, mode)),
    }))
    .sort((a, b) => b.adjusted_score - a.adjusted_score || b.score - a.score);
}

/**
 * Pick the plan rows that actually fit today's budget, biggest lever first.
 * Greedy on score-per-minute — the operator's scarce resource is minutes, so
 * that, not raw score, is the right ordering for a plan.
 */
export function fitPlanToCapacity<T extends { estimated_minutes: number | null; score: number }>(
  candidates: T[],
  mode: CapacityMode,
  { overflowFactor = 1.25 }: { overflowFactor?: number } = {},
): T[] {
  const budget = CAPACITY[mode].budgetMinutes * overflowFactor;
  const ranked = [...candidates].sort((a, b) => {
    const aRate = a.score / Math.max(a.estimated_minutes ?? 30, 5);
    const bRate = b.score / Math.max(b.estimated_minutes ?? 30, 5);
    return bRate - aRate;
  });

  const chosen: T[] = [];
  let spent = 0;
  for (const item of ranked) {
    const cost = item.estimated_minutes ?? 30;
    if (spent + cost > budget && chosen.length > 0) continue;
    chosen.push(item);
    spent += cost;
  }
  return chosen;
}
