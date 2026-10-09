// src/lib/copilot/voices.ts
// People who said it: public posts where somebody says, in their own words, the
// problem a running bet is about — found for that bet, each with its link.
//
// Why it exists. Its owner's bet was ten conversations with people who want a
// business and do not know where to start, and on day three the card read
// "0 of 10" over a "Log a conversation" button. Nothing in the app could find one
// such person: the pool, the searches and the deck all look for businesses to
// write to, and a conversation bet needs people to talk to. The Mom Test's first
// step is finding people who have the problem, and the cheapest place they say
// so is in public, where they ask for help. So the bet finds them: posts on
// forums and social sites, recent, each one somebody saying it.
//
// The rules it is held to, each the app's own:
//
//   - A post counts only with a real link: a page a search index crawled, on one
//     of the sites below, never a URL a model wrote (invariant 3).
//   - Their words are the page's own sentence (the search's highlight), never a
//     model's summary of it. A summary is a model's reading of a person, and on
//     the card it would stand in their quotes (invariant 12).
//   - The app writes to nobody (invariant 4). The person replies from their own
//     account, by hand, and logs the conversation when there is one.
//   - Nothing is kept about anyone but what they posted in public and where, for
//     the bet that found it: no file on a person (DIRECTION.md).
//   - A conversation logged from a post names it, so the bet says how many of
//     the people it found became conversations: rows, not recollection.
//
// It passes the survival test on the join, not the search. A harness can call a
// search once; it cannot say that eight posts found for this bet became two
// conversations and one commitment, or that the last bet's posts became none.
//
// Pure: no DB import, no fetch. The route searches (watch/exa.ts exaPosts) and
// store.ts keeps the rows, as copilot_events — no migration.

import type { Bet, Commitment, Talk } from './lab';
import type { Offer } from './types';

/** One search for a bet and what it kept. */
export const LAB_VOICES = 'lab_voices';
/** A post the person said is not a fit. It leaves the card; the search's row keeps it. */
export const LAB_VOICE_GONE = 'lab_voice_gone';
export const VOICE_EVENTS = [LAB_VOICES, LAB_VOICE_GONE] as const;

/**
 * Where people say a problem in their own words, in public, and can be answered
 * by hand. A company site is not here (the hunts find those), nor anywhere that
 * needs a login to read: a link the person cannot open is not somebody to talk to.
 */
const SITES: Array<{ host: string; name: string }> = [
  { host: 'reddit.com', name: 'Reddit' },
  { host: 'indiehackers.com', name: 'Indie Hackers' },
  { host: 'news.ycombinator.com', name: 'Hacker News' },
  { host: 'quora.com', name: 'Quora' },
  { host: 'x.com', name: 'X' },
  { host: 'twitter.com', name: 'X' },
];
export const VOICE_DOMAINS = SITES.map((s) => s.host);

/** Kept from one search. Ten people is a fortnight of conversations; more is a list nobody works through. */
export const VOICES_PER_SEARCH = 8;
/** Asked of the index per query: the page it bills for. Half are usually somebody else's site or a dead thread. */
export const VOICE_RESULTS = 10;
/** Only posts this recent. Somebody who asked for help a year ago has found it, or stopped looking. */
export const VOICE_DAYS = 120;
/** Searches one bet may run. Each one costs money; past three, the posts are there and the talking is what is left. */
export const VOICE_SEARCHES = 3;
export const VOICE_SAID_MAX = 280;
export const VOICE_TITLE_MAX = 140;
export const VOICE_AUTHOR_MAX = 60;
export const VOICE_QUERY_MAX = 160;
/** Queries asked per search: two phrasings find different people; a third finds the same ones again. */
export const VOICE_QUERIES = 2;

/**
 * The first thing to send, from The Mom Test: about their past, not the idea.
 * Fixed words, not a model's — a reply to somebody's post is theirs to write,
 * and this is only the shape of a good first question.
 */
export const VOICE_OPENER = 'Not selling anything, I am trying to understand this. When did it last get in your way, and what did you try?';

export interface Voice {
  /** From the address, so the same post found twice is one. */
  id: string;
  url: string;
  /** Where it was said: "r/Entrepreneur", "Indie Hackers". */
  where: string;
  /** The post's own title, as the index has it. */
  title: string;
  /** A sentence from the page, word for word. Null when the search returned none. */
  said: string | null;
  /** The name the post is signed with, where the index has one. */
  author: string | null;
  /** The day it was posted, where the index knows it. */
  posted: string | null;
}

export interface VoiceSearch {
  /** The event id. */
  id: string;
  bet: string;
  at: string;
  voices: Voice[];
  queries: string[];
  /** Who wrote the searches: a model, or the offer's own words. */
  from: 'model' | 'offer';
}

export interface VoicesHome {
  /** Newest first. */
  searches: VoiceSearch[];
  /** Posts said not to be a fit. */
  gone: string[];
  /** The read's failure: said on the bet, never drawn as nobody found (invariant 13). */
  unreadable?: string | null;
}

/** What the route hands over from a search hit: watch/exa.ts ExaHit's fields. */
export interface VoiceHit { url: string; title: string; highlight?: string; author?: string; publishedDate?: string }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const line = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ─── Addresses ───────────────────────────────────────────────────────────── */

/** The site a post is on, or null for anywhere else — and for anything that is not a web address. */
export function voiceSite(url: string): { host: string; name: string; u: URL } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const site = SITES.find((s) => host === s.host || host.endsWith(`.${s.host}`));
  return site ? { ...site, u } : null;
}

/**
 * The address a post is known by: no query, no fragment, no trailing slash, and
 * a Reddit thread without its slug — the same thread is found with and without
 * one, and two cards for one person would be one conversation logged twice.
 */
export function voiceKey(url: string): string | null {
  const site = voiceSite(url);
  if (!site) return null;
  const host = site.u.hostname.toLowerCase().replace(/^(www|old|new|m|np)\./, '');
  let path = site.u.pathname.replace(/\/+$/, '');
  const thread = path.match(/^(\/r\/[^/]+\/comments\/[a-z0-9]+)/i);
  if (thread) path = thread[1];
  // Hacker News says which thread in its query, and it is the only part that does.
  const item = host === 'news.ycombinator.com' ? site.u.searchParams.get('id') : null;
  return `${host}${path.toLowerCase()}${item && /^\d+$/.test(item) ? `?id=${item}` : ''}`;
}

/** FNV-1a: short, stable, and the same on the server and the phone. Not a secret, only a name. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const isVoiceId = (v: unknown): v is string => typeof v === 'string' && /^v_[0-9a-f]{8}$/.test(v);

/** A post's id, from its address: the same post found by two searches is one card. */
export function voiceId(url: string): string | null {
  const key = voiceKey(url);
  return key ? `v_${fnv(key)}` : null;
}

/** "r/Entrepreneur" for a Reddit thread; the site's name for the rest. */
export function voiceWhere(url: string): string | null {
  const site = voiceSite(url);
  if (!site) return null;
  const sub = site.host === 'reddit.com' ? site.u.pathname.match(/^\/r\/([A-Za-z0-9_]{2,40})(\/|$)/) : null;
  return sub ? `r/${sub[1]}` : site.name;
}

/* ─── What a search brought back ──────────────────────────────────────────── */

/**
 * A sentence from the page, as the page has it, made readable: one line, the
 * marks a forum's formatting leaves (asterisks, a quote's angle, a heading's
 * hash) taken off, cut at a word. The words stay theirs — nothing is reworded.
 */
export function cleanSaid(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/\[([^\]]{1,200})\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)[#>]+\s+/g, '$1')
    .replace(/[*_`~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 12) return null;
  if (s.length <= VOICE_SAID_MAX) return s;
  return `${s.slice(0, VOICE_SAID_MAX - 1).replace(/\s+\S*$/, '')}…`;
}

/** The name a post is signed with, without the site's prefix. A name that is a link or a sentence is not one. */
function authorOf(v: unknown): string | null {
  const a = line(v, VOICE_AUTHOR_MAX + 4)?.replace(/^(u\/|\/u\/|@)/i, '') ?? null;
  return a && a.length <= VOICE_AUTHOR_MAX && !/https?:|\s{2,}/.test(a) && a.split(' ').length <= 4 ? a : null;
}

/**
 * What a search found, kept: posts on the sites above only — the index is asked
 * for those, and checked here anyway, because a result is a claim about a page
 * until the address says otherwise — each once, none already found for this
 * account, at most `max`. A post with neither a title nor a sentence says nothing
 * a card could show, and is dropped.
 */
export function voicesFromHits(hits: VoiceHit[], seen: ReadonlySet<string>, max = VOICES_PER_SEARCH): Voice[] {
  const out: Voice[] = [];
  const ids = new Set<string>();
  for (const h of hits) {
    if (out.length >= max) break;
    const id = typeof h.url === 'string' ? voiceId(h.url) : null;
    if (!id || seen.has(id) || ids.has(id)) continue;
    const where = voiceWhere(h.url)!;
    const said = cleanSaid(h.highlight);
    const rawTitle = line(h.title, VOICE_TITLE_MAX + 40);
    const title = rawTitle && rawTitle !== h.url ? rawTitle.replace(/\s*[:|-]\s*r\/\w+$/i, '').slice(0, VOICE_TITLE_MAX) : null;
    if (!said && !title) continue;
    ids.add(id);
    out.push({
      id, url: h.url.slice(0, 500), where, title: title ?? where, said,
      author: authorOf(h.author),
      posted: typeof h.publishedDate === 'string' && isDay(h.publishedDate.slice(0, 10)) ? h.publishedDate.slice(0, 10) : null,
    });
  }
  return out;
}

/* ─── What to search for ──────────────────────────────────────────────────── */

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * The searches, from the offer's own words, where no model writes them: the
 * problem as somebody asking for help would put it, and the buyers named beside
 * it. A search engine reading meaning, not keywords, finds the post from either.
 * Nothing from a blank offer (invariant 1) — the caller checks that first.
 */
export function voiceQueries(offer: Offer, belief: string): string[] {
  const problem = offer.problem?.trim() ? lowerFirst(offer.problem.trim()) : null;
  const who = offer.for_who?.split(/[,;/]|\s+(?:and|or)\s+/)[0].trim() || null;
  // A second phrasing only where there is a second thing to say: the belief
  // twice is one search paid for two times.
  const out = [
    `asking for advice: ${problem ?? lowerFirst(belief)}`,
    who && problem ? `${who}: ${problem}` : null,
  ].filter((q): q is string => !!q).map((q) => q.replace(/\s+/g, ' ').trim().slice(0, VOICE_QUERY_MAX));
  return [...new Set(out)].filter((q) => q.length >= 8).slice(0, VOICE_QUERIES);
}

export const VOICE_SYSTEM = [
  'You write web searches that find recent public posts where one person describes, in the first person, having a problem.',
  'The posts are on Reddit, Indie Hackers, Hacker News, Quora and X: someone asking for help, venting, or asking what others did.',
  `Write ${VOICE_QUERIES} searches. Write each as the sentence such a person would post, in their words, not as keywords.`,
  'Never name the product or the seller. Never write a web address. Each under 120 characters.',
  'Answer with only JSON: {"queries": ["...", "..."]}',
].join('\n');

/** What the model is told: the buyers, the problem and the bet's belief, in the person's words. */
export function voicePrompt(i: { offer: Offer; belief: string }): string {
  return [
    i.offer.for_who?.trim() ? `Who has the problem: ${i.offer.for_who.trim()}` : null,
    i.offer.problem?.trim() ? `The problem: ${i.offer.problem.trim()}` : null,
    `What the seller believes about them: ${i.belief}`,
  ].filter(Boolean).join('\n');
}

/** The model's searches, held to what a search is: words, short, no address, no repeat. Null when none hold up. */
export function parseVoiceQueries(raw: unknown): string[] | null {
  const qs = Array.isArray(obj(raw).queries) ? (obj(raw).queries as unknown[]) : [];
  const out: string[] = [];
  for (const q of qs) {
    const s = line(q, VOICE_QUERY_MAX + 40);
    if (!s || s.length < 8 || s.length > VOICE_QUERY_MAX || /https?:|www\.|\.com\b/i.test(s)) continue;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
    out.push(s);
    if (out.length >= VOICE_QUERIES) break;
  }
  return out.length ? out : null;
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface VoiceEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

/**
 * Each search and every post said not to be a fit, newest first. A post is read
 * back from its address — its id is worked out again, never taken from the row —
 * so a row that does not hold together is dropped, not shown as somebody.
 */
export function voicesFromEvents(rows: VoiceEventRow[]): VoicesHome {
  const searches: VoiceSearch[] = [];
  const gone = new Set<string>();
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const p = obj(r.payload);
    if (r.event_type === LAB_VOICE_GONE) {
      if (isVoiceId(p.voice)) gone.add(p.voice);
      continue;
    }
    if (r.event_type !== LAB_VOICES || typeof p.bet !== 'string' || !p.bet) continue;
    const voices: Voice[] = [];
    for (const raw of Array.isArray(p.voices) ? p.voices : []) {
      const v = obj(raw);
      const url = typeof v.url === 'string' ? v.url : '';
      const id = voiceId(url);
      if (!id || voices.some((x) => x.id === id)) continue;
      voices.push({
        id, url, where: voiceWhere(url)!,
        title: line(v.title, VOICE_TITLE_MAX) ?? voiceWhere(url)!,
        said: cleanSaid(v.said),
        author: authorOf(v.author),
        posted: isDay(v.posted) ? v.posted : null,
      });
    }
    const queries = (Array.isArray(p.queries) ? p.queries : []).map((q) => line(q, VOICE_QUERY_MAX)).filter((q): q is string => !!q).slice(0, VOICE_QUERIES);
    searches.push({ id: String(r.id), bet: p.bet.slice(0, 64), at: r.created_at, voices: voices.slice(0, VOICES_PER_SEARCH), queries, from: p.from === 'model' ? 'model' : 'offer' });
  }
  return { searches, gone: [...gone] };
}

/** Every post already found for the account: a new search does not bring back somebody already on a card. */
export function voicesSeen(home: VoicesHome | null | undefined): Set<string> {
  return new Set((home?.searches ?? []).flatMap((s) => s.voices.map((v) => v.id)));
}

/* ─── The bet's people ────────────────────────────────────────────────────── */

/** Whether a bet is about people who have the problem: one that counts conversations, or one on who buys. */
export function betVoiced(bet: Pick<Bet, 'part' | 'metric' | 'tries'>): boolean {
  return bet.part === 'who' || bet.metric === 'talks' || bet.metric === 'committed' || bet.tries?.metric === 'talks';
}

export interface BetVoices {
  /** Not yet talked to, nor said not to be a fit, newest search first. */
  open: Voice[];
  /** Found for this bet and logged as a conversation. */
  talked: number;
  /** Found for this bet, every one. */
  found: number;
  searches: number;
  /** When the newest search ran, and whether it kept nobody. */
  last: { at: string; kept: number } | null;
}

/** The posts found for one bet, read against the conversations logged from them and the ones set aside. */
export function betVoices(home: VoicesHome | null | undefined, bet: Pick<Bet, 'id'>, talks: Array<Pick<Talk, 'voice'>>): BetVoices {
  const mine = (home?.searches ?? []).filter((s) => s.bet === bet.id);
  const gone = new Set(home?.gone ?? []);
  const talkedTo = new Set(talks.map((t) => t.voice).filter((v): v is string => !!v));
  const all: Voice[] = [];
  for (const s of mine) for (const v of s.voices) if (!all.some((x) => x.id === v.id)) all.push(v);
  return {
    open: all.filter((v) => !talkedTo.has(v.id) && !gone.has(v.id)),
    talked: all.filter((v) => talkedTo.has(v.id)).length,
    found: all.length,
    searches: mine.length,
    last: mine[0] ? { at: mine[0].at, kept: mine[0].voices.length } : null,
  };
}

/**
 * Why a bet cannot search again, or null when it can. Said the same by the route
 * that refuses and the card that hides the button, so the two cannot disagree.
 */
export function voiceRefusal(i: { running: boolean; voiced: boolean; searches: number; ready: boolean; remaining: number }): string | null {
  if (!i.ready) return 'Searching the web is not set up on this server (EXA_API_KEY).';
  if (!i.running) return 'That bet is not running.';
  if (!i.voiced) return 'This bet does not count conversations, so there is nobody to find for it.';
  if (i.searches >= VOICE_SEARCHES) return `${VOICE_SEARCHES} searches for this bet already. The people they found are the work now.`;
  if (i.remaining <= 0) return 'Your matches for this month are used up, and each post found counts as one.';
  return null;
}

/**
 * A conversation bet with nothing logged, said on the card from day two: how many
 * conversations its own plan set, and the days left to have them. Arithmetic on
 * the person's line, never a pace the app estimated (invariant 2).
 */
export function stuckLine(i: { day: number; days: number; talks: number; planned: number | null }): string | null {
  if (i.day < 2 || i.talks > 0) return null;
  const left = Math.max(1, i.days - i.day + 1);
  const head = `Day ${i.day} of ${i.days} and no conversation logged yet`;
  return i.planned ? `${head}: ${i.planned} to have in the ${left} ${left === 1 ? 'day' : 'days'} left.` : `${head}.`;
}

/** "12 days ago", "today": how old a post is, from the day the index gave it. */
export function postedWords(posted: string | null, today: string): string | null {
  if (!posted) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${posted}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * The conversation a post becomes with one tap on how it ended. Who they are is
 * their post's name; they are a buyer, because their post is the reason they are
 * on the list; and the problem is left as "did not come up" — the post said it,
 * but whether they have it is a thing the conversation answers, and a count of
 * who has the problem that took a search's word for it would be the app forming a
 * view and feeding it back (invariants 2 and 12). The sheet can still say it.
 */
export function voiceTalk(v: Pick<Voice, 'id' | 'author' | 'where'>, commitment: Commitment): { who: string; role: 'buyer'; problem: 'unasked'; commitment: Commitment; voice: string } {
  return { who: voiceWho(v), role: 'buyer', problem: 'unasked', commitment, voice: v.id };
}

/** Who a conversation logged from a post was with, for the sheet's first value: the name it is signed with, or where it was said. */
export function voiceWho(v: Pick<Voice, 'author' | 'where'>): string {
  return (v.author ? `${v.author} (${v.where})` : `Someone on ${v.where}`).slice(0, 80);
}
