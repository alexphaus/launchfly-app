// src/lib/copilot/moves.ts
// A Move is a finished piece of work with something concrete attached.
//
// Pure — no DB import — so copilot-core.test.ts covers the rules that decide
// what is allowed to reach the user. The writes live in jobs/index.ts.
//
// Why this exists: the app could produce exactly one kind of action, a WhatsApp
// opener, and its own author sent zero of them. Not a discipline problem — the
// only move on offer was not one he wanted to make. A Move is any move: earn,
// spend, build, fix, learn, meet, decide, avoid.

import type { Stake } from './stake';

/** What a Move asks of you. Ordered by how directly it moves money. */
export const MOVE_KINDS = ['earn', 'spend', 'build', 'fix', 'learn', 'meet', 'decide', 'avoid'] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

/** Short, so a phone renders it as a chip rather than a sentence. */
export const KIND_LABEL: Record<MoveKind, string> = {
  earn: 'Earn', spend: 'Spend', build: 'Build', fix: 'Fix',
  learn: 'Learn', meet: 'Meet', decide: 'Decide', avoid: 'Avoid',
};

/**
 * The thing that was actually produced. A Move without one is advice, and
 * advice is the one thing the user can already get free from a chat window.
 *
 * - `message`: drafted text, usually with a deep link to send it as themselves
 * - `link`:    something found — a listing, a tutorial, a supplier
 * - `text`:    a finding with no destination, e.g. a diagnosis
 */
export type ArtifactKind = 'message' | 'link' | 'text';

export interface MoveArtifact {
  kind: ArtifactKind;
  /** What the button says: "Open in WhatsApp", "View the listing". */
  label: string;
  /** The content — the message body, the finding. Always present. */
  value: string;
  /** Where the button goes. Null when the artifact is the value itself. */
  href?: string | null;
}

export interface MoveDraft {
  job: string;
  kind: MoveKind;
  external_id: string;
  headline: string;
  why: string[];
  artifact: MoveArtifact;
  cost_label?: string | null;
  /**
   * What this Move claims it will move, and by when. Optional: a job that
   * genuinely cannot say is better off silent than inventing a number, and the
   * kind prior in stake.ts carries it. But a Move with no stake can still be
   * ranked and can still win the Call — it just brings less evidence to the
   * argument than one that named a number.
   */
  stake?: Stake | null;
}

export const HEADLINE_MAX = 160;
export const WHY_MAX = 3;
export const WHY_LINE_MAX = 200;
export const ARTIFACT_VALUE_MAX = 4000;

/**
 * The quality floor, enforced before anything is written.
 *
 * Ten mediocre Moves a day is worse than one real one: the user stops reading,
 * and a queue nobody reads is the state this whole rewrite exists to escape.
 * So a Move must name a move, cite at least one thing, and carry an artifact
 * with actual content. Anything short of that is dropped silently — a Job that
 * found nothing worth doing should produce nothing, not filler.
 */
export function isDeliverable(d: MoveDraft): boolean {
  if (!d.job || !d.external_id || !d.headline?.trim()) return false;
  if (!MOVE_KINDS.includes(d.kind)) return false;
  if (!d.why?.some((w) => w?.trim())) return false;
  const a = d.artifact;
  if (!a || !a.value?.trim() || !a.label?.trim()) return false;
  if (a.kind === 'link' && !a.href) return false;   // a link Move with no link is a text Move
  return true;
}

/** Trim a draft to what the columns and a phone screen can carry. */
export function normalizeMove(d: MoveDraft): MoveDraft {
  return {
    ...d,
    headline: d.headline.trim().slice(0, HEADLINE_MAX),
    why: d.why.map((w) => w.trim().slice(0, WHY_LINE_MAX)).filter(Boolean).slice(0, WHY_MAX),
    artifact: {
      ...d.artifact,
      label: d.artifact.label.trim().slice(0, 40),
      value: d.artifact.value.trim().slice(0, ARTIFACT_VALUE_MAX),
      href: d.artifact.href ?? null,
    },
    cost_label: d.cost_label?.trim().slice(0, 40) || null,
    stake: d.stake ?? null,
  };
}

/**
 * What leads the screen when several jobs deliver at once.
 *
 * Deliberately NOT the declaration order of MOVE_KINDS, which is the shape of
 * the database check constraint. This is the order a person should meet them in
 * on a phone, at eight in the morning, with time for two:
 *
 *   earn    money coming in
 *   build   money already collected and not yet delivered — the most expensive
 *           kind of quiet there is
 *   fix     something broken is charging you rent every day it stays broken
 *   decide  the calls that change what everything below them is worth
 *   avoid   the same, said from the side that saves the week
 *   spend   money going out; real leverage, but it can wait until tonight
 *   meet    compounding, slowly
 *   learn   compounding, slowest, and the easiest thing to hide inside all day
 */
export const KIND_ORDER: Record<MoveKind, number> = {
  earn: 0, build: 1, fix: 2, decide: 3, avoid: 4, spend: 5, meet: 6, learn: 7,
};

/**
 * The Moves the screen actually shows, newest first within each kind.
 *
 * With one job this was academic. With six, an ordering left to `created_at`
 * means whichever job happened to finish last leads — so a reconnect worth real
 * money can sit under a tutorial link because the tutorial was written a second
 * later. Pure, and applied at read time, so re-ordering never needs a migration.
 */
export function orderMoves<T extends { kind: MoveKind; created_at: string }>(moves: T[], max = 8): T[] {
  return [...moves]
    .sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || b.created_at.localeCompare(a.created_at))
    .slice(0, max);
}

/** Dedupe key, matching the unique index. A job that reruns must not double up. */
export function moveKey(job: string, externalId: string): string {
  return `${job} ${externalId}`;
}

/**
 * Everything a job produced, filtered and deduped within the batch.
 * Later drafts win, being the fresher read of the same source row.
 */
export function selectMoves(drafts: MoveDraft[], max = 12): MoveDraft[] {
  const byKey = new Map<string, MoveDraft>();
  for (const d of drafts) {
    if (!isDeliverable(d)) continue;
    const n = normalizeMove(d);
    byKey.set(moveKey(n.job, n.external_id), n);
  }
  return [...byKey.values()].slice(0, max);
}

/* ─── What the user actually acts on ─────────────────────────────────────── */

/**
 * Answering a Move was a dead write.
 *
 * `setMoveStatus` logged `move_answered` on every done and every dismissed, and
 * nothing in the app ever read it — only the health endpoint counted the rows.
 * Meanwhile the watcher makes a subjective call about a stranger's feed every
 * night, three picks out of twenty-five, and had no way of finding out whether
 * any of them were wanted. The one working preference loop in this app was
 * wired to scraped businesses, which already have a deterministic score.
 *
 * So this is the triage keep-rate, applied to the surface that needs it more.
 * Same shape, same floor, same bounded claim: it changes what the judge is TOLD
 * about this person, never what counts as a result. A dismissal is a preference.
 * A reply is the truth. Invariant 5, one level up.
 */
export interface MoveAnswerEvent {
  event_type: string;
  payload: Record<string, unknown> | null;
}

/**
 * Below this a rate is one bad morning, not a preference. Lower than triage's
 * five because a Move costs a judgement rather than a flick — four of them is
 * already more deliberation than twenty swipes.
 */
export const MIN_MOVE_SAMPLE = 4;

/** Kept this often or more and it is worth more of them. */
export const KEEP_HIGH = 0.6;
/** Kept this rarely and the judge should stop spending picks on it. */
export const KEEP_LOW = 0.34;

export interface KeepRates {
  /** job key → share marked done rather than dismissed. */
  byJob: Map<string, number>;
  byKind: Map<MoveKind, number>;
}

export function moveKeepRate(events: MoveAnswerEvent[]): KeepRates {
  const jobs = new Map<string, { kept: number; total: number }>();
  const kinds = new Map<MoveKind, { kept: number; total: number }>();

  for (const e of events) {
    if (e.event_type !== 'move_answered') continue;
    const status = e.payload?.status;
    if (status !== 'done' && status !== 'dismissed') continue;
    const job = typeof e.payload?.job === 'string' ? e.payload.job.trim() : '';
    const kind = e.payload?.kind;

    if (job) {
      const t = jobs.get(job) ?? { kept: 0, total: 0 };
      t.total += 1;
      if (status === 'done') t.kept += 1;
      jobs.set(job, t);
    }
    if (typeof kind === 'string' && MOVE_KINDS.includes(kind as MoveKind)) {
      const k = kind as MoveKind;
      const t = kinds.get(k) ?? { kept: 0, total: 0 };
      t.total += 1;
      if (status === 'done') t.kept += 1;
      kinds.set(k, t);
    }
  }

  const settle = <K>(tally: Map<K, { kept: number; total: number }>) => {
    const out = new Map<K, number>();
    for (const [key, t] of tally) if (t.total >= MIN_MOVE_SAMPLE) out.set(key, t.kept / t.total);
    return out;
  };
  return { byJob: settle(jobs), byKind: settle(kinds) };
}

/**
 * The kinds worth saying out loud to a model, in its own vocabulary.
 *
 * Only kinds, not jobs: a job key is this codebase's word for a sensor and means
 * nothing to a judge reading a feed. "They act on earn, they bin learn" is a
 * sentence that changes what gets picked tonight.
 */
export function keepSummary(rates: KeepRates): { kept: MoveKind[]; binned: MoveKind[] } {
  const kept: MoveKind[] = [];
  const binned: MoveKind[] = [];
  for (const [kind, rate] of rates.byKind) {
    if (rate >= KEEP_HIGH) kept.push(kind);
    else if (rate <= KEEP_LOW) binned.push(kind);
  }
  const order = (a: MoveKind, b: MoveKind) => KIND_ORDER[a] - KIND_ORDER[b];
  return { kept: kept.sort(order), binned: binned.sort(order) };
}
