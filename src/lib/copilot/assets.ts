// src/lib/copilot/assets.ts
// Assets: what the business has to sell with — the offer, a demo, a script, a
// landing page, a workflow, a price test — as things with a history, not lines
// on a list.
//
// Why first-class. Work's Built was a list of what had been made, newest first,
// and it could not say the two things that make an asset worth having: which
// version is in use, and what it was made for. Its owner asked for each asset
// with who built it (AI or you), its version, and the bet that produced it,
// because without those the business's history has a gap exactly where its
// work is: a price that changed with nothing saying why, a script rewritten
// with nothing saying what the first one did.
//
// So an asset is an identity and a list of versions. Each version says who made
// it, when, from which bet (lab.ts) or project (commission.ts), and holds a link
// or a body or both. A version is never edited: a change is the next version,
// and the history is the list.
//
// The offer is one asset among them with a fixed id. The profile row keeps the
// version in use — every draft is built from it (invariant 1), so it stays the
// single source — and every save of it is recorded as a version here, which is
// what fills the offer's history from now on. A version the AI wrote is not the
// offer until the person makes it theirs.
//
// What an AI may write here is held to the same rule as a message (deck.ts
// checkDraft): no placeholder, no link the person did not give, and no number
// that is not in their own words or their rows (invariant 2). A model drafts;
// the person keeps, edits or drops it; only rows judge it — through the bet it
// was made for.
//
// Stored without a migration, as copilot_events rows (ASSET_EVENTS), like the
// Lab. Pure: no DB import.

import type { LinkKey } from './business';
import { HEARD_ROLES_NOTE } from './lab';
import type { FoundBy, Offer } from './types';

/* ─── Kinds ───────────────────────────────────────────────────────────────── */

export const ASSET_KINDS = ['offer', 'demo', 'script', 'landing_page', 'workflow', 'price_test'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_LABEL: Record<AssetKind, string> = {
  offer: 'Offer',
  demo: 'Demo',
  script: 'Script',
  landing_page: 'Landing page',
  workflow: 'Workflow',
  price_test: 'Price test',
};

/** What each kind is, said where one is made, so the choice is not a guess. */
export const ASSET_BLURB: Record<AssetKind, string> = {
  offer: 'What you sell, who for, the problem it solves and the price',
  demo: 'What a buyer sees working before they pay: a recording, or its script',
  script: 'What you say: a first message, a call, a follow-up',
  landing_page: 'One page that says the offer and asks for one thing',
  workflow: 'How a client goes from yes to delivered, step by step',
  price_test: 'A price, the terms it is offered on, and who is asked',
};

/** The part of the business each kind works on (business.ts). A price test and a demo are both bets on what they pay. */
export const ASSET_PART: Record<AssetKind, LinkKey> = {
  offer: 'pay',
  demo: 'pay',
  script: 'close',
  landing_page: 'reach',
  workflow: 'deliver',
  price_test: 'pay',
};

export const isAssetKind = (v: unknown): v is AssetKind => typeof v === 'string' && (ASSET_KINDS as readonly string[]).includes(v);

/* ─── Storage ─────────────────────────────────────────────────────────────── */

export const ASSET_VERSION = 'asset_version';
export const ASSET_RETIRED = 'asset_retired';
export const ASSET_RESTORED = 'asset_restored';
export const ASSET_EVENTS = [ASSET_VERSION, ASSET_RETIRED, ASSET_RESTORED] as const;

/** The offer's fixed id: there is only ever one offer, and the profile row holds the version in use. */
export const OFFER_ASSET = 'offer';

export const TITLE_MAX = 80;
export const BODY_MAX = 6000;
export const NOTE_MAX = 200;
export const URL_MAX = 500;
/** What the person can tell the model about a draft: "add a guarantee", "shorter". */
export const DRAFT_ASK_MAX = 300;
/** Assets the screen carries. */
export const MAX_ASSETS = 60;
/**
 * Versions per asset whose bodies travel with the home payload. Older ones are
 * kept and fetched when opened: a landing page at its sixth version would
 * otherwise send all six on every load.
 */
export const BODIES_KEPT = 2;

export type Maker = 'ai' | 'you';
export const MAKER_LABEL: Record<Maker, string> = { ai: 'By AI', you: 'By you' };

export interface AssetVersion {
  /** The event id. */
  id: string;
  asset: string;
  /** 1 for the first, counting up. */
  n: number;
  by: Maker;
  /** When it was made. Null for the offer as it stood before its history began. */
  at: string | null;
  title: string;
  body: string | null;
  url: string | null;
  /** What changed, or why: the person's line, or what they asked the model for. */
  note: string | null;
  /** The bet it was made for (lab.ts), when it was. */
  bet: string | null;
  /** The project that produced it (commission.ts), when one did. */
  project: string | null;
  /** The offer's fields, for the offer's versions. */
  offer: Offer | null;
  /** The model that wrote it, for a version by AI. */
  model: string | null;
  /** True when the body was left out of this payload to keep it small; the asset route returns it whole. */
  trimmed: boolean;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  /** Newest first. */
  versions: AssetVersion[];
  current: AssetVersion;
  /** Who made the first version: an asset the AI began and you rewrote is both, and says so. */
  firstBy: Maker;
  retired: boolean;
  updatedAt: string | null;
  /** The offer only: the version number the profile's offer is now, or null when it matches none. */
  live: number | null;
}

export interface AssetsHome {
  /** Newest change first, retired ones last. */
  assets: Asset[];
  /** The read's failure, said on Proof — never shown as a business with nothing built (invariant 13). */
  unreadable: string | null;
}

export interface AssetEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
/** Prose kept as written: line breaks are the structure of a script or a workflow. */
const prose = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : null);

/** A web address a person can open: http(s) only, so a `javascript:` link is never a button. */
export function webLink(v: unknown): string | null {
  const u = text(v, URL_MAX);
  if (!u) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(u) ? `https://${u}` : null;
  if (!withScheme) return null;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** The five fields an offer is made of, trimmed; empty ones left out. */
export function offerFields(o: Offer | null | undefined): Offer {
  const f: Offer = {};
  for (const k of ['sells', 'for_who', 'problem', 'price_band', 'proof_url'] as const) {
    const v = o?.[k]?.trim();
    if (v) f[k] = v;
  }
  return f;
}

const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Two offers that would write the same messages. How buyers find you is not part of it: no message says it. */
export function sameOffer(a: Offer | null | undefined, b: Offer | null | undefined): boolean {
  return (['sells', 'for_who', 'problem', 'price_band', 'proof_url'] as const).every((k) => norm(a?.[k]) === norm(b?.[k]));
}

/** An offer, said as text: what a version of it shows. */
export function offerBody(o: Offer): string {
  return [
    o.sells ? `What you sell: ${o.sells}` : null,
    o.for_who ? `Who for: ${o.for_who}` : null,
    o.problem ? `The problem it solves: ${o.problem}` : null,
    o.price_band ? `Price: ${o.price_band}` : null,
    o.proof_url ? `Proof: ${o.proof_url}` : null,
  ].filter(Boolean).join('\n');
}

/* ─── What comes in ───────────────────────────────────────────────────────── */

export interface AssetDraftIn {
  kind: AssetKind;
  title: string;
  body: string | null;
  url: string | null;
  note: string | null;
}

/**
 * An asset as the person wrote it: a kind, a title, and something in it — a
 * link, a body, or both. A link that is not a web address is refused rather
 * than kept as a button that goes nowhere.
 */
export function normalizeAssetInput(raw: Record<string, unknown>, fixedKind?: AssetKind): Result<AssetDraftIn> {
  const kind = fixedKind ?? (isAssetKind(raw.kind) ? raw.kind : null);
  if (!kind) return { ok: false, error: 'What kind of asset is it?' };
  if (kind === 'offer') return { ok: false, error: 'The offer is changed on its own sheet, where every draft is rewritten from it.' };
  const rawUrl = text(raw.url, URL_MAX);
  const url = webLink(rawUrl);
  if (rawUrl && !url) return { ok: false, error: 'That link is not a web address. It should start with https://' };
  const body = prose(raw.body, BODY_MAX);
  if (!url && !body) return { ok: false, error: 'Add a link to it, or write it out.' };
  return {
    ok: true,
    value: { kind, title: text(raw.title, TITLE_MAX) ?? ASSET_LABEL[kind], body, url, note: text(raw.note, NOTE_MAX) },
  };
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

function storedVersion(p: Record<string, unknown>, id: string, at: string): Omit<AssetVersion, 'n'> | null {
  const asset = text(p.asset, 64);
  if (!asset) return null;
  const by: Maker = p.by === 'ai' ? 'ai' : 'you';
  const o = obj(p.offer);
  const offer = asset === OFFER_ASSET ? offerFields(o as Offer) : null;
  const body = prose(p.body, BODY_MAX) ?? (offer ? offerBody(offer) : null);
  const url = webLink(p.url);
  if (!body && !url && !(offer && offer.sells)) return null;
  return {
    id, asset, by,
    // A version recorded after the fact for something written before the
    // history began carries no date: the row's own is when it was recorded.
    at: p.undated === true ? null : at,
    title: text(p.title, TITLE_MAX) ?? (offer?.sells ? offer.sells.slice(0, TITLE_MAX) : 'Untitled'),
    body, url,
    note: text(p.note, NOTE_MAX),
    bet: text(p.bet, 64),
    project: text(p.project, 64),
    offer,
    model: by === 'ai' ? text(p.model, 80) : null,
    trimmed: false,
  };
}

/**
 * Every asset from its events, with the offer always among them while there is
 * one. The offer's versions are its recorded saves; its first, when it was set
 * before the history began, stands in undated — said as such, never given a
 * date it does not have. A profile offer that matches no version (changed where
 * the history does not reach) is shown as the version in use, undated, so the
 * screen never shows an offer the drafts are not built from.
 */
export function assetsFromEvents(rows: AssetEventRow[], offer: Offer | null | undefined): Asset[] {
  const byAsset = new Map<string, { kind: AssetKind; versions: Array<Omit<AssetVersion, 'n'>>; retired: boolean }>();
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || String(a.id).localeCompare(String(b.id)))) {
    const p = obj(r.payload);
    if (r.event_type === ASSET_VERSION) {
      const v = storedVersion(p, String(r.id), r.created_at);
      if (!v) continue;
      const kind = v.asset === OFFER_ASSET ? 'offer' : isAssetKind(p.kind) && p.kind !== 'offer' ? p.kind : null;
      const held = byAsset.get(v.asset);
      if (!held) {
        // The first version names the kind, for good: a script is not later a demo.
        if (!kind) continue;
        byAsset.set(v.asset, { kind, versions: [v], retired: false });
      } else {
        held.versions.push(v);
      }
    } else if (r.event_type === ASSET_RETIRED || r.event_type === ASSET_RESTORED) {
      const id = text(p.asset, 64);
      const held = id ? byAsset.get(id) : null;
      if (held) held.retired = r.event_type === ASSET_RETIRED;
    }
  }

  // The offer as it stands, against its recorded versions.
  const now = offerFields(offer);
  if (now.sells) {
    const held = byAsset.get(OFFER_ASSET);
    const versions = held?.versions ?? [];
    if (!versions.some((v) => sameOffer(v.offer, now))) {
      const standIn: Omit<AssetVersion, 'n'> = {
        id: `${OFFER_ASSET}-now`, asset: OFFER_ASSET, by: 'you', at: null, title: now.sells!.slice(0, TITLE_MAX),
        body: offerBody(now), url: null,
        note: versions.length ? 'Changed where the history does not reach' : 'Written before the history began',
        bet: null, project: null, offer: now, model: null, trimmed: false,
      };
      // Undated, so it cannot be ordered by time: before everything when it is
      // the only version, after everything when the recorded ones are older
      // than the offer in use.
      if (versions.length) versions.push(standIn); else versions.unshift(standIn);
    }
    if (!held) byAsset.set(OFFER_ASSET, { kind: 'offer', versions, retired: false });
  }

  const out: Asset[] = [];
  for (const [id, held] of byAsset) {
    if (!held.versions.length) continue;
    const numbered = held.versions.map((v, i) => ({ ...v, n: i + 1 }));
    const newestFirst = [...numbered].reverse();
    const current = id === OFFER_ASSET
      ? newestFirst.find((v) => sameOffer(v.offer, now)) ?? newestFirst[0]
      : newestFirst[0];
    out.push({
      id, kind: held.kind, title: current.title, versions: newestFirst, current,
      firstBy: numbered[0].by,
      // The offer cannot be put away: every draft is written from it.
      retired: id === OFFER_ASSET ? false : held.retired,
      updatedAt: newestFirst.find((v) => v.at)?.at ?? null,
      live: id === OFFER_ASSET ? newestFirst.find((v) => sameOffer(v.offer, now))?.n ?? null : null,
    });
  }
  return out.sort((a, b) =>
    Number(a.retired) - Number(b.retired)
    // The offer first: it is what every other asset is about.
    || Number(b.id === OFFER_ASSET) - Number(a.id === OFFER_ASSET)
    || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

/** The home payload's assets: the latest versions whole, older bodies left for the asset route. */
export function assetsHome(i: { events: AssetEventRow[]; unreadable: string | null; offer: Offer | null | undefined }): AssetsHome {
  const assets = assetsFromEvents(i.events, i.offer).slice(0, MAX_ASSETS).map((a) => ({
    ...a,
    versions: a.versions.map((v, idx) => (idx < BODIES_KEPT || v.id === a.current.id ? v : { ...v, body: null, trimmed: !!v.body })),
  }));
  return { assets, unreadable: i.unreadable };
}

/** "v3 · by AI · 4 Oct" — what a row says under an asset's title. */
export function versionLine(v: Pick<AssetVersion, 'n' | 'by' | 'at'>, dayWords: (iso: string) => string): string {
  return [`v${v.n}`, v.by === 'ai' ? 'by AI' : 'by you', v.at ? dayWords(v.at) : null].filter(Boolean).join(' · ');
}

/* ─── What is missing ─────────────────────────────────────────────────────── */

export interface AssetGap {
  kind: AssetKind;
  /** "No demo yet". */
  title: string;
  /** Why it matters for this business, now. */
  why: string;
}

/**
 * The assets this business lacks where they would matter now, the weak part's
 * first. At most two: a list of everything missing is a to-do list, and the
 * point is the one or two that would move the part that is failing.
 */
export function assetGaps(i: {
  assets: Asset[];
  offer: Offer | null | undefined;
  weak: LinkKey | null;
  foundBy: FoundBy | null;
  states: Partial<Record<LinkKey, string>>;
}): AssetGap[] {
  if (!i.offer?.sells?.trim()) return [];
  const live = i.assets.filter((a) => !a.retired);
  const has = (k: AssetKind) => live.some((a) => a.kind === k);
  const gaps: Array<AssetGap & { part: LinkKey }> = [];
  // Proof matters while the price is not being paid: once sales at it come in, they are the proof.
  if (!has('demo') && !i.offer.proof_url?.trim() && i.states.pay !== 'works' && i.states.pay !== 'testing') {
    gaps.push({ kind: 'demo', part: 'pay', title: 'No demo yet', why: 'Proof is what a price is believed on.' });
  }
  if (!has('landing_page') && i.foundBy && i.foundBy !== 'outreach' && i.states.reach !== 'works') {
    gaps.push({ kind: 'landing_page', part: 'reach', title: 'No landing page yet', why: 'Where buyers find you, the page is the first conversation.' });
  }
  if (!has('script') && (i.states.close === 'stuck' || i.states.close === 'testing')) {
    gaps.push({ kind: 'script', part: 'close', title: 'No script yet', why: 'What you say after they answer decides the yes.' });
  }
  if (!has('workflow') && i.states.deliver === 'missing' && i.states.pay === 'works') {
    gaps.push({ kind: 'workflow', part: 'deliver', title: 'No workflow yet', why: 'Selling works; delivery is what has to hold now.' });
  }
  return gaps
    .sort((a, b) => Number(b.part === i.weak) - Number(a.part === i.weak))
    .slice(0, 2)
    .map(({ part: _part, ...g }) => g);
}

/* ─── A draft by AI ───────────────────────────────────────────────────────── */

/** What the model writes from: only the person's words and their rows. */
export interface AssetDraftContext {
  kind: AssetKind;
  offer: Offer;
  foundBy: FoundBy | null;
  /** The working file, as the person wrote it (working.ts workingBrief). */
  working: string | null;
  /** The bet it is for, when there is one. */
  bet: { belief: string; line: string; play: string | null } | null;
  /** The part of the business this kind works on, as the chain reads it now. */
  part: { label: string; state: string; why: string } | null;
  /** The version being revised, when it is a revision. */
  previous: { title: string; body: string | null } | null;
  /** What the person asked for. */
  ask: string | null;
  /**
   * What people said in the conversations the person logged, newest first and
   * nameless (lab.ts heardLine): the vocabulary a page or a script should be
   * written in, and the person's own rows, so a number in them is theirs.
   */
  heard?: string[];
}

export const ASSET_DRAFT_SYSTEM = [
  'You write one business asset for a small business owner: an offer, a demo script, a sales script, landing page copy, a delivery workflow or a price test.',
  'Write in plain words, second person where it addresses the buyer, and in the owner\'s own vocabulary from what they wrote.',
  'Use only facts given to you. Never invent a number, a result, a client, a testimonial, a guarantee term with a figure, or a statistic. If a number is not in what you were given, write the sentence without one.',
  'Where you are given what people said, write in their words and to the problem they described. Never quote them or present what they said as a testimonial, and never turn one person\'s number into a claim about every buyer.',
  'Never leave a placeholder such as [NAME] or {{price}}. Never include a link unless it was given to you.',
  'Answer with JSON only, no prose around it.',
].join(' ');

const KIND_BRIEF: Record<AssetKind, string> = {
  offer: 'Rewrite the offer. Fields: "sells" (what is sold, one line), "for_who" (who buys, one line), "problem" (the problem it solves, one line), "price_band" (the price exactly as given, or empty), and "body" (two or three sentences that say the offer as a buyer would read it).',
  demo: 'Write a demo script the owner records and sends: what the buyer sees before, the moment it works, and after. Short numbered beats, under 1,200 characters.',
  script: 'Write a sales script: the first message or call opener, the one question that finds the problem, how to answer the most likely objection, and the ask. Under 1,800 characters.',
  landing_page: 'Write landing page copy: a headline, one line under it, three short benefit lines, one call to action, and three questions a buyer asks with short answers. Under 2,500 characters.',
  workflow: 'Write the delivery workflow: numbered steps from the first yes to delivered, what the owner needs from the client at each step, and which step could be handed over. Under 2,500 characters.',
  price_test: 'Write a price test: the price to test (only one the owner gave), the terms it is offered on, who to ask and how many, and the count that would show it works. Under 1,200 characters.',
};

/** The prompt for one draft: the kind's brief, then everything the model may use, labelled. */
export function assetDraftPrompt(c: AssetDraftContext): string {
  const o = c.offer;
  const lines = [
    `Write: ${ASSET_LABEL[c.kind]}.`,
    KIND_BRIEF[c.kind],
    c.kind === 'offer'
      ? 'Return {"title": "...", "sells": "...", "for_who": "...", "problem": "...", "price_band": "...", "body": "..."}.'
      : 'Return {"title": "a short name for it", "body": "the asset itself"}.',
    '',
    'The offer, as the owner wrote it:',
    `- What they sell: ${o.sells ?? ''}`,
    o.for_who ? `- Who for: ${o.for_who}` : null,
    o.problem ? `- The problem: ${o.problem}` : null,
    o.price_band ? `- Price: ${o.price_band}` : null,
    o.proof_url ? `- Proof link: ${o.proof_url}` : null,
    c.foundBy ? `- How buyers find them: ${c.foundBy}` : null,
    c.working ? `\nWhat the owner wrote about how they work:\n${c.working}` : null,
    c.part ? `\nThe part of the business this is for: ${c.part.label} — ${c.part.state}. ${c.part.why}` : null,
    c.bet ? `\nThe bet it is for: "${c.bet.belief}". ${c.bet.play ? `The play: ${c.bet.play}. ` : ''}Pass line: ${c.bet.line}.` : null,
    ...(c.heard?.length ? ['\nWhat people told the owner, newest first:', ...c.heard.map((h) => `- ${h}`), HEARD_ROLES_NOTE] : []),
    c.previous ? `\nThe current version, to improve rather than start over:\nTitle: ${c.previous.title}\n${c.previous.body ?? ''}` : null,
    c.ask ? `\nWhat the owner asked for: ${c.ask}` : null,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

/** Everything a draft may take a number or a link from. */
export function draftSources(c: AssetDraftContext): string[] {
  const o = c.offer;
  return [o.sells, o.for_who, o.problem, o.price_band, o.proof_url, c.working, c.part?.why, c.bet?.belief, c.bet?.line, c.bet?.play, c.previous?.title, c.previous?.body, c.ask, ...(c.heard ?? [])]
    .filter((s): s is string => typeof s === 'string' && !!s);
}

/**
 * The first number in a text that is not in the sources, or null. A duration
 * or a time of day is an instruction ("a 10-minute call", "at 3pm"), a list's
 * own numbering is structure, and neither is a claim; everything else — a
 * price, a percentage, a count of clients — must be one the person gave.
 */
export function numberOutside(textIn: string, sources: string[]): string | null {
  const haystack = sources.join(' ').replace(/[,\s_]/g, '');
  const t = textIn
    .replace(/^\s*(?:step\s+)?\d{1,2}[.):]\s/gim, '')
    .replace(/\bstep\s+\d{1,2}\b/gi, '')
    .replace(/\b\d{1,3}\s?-?\s?(?:sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks|month|months)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi, '');
  for (const n of t.match(/\d[\d,.]*/g) ?? []) {
    const digits = n.replace(/[,.]+$/, '').replace(/,/g, '');
    if (!digits || /^[.]/.test(digits)) continue;
    if (!haystack.includes(digits.replace(/\.\d+$/, '')) && !haystack.includes(digits)) return n.replace(/[,.]+$/, '');
  }
  return null;
}

const PLACEHOLDER = /\[[^\]]{0,40}\]|\{\{|\}\}|<[a-z][^>]*>|\b(your name|company name|business name|lorem ipsum|insert [a-z]+)\b/i;

/** A link compared as a person would: no scheme, no www, no trailing slash. */
const linkKey = (u: string) => u.trim().replace(/[.,;:!?)]+$/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();

export type CheckedDraft = { ok: true; title: string; body: string; offer: Offer | null } | { ok: false; why: string };

/**
 * A model's draft held to what an asset may be. Refused, not repaired, when it
 * leaves a placeholder, links somewhere the person did not give, or states a
 * number that is not theirs: a draft with an invented price is worse than no
 * draft, because it reads as the person's.
 */
export function checkAssetDraft(parsed: unknown, c: AssetDraftContext): CheckedDraft {
  const j = obj(parsed);
  const sources = draftSources(c);
  let offer: Offer | null = null;
  let body = prose(j.body, BODY_MAX + 2000);
  if (c.kind === 'offer') {
    const sells = text(j.sells, 240);
    if (!sells) return { ok: false, why: 'the model wrote no offer' };
    offer = offerFields({
      sells,
      for_who: text(j.for_who, 120) ?? undefined,
      problem: text(j.problem, 240) ?? undefined,
      // The price is the person's or none: a model that names its own price has
      // made the one claim an offer cannot carry.
      price_band: text(j.price_band, 60) ?? c.offer.price_band ?? undefined,
      proof_url: c.offer.proof_url,
    });
    body = body ?? offerBody(offer);
  }
  if (!body) return { ok: false, why: 'the model wrote nothing' };
  const all = [body, offer ? offerBody(offer) : ''].join('\n');
  if (PLACEHOLDER.test(all)) return { ok: false, why: 'it left a placeholder in it' };
  const given = new Set(sources.flatMap((s) => s.match(/\b(?:https?:\/\/|www\.)[^\s)]+/gi) ?? []).map(linkKey));
  for (const url of all.match(/\b(?:https?:\/\/|www\.)[^\s)]+/gi) ?? []) {
    if (!given.has(linkKey(url))) return { ok: false, why: `it put in a link you did not give (${url.replace(/[.,;:!?)]+$/, '').slice(0, 60)})` };
  }
  const stray = numberOutside(all, sources);
  if (stray) return { ok: false, why: `it wrote a number that is not in your offer, your notes or your rows (${stray})` };
  if (body.length > BODY_MAX) {
    // Cut at the last paragraph that fits: an asset cut mid-sentence is not kept.
    const cut = body.slice(0, BODY_MAX);
    const end = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('.\n'), cut.lastIndexOf('. '));
    if (end < BODY_MAX * 0.5) return { ok: false, why: 'it wrote more than fits' };
    body = cut.slice(0, end + 1).trim();
  }
  const title = text(j.title, TITLE_MAX) ?? (offer?.sells ? offer.sells.slice(0, TITLE_MAX) : ASSET_LABEL[c.kind]);
  if (PLACEHOLDER.test(title) || numberOutside(title, sources)) return { ok: false, why: 'its title carried a placeholder or a number that is not yours' };
  return { ok: true, title, body, offer };
}
