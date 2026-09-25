// src/lib/copilot/hunts.ts
// What to look for, in the user's own words, and which finder goes and looks.
//
// Until this file, supply was one query shape for everybody: every segment, as
// typed, searched on Google Maps as "segment in area". That is the right search
// for somebody who sells to shops and trades down the road, and the wrong world
// for everyone else — a live account selling medieval-market jewellery in Toledo
// got sixty businesses from Toledo, Ohio, and the ranker's own reasons said so
// ("a dental lab cannot buy medieval-market jewelry"). The market was never the
// problem. The search was, and nobody could change its shape.
//
// A hunt is one line the user wrote — "shops in Spain that stock handmade
// jewellery", "organisers of medieval fairs" — and a kind that says who runs it:
//
//   companies   a web search over company sites (Exa, category "company"); the
//               site is then read for an email or a WhatsApp link
//   people      a web search over public profiles (Exa, category "people") —
//               a named buyer, organiser or owner, contacted by hand
//   agent       a standing brief for the research worker, for a search that
//               needs judgement across pages. Handed over as a DRAFT mandate,
//               approved like any other, and its finds come back into Matches
//
// Places stay where they were (target_segments × target_area, on Maps) and posts
// stay the watcher's. The hunts sheet shows all of them as one list, because to
// the person reading it they are one question: what is it looking for.
//
// One rule holds the whole thing to the rest of the product: a find counts only
// with a real link. A search index's result is a link somebody else crawled; an
// agent's claimed link is opened by this app before it is admitted, and one that
// will not open is dropped and counted, never shown. A model's guess at a URL is
// exactly what INFERRED_SCORE_CAP was written against (invariant 3).
//
// Pure: no DB import, no fetch. store.ts reads and writes the rows, supply/web.ts
// runs the searches, hunting.ts delivers what the agent found.

import { OBJECTIVE_MAX, SAFE_HREF, WHY_MAX, type CommissionEvent } from './commission';
import { isSearchableSegment } from './matches';
import { normalizePhone, type SupplyCandidate } from './supply/types';
import type { Contact, Offer, OpportunityType } from './types';

export const HUNT_KINDS = ['companies', 'people', 'agent'] as const;
export type HuntKind = (typeof HUNT_KINDS)[number];

export const HUNT_KIND_LABEL: Record<HuntKind, string> = { companies: 'Companies', people: 'People', agent: 'Agent' };
/** What each kind does, in the words the add form shows under the picker. */
export const HUNT_KIND_BLURB: Record<HuntKind, string> = {
  companies: 'Businesses found on the web — buyers, stockists, partners. Their site is read for an email or WhatsApp.',
  people: 'Named people with a public profile — a buyer, an organiser, an owner. You write to them yourself.',
  agent: 'A search that needs judgement across several pages. The research worker does it, once you approve it.',
};

export type HuntStatus = 'active' | 'paused';

export interface Hunt {
  id: string;
  kind: HuntKind;
  /** The user's own words. Searched as written. */
  query: string;
  area: string | null;
  /** A short name for the chip. */
  label: string;
  status: HuntStatus;
  origin: 'user' | 'suggested';
  /** The mandate behind an agent hunt — the latest one, if it has been re-run. */
  commission_id: string | null;
  last_run_at: string | null;
  /** How many the last run returned, before dedupe. Null until it has run. */
  last_found: number | null;
  /** An agent hunt's finds whose link would not open, at the last delivery. */
  last_dropped: number | null;
  /** Why the last run failed, in the finder's words. Cleared by the next good run. */
  last_error: string | null;
  created_at: string;
}

/** A hunt as the sheet shows it: the row, and what it has put in the pool. */
export type HuntView = Hunt & { yield: HuntYield };

/** Live hunts per account. Past five, the chips stop being a filter and become a list. */
export const MAX_HUNTS = 5;
export const HUNT_QUERY_MAX = 120;
export const HUNT_LABEL_MAX = 28;
export const HUNT_AREA_MAX = 80;
/** Results asked of the search per hunt per run. It is also the page it bills for. */
export const HUNT_RESULTS = 10;
/** Suggestions offered at once. */
export const MAX_SUGGESTIONS = 4;

export interface HuntInput { kind: HuntKind; query: string; area: string | null; label: string }

/**
 * What a hunt may be. The same floor as a segment — a one-letter query is a
 * typo, searched exactly as typed — plus a length a search engine can use and a
 * chip can show.
 */
export function normalizeHuntInput(raw: unknown): HuntInput | { error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = (HUNT_KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as HuntKind) : null;
  if (!kind) return { error: 'Pick what kind of hunt it is.' };
  const query = typeof r.query === 'string' ? r.query.replace(/\s+/g, ' ').trim().slice(0, HUNT_QUERY_MAX) : '';
  if (!isSearchableSegment(query) || query.length < 3) return { error: 'Say who to look for, in a few words.' };
  const area = typeof r.area === 'string' && r.area.trim() ? r.area.replace(/\s+/g, ' ').trim().slice(0, HUNT_AREA_MAX) : null;
  const given = typeof r.label === 'string' ? r.label.replace(/\s+/g, ' ').trim() : '';
  return { kind, query, area, label: given ? given.slice(0, HUNT_LABEL_MAX) : labelFor(query) };
}

/** A chip-length name from the words: whole words, up to the limit, never mid-word. */
export function labelFor(query: string, max = HUNT_LABEL_MAX): string {
  const q = query.replace(/\s+/g, ' ').trim();
  if (q.length <= max) return capital(q);
  let out = '';
  for (const w of q.split(' ')) {
    if ((out ? `${out} ${w}` : w).length > max - 1) break;
    out = out ? `${out} ${w}` : w;
  }
  return capital(out || q.slice(0, max - 1)) + '…';
}

/** True when two hunts, or a hunt and a segment, ask for the same thing. */
export function sameHunt(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return norm(a) === norm(b);
}

/* ── The web finders ──────────────────────────────────────────────────── */

export type ExaCategory = 'company' | 'people';

export function exaCategoryFor(kind: HuntKind): ExaCategory | null {
  return kind === 'companies' ? 'company' : kind === 'people' ? 'people' : null;
}

/** The query as the search gets it: the user's words, and the area when there is one. */
export function exaQueryFor(h: Pick<Hunt, 'query' | 'area'>): string {
  const area = h.area?.trim();
  // Not appended twice when the user already wrote the place into the words.
  return area && !h.query.toLowerCase().includes(area.toLowerCase()) ? `${h.query} in ${area}` : h.query;
}

/** What we use of a search hit. The shape of watch/exa.ts's ExaHit. */
export interface HuntHit { title: string; url: string; summary?: string }

/**
 * Sites that are never the company itself. A directory or a social page is a
 * place the company is listed, and "Yelp" is not somebody to write to.
 */
const NOT_A_COMPANY = /(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|yelp|tripadvisor|google|wikipedia|amazon|ebay|etsy|reddit|medium|crunchbase|bloomberg|glassdoor|indeed)\.[a-z.]+$/i;

/**
 * Search hits into candidates. Every one carries the URL the index returned —
 * that is what makes it sourced — and nothing the hit did not say: the summary
 * is the index's own line about the page, and the ranker words the reason.
 */
export function candidatesFromHits(hits: HuntHit[], hunt: Pick<Hunt, 'id' | 'kind' | 'query' | 'label'>): SupplyCandidate[] {
  const out: SupplyCandidate[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (!SAFE_HREF.test(h.url)) continue;
    const host = hostOf(h.url);
    if (!host) continue;
    if (hunt.kind === 'companies' && NOT_A_COMPANY.test(host)) continue;
    const key = urlKey(h.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const person = hunt.kind === 'people' ? personFromTitle(h.title) : null;
    const title = person?.name ?? companyFromTitle(h.title, host);
    out.push({
      source: 'web',
      external_id: key,
      type: (hunt.kind === 'people' ? 'people' : 'client') as OpportunityType,
      title,
      summary: (h.summary?.trim() || (person?.role ? `${person.role}.` : `Found by your hunt "${hunt.label}" on ${host}.`)).slice(0, 400),
      url: h.url,
      contact: hunt.kind === 'people' ? { name: person?.name } : { website: h.url },
      data: {
        hunt_id: hunt.id, hunt_label: hunt.label,
        // The hunt's words are this listing's segment: the grouping key the
        // keep-rate and the funnel already read, so the ranker learns per hunt
        // without learning anything new.
        segment: hunt.query,
        host, found_via: 'exa',
        ...(person?.role ? { role: person.role } : {}),
      },
      effort: 'medium',
    });
  }
  return out;
}

/** "Joyería El Greco | Joyas artesanales en Toledo" → "Joyería El Greco". */
export function companyFromTitle(title: string, host: string): string {
  const first = title.split(/\s[|–—·:-]\s|\s\|\s?/)[0]?.trim() ?? '';
  const generic = /^(home|inicio|welcome|bienvenidos?|start|accueil|index)$/i;
  if (first && first.length >= 2 && !generic.test(first)) return first.slice(0, 120);
  // A homepage titled "Home" names nobody; the domain does.
  return host.replace(/\.[a-z.]+$/i, '').replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);
}

/** "Carmen López - Compradora - El Corte Inglés | LinkedIn" → name and role. */
export function personFromTitle(title: string): { name: string; role: string | null } {
  const parts = title.replace(/\s*\|\s*LinkedIn\s*$/i, '').split(/\s[-–—|]\s/).map((p) => p.trim()).filter(Boolean);
  const name = (parts[0] ?? title).slice(0, 120);
  const role = parts.slice(1).join(' · ').slice(0, 160) || null;
  return { name, role };
}

/** Where a candidate is deduped on: host and path, no scheme, no query, no trailing slash. */
export function urlKey(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${path}`.slice(0, 200) || null;
  } catch { return null; }
}

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null; } catch { return null; }
}

/* ── Reading a page for a way to reach them ───────────────────────────── */

/**
 * Whether this app may open a URL at all. The URL came from a search index or a
 * worker — both outside — and an open fetch is how a hostile link reaches the
 * metadata endpoint of the machine it runs on. http(s), a real host name, and
 * nothing that names a private or local address.
 */
export function isPublicHttpUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') && !h.includes(':')) return false;
  if (/(^localhost$)|(\.localhost$)|(\.local$)|(\.internal$)|(\.lan$)/.test(h)) return false;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false;
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h) || /^::ffff:/.test(h)) return false;
  return true;
}

export interface PageContact { email?: string; whatsapp?: string; instagram?: string }

/** Addresses that are never the business: a platform's, a placeholder, an image name. */
const JUNK_EMAIL = /(@(example|sentry|wixpress|sentry-next|domain|email|yourdomain|test)\.)|(\.(png|jpe?g|gif|webp|svg)$)|(^(no-?reply|donotreply)@)/i;

/**
 * An email and a WhatsApp number off the page, if it shows them. Deterministic —
 * mailto: and wa.me links first, because a link is the business saying "reach
 * me here", then a plain address in the text. A tel: number is taken as WhatsApp
 * the same way the Maps adapter takes a listed phone; the draft opens in the
 * user's own app, so a landline shows itself the moment it is tried.
 */
export function contactFromHtml(html: string): PageContact {
  const out: PageContact = {};
  const decoded = html.replace(/&#64;|&commat;/gi, '@').replace(/&#46;|&period;/gi, '.');
  const mailto = /mailto:([^"'?\s>]+)/gi;
  for (let m = mailto.exec(decoded); m && !out.email; m = mailto.exec(decoded)) {
    const e = safeDecode(m[1]).trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && !JUNK_EMAIL.test(e)) out.email = e;
  }
  if (!out.email) {
    const text = decoded.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
    const plain = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    for (let m = plain.exec(text); m && !out.email; m = plain.exec(text)) {
      const e = m[0].toLowerCase();
      if (!JUNK_EMAIL.test(e)) out.email = e;
    }
  }
  const wa = /(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=|whatsapp:\/\/send\?phone=)\+?([0-9]{7,15})/i.exec(decoded);
  if (wa) out.whatsapp = normalizePhone(wa[1]) ?? undefined;
  if (!out.whatsapp) {
    const tel = /href=["']tel:([+0-9()\s.-]{7,20})["']/i.exec(decoded);
    if (tel) out.whatsapp = normalizePhone(tel[1]) ?? undefined;
  }
  const ig = /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,30})\/?["'?]/i.exec(decoded);
  if (ig && !/^(p|explore|accounts|reel|stories)$/i.test(ig[1])) out.instagram = `https://instagram.com/${ig[1]}`;
  return out;
}

/** The page's own "contact" link, when the homepage did not carry an address. Same host only. */
export function contactPageLink(html: string, pageUrl: string): string | null {
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (!/contact|contacto|kontakt|contatti|contato|about|nosotros/i.test(`${href} ${text}`)) continue;
    try {
      const u = new URL(href, pageUrl);
      if (hostOf(u.href) === hostOf(pageUrl) && isPublicHttpUrl(u.href)) return u.href;
    } catch { /* not a URL; keep looking */ }
  }
  return null;
}

/** A candidate with what the page said merged in. Nothing the page did not show is added. */
export function withPageContact(c: SupplyCandidate, found: PageContact): SupplyCandidate {
  const contact: Contact = { ...c.contact };
  if (found.email && !contact.email) contact.email = found.email;
  if (found.whatsapp && !contact.whatsapp) contact.whatsapp = found.whatsapp;
  return { ...c, contact, data: { ...c.data, ...(found.instagram ? { instagram: found.instagram } : {}) } };
}

/* ── What the agent found ─────────────────────────────────────────────── */

/**
 * The mandate an agent hunt hands over. The objective is the search; the why is
 * the delivery contract, because it is the one field the worker reads that can
 * say how a find has to come back for this app to take it.
 */
export function agentObjective(h: Pick<Hunt, 'query' | 'area'>): { objective: string; why: string } {
  const objective = `Find up to 10 ${exaQueryFor(h)} worth contacting, with a working link for each`.slice(0, OBJECTIVE_MAX);
  const why = ('Each find goes straight to Matches. Post each as its own `found` event: who and why in the summary, their website or a public page '
    + 'in artifact.href, any email or phone in artifact.value. A link that will not open is dropped, and LinkedIn cannot be checked.').slice(0, WHY_MAX);
  return { objective, why };
}

export interface AgentFind { candidate: SupplyCandidate; href: string }

/**
 * The worker's `found` events into candidates, before anything is opened. Only
 * events with an http(s) link: a find the app cannot open is a claim, and the
 * delivery step drops what does not open. Contact details are read from what
 * the worker wrote, deterministically — never asked of a model.
 */
export function findsFromEvents(events: Array<Pick<CommissionEvent, 'kind' | 'summary' | 'artifact'>>, hunt: Pick<Hunt, 'id' | 'kind' | 'query' | 'label'>): AgentFind[] {
  const out: AgentFind[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.kind !== 'found') continue;
    const href = e.artifact?.href ?? null;
    if (!href || !SAFE_HREF.test(href) || !isPublicHttpUrl(href)) continue;
    const key = urlKey(href);
    const host = hostOf(href);
    if (!key || !host || seen.has(key)) continue;
    seen.add(key);
    const text = `${e.summary} ${e.artifact?.value ?? ''}`;
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0]?.toLowerCase();
    const phone = phoneIn(text);
    const label = e.artifact?.label && !/^(open|link|view|website|site|profile)( it)?$/i.test(e.artifact.label) ? e.artifact.label : null;
    out.push({
      href,
      candidate: {
        source: 'agent',
        external_id: key,
        type: /linkedin\.com\/in\//i.test(href) ? 'people' : 'client',
        title: (label ?? companyFromTitle(e.summary.split(/[.—–:]/)[0] ?? '', host)).slice(0, 120),
        summary: e.summary.slice(0, 400),
        url: href,
        contact: { website: href, ...(email && !JUNK_EMAIL.test(email) ? { email } : {}), ...(phone ? { whatsapp: phone } : {}) },
        data: { hunt_id: hunt.id, hunt_label: hunt.label, segment: hunt.query, host, found_via: 'agent' },
        effort: 'medium',
      },
    });
  }
  return out;
}

/**
 * A phone number the worker wrote, only when it reads as one: in international
 * form, or right after a word that says it is a phone. A bare run of digits is
 * as likely to be a date, a price or an order number, and a WhatsApp draft to
 * "20260925" is a message to nobody.
 */
export function phoneIn(text: string): string | null {
  const m = /(?:(\+\d[\d\s().-]{6,16}\d)|(?:phone|tel|tlf|whatsapp|m[oó]vil|mobile|tel[eé]fono|contact)\s*[:.]?\s*(\d[\d\s().-]{6,16}\d))/i.exec(text);
  const raw = m?.[1] ?? m?.[2];
  return raw ? normalizePhone(raw) : null;
}

/* ── How each hunt is doing ───────────────────────────────────────────── */

export interface HuntYield { found: number; waiting: number; drafted: number; binned: number }
export const EMPTY_YIELD: HuntYield = { found: 0, waiting: 0, drafted: 0, binned: 0 };

/** Counted from the rows each hunt put in the pool — never from what the finder said it found. */
export function huntYield(rows: Array<{ hunt_id: string; status: string; drafted: boolean }>): Record<string, HuntYield> {
  const out: Record<string, HuntYield> = {};
  for (const r of rows) {
    const y = (out[r.hunt_id] ??= { ...EMPTY_YIELD });
    y.found += 1;
    if (r.status === 'dismissed') y.binned += 1;
    else if (r.drafted || r.status === 'acted') y.drafted += 1;
    else y.waiting += 1;
  }
  return out;
}

/** Set aside this many with nothing drafted and a hunt has said what it is worth. */
export const HUNT_BIN_FLAG = 8;

export interface HuntLine { text: string; tone: 'ok' | 'warn' | 'quiet' }

/**
 * One line per hunt, and the order is the point: a failure first (a hunt that
 * broke and a hunt that found nothing read the same without it — invariant 13),
 * then what it has produced, then a hunt that is not earning its place.
 */
export function huntLine(h: Pick<Hunt, 'kind' | 'status' | 'last_run_at' | 'last_found' | 'last_error'> & { last_dropped?: number | null }, y: HuntYield, ctx: { webReady: boolean; workerReady: boolean; commission: { status: string } | null }): HuntLine {
  if (h.status === 'paused') return { text: 'Paused', tone: 'quiet' };
  if (h.kind !== 'agent' && !ctx.webReady) return { text: 'Web search is not set up on this server, so this cannot run yet', tone: 'warn' };
  if (h.kind === 'agent' && !ctx.workerReady) return { text: 'No research worker is connected, so nobody can take this', tone: 'warn' };
  if (h.last_error) return { text: `Last run failed: ${h.last_error}`.slice(0, 140), tone: 'warn' };
  const answered = y.binned + y.drafted;
  if (y.binned >= HUNT_BIN_FLAG && y.drafted === 0) {
    return { text: `${y.binned} of ${answered} set aside, none drafted — change the words or drop it`, tone: 'warn' };
  }
  if (h.kind === 'agent') {
    const s = ctx.commission?.status;
    // The gap between what the worker reported and what arrived, said: the
    // project log will show seven finds, and Matches five.
    const dropped = h.last_dropped ? ` · ${h.last_dropped} link${h.last_dropped === 1 ? '' : 's'} would not open` : '';
    if (s === 'draft') return { text: 'Waiting for your go-ahead', tone: 'warn' };
    if (s === 'active' || s === 'blocked') return { text: y.found ? `${y.found} delivered so far${dropped}` : `With the worker — finds land here as they come${dropped}`, tone: 'ok' };
    if (y.found || s === 'done' || s === 'stopped') return { text: `${y.found} delivered${y.drafted ? ` · ${y.drafted} drafted` : ''}${dropped} — finished`, tone: 'quiet' };
  }
  if (!h.last_run_at) return { text: 'Runs on the next pass', tone: 'quiet' };
  if (h.last_found === 0 && !y.found) return { text: 'Found nothing last run — try other words', tone: 'warn' };
  return { text: [`${y.found} found`, y.drafted ? `${y.drafted} drafted` : null, y.waiting ? `${y.waiting} waiting` : null].filter(Boolean).join(' · '), tone: 'ok' };
}

/* ── Suggestions ──────────────────────────────────────────────────────── */

export interface HuntSuggestion { kind: HuntKind; query: string; area: string | null; label: string; why: string }

export const SUGGEST_SYSTEM = `You propose where to look for one person's buyers. You are given what they sell, who they say buys it, where they are, and what they are already searching for.

Return JSON only: {"hunts":[{"kind","query","area","label","why"}]}, at most ${MAX_SUGGESTIONS}.

kind is one of:
- "companies": businesses found by a web search over company sites — stockists, retailers, B2B buyers, partners, suppliers
- "people": named individuals with a public profile — a buyer, an organiser, an owner, a decision maker
- "agent": a search that needs judgement across several pages, done by a research assistant — lists to assemble, events to check, directories to read

Rules:
- query is what a search engine would be typed, in plain words, 3 to 12 words, specific to what they sell and who buys it. Never generic ("small businesses", "potential clients").
- area only when place matters to the buyer; a city with its country ("Toledo, Spain"), else null.
- label is 2 to 4 words for a filter chip.
- why is one sentence saying which part of what they told you this follows from.
- Do not repeat anything they already search for. Do not invent facts about their business.`;

/** Model output into suggestions. Anything malformed, duplicated or already hunted is dropped. */
export function parseSuggestions(raw: unknown, existing: string[]): HuntSuggestion[] {
  const list = Array.isArray((raw as { hunts?: unknown })?.hunts) ? (raw as { hunts: unknown[] }).hunts : Array.isArray(raw) ? raw : [];
  const out: HuntSuggestion[] = [];
  for (const item of list) {
    const n = normalizeHuntInput(item);
    if ('error' in n) continue;
    if ([...existing, ...out.map((o) => o.query)].some((q) => sameHunt(q, n.query))) continue;
    const r = item as Record<string, unknown>;
    const why = typeof r.why === 'string' ? r.why.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    out.push({ ...n, why });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Suggestions with no model: the buyers the user named, each as a company hunt,
 * and the first of them as people to reach. Read straight off their own words —
 * nothing here is a view about their business (invariant 12).
 */
export function suggestionsFromOffer(offer: Offer, area: string | null, existing: string[]): HuntSuggestion[] {
  const buyers = (offer.for_who ?? '').split(/[,;/]|\s+and\s+|\s+y\s+/i).map((s) => s.trim()).filter((s) => s.length >= 3);
  const drafts: Array<Omit<HuntSuggestion, 'label'>> = buyers.slice(0, 3).map((b) => ({ kind: 'companies' as const, query: b, area, why: `You said you sell to ${b}.` }));
  if (buyers[0]) drafts.push({ kind: 'people', query: `owners and buyers at ${buyers[0]}`, area, why: `The people who decide at ${buyers[0]}.` });
  return parseSuggestions(drafts, existing);
}

export function suggestPrompt(input: { offer: Offer; area: string | null; working: string; goals: string[]; existing: string[] }): string {
  const o = input.offer;
  return [
    `They sell: ${o.sells ?? '(not said)'}`,
    o.for_who ? `They say buyers are: ${o.for_who}` : null,
    o.problem ? `The problem it solves: ${o.problem}` : null,
    o.price_band ? `Price: ${o.price_band}` : null,
    `Where they are: ${input.area ?? '(not said)'}`,
    input.goals.length ? `Their goals: ${input.goals.join('; ')}` : null,
    input.working ? `What they have written about the business:\n${input.working}` : null,
    input.existing.length ? `Already searching for (do not repeat): ${input.existing.join('; ')}` : 'Already searching for: nothing yet',
  ].filter(Boolean).join('\n');
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
