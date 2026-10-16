// src/lib/copilot/idearesearch.ts
// What others did, found before a model writes ideas for a part of the business.
//
// Why. Ideas were written from the record alone: what the person said and what
// the rows show. That keeps them about this business, and it also kept them
// inside it — a model told "use only what you are told" proposes variations on
// what was already tried, and its owner asked how it could know what works
// anywhere else. A model's memory of playbooks is a start, and it cannot be
// checked. A page where somebody says how they got their first customers can.
//
// So two searches are run first, written by a rule from the offer and the part
// (not by a model: which question to ask the web about "how they hear" does not
// get better with a better model, and a rule costs no call). The pages come back
// numbered with a sentence from each, in the page's words, and the model cites
// the ones an idea rests on by number. Only a number the search returned becomes
// a link: an address a model writes is never one (the rule exa.ts was allowed in
// on).
//
// What it does not change. The rows still judge: a cited page is a reason to try
// something, never evidence it worked here. Sourced still beats inferred
// (invariant 3), so an idea with a page behind it ranks above one from the
// model's memory, whatever order the model gave. And a search that failed is
// said on the set, not drawn as a set that needed no search (invariant 13).
//
// Pure: no DB import, no network. proofai.ts runs the searches.

import type { LinkKey } from './business';
import { IDEA_SOURCES_MAX, type Idea, type IdeaSource } from './lab';
import type { Offer } from './types';
import type { ExaHit } from './watch/exa';

/** Pages kept for one set of ideas, across both searches. Enough to cite; few enough to read. */
export const EVIDENCE_MAX = 8;
/** Pages asked for per search. */
export const RESEARCH_PER_QUERY = 5;
/** Both searches run at once, inside this. Ideas are written in the background, but a search is seconds or it is broken. */
export const RESEARCH_TIMEOUT_MS = 15_000;
const SAID_MAX = 280;

export interface Evidence {
  /** Its number in the prompt, from 1: what an idea cites. */
  n: number;
  title: string;
  url: string;
  /** The page's own sentence, or the index's summary of it. */
  said: string | null;
}

export interface IdeaResearch {
  evidence: Evidence[];
  queries: string[];
  /** Why there are no pages, or why one search of two failed. */
  why: string | null;
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
const firstOf = (s: string | null | undefined) => s?.split(/[,;/]|\s+(?:and|or)\s+/)[0].replace(/[.\s]+$/, '').trim() || null;

/**
 * Two searches for a part: how others like this business did it, and where its
 * buyers say the problem. Written from the offer's own first phrases, because a
 * search for "freelancers, tech indies, business owners in Manila" finds pages
 * about none of them. The second is about the buyers, so it is asked where they
 * are (`where`): unplaced, it found American forums and programs, and the ideas
 * cited them to a founder in Manila. The first stays unplaced — how a business
 * like this one got its first customers travels. Empty when the offer does not
 * say what it sells.
 */
export function researchQueries(part: LinkKey, offer: Offer, where: string | null = null): string[] {
  const sells = firstOf(offer.sells);
  if (!sells) return [];
  const what = lowerFirst(sells);
  const who = firstOf(offer.for_who);
  const buyers = `${who ? lowerFirst(who) : 'small businesses'}${where?.trim() ? ` in ${where.trim()}` : ''}`;
  const problem = offer.problem?.trim().replace(/[.\s]+$/, '') || null;
  const byPart: Record<LinkKey, [string, string]> = {
    who: [
      `how the founder of a ${what} found their first paying customers`,
      problem ? `${buyers} talking about ${lowerFirst(problem)}` : `what ${buyers} already pay for instead of ${what}`,
    ],
    reach: [
      `how a ${what} got its first 100 customers without ads`,
      `where ${buyers} go to ask for advice${problem ? ` about ${lowerFirst(problem)}` : ''}`,
    ],
    close: [
      `how founders of a ${what} turned first conversations into sales`,
      `why ${buyers} say no to ${what}`,
    ],
    pay: [
      `how a ${what} priced its first paid plan and what customers paid`,
      `what ${buyers} pay for ${problem ? lowerFirst(problem) : what} today`,
    ],
    deliver: [
      `how a solo founder delivers ${what} to first clients without hiring`,
      `productized service case study ${what}`,
    ],
  };
  return byPart[part].map((q) => q.replace(/\s+/g, ' ').slice(0, 200));
}

/** Host and path, so the same page reached twice is one page. */
const pageKey = (url: string) => {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase(); }
  catch { return url.toLowerCase(); }
};

/**
 * The pages from each search, taken in turn so both are heard, with a repeat
 * dropped and every page numbered. A page with no words of its own is still a
 * page: its title says what it is.
 */
export function evidenceFrom(runs: ExaHit[][], max = EVIDENCE_MAX): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  const longest = Math.max(0, ...runs.map((r) => r.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const hits of runs) {
      const h = hits[i];
      if (!h || out.length >= max) continue;
      const key = pageKey(h.url);
      if (seen.has(key)) continue;
      seen.add(key);
      const said = (h.highlight ?? h.summary ?? '').replace(/\s+/g, ' ').trim();
      out.push({ n: out.length + 1, title: h.title.replace(/\s+/g, ' ').trim().slice(0, 120), url: h.url, said: said ? said.slice(0, SAID_MAX) : null });
    }
  }
  return out;
}

/** The pages, as the model reads them. */
export function evidenceLines(r: IdeaResearch | null): string[] {
  if (!r || !r.evidence.length) {
    return ['', `No web search ran for this set${r?.why ? ` (${r.why})` : ''}. Use what is known about how businesses like this one win and keep customers, and give every idea "sources": [].`];
  }
  return [
    '',
    'What others did, from a web search just now. Each is a real page; cite the ones an idea rests on by number in "sources". A page is a reason to try something, not proof it works here:',
    ...r.evidence.map((e) => `[${e.n}] ${e.title} (${hostOf(e.url)})${e.said ? `: "${e.said}"` : ''}`),
  ];
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** The numbers an idea cited, as the pages they name: only the search's, never an address a model wrote. */
export function citedSources(raw: unknown, evidence: Evidence[]): IdeaSource[] {
  if (!Array.isArray(raw)) return [];
  const out: IdeaSource[] = [];
  for (const x of raw) {
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(/[[\]\s]/g, '')) : NaN;
    const e = evidence.find((y) => y.n === n);
    if (!e || out.some((s) => s.url === e.url)) continue;
    out.push({ title: e.title, url: e.url });
    if (out.length >= IDEA_SOURCES_MAX) break;
  }
  return out;
}

/**
 * The set's order: the model's, best first, except that an idea resting on a
 * page goes before one resting on the model's memory (invariant 3). The model's
 * reason for its first stays only while that idea is still first — beside
 * another, it would be a reason for the wrong one.
 */
export function rankIdeas<T extends Idea>(ideas: T[], pick: string | null): { ideas: T[]; pick: string | null } {
  const sourced = (i: T) => ((i.sources?.length ?? 0) > 0 ? 0 : 1);
  const ranked = ideas.map((idea, at) => ({ idea, at })).sort((a, b) => sourced(a.idea) - sourced(b.idea) || a.at - b.at).map((x) => x.idea);
  return { ideas: ranked, pick: ranked[0] && ranked[0] === ideas[0] ? pick : null };
}

/** "From your record and 6 pages found on the web", or why there were none: said under the set. */
export function researchLine(r: { pages: number; why: string | null } | null | undefined): string {
  if (!r) return 'from your record';
  if (r.pages > 0) return `from your record and ${r.pages} ${r.pages === 1 ? 'page' : 'pages'} found on the web`;
  return `from your record and what the model knows, with no web search${r.why ? `: ${r.why}` : ''}`;
}
