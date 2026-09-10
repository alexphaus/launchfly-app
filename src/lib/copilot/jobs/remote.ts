// src/lib/copilot/jobs/remote.ts
// Leverage as a service: any kind of Move, produced outside this app.
//
// Mirrors supply/remote.ts, and exists for the same reason one level up. Some
// of the most valuable things a cofounder does cannot be computed from the
// user's own rows and should not be faked from them:
//
//   spend  — "here is the MacBook you wanted, this listing, this price"
//   spend  — "three suppliers who make this, quoted"
//   meet   — "this person is worth an hour, here is why"
//   fix    — "your intake flow drops enquiries after 6pm, here is the node"
//   build  — "I put up a page for the new offer, here is the link"
//
// Every one of those needs a searcher, a scraper or a builder that is not a
// Next.js request handler — an n8n workflow, an agent with browser access, a
// human. So the app does not pretend to do them. It defines the socket, applies
// the same quality floor to whatever comes back, and lets the work happen
// wherever it is cheapest to build.
//
//   POST $COPILOT_JOBS_URL
//   Authorization: Bearer $COPILOT_JOBS_SECRET
//   { "kind": "moves", "today": "2026-09-09", "profile": { ...what the work needs... } }
//   -> { "moves": MoveDraft[] }   (a bare array is also accepted)
//
// Nothing here is trusted. A remote that returns junk pollutes one section of
// one screen and is dropped by isDeliverable; it can never crash the run, and
// it can never write a Move without an artifact.

import { MOVE_KINDS, type ArtifactKind, type MoveDraft, type MoveKind } from '../moves';
import type { Profile } from '../types';
import type { Job, JobContext } from './types';

const TIMEOUT_MS = 90_000;
/** One remote cannot fill the whole screen. selectMoves caps the run; this caps the source. */
export const MAX_REMOTE_MOVES = 8;

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

const ARTIFACT_KINDS: ArtifactKind[] = ['message', 'link', 'text'];

/**
 * Whatever came back, forced into the shape the table accepts.
 *
 * Returns null rather than a partial Move: a row with no artifact or no stable
 * id is not a weaker Move, it is a different thing — advice, or a duplicate
 * waiting to happen.
 */
export function normalizeRemoteMove(raw: unknown, source?: string): MoveDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const headline = str(r.headline ?? r.title, 160);
  const id = str(r.external_id ?? r.id, 160);
  if (!headline || !id) return null;   // without a stable id a nightly rerun doubles up

  const kind = MOVE_KINDS.includes(r.kind as MoveKind) ? (r.kind as MoveKind) : null;
  if (!kind) return null;              // "some kind of move" is not a move

  const a = (r.artifact && typeof r.artifact === 'object' ? r.artifact : {}) as Record<string, unknown>;
  const value = str(a.value ?? r.body, 4000);
  const label = str(a.label, 40);
  const href = str(a.href ?? r.url, 1000) ?? null;
  if (!value || !label) return null;   // no artifact, no Move

  const aKind = ARTIFACT_KINDS.includes(a.kind as ArtifactKind) ? (a.kind as ArtifactKind) : (href ? 'link' : 'text');
  if (aKind === 'link' && !href) return null;

  const why = (Array.isArray(r.why) ? r.why : [r.why])
    .map((w) => str(w, 200))
    .filter((w): w is string => !!w);
  if (!why.length) return null;        // a Move that cites nothing is a guess

  return {
    job: remoteJob.key,
    kind,
    // Namespaced so two workflows pointed at the same deployment cannot collide
    // on a generic id like "1".
    external_id: source ? `${source}:${id}`.slice(0, 200) : id,
    headline,
    why,
    artifact: { kind: aKind, label, value, href },
    cost_label: str(r.cost_label, 40) ?? null,
  };
}

export const remoteJob: Job = {
  key: 'remote',
  label: 'External workflow',

  available: () => !!process.env.COPILOT_JOBS_URL,

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const url = process.env.COPILOT_JOBS_URL!;
    const ctrl = new AbortController();
    // Never outlive the run's own budget: a remote that hangs must not be the
    // reason the nightly pass returns nothing for anybody.
    const budget = ctx.deadline ? Math.max(0, ctx.deadline - Date.now()) : TIMEOUT_MS;
    const t = setTimeout(() => ctrl.abort(), Math.min(TIMEOUT_MS, budget));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.COPILOT_JOBS_SECRET ? { authorization: `Bearer ${process.env.COPILOT_JOBS_SECRET}` } : {}) },
        body: JSON.stringify({
          kind: 'moves',
          today: ctx.today,
          profile: profileForRemote(ctx.profile),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as unknown;
      const raw = Array.isArray(json) ? json : Array.isArray((json as { moves?: unknown }).moves) ? (json as { moves: unknown[] }).moves : [];
      const source = !Array.isArray(json) ? str((json as { source?: unknown }).source, 40) : undefined;
      return raw.map((m) => normalizeRemoteMove(m, source)).filter((m): m is MoveDraft => !!m).slice(0, MAX_REMOTE_MOVES);
    } finally {
      clearTimeout(t);
    }
  },
};

/**
 * What the workflow is told. Enough to do the work, and no more — this payload
 * leaves the deployment, so it carries no email, no phone, no billing and no id.
 */
export function profileForRemote(p: Profile) {
  return {
    name: p.name,
    headline: p.headline,
    offer: p.offer,
    location: p.location,
    timezone: p.timezone,
    capacity: p.capacity,
    target_segments: p.target_segments,
    target_area: p.target_area,
    hunt_types: p.hunt_types,
  };
}
