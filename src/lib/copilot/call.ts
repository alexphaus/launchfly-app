// src/lib/copilot/call.ts
// Picking the day's one Call out of everything the jobs produced.
//
// The ladder, in order:
//
//   1. A blank offer forces the offer call, whatever anything else says. That
//      rule predates this file and outranks it (invariant 1).
//   2. The winning Move, when one clears CALL_FLOOR. It is grounded in a real
//      row and carries an artifact, which prose does not.
//   3. Whatever the agent wrote.
//   4. starterDecision's ladder, so Today always leads with one move.
//
// Steps 2 and 3 are the change. Before it there was no step 2 at all: the brief
// wrote the Call and the jobs wrote Moves, on separate paths that never met, so
// "send the drafts" led every morning because starterDecision has no other kind
// of branch. A Move could not win because nothing was comparing them.

import { arbitrate, costMinutesOf, type ScoreCtx } from './stake';
import { CAPACITY_META, type Metrics, type Move, type Profile } from './types';
import type { DecisionDraft } from './decision';
import { loadMoves } from './store';

/** How many open Moves arbitration considers. Past this it is not a shortlist. */
export const ARBITRATE_POOL = 24;

export interface PromotedCall {
  draft: DecisionDraft;
  move: Move;
  /** The runner-up, already named in the draft's instead_of. */
  insteadOf: Move | null;
}

/** What a Move looks like to the scorer. Kept here so store.ts stays about rows. */
export function scorable(m: Move) {
  return { id: m.id, kind: m.kind, stake: m.stake ?? null, costMinutes: costMinutesOf(m.cost_label) };
}

/**
 * Turn the winning Move into the day's call.
 *
 * `instead_of` stops being a sentence somebody wrote and becomes the runner-up,
 * named. That is the honest version: the app can only claim it chose this over
 * something if there was something.
 */
export function draftFrom(win: Move, runnerUp: Move | null): DecisionDraft {
  return {
    headline: win.headline,
    because: win.why,
    instead_of: runnerUp ? runnerUp.headline : undefined,
    // A Move that named a number is a claim; one riding its kind prior is a
    // guess about a category, and the card says so rather than sounding equally
    // sure about both.
    confidence: win.stake ? 'high' : 'low',
    topic: win.job,
    verify_metric: win.stake?.metric ?? 'none',
    source_move_id: win.id,
  };
}

export function scoreCtxFor(profile: Pick<Profile, 'capacity' | 'finance'>): ScoreCtx {
  return {
    monthlyBurn: profile.finance?.monthly_burn ?? null,
    capacityMinutes: CAPACITY_META[profile.capacity].minutes,
  };
}

/**
 * Load today's open Moves and pick one. Null when nothing clears the floor —
 * a quiet day should fall through to the written call rather than promote the
 * best of a bad list.
 */
export async function promoteCall(
  profile: Pick<Profile, 'id' | 'capacity' | 'finance'>,
  _metrics: Metrics,
): Promise<PromotedCall | null> {
  const { moves } = await loadMoves(profile.id, ARBITRATE_POOL);
  if (!moves.length) return null;

  const byId = new Map(moves.map((m) => [m.id, m]));
  const { call, insteadOf } = arbitrate(moves.map(scorable), scoreCtxFor(profile));
  if (!call) return null;

  const win = byId.get(call.id);
  if (!win) return null;
  const runnerUp = insteadOf ? byId.get(insteadOf.id) ?? null : null;
  return { draft: draftFrom(win, runnerUp), move: win, insteadOf: runnerUp };
}
