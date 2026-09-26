// src/lib/copilot/hunts.ts
// What the app searches the web for, worked out by the app.
//
// Supply was one query shape for everybody: every segment, as typed, on Google
// Maps as "segment in area". Right for somebody who sells to the shops and
// trades down the road, and the wrong world for everyone else — a live account
// selling medieval-market jewellery in Toledo got sixty businesses from Toledo,
// Ohio. The first answer was a sheet of "hunts" the user wrote and managed. It
// was the wrong answer: it made finding people the user's job again, which is
// the exact job this app exists to take off them. Serve, not configure.
//
// So a hunt is now the app's own search. It is planned from what the user has
// already told it — the offer, the working file, the goals, where they are —
// and kept or replaced by what it brings in:
//
//   companies   a web search over company sites (Exa, category "company"); each
//               site is then read for an email or a WhatsApp link
//   people      a web search over public profiles (Exa, category "people") —
//               a named buyer, organiser or owner, contacted by hand
//
// Nobody sees a hunt. They see what it found, judged against the same offer,
// and only what clears the bar (matches.ts). A search that keeps bringing in
// what nobody drafts is retired and replaced; one that finds nothing is too.
//
// One rule holds it to the rest of the product: a find counts only with a real
// link — a result some search index crawled, never a URL a model wrote
// (invariant 3). And nothing is planned from a blank offer (invariant 1): a
// search worked out from nothing is not the user's.
//
// Pure: no DB import, no fetch. store.ts holds the rows, hunting.ts plans them,
// supply/web.ts runs them.

import { SAFE_HREF } from './commission';
import { isSearchableSegment } from './matches';
import { normalizePhone, type SupplyCandidate } from './supply/types';
import type { Contact, Offer, OpportunityType } from './types';

/**
 * 'agent' is a kind the table still allows — rows written when hunts had a
 * sheet — and nothing plans or runs one now. Research that needs a person's
 * judgement across pages is proposed as a Move instead (propose.ts), where one
 * tap hands it over.
 */
export const HUNT_KINDS = ['companies', 'people', 'agent'] as const;
export type HuntKind = (typeof HUNT_KINDS)[number];
/** What the planner may write. */
export const PLAN_KINDS = ['companies', 'people'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export type HuntStatus = 'active' | 'paused';

export interface Hunt {
  id: string;
  kind: HuntKind;
  /** The search, as the index gets it. */
  query: string;
  area: string | null;
  /** A short name, for the log and a find's line on Matches. */
  label: string;
  /** Paused is also retired: the row stays so the planner does not suggest it again. */
  status: HuntStatus;
  /** 'suggested' is the app's own plan; 'user' is a row from when hunts had a sheet. */
  origin: 'user' | 'suggested';
  commission_id: string | null;
  last_run_at: string | null;
  /** How many the last run returned, before dedupe. Null until it has run. */
  last_found: number | null;
  last_dropped: number | null;
  /** Why the last run failed, or why it was retired. Cleared by the next good run. */
  last_error: string | null;
  created_at: string;
}

/** Searches the app keeps running at once. Three is breadth; more is the same money for noise. */
export const AUTO_HUNTS = 3;
export const HUNT_QUERY_MAX = 120;
export const HUNT_LABEL_MAX = 28;
export const HUNT_AREA_MAX = 80;
/** Results asked of the search per hunt per run. It is also the page it bills for. */
export const HUNT_RESULTS = 10;

export interface HuntInput { kind: PlanKind; query: string; area: string | null; label: string }

/**
 * What a planned search may be: a web kind, words a search engine can use (the
 * same floor as a segment — one letter is a typo, searched exactly as typed),
 * and a length a log line can show.
 */
export function normalizeHuntInput(raw: unknown): HuntInput | { error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = (PLAN_KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as PlanKind) : null;
  if (!kind) return { error: 'not a web search' };
  const query = typeof r.query === 'string' ? r.query.replace(/\s+/g, ' ').trim().slice(0, HUNT_QUERY_MAX) : '';
  if (!isSearchableSegment(query) || query.length < 3) return { error: 'no words to search for' };
  const area = typeof r.area === 'string' && r.area.trim() ? r.area.replace(/\s+/g, ' ').trim().slice(0, HUNT_AREA_MAX) : null;
  const given = typeof r.label === 'string' ? r.label.replace(/\s+/g, ' ').trim() : '';
  return { kind, query, area, label: given ? given.slice(0, HUNT_LABEL_MAX) : labelFor(query) };
}

/** A short name from the words: whole words, up to the limit, never mid-word. */
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

/** True when two searches, or a search and a segment, ask for the same thing. */
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

/* ── What each search has brought in ──────────────────────────────────── */

export interface HuntYield { found: number; waiting: number; drafted: number; binned: number; below: number }
export const EMPTY_YIELD: HuntYield = { found: 0, waiting: 0, drafted: 0, binned: 0, below: 0 };

/** Counted from the rows each hunt put in the pool — never from what the finder said it found. */
export function huntYield(rows: Array<{ hunt_id: string; status: string; drafted: boolean; below?: boolean }>): Record<string, HuntYield> {
  const out: Record<string, HuntYield> = {};
  for (const r of rows) {
    const y = (out[r.hunt_id] ??= { ...EMPTY_YIELD });
    y.found += 1;
    if (r.status === 'dismissed') y.binned += 1;
    else if (r.drafted || r.status === 'acted') y.drafted += 1;
    // Judged below the bar: never shown, so never answered — and exactly as
    // unwanted as a find somebody set aside.
    else if (r.below) y.below += 1;
    else y.waiting += 1;
  }
  return out;
}

/* ── Keeping the plan honest ──────────────────────────────────────────── */

/**
 * Set aside or judged below the bar this many, with nothing drafted, and a
 * search has said what it is worth.
 */
export const HUNT_BIN_FLAG = 8;
/** A search that has found nothing at all is given this long before it is replaced. */
export const HUNT_GRACE_DAYS = 3;

/**
 * Which searches to retire — the app's own, and the rows the user wrote back
 * when hunts had a sheet. Those were their words, but nothing on screen can stop
 * one any more, and a web search is billable: one bringing in what nobody wants
 * would spend their allowance every night with no way to call it off.
 *
 *   brings in what nobody wants   set aside or below the bar, repeatedly, and
 *                                 nothing ever drafted
 *   brings in nothing              found nothing, and has had a few nights
 *
 * Retired is paused, not deleted, so the planner remembers not to suggest the
 * same words tomorrow.
 */
export function spentHunts(hunts: Hunt[], yields: Record<string, HuntYield>, now: Date): Array<{ id: string; why: string }> {
  const out: Array<{ id: string; why: string }> = [];
  for (const h of hunts) {
    if (h.status !== 'active') continue;
    const y = yields[h.id] ?? EMPTY_YIELD;
    const unwanted = y.binned + y.below;
    if (unwanted >= HUNT_BIN_FLAG && y.drafted === 0) {
      out.push({ id: h.id, why: `Retired: ${unwanted} found, none worth drafting` });
      continue;
    }
    const age = now.getTime() - Date.parse(h.created_at);
    if (h.last_run_at && h.last_found === 0 && y.found === 0 && age > HUNT_GRACE_DAYS * 86_400_000) {
      out.push({ id: h.id, why: 'Retired: found nothing' });
    }
  }
  return out;
}

/** How many new searches to plan: the empty slots, of the web kinds that run. */
export function huntsNeeded(hunts: Array<Pick<Hunt, 'kind' | 'status'>>, want = AUTO_HUNTS): number {
  const live = hunts.filter((h) => h.status === 'active' && h.kind !== 'agent').length;
  return Math.max(0, want - live);
}

/* ── The plan ──────────────────────────────────────────────────────────── */

export interface HuntPlanItem { kind: PlanKind; query: string; area: string | null; label: string }

export const PLAN_SYSTEM = `You decide where to look for one person's next buyers. You are given what they sell, who buys it, where they are, their goals, and what is already being searched.

Return JSON only: {"hunts":[{"kind","query","area","label"}]}, at most ${AUTO_HUNTS}.

kind is one of:
- "companies": a web search over company websites — businesses that would pay for what they sell: stockists, clients, B2B buyers, partners
- "people": a web search over public profiles — a named buyer, owner, organiser or decision maker at the kind of business that buys

Rules:
- Write each query the way you would describe the page you want to find, in plain words: "a family-run resort in Palawan that takes bookings by Facebook message", not "Palawan resort booking automation buyer". 6 to 16 words. Never generic ("small businesses", "potential clients").
- Pick buyers who can say yes at their price, where they can actually be reached from where the person is.
- area only when place matters; a city or region with its country, else null.
- label is 2 to 4 words.
- Do not repeat anything already searched. Do not invent facts about their business.`;

/** Model output into a plan. Anything malformed, not a web kind, or already searched is dropped. */
export function parsePlan(raw: unknown, existing: string[], max = AUTO_HUNTS): HuntPlanItem[] {
  const list = Array.isArray((raw as { hunts?: unknown })?.hunts) ? (raw as { hunts: unknown[] }).hunts : Array.isArray(raw) ? raw : [];
  const out: HuntPlanItem[] = [];
  for (const item of list) {
    const n = normalizeHuntInput(item);
    if ('error' in n) continue;
    if ([...existing, ...out.map((o) => o.query)].some((q) => sameHunt(q, n.query))) continue;
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * A plan with no model: the buyers the user named, each as a company search in
 * their area, and the people who decide at the first of them. Read straight off
 * their own words — nothing here is a view about their business (invariant 12).
 */
export function planFromOffer(offer: Offer, area: string | null, existing: string[], max = AUTO_HUNTS): HuntPlanItem[] {
  const buyers = buyersOf(offer);
  const drafts: Array<Omit<HuntPlanItem, 'label'>> = buyers.slice(0, max).map((b) => ({ kind: 'companies' as const, query: b, area }));
  if (buyers[0]) drafts.push({ kind: 'people', query: `owners and buyers at ${buyers[0]}`, area });
  return parsePlan(drafts, existing, max);
}

/** The buyers the user named, split the way people list them: "cafés, gyms and salons". */
export function buyersOf(offer: Offer): string[] {
  return (offer.for_who ?? '').split(/[,;/]|\s+and\s+|\s+y\s+/i).map((s) => s.trim()).filter((s) => s.length >= 3);
}

/**
 * Why there is nothing to search, when nothing is live and nothing new could be
 * planned. Thrown rather than returned as an empty run, because an empty run
 * reads as a quiet night (invariant 13). Worded to follow "Web search failed
 * last run:" on the Scout and "Could not search the web:" in the toast, and as
 * the thing to change where the user can change it. A model that failed, or
 * could not be asked in time, comes first: one that answered would have planned.
 */
export function noPlanReason(offer: Offer, modelError?: string | null): string {
  if (modelError) return `could not work out what to look for (${modelError.slice(0, 50)})`;
  return buyersOf(offer).length
    ? 'every search it could think of was tried, and none brought in anybody worth writing to'
    : 'nothing to look for — your offer does not say who buys it';
}

export function planPrompt(input: { offer: Offer; area: string | null; working: string; goals: string[]; existing: string[] }): string {
  const o = input.offer;
  return [
    `They sell: ${o.sells ?? '(not said)'}`,
    o.for_who ? `They say buyers are: ${o.for_who}` : null,
    o.problem ? `The problem it solves: ${o.problem}` : null,
    o.price_band ? `Price: ${o.price_band}` : null,
    `Where they are: ${input.area ?? '(not said)'}`,
    input.goals.length ? `Their goals: ${input.goals.join('; ')}` : null,
    input.working ? `What they have written about the business:\n${input.working}` : null,
    input.existing.length ? `Already searched (do not repeat): ${input.existing.join('; ')}` : 'Already searched: nothing yet',
  ].filter(Boolean).join('\n');
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
