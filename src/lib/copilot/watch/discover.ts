// src/lib/copilot/watch/discover.ts
// Finding the feeds, so the hardest part of the watcher stops being the user's.
//
// To add a source today you have to already know that r/forhire exists. That is
// most of what somebody would be hiring this app to work out, and it was the
// blank first screen of the only sensor that reaches outside the account at all.
// Everything else the app knows is computed from rows the user already had, and
// a closed system can only ever re-rank itself.
//
// The pipeline is four steps and only the middle two touch the network:
//
//   1. queries        from the offer, because the offer describes a world
//   2. Exa            returns PAGES — real URLs, not a model's guess at one
//   3. candidateFeeds turns a page into feed URLs to try, deterministically
//   4. verify         fetch and parse; only what produced real items is offered
//
// Nothing here decides what is worth reading. It decides what is READABLE, and
// the user picks. That keeps discovery on the right side of invariant 3: no
// inferred thing is ever promoted over a sourced one, because by the time the
// user sees a card the feed has already been fetched and parsed.
//
// Pure. The fetching lives in the route, the same split as feed.ts and
// jobs/watcher.ts.

import { decodeEntities } from './feed';
import { normalizeSourceUrl } from './catalogue';
import { offerIsEmpty } from '../offer';
import type { Profile } from '../types';

/** Offered at once. Below MAX_WATCH_SOURCES so a full list is still addable. */
export const MAX_DISCOVERED = 8;
/** Sent to Exa. Each costs money, so the cap is a budget and not a guess. */
export const MAX_QUERIES = 3;
/**
 * A feed has to produce at least this much to count as alive. One item is a
 * placeholder page or a site that posted once in 2019; three is a feed.
 */
export const MIN_VERIFY_ITEMS = 3;
/** Feed URLs tried per page. Autodiscovery usually hits on the first. */
export const MAX_TRIES_PER_PAGE = 4;

/**
 * What kind of place to look for, and the sentence that finds it.
 *
 * Keyed to hunt_types, which the user set at onboarding — so somebody hunting
 * clients gets marketplaces and forums, and somebody hunting signal gets
 * newsletters. The label becomes the source's `intent`, which the nightly judge
 * is told; "this feed is here because you are looking for contract work" is the
 * difference between a relevant pick and a merely topical one.
 */
export interface QueryShape {
  /** Which hunt_types ask for this shape. */
  wants: string[];
  label: (o: { sells: string; forWho?: string }) => string;
  query: (o: { sells: string; forWho?: string; problem?: string; area?: string }) => string;
}

export const QUERY_SHAPES: QueryShape[] = [
  {
    wants: ['client', 'service'],
    label: ({ sells }) => `Where paid ${sells} work gets posted`,
    query: ({ sells, area }) =>
      `job board or marketplace where companies post paid ${sells} projects${area ? ` in ${area}` : ''}`,
  },
  {
    wants: ['client', 'community'],
    label: ({ forWho, sells }) => `Where ${forWho || 'buyers'} talk about ${sells}`,
    query: ({ forWho, problem, sells }) =>
      `active online community or forum where ${forWho || 'small business owners'} ask for help with ${problem || sells}`,
  },
  {
    wants: ['people'],
    label: ({ sells }) => `Where people hiring for ${sells} post`,
    query: ({ sells, area }) =>
      `hiring board or careers feed for ${sells} roles${area ? ` in ${area}` : ''}`,
  },
  {
    wants: ['signal'],
    label: ({ forWho, sells }) => `What is changing in ${forWho || sells}`,
    query: ({ forWho, sells }) =>
      `industry newsletter or blog covering ${forWho || sells}`,
  },
];

/**
 * The searches to run for this person.
 *
 * Empty when the offer is empty, which is invariant 1 reaching one step further
 * out than it used to: a draft written from nothing is not the user's message,
 * and a search run from nothing is not the user's world. "Find me sources"
 * against a blank offer returns whatever the model free-associates, and the
 * result is a watchlist nobody recognises.
 *
 * Goals are deliberately not used. A goal title is a target, not a place —
 * "Reach $5,000/month" names no corner of the internet, and feeding it to a
 * search engine produces motivational blogs. The offer says what the user does
 * and who for, which is the only part of the account that describes somewhere
 * real.
 */
export function discoveryQueries(profile: Pick<Profile, 'offer' | 'hunt_types' | 'target_area' | 'location'>): Array<{ label: string; query: string }> {
  if (offerIsEmpty(profile.offer)) return [];
  const sells = (profile.offer.sells ?? '').trim();
  if (!sells) return [];

  const forWho = profile.offer.for_who?.trim() || undefined;
  const problem = profile.offer.problem?.trim() || undefined;
  const area = profile.target_area?.trim() || profile.location?.trim() || undefined;
  const hunts = profile.hunt_types?.length ? profile.hunt_types : ['client'];

  const out: Array<{ label: string; query: string }> = [];
  for (const shape of QUERY_SHAPES) {
    if (!shape.wants.some((w) => hunts.includes(w as Profile['hunt_types'][number]))) continue;
    const label = shape.label({ sells, forWho }).slice(0, 200);
    const query = shape.query({ sells, forWho, problem, area }).slice(0, 400);
    // Two hunt_types can select the same shape; the list is what to search, not
    // what was asked for.
    if (out.some((q) => q.query === query)) continue;
    out.push({ label, query });
    if (out.length >= MAX_QUERIES) break;
  }
  return out;
}

const FEED_TYPE = /application\/(?:rss\+xml|atom\+xml|feed\+json)/i;

/**
 * Every feed a page declares, resolved absolute.
 *
 * This is the standard autodiscovery `<link rel="alternate">` and it is the
 * reason discovery does not need a model to guess URLs: a site that publishes a
 * feed says so in its own head, and reading that is deterministic. A guessed
 * /feed path is the fallback below, not the mechanism.
 */
export function feedLinksFromHtml(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<link\s([^>]*?)\/?>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const attrs = m[1];
    // rel can be "alternate", "alternate home", or quoted either way.
    if (!/\brel\s*=\s*["']?[^"'>]*\balternate\b/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
    if (!FEED_TYPE.test(type)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href?.trim()) continue;
    try {
      out.push(new URL(decodeEntities(href.trim()), base).toString());
    } catch {
      // A relative href against a base we cannot parse is not worth a throw.
    }
  }
  return [...new Set(out)];
}

/** The conventional paths, tried only when a page declares nothing. */
export function feedGuesses(pageUrl: string): string[] {
  let u: URL;
  try { u = new URL(pageUrl); } catch { return []; }
  const path = u.pathname.replace(/\/$/, '');
  const guesses = [
    // Section-relative first: a blog at /blog serves /blog/feed, and the root
    // feed of the same host is usually a different, broader thing.
    ...(path && path !== '/' ? [`${u.origin}${path}/feed`] : []),
    `${u.origin}/feed`,
    `${u.origin}/rss`,
  ];
  return [...new Set(guesses)];
}

/**
 * Feed URLs to try for one page, best first.
 *
 * normalizeSourceUrl goes first and often ends it: a Reddit or YouTube or hnrss
 * URL converts with no fetch at all, which is most of what Exa returns for the
 * community shapes. Only when that fails does the page get read.
 */
export function candidateFeeds(pageUrl: string, html?: string): string[] {
  const direct = normalizeSourceUrl(pageUrl);
  const out: string[] = [];
  if (direct?.kind === 'feed') out.push(direct.url);
  if (html) out.push(...feedLinksFromHtml(html, pageUrl));
  out.push(...feedGuesses(pageUrl));
  return [...new Set(out)].slice(0, MAX_TRIES_PER_PAGE);
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export interface DiscoveryCandidate {
  /** The page Exa returned. Shown so the user can see where this came from. */
  page: string;
  title: string;
  /** Exa's one-liner about the place. Never a claim about an opportunity. */
  summary?: string;
  /** Why it is being offered — becomes the source's intent. */
  intent: string;
}

/**
 * Hits worth fetching: nothing already watched, nothing twice from one host.
 *
 * The host rule matters more than it looks. Exa happily returns six pages of
 * the same job board, and six feeds from one site is six nightly model calls
 * answering the same question — the per-source budget is the scarce thing here,
 * not the user's attention.
 */
export function newCandidates(
  hits: Array<{ url: string; title: string; summary?: string }>,
  intent: string,
  seen: Set<string>,
): DiscoveryCandidate[] {
  const out: DiscoveryCandidate[] = [];
  for (const hit of hits) {
    const host = hostOf(hit.url);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push({ page: hit.url, title: hit.title, summary: hit.summary, intent });
  }
  return out;
}

/**
 * A page title as a source name.
 *
 * Site titles are built for search engines — "We Work Remotely: Remote Jobs for
 * Digital Nomads" — and the part before the first separator is almost always
 * the name. Everything after it is the pitch, and a watchlist of pitches is
 * unreadable on a phone.
 */
export function titleLabel(title: string): string {
  // A colon needs no space before it ("We Work Remotely: Remote Jobs"), a dash
  // or pipe does — or "r/for-hire" and "9-to-5" lose their second half.
  const head = title.split(/\s+[—–|·]\s+|:\s+/)[0].trim();
  // A title that is one long phrase with no separator, or a bare URL, is not a
  // name and the caller should fall back.
  if (!head || head.length > 40 || /^https?:\/\//i.test(head)) return '';
  return head;
}

export interface Discovered {
  /** The verified feed URL — fetched and parsed before it got here. */
  url: string;
  label: string;
  intent: string;
  page: string;
  /** One real headline off the feed, so the user judges the thing not the pitch. */
  sample: string;
  /** How many items it actually returned. A number computed, never claimed. */
  items: number;
}

/**
 * A verified candidate, as a card.
 *
 * `sample` is the point. A row that says "Remote OK — 42 items" is a promise;
 * one that shows the newest headline off the feed is evidence, and the user can
 * tell in a second whether it is their world. Same reason the app renders no
 * lesson without a URL.
 */
export function discoveredFrom(
  candidate: DiscoveryCandidate,
  feedUrl: string,
  items: Array<{ title: string }>,
): Discovered | null {
  if (items.length < MIN_VERIFY_ITEMS) return null;
  const normalized = normalizeSourceUrl(feedUrl);
  // normalizeSourceUrl only sets `note` when it RECOGNISED the shape, and in
  // that case its label is the good one — "r/forhire" beats whatever Reddit
  // puts in a <title>. Otherwise its label is the hostname with the TLD cut
  // off, which reads as "Weworkremotely", and the page's own title is better.
  const label = (normalized?.note ? normalized.label : titleLabel(candidate.title) || normalized?.label || hostOf(feedUrl)).slice(0, 80);
  const sample = (items[0]?.title ?? '').trim().slice(0, 200);
  if (!sample) return null;
  return {
    url: feedUrl,
    label,
    intent: candidate.intent.slice(0, 200),
    page: candidate.page,
    sample,
    items: items.length,
  };
}

/** Drop feeds that verified to the same URL, and cap what is offered. */
export function rankDiscovered(found: Discovered[]): Discovered[] {
  const byUrl = new Map<string, Discovered>();
  for (const d of found) {
    const prev = byUrl.get(d.url);
    // More items is a livelier feed, and the tie-break costs nothing.
    if (!prev || d.items > prev.items) byUrl.set(d.url, d);
  }
  return [...byUrl.values()].sort((a, b) => b.items - a.items).slice(0, MAX_DISCOVERED);
}
