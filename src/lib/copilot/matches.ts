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
// The list is one stage of four — New, To send, Waiting, Replied — picked by a
// bar across the top, so a business is somewhere on this tab from the night it
// is found to the reply. The send queue used to be a card above the list, the
// biggest thing on the screen whatever it held, and "1 draft written and
// waiting" over sixty poor fits was the tab's headline. Only one stage shows at
// a time, so this is still not the forty-row queue the product deleted once.
//
// A poor fit is folded, not listed. The ranker says so in its own reason —
// "a dental lab cannot buy medieval-market jewelry" — and the tab used to head
// that card "Matched for you". Folded under a count, with the search terms
// shown above it, because a list of poor fits almost always means the search
// is wrong, and the search is the one thing here the user can change.
//
// No percentages. A fit score is a heuristic or a model's guess, and a "92%
// match" badge presents a guess as a measurement — invariant 2. The order uses
// it; the screen does not print it.
//
// Pure: no DB import.

import { segmentOf } from './diagnose';
import { KIND_LABEL, type MoveKind } from './moves';
import type { TriageCard } from './triage';
import type { Channel, Move, Opportunity, OpportunityType, PipelineRow, QueueItem } from './types';

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

/**
 * Below this, a match the ranker has judged is a poor fit. The brief asks it
 * for 0-100 against this person's offer and goals (agent/schema.ts); a listing
 * nobody has judged yet is not weak, it is unjudged, and stays in the list.
 */
export const WEAK_FIT = 40;
/** Fewer judged than this and "most are poor fits" is a small sample, not a finding. */
export const WEAK_NOTICE_MIN = 3;

/** True when the ranker looked at this listing and judged it a poor fit. */
export function isWeak(o: Pick<Opportunity, 'scored_at' | 'fit_score'>): boolean {
  return !!o.scored_at && o.fit_score < WEAK_FIT;
}

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
  /**
   * What a business IS — the listing's own category, falling back to the
   * segment it was searched under — or the kind of a find. The category wins
   * because the search term can be wrong: on one live account the segment was
   * the single letter "m", sixty unrelated businesses came back under it, and
   * "M" was the only label on every card.
   */
  tag: string | null;
  /** One line under the title: what it is and where. "Dental laboratory · Toledo, OH". */
  sub: string | null;
  /** The facts a glance can use: rating and how to reach it, or what a find costs. */
  facts: string | null;
  /** A photo of the place, when the listing came with one. */
  image: string | null;
  /** Initials for the tile when there is no photo. Empty for a find, which gets a glyph. */
  initials: string;
  /** How a business can be reached. Null for a find, and for a listing with a link but no contact. */
  channel: Channel | null;
  url: string | null;
  fresh: boolean;
  created_at: string | null;
  saved: boolean;
  costLabel: string | null;
  /** The ranker has judged it. Only businesses are judged; a find never is. */
  judged: boolean;
  /** Judged, and judged a poor fit. Folded out of the list, never dropped. */
  weak: boolean;
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
    const tag = whatOf(o, input.targetSegments);
    businesses.push({
      id: o.id,
      from: 'business',
      answer: 'triage',
      group: groupOfType(o.type),
      title: o.title,
      reason: o.reason ?? '',
      tag,
      sub: join([tag ? capital(tag) : null, placeOf(o.data)]),
      facts: join([ratingOf(o.data), channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Link only']),
      image: imageOf(o.data),
      initials: monogramOf(o.title),
      channel,
      url,
      fresh: isFresh(o.created_at, now),
      created_at: o.created_at,
      saved: o.status === 'saved',
      costLabel: null,
      judged: !!o.scored_at,
      weak: isWeak(o),
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
      sub: join([KIND_LABEL[kind] ?? null, hostOf(c.url)]),
      facts: 'From a source you watch',
      image: null,
      initials: '',
      channel: null,
      url: c.url,
      fresh: isFresh(c.created_at, now),
      created_at: c.created_at ?? null,
      saved: false,
      costLabel: null,
      judged: false,
      weak: false,
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
      sub: join([KIND_LABEL[m.kind], hostOf(m.artifact?.href ?? null)]),
      facts: m.cost_label || 'From a source you watch',
      image: null,
      initials: '',
      channel: null,
      url: m.artifact?.href ?? null,
      fresh: isFresh(m.created_at, now),
      created_at: m.created_at,
      saved: false,
      costLabel: m.cost_label,
      judged: false,
      weak: false,
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

/**
 * The line under the greeting on Matches, counted over what the list shows —
 * poor fits are folded, so they are not "to look at". The queue is not here any
 * more: the stage bar right under this line carries it, and the same number
 * twice in one glance is how the header came to say 61 over a card saying 51.
 */
export function matchesStatus(counts: MatchCounts, poor = 0): string | null {
  if (counts.fresh) return `${counts.fresh} new since yesterday`;
  if (counts.all) return `${counts.all} to look at`;
  // Found plenty, none worth a message: said, because an empty list under a
  // calm header reads as a quiet night rather than a search pointed wrong.
  if (poor) return `${poor} found, all poor fits`;
  return null;
}

/**
 * Whether the poor fits are the story. More than half of what the ranker judged,
 * past a minimum, and the tab says so above the list — with the search terms,
 * because that is almost always the cause and it is the one input here that is
 * the user's to change.
 */
export function poorFitMajority(items: MatchItem[]): { judged: number; weak: number; majority: boolean } {
  const judged = items.filter((i) => i.judged).length;
  const weak = items.filter((i) => i.weak).length;
  return { judged, weak, majority: judged >= WEAK_NOTICE_MIN && weak * 2 > judged };
}

/**
 * Whether a typed segment is worth a search. One character is a typo, and it is
 * searched exactly as typed; two is kept, because "IT" and "HR" are markets.
 */
export function isSearchableSegment(s: string): boolean {
  return Array.from(s.trim()).length > 1;
}

/** What it searches for, as a sentence's two halves. Null halves when unset. */
export function lookingFor(segments: string[], area: string | null | undefined): { what: string | null; where: string | null } {
  const what = segments.map((s) => s.trim()).filter(Boolean);
  return { what: what.length ? what.join(', ') : null, where: area?.trim() || null };
}

/* ── The other three stages ─────────────────────────────────────────────── */

export const MATCH_STAGES = ['new', 'to_send', 'waiting', 'replied'] as const;
export type MatchStage = (typeof MATCH_STAGES)[number];
export const MATCH_STAGE_LABEL: Record<MatchStage, string> = { new: 'New', to_send: 'To send', waiting: 'Waiting', replied: 'Replied' };

/**
 * One business past New. Its card says where it is and does the one thing that
 * moves it: a draft opens to be sent, a send can be marked replied, a reply
 * opens to log what happened.
 */
export interface StageCard {
  key: string;
  stage: Exclude<MatchStage, 'new'>;
  title: string;
  sub: string | null;
  image: string | null;
  initials: string;
  /** Where it is, with how long: "Written 14 days ago", "Sent 20 days ago · no reply yet". */
  status: string;
  /** The draft's first line, so the card says what is about to go out. */
  preview: string | null;
  /** The draft to open, on To send. */
  draftId: string | null;
  /** The business, on Waiting and Replied. */
  oppId: string | null;
  channel: Channel | null;
}

export interface StageInput {
  now: Date;
  queue: QueueItem[];
  pipeline: PipelineRow[];
  targetSegments: string[];
}

export function stageCards(input: StageInput): Record<Exclude<MatchStage, 'new'>, StageCard[]> {
  const byId = new Map(input.pipeline.map((r) => [r.opportunity.id, r.opportunity]));
  const subOf = (o: Opportunity | undefined, fallback: string | null) => {
    if (!o) return fallback ? capital(fallback) : null;
    const tag = whatOf(o, input.targetSegments);
    return join([tag ? capital(tag) : null, placeOf(o.data)]);
  };

  // The queue, in the queue's own order, so the card list and the one-at-a-time
  // sheet it opens walk the same drafts in the same sequence. Read from the
  // queue rather than the pipeline: a draft for a business the pipeline does not
  // hold (an inferred one, or one past its 200 rows) is still a draft to send.
  const to_send: StageCard[] = input.queue.map((q) => {
    const oppId = q.opp?.id ?? q.opportunity_id ?? null;
    const o = oppId ? byId.get(oppId) : undefined;
    const title = q.opp?.title ?? o?.title ?? q.title;
    return {
      key: `q:${q.id}`,
      stage: 'to_send',
      title,
      sub: subOf(o, q.opp?.segment ?? null),
      image: o ? imageOf(o.data) : null,
      initials: monogramOf(title),
      status: `Written ${daysAgo(q.execution.created_at, input.now)}`,
      preview: firstLine(q.execution.body),
      draftId: q.id,
      oppId,
      channel: q.execution.channel,
    };
  });

  const sentAt = (r: PipelineRow) => r.execution?.sent_at ?? r.execution?.created_at ?? null;
  const card = (r: PipelineRow, stage: 'waiting' | 'replied', status: string): StageCard => ({
    key: `o:${r.opportunity.id}`,
    stage,
    title: r.opportunity.title,
    sub: subOf(r.opportunity, null),
    image: imageOf(r.opportunity.data),
    initials: monogramOf(r.opportunity.title),
    status,
    preview: null,
    draftId: null,
    oppId: r.opportunity.id,
    channel: r.execution?.channel ?? null,
  });

  // Oldest first: the one closest to having gone cold is the one worth a look.
  const waiting = input.pipeline.filter((r) => r.stage === 'sent')
    .sort((a, b) => (sentAt(a) ?? '').localeCompare(sentAt(b) ?? ''))
    .map((r) => { const at = sentAt(r); return card(r, 'waiting', at ? `Sent ${daysAgo(at, input.now)} · no reply yet` : 'Sent · no reply yet'); });
  // Newest first: a reply is live, and the latest is the one still warm.
  const replied = input.pipeline.filter((r) => r.stage === 'replied' || r.stage === 'meeting')
    .sort((a, b) => (sentAt(b) ?? '').localeCompare(sentAt(a) ?? ''))
    .map((r) => card(r, 'replied', r.stage === 'meeting' ? 'Meeting or proposal logged' : 'Replied — log what happened next'));

  return { to_send, waiting, replied };
}

/* ── Formatting, pure and small ─────────────────────────────────────────── */

const join = (parts: Array<string | null | undefined>) => {
  const kept = parts.filter((p): p is string => !!p && !!p.trim());
  return kept.length ? kept.join(' · ') : null;
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const str = (d: Record<string, unknown> | null | undefined, k: string) => {
  const v = d?.[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/**
 * What the listing is. The scraper's own category first; the segment it was
 * searched under only when there is none, and never a one-letter term, which is
 * a typo rather than a market.
 */
function whatOf(o: Pick<Opportunity, 'id' | 'status' | 'source' | 'source_kind' | 'data' | 'reason' | 'title'>, targetSegments: string[]): string | null {
  const category = str(o.data, 'category');
  if (category && category.length >= 3) return category;
  const seg = segmentOf({ id: o.id, status: o.status, source: o.source, source_kind: o.source_kind, data: o.data, reason: o.reason, title: o.title }, targetSegments);
  return seg && seg.length >= 2 ? seg : null;
}

/**
 * Where the place is, short enough for half a line. City and region when the
 * listing carries both; otherwise the address from the city on, postcode
 * dropped. The region is the point: "Toledo" is two cities, and the only
 * outward sign that a search for Toledo, Spain was answered from Toledo, Ohio
 * was an "OH" nobody was shown.
 */
export function placeOf(d: Record<string, unknown> | null | undefined): string | null {
  const city = str(d, 'city');
  const region = str(d, 'state') ?? str(d, 'country_code');
  if (city && region) {
    // "Manila, Metro Manila" says the city twice; the region is only worth its
    // space when it is not already a longer name for the same place.
    const c = city.toLowerCase(), r = region.toLowerCase();
    return c.includes(r) || r.includes(c) ? city : `${city}, ${region}`;
  }
  const address = str(d, 'address');
  if (address && city) {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    // From the END: an address closes on city, region and postcode, and a street
    // can carry a city's name ("Calle Toledo 12, 28005 Madrid").
    let at = -1;
    for (let i = parts.length - 1; i >= 0 && at < 0; i--) if (parts[i].toLowerCase().includes(city.toLowerCase())) at = i;
    if (at >= 0) {
      const tail = parts.slice(at, at + 2).map((p) => p.replace(/\b\d{4,6}(-\d{3,4})?\b/g, '').replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
      if (tail.length) return tail.join(', ');
    }
  }
  return city ?? str(d, 'area');
}

/** "4.6★ (31)", one decimal as Maps prints it. Nothing when there is no rating: no reviews is not a zero. */
export function ratingOf(d: Record<string, unknown> | null | undefined): string | null {
  const r = Number(d?.rating);
  if (!Number.isFinite(r) || r <= 0) return null;
  const n = Number(d?.reviews_count);
  return `${r.toFixed(1)}★${Number.isFinite(n) && n > 0 ? ` (${n})` : ''}`;
}

/** An https photo URL off the listing, or nothing. Never a data: or javascript: string from a remote adapter. */
export function imageOf(d: Record<string, unknown> | null | undefined): string | null {
  const u = str(d, 'image_url');
  return u && /^https:\/\//i.test(u) ? u : null;
}

/** Initials for a tile: the first letters of the first two words that carry any. */
export function monogramOf(title: string): string {
  const words = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  const main = words.filter((w) => !MONOGRAM_SKIP.has(w.toLowerCase()));
  const picked = (main.length ? main : words).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  // A title in a script the strip above removed entirely still gets its first character.
  return picked || (Array.from(title.trim())[0] ?? '');
}
const MONOGRAM_SKIP = new Set(['the', 'a', 'an', 'and', 'of', 'la', 'el', 'los', 'las', 'de', 'del', 'le', 'les', 'ng']);

/** Which of the tile tints a title gets. Stable per title, so a card keeps its colour. */
export function tintOf(title: string, n = 6): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '') || null; } catch { return null; }
}

function firstLine(body: string | null | undefined): string | null {
  const line = (body ?? '').split('\n').map((l) => l.trim()).find(Boolean);
  return line ? line.slice(0, 160) : null;
}

function daysAgo(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
