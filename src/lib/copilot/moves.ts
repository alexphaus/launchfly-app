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
