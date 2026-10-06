// src/lib/copilot/seed.ts
// What a person shares into Copilot from another app — most often a reply from
// Claude or Grok — as the start of a bet.
//
// Why. The habit is to ask a chat for ideas and whether they look right, and a
// chat's answer ends where the chat does: nothing in it is counted, so nothing
// in it can turn out wrong. A share that opens the bet sheet makes the end of the
// chat the start of a test — a belief, a count and a line, written before
// anything is sent. What it must not do is let the chat's words become the
// person's. So the text rides along as the play (what to do, "Shared from another
// app", the way a model's idea does, with the link back to the chat) and the
// belief is never filled in from it: the person writes it. It was prefilled once,
// when the whole share was one sentence, and a review found where that led — a
// tap on Keep, and the chat's sentence and its numbers reached the ideas model as
// the owner's own words (invariants 2 and 12). A shared reply is never context
// about the business: it lives on the bet as its play, and no model is shown a
// shared play (proofai.ts checks SHARED_FROM).
//
// Pure: no DB import, no browser API. The service worker and the share page only
// carry the share; this decides what it is.

import { URL_MAX, webLink } from './assets';
import { IDEA_HOW_MAX, IDEA_LABEL_MAX, SHARED_FROM, type BetIdea } from './lab';

/**
 * Where a text share waits for the page. Its own cache: the Money tab reads every
 * entry of `copilot-share` as a statement, and a reply from a chat read as a CSV
 * would be an import error about a file nobody shared. public/sw.js repeats both
 * strings (a worker cannot import this) and the suite checks they match.
 */
export const SEED_CACHE = 'copilot-share-text';
export const SEED_KEY = '/copilot2/share/text';

/** Said beside the play on the bet, so it is never mistaken for one the app wrote (lab.ts SHARED_FROM). */
export const SEED_FROM = SHARED_FROM;

/**
 * How long shared words wait to be picked up when they were not read on arrival —
 * shared while signed out, the app opens on sign-in instead. Past it they are not
 * the share the person remembers making, and are let go rather than popping up.
 */
export const SEED_FRESH_MS = 30 * 60_000;

/** Whether what was kept is still the share someone just made, by the stamp it carries. No stamp is not fresh. */
export function seedIsFresh(raw: unknown, now: number): boolean {
  const at = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).at : null;
  return typeof at === 'number' && Number.isFinite(at) && now - at >= 0 && now - at <= SEED_FRESH_MS;
}

/** What of a share is read. A whole conversation is not an idea: the rest is left, and the sheet says so. */
export const SEED_MAX = 4000;

export interface Seed {
  /** The shared words, line breaks kept. Empty when only a link came. */
  text: string;
  /** The link that came with them, when it is a web address a person can open. */
  url: string | null;
  /** More was shared than is read. */
  cut: boolean;
}

const LINK = /https?:\/\/[^\s<>"')\]]+/gi;
const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '');
/** A link that fits whole: `webLink` keeps the first URL_MAX characters, and half an address opens the wrong page. */
const link = (v: string) => (v.length <= URL_MAX ? webLink(v) : null);

/**
 * A share as the phone hands it over: `title`, `text` and `url`, any of them
 * missing. Null when it has no words and no link. Apps put the link in `text` —
 * after the words, or alone — so a link at the very end is the share's own; one
 * in the middle is part of what was said and stays.
 */
export function seedOf(raw: unknown): Seed | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const given = link(clean(o.url));
  // A title is an app's name for what it shared ("Claude"): noise beside words or a
  // link, and all there is without either. Taken beside a link, it became the belief.
  let text = clean(o.text) || (given ? '' : clean(o.title));
  let url = given;
  // "…see https://x.com/a." ends in the link and a full stop: the stop is the sentence's, not the address's.
  const tail = text.replace(/[\s.,;:!?]+$/, '');
  const found = tail.match(LINK);
  const last = found ? found[found.length - 1] : null;
  const ending = last && tail.endsWith(last) ? link(last) : null;
  // The link ending the words is the share's own — unless the share named another,
  // and then it is part of what was said and stays in the words rather than being lost.
  if (last && ending && (!given || ending === given)) {
    text = tail.slice(0, tail.length - last.length).replace(/[\s:–—-]+$/, '').trim();
    url = given ?? ending;
  }
  let cut = false;
  if (text.length > SEED_MAX) {
    const head = text.slice(0, SEED_MAX);
    const at = head.search(/\s\S*$/);
    text = (at > SEED_MAX / 2 ? head.slice(0, at) : head).trim();
    cut = true;
  }
  return text || url ? { text, url, cut } : null;
}

/** One line of a chat reply as plain words: a heading mark, a bullet and bold are formatting, not what was said. */
function plain(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s+/, '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2')
    // Emphasis wraps a word, never a space: "2 * 3 * 4" is arithmetic, not italics.
    .replace(/(^|[\s(])[*_](\S(?:[^*_]*\S)?)[*_](?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The lines that say something, as plain words. */
export function plainLines(text: string): string[] {
  return text.split('\n').map(plain).filter(Boolean);
}

/** Cut at a word and marked, never mid-word and never silently: a cut idea reads as a finished one. */
function fit(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max - 1);
  const at = head.lastIndexOf(' ');
  return `${(at > max / 2 ? head.slice(0, at) : head).trimEnd()}…`;
}

/** "claude.ai" from a link, for naming where words came from. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'a link'; }
}

/** The longest link a play keeps beside the words: past it there would be too little room left for them. */
const LINK_KEPT_MAX = 200;

/** What a bet keeps of a share, so the sheet can say it truthfully: the play, whether it holds all the words, and the link. */
export interface SeedKept {
  idea: BetIdea | null;
  /** Every word that was read, not the first of them. */
  whole: boolean;
  /** The link back to where it came from. */
  link: boolean;
}

/**
 * The share as the play the bet runs: its first line for a name; the words for
 * what to do, cut at a word and marked where they are longer than a play holds;
 * and the link back to the chat after them, so the bet keeps the way back. A link
 * and no words is the play itself.
 */
export function keptOfSeed(seed: Seed): SeedKept {
  const lines = plainLines(seed.text);
  const words = lines.join(' ');
  const url = seed.url && seed.url.length <= LINK_KEPT_MAX ? seed.url : null;
  if (words) {
    const how = fit(words, url ? IDEA_HOW_MAX - url.length - 1 : IDEA_HOW_MAX);
    return { idea: { label: fit(lines[0], IDEA_LABEL_MAX), how: url ? `${how} ${url}` : how, from: SEED_FROM }, whole: !seed.cut && how === words, link: !!url };
  }
  if (url) return { idea: { label: `Idea from ${hostOf(url)}`, how: url, from: SEED_FROM }, whole: true, link: true };
  return { idea: null, whole: false, link: false };
}

export function ideaOfSeed(seed: Seed): BetIdea | null {
  return keptOfSeed(seed).idea;
}

/** The two characters JavaScript reads as a line end inside a string, built by code: written out, they end the line they are on. */
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/**
 * What the server answers a text share with when no service worker has taken it
 * (the first share after installing): a page that keeps the words in the same
 * cache the worker would have, then opens Proof. The words go into a script, so
 * `<` is escaped — "</script>" in a shared reply must not end it — and so are the
 * two line separators JavaScript reads as a line end inside a string. Said on
 * arrival when keeping them failed (invariant 13), never a blank page.
 */
export function seedPage(raw: { title?: string; text?: string; url?: string }): string {
  const words = JSON.stringify({ title: raw.title ?? '', text: raw.text ?? '', url: raw.url ?? '' })
    .replace(/</g, '\\u003c').split(LINE_SEP).join('\\u2028').split(PARA_SEP).join('\\u2029');
  const to = '/copilot2?tab=proof&shared=text';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Copilot</title></head><body>',
    '<p style="font:16px system-ui,sans-serif;padding:24px">Opening Copilot…</p>',
    '<script>(function(){',
    // Stamped here, as the worker stamps its own: words kept while signed out are picked up after sign-in only while fresh.
    `var to=${JSON.stringify(to)};var p=${words};p.at=Date.now();`,
    'function go(why){location.replace(why?to+"&why="+encodeURIComponent(why):to)}',
    'try{',
    'if(!("caches" in window))return go("This browser kept nothing from that share. Share it again once Copilot is installed.");',
    `caches.open(${JSON.stringify(SEED_CACHE)}).then(function(c){return c.put(${JSON.stringify(SEED_KEY)},new Response(JSON.stringify(p),{headers:{"content-type":"application/json"}}))})`,
    '.then(function(){go()},function(e){go("That share could not be kept: "+(e&&e.message||e))});',
    '}catch(e){go("That share could not be kept: "+(e&&e.message||e))}',
    '})();</script></body></html>',
  ].join('');
}
