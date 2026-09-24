// src/lib/copilot/matches.ts
// The Matches tab: everything the app found outside the account that you might
// go after, in one list, filtered by what kind of thing it is.
//
// Why this is a tab again. The pipeline tab was folded away because its parts
// existed elsewhere — the queue on Now, the deck on Now, the stages on Working —
// and the cost of that was the product's front door: the thing it does while
// you sleep is FIND people, and there was no longer a place where what it found
// was simply laid out. Waking up to "12 new overnight" and a list of who they
// are is the morning the product was designed around.
//
// Two sources, kept distinct because they are answered differently:
//
//   business   a real listing with a contact, from supply. Yes drafts an opener.
//   feed       something a watched source turned up — a gig post, a role, a
//              person, a signal. The artifact is already attached; yes keeps it.
//
// What the list deliberately does not carry: drafted businesses (they are the
// queue, one strip at the top), and anything already contacted (they are the
// pipeline, opened from Work). A list that held every stage would be the
// forty-row queue this product already deleted once.
//
// No percentages. A fit score is a heuristic or a model's guess, and a "92%
// match" badge presents a guess as a measurement — invariant 2. The order uses
// it; the screen does not print it.
//
// Pure: no DB import.

import { segmentOf } from './diagnose';
import { KIND_LABEL, type MoveKind } from './moves';
import type { TriageCard } from './triage';
import type { Channel, Move, OpportunityType, PipelineRow } from './types';

export const MATCH_GROUPS = ['clients', 'work', 'people', 'signals'] as const;
export type MatchGroup = (typeof MATCH_GROUPS)[number];

export const MATCH_GROUP_LABEL: Record<MatchGroup, string> = {
  clients: 'Clients',
  work: 'Gigs & jobs',
  people: 'People',
  signals: 'Signals',
};

/** "New" means it arrived in the last day — whichever run found it. */
export const FRESH_HOURS = 24;

/** What a supplied listing is, by the type its adapter gave it. */
export function groupOfType(t: OpportunityType): MatchGroup {
  if (t === 'people') return 'people';
  if (t === 'signal' || t === 'community') return 'signals';
  return 'clients';
}

/**
 * What a feed find is, by its Move kind. `earn` from a feed is somebody paying
 * for work — a gig, a brief, a role — which is why it is not "Clients": those
 * are businesses you would pitch, and these are posts you would answer.
 */
export function groupOfKind(k: MoveKind): MatchGroup {
  if (k === 'earn') return 'work';
  if (k === 'meet') return 'people';
  return 'signals';
}

export interface MatchItem {
  id: string;
  from: 'business' | 'feed';
  /**
   * Which route answers it. A business or a deck card goes through triage, so
   * the keep-rate learns from it; a feed signal that was never a deck card is a
   * Move and is answered as one.
   */
  answer: 'triage' | 'move';
  group: MatchGroup;
  title: string;
  reason: string;
  /** The segment of a business, or the kind of a find. */
  tag: string | null;
  /** How a business can be reached. Null for a find, and for a listing with a link but no contact. */
  channel: Channel | null;
  url: string | null;
  fresh: boolean;
  created_at: string | null;
  saved: boolean;
  costLabel: string | null;
}

export interface MatchFeedInput {
  now: Date;
  pipeline: PipelineRow[];
  /** The deck, already ordered by what this person keeps. */
  triage: TriageCard[];
  /** Open Moves; only the watcher's are read here. */
  moves: Move[];
  targetSegments: string[];
}

const isFresh = (iso: string | null | undefined, now: Date) =>
  !!iso && now.getTime() - Date.parse(iso) <= FRESH_HOURS * 3_600_000;

export function matchFeed(input: MatchFeedInput): MatchItem[] {
  const { now } = input;
  // The deck's order is the learned one — keep-rate first, then score — so it
  // leads wherever a card is in it. Listings the deck is holding back (the queue
  // is deep) are still shown, below, by score: seeing what was found is not the
  // avoidance the hold exists for; drafting more of it is, and the tab gates that.
  const rank = new Map(input.triage.map((c, i) => [c.id, i]));

  // The fit score orders the list and is never printed — see the note on percentages above.
  const scoreOf = new Map<string, number>();
  const businesses: MatchItem[] = [];
  for (const row of input.pipeline) {
    if (row.stage !== 'not_drafted') continue;
    const o = row.opportunity;
    if (o.status === 'dismissed' || o.status === 'acted') continue;
    const channel: Channel | null = o.contact?.whatsapp ? 'whatsapp' : o.contact?.email ? 'email' : null;
    const url = o.url || o.contact?.website || null;
    // A listing you can neither message nor look up is a row you can only
    // scroll past. Same floor canTriage applies to the deck.
    if (!channel && !url) continue;
    businesses.push({
      id: o.id,
      from: 'business',
      answer: 'triage',
      group: groupOfType(o.type),
      title: o.title,
      reason: o.reason ?? '',
      tag: segmentOf({ id: o.id, status: o.status, source: o.source, source_kind: o.source_kind, data: o.data, reason: o.reason, title: o.title }, input.targetSegments),
      channel,
      url,
      fresh: isFresh(o.created_at, now),
      created_at: o.created_at,
      saved: o.status === 'saved',
      costLabel: null,
    });
    scoreOf.set(o.id, o.score ?? 0);
  }

  const finds: MatchItem[] = [];
  const seen = new Set<string>();
  for (const c of input.triage) {
    if (c.source !== 'move') continue;
    seen.add(c.id);
    const kind = (c.segment ?? 'earn') as MoveKind;
    finds.push({
      id: c.id,
      from: 'feed',
      answer: 'triage',
      group: groupOfKind(kind),
      title: c.title,
      reason: c.reason,
      tag: KIND_LABEL[kind] ?? null,
      channel: null,
      url: c.url,
      fresh: isFresh(c.created_at, now),
      created_at: c.created_at ?? null,
      saved: false,
      costLabel: null,
    });
  }
  for (const m of input.moves) {
    if (m.job !== 'watch' || seen.has(m.id)) continue;
    finds.push({
      id: m.id,
      from: 'feed',
      answer: 'move',
      group: groupOfKind(m.kind),
      title: m.headline,
      reason: m.why[0] ?? '',
      tag: KIND_LABEL[m.kind],
      channel: null,
      url: m.artifact?.href ?? null,
      fresh: isFresh(m.created_at, now),
      created_at: m.created_at,
      saved: false,
      costLabel: m.cost_label,
    });
  }

  // Finds interleave with businesses by the same rule, so a gig posted last
  // night is not buried under two hundred listings from last month.
  const rankOf = (id: string) => rank.get(id) ?? Number.POSITIVE_INFINITY;
  return [...businesses, ...finds].sort((a, b) =>
    Number(b.fresh) - Number(a.fresh)
    || (rankOf(a.id) === rankOf(b.id) ? 0 : rankOf(a.id) < rankOf(b.id) ? -1 : 1)
    || (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0)
    || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export interface MatchCounts {
  all: number;
  fresh: number;
  by: Record<MatchGroup, number>;
}

export function matchCounts(items: MatchItem[]): MatchCounts {
  const by = Object.fromEntries(MATCH_GROUPS.map((g) => [g, 0])) as Record<MatchGroup, number>;
  for (const i of items) by[i.group] += 1;
  return { all: items.length, fresh: items.filter((i) => i.fresh).length, by };
}

/** The line under the greeting on Matches. */
export function matchesStatus(counts: MatchCounts, queueCount: number): string | null {
  const parts = [
    counts.fresh ? `${counts.fresh} new since yesterday` : counts.all ? `${counts.all} to look at` : null,
    // Short enough for one line beside the capacity pill at 390px.
    queueCount ? `${queueCount} to send` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
