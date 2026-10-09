// src/lib/copilot/livepage.ts
// Your page, online: a landing page the person kept, at an address of its own,
// with one thing it asks for — and the app counting who opened it and who tapped.
//
// Why it exists. Proof's verdict on its owner's business read "Weak link: how
// they hear. Your count link has recorded nothing yet", over an asset list that
// said "No landing page yet — Draft it". Drafting it gave text, and text is not
// somewhere a buyer can find. The count link was made and nothing posted to it,
// because wiring a form tool's webhook is exactly the setup a person under
// pressure does not get to. So a kept landing page goes online in one tap, and
// the page counts itself: how many opened it and how many tapped what it asks.
// "How they hear" stops being untested the first time somebody opens the link.
//
// What it is held to:
//
//   - One ask, the person's own channel: their WhatsApp, their email, or a link
//     they give (a sign-up, a booking page, a checkout). The conversation happens
//     there, from their own identity (invariant 4). The app sends nothing.
//   - Text only. The page is the version's own words, escaped, with no link in it
//     but the ask — a page on this app's address must not become anybody's way to
//     put a link of their choosing in front of a stranger.
//   - Counts, never visitors. An open and a tap are rows with a kind, a day and
//     the version that was online; nothing about who opened it is read or kept
//     (signal.ts holds the same line for the count link).
//   - A tap is a tap. It is not an enquiry and is never added to the count link's
//     enquiries: somebody who tapped "Message me" may not have sent anything.
//   - The person's own visits are not counted: their session is on the same
//     address, and the count is of strangers.
//   - Which version was online when it was opened is kept with every count, so a
//     page that changed can be read against the version it was — the join a chat
//     that writes landing pages cannot make (DIRECTION.md, Proof).
//
// One page per account: the address stays the same while the version behind it
// changes, so the link already shared keeps working. Stored as copilot_events
// rows — no migration. Pure: no DB import, no crypto (pagekey.ts signs).

import { ASSET_LABEL, webLink } from './assets';

export const PAGE_LIVE = 'page_live';
export const PAGE_OFF = 'page_off';
/** One open or one tap, with the version that was online. */
export const PAGE_HIT = 'page_hit';
/** Counting stopped for the hour: more than PAGE_HITS_PER_HOUR. Said, never silent (invariant 13). */
export const PAGE_CAPPED = 'page_capped';
export const PAGE_STATE_EVENTS = [PAGE_LIVE, PAGE_OFF] as const;
export const PAGE_HIT_EVENTS = [PAGE_HIT, PAGE_CAPPED] as const;

/** Past this many in an hour, it is not people reading a page. */
export const PAGE_HITS_PER_HOUR = 600;
/** What the home payload reads of them, newest first. */
export const PAGE_HITS_KEPT = 2000;

export const ASK_KINDS = ['whatsapp', 'email', 'link'] as const;
export type AskKind = (typeof ASK_KINDS)[number];
export const ASK_KIND_LABEL: Record<AskKind, string> = { whatsapp: 'WhatsApp', email: 'Email', link: 'A link' };
/** What the button says unless the person writes their own. */
export const ASK_DEFAULT: Record<AskKind, string> = { whatsapp: 'Message me on WhatsApp', email: 'Email me', link: 'Get started' };
export const ASK_LABEL_MAX = 40;

export interface PageAsk { kind: AskKind; to: string; label: string }

/** The page as it is online: which asset, which version, and what it asks for. */
export interface LivePage { asset: string; n: number; ask: PageAsk; at: string }

export type HitKind = 'open' | 'tap';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const line = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

const isAskKind = (v: unknown): v is AskKind => typeof v === 'string' && (ASK_KINDS as readonly string[]).includes(v);

/** A WhatsApp number as wa.me takes it: digits, with the country code. Seven to fifteen of them. */
export function waDigits(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/[^\d]/g, '');
  // A Philippine mobile typed the local way (09xx) is the commonest number this
  // app sees; wa.me needs it with 63 in front.
  const full = d.length === 11 && d.startsWith('09') ? `63${d.slice(1)}` : d;
  return /^\d{7,15}$/.test(full) ? full : null;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

/**
 * What the page asks for, as the person said it, held to what each kind can be:
 * a number wa.me opens, an address mail opens, a secure web address. Refused with
 * what to fix — a button that goes nowhere is worse than no page.
 */
export function normalizeAsk(raw: Record<string, unknown>): Result<PageAsk> {
  if (!isAskKind(raw.kind)) return { ok: false, error: 'What should the page ask for: WhatsApp, email or a link?' };
  const label = line(raw.label, ASK_LABEL_MAX) ?? ASK_DEFAULT[raw.kind];
  if (raw.kind === 'whatsapp') {
    const to = waDigits(raw.to);
    return to ? { ok: true, value: { kind: 'whatsapp', to, label } } : { ok: false, error: 'That is not a WhatsApp number. Write it with the country code, like +63 917 123 4567.' };
  }
  if (raw.kind === 'email') {
    const to = line(raw.to, 254);
    return to && EMAIL.test(to) ? { ok: true, value: { kind: 'email', to, label } } : { ok: false, error: 'That is not an email address.' };
  }
  const to = webLink(raw.to);
  if (!to || !to.startsWith('https://')) return { ok: false, error: 'The link has to be a secure web address, starting https://' };
  return { ok: true, value: { kind: 'link', to, label } };
}

/** Where the button goes. WhatsApp opens with a first line that names the page, so the person knows where the message came from. */
export function askHref(ask: PageAsk, title: string): string {
  if (ask.kind === 'whatsapp') return `https://wa.me/${ask.to}?text=${encodeURIComponent(`Hi, I saw your page: ${title}`)}`;
  if (ask.kind === 'email') return `mailto:${ask.to}?subject=${encodeURIComponent(title)}`;
  return ask.to;
}

/** "WhatsApp, +63…4567": what the button opens, said on the person's sheet. */
export function askWhere(ask: PageAsk): string {
  if (ask.kind === 'whatsapp') return `WhatsApp, +${ask.to}`;
  if (ask.kind === 'email') return ask.to;
  return ask.to.replace(/^https:\/\//, '').slice(0, 60);
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface PageEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

function storedAsk(v: unknown): PageAsk | null {
  const r = normalizeAsk(obj(v));
  return r.ok ? r.value : null;
}

/**
 * The page online now, or null: the newest of going online and going offline
 * wins. A row that does not hold together is skipped, never shown as a page.
 */
export function livePageOf(rows: PageEventRow[]): LivePage | null {
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || String(b.id).localeCompare(String(a.id)))) {
    if (r.event_type === PAGE_OFF) return null;
    if (r.event_type !== PAGE_LIVE) continue;
    const p = obj(r.payload);
    const asset = line(p.asset, 64);
    const n = typeof p.n === 'number' && Number.isInteger(p.n) && p.n >= 1 ? p.n : null;
    const ask = storedAsk(p.ask);
    if (asset && n && ask) return { asset, n, ask, at: r.created_at };
  }
  return null;
}

/**
 * The button the page last had, online or not: taken offline and put back up,
 * the page asks for what it asked for before, unless the person changes it.
 */
export function lastAskOf(rows: PageEventRow[]): PageAsk | null {
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || String(b.id).localeCompare(String(a.id)))) {
    if (r.event_type !== PAGE_LIVE) continue;
    const ask = storedAsk(obj(r.payload).ask);
    if (ask) return ask;
  }
  return null;
}

/** One count, on the person's day, with the version that was online. */
export interface PageHit { kind: HitKind; on: string; asset: string | null; n: number | null }

/** Every open and tap, newest first, and when counting last stopped for the hour. */
export function pageHitsOf(rows: PageEventRow[], dayOf: (iso: string) => string | null): { hits: PageHit[]; capped: string | null } {
  const hits: PageHit[] = [];
  let capped: string | null = null;
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const p = obj(r.payload);
    if (r.event_type === PAGE_CAPPED) { capped ??= r.created_at; continue; }
    if (r.event_type !== PAGE_HIT || (p.kind !== 'open' && p.kind !== 'tap')) continue;
    const on = dayOf(r.created_at);
    if (!on) continue;
    hits.push({ kind: p.kind, on, asset: line(p.asset, 64), n: typeof p.n === 'number' && Number.isInteger(p.n) ? p.n : null });
  }
  return { hits, capped };
}

/** Opens and taps, from a day on or all of them, of one version or every one. */
export function pageCounts(hits: PageHit[], o: { since?: string; asset?: string; n?: number } = {}): { opened: number; tapped: number } {
  const of = hits.filter((h) => (!o.since || h.on >= o.since) && (!o.asset || h.asset === o.asset) && (o.n == null || h.n === o.n));
  return { opened: of.filter((h) => h.kind === 'open').length, tapped: of.filter((h) => h.kind === 'tap').length };
}

/** The page, as the home payload carries it. */
export interface PageHome {
  live: LivePage | null;
  /** The button it last had, online or not (lastAskOf): what the sheet offers again. Optional: an older payload has none. */
  lastAsk?: PageAsk | null;
  /** Its address, from NEXT_PUBLIC_APP_URL. Null where that is not set: the sheet builds it from the address the app is open on. */
  url: string | null;
  /** The address's path ("/p/…"), for when there is no URL to hand. Null when the server cannot sign one. */
  path: string | null;
  /** Opens and taps, newest first, on the person's day. */
  hits: PageHit[];
  /** When counting last stopped for the hour, if it did. */
  capped: string | null;
  /** The read's failure, said where the page is (invariant 13). */
  unreadable: string | null;
}

/** "41 opened · 5 tapped Message me": the counts, said. Empty when there are none. */
export function pageLine(c: { opened: number; tapped: number }, label: string | null): string {
  if (!c.opened && !c.tapped) return '';
  return [`${c.opened} opened`, c.tapped ? `${c.tapped} tapped${label ? ` ${label}` : ''}` : null].filter(Boolean).join(' · ');
}

/* ─── The page itself ─────────────────────────────────────────────────────── */

export type PageBlock = { kind: 'h'; text: string } | { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

/** The marks a model or a note app leaves around words: bold, italics, code. The words stay. */
const plain = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/(^|\s)\*(\S[^*]*\S|\S)\*(?=\s|$|[.,;:!?])/g, '$1$2').trim();

/**
 * A version's text as a page: a line that starts with # is a heading, a run of
 * lines that start with -, * or a number is a list, and every other line is its
 * own paragraph — landing copy is short lines, and each is meant to be read as
 * one. The first line is dropped when it only repeats the title.
 */
export function pageBlocks(body: string, title: string): PageBlock[] {
  const out: PageBlock[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let first = true;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const heading = t.match(/^#{1,6}\s+(.+)$/);
    const item = t.match(/^(?:[-*•]|\d{1,2}[.)])\s+(.+)$/);
    const text = plain(heading ? heading[1] : item ? item[1] : t);
    if (!text) continue;
    if (first) {
      first = false;
      if (text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()) continue;
    }
    if (heading) out.push({ kind: 'h', text });
    else if (item) {
      const last = out[out.length - 1];
      if (last?.kind === 'list') last.items.push(text); else out.push({ kind: 'list', items: [text] });
    } else out.push({ kind: 'p', text });
  }
  return out;
}

/** The first paragraph, for the line a link preview shows under the title. */
export function pageSummary(blocks: PageBlock[], max = 160): string | null {
  const p = blocks.find((b): b is { kind: 'p'; text: string } => b.kind === 'p');
  if (!p) return null;
  return p.text.length <= max ? p.text : `${p.text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/** Text, made safe to put in HTML or an attribute. Everything the page shows goes through this. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** What a page that is not online says: the same words whether it never was or was taken down. */
export const PAGE_GONE = 'This page is not online right now.';

/**
 * The page, whole: the title, the version's words, the one button and nothing
 * else. Every word escaped; the only link is the ask's; the script — counting
 * the open, and the tap — runs under the nonce the response's policy names, and
 * nothing else may run, load or post anywhere but this address.
 */
export function pageHtml(i: { code: string; title: string; body: string; ask: PageAsk; nonce: string; madeWith: string | null }): string {
  const blocks = pageBlocks(i.body, i.title);
  const summary = pageSummary(blocks);
  const html = blocks.map((b) => (b.kind === 'h' ? `<h2>${esc(b.text)}</h2>`
    : b.kind === 'p' ? `<p>${esc(b.text)}</p>`
    : `<ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`)).join('\n');
  const href = askHref(i.ask, i.title);
  // Counted once per tab: a reload is the same person, and sessionStorage keeps
  // nothing past the tab. A browser that refuses storage counts each load.
  const script = `(function(){var c=${JSON.stringify(i.code).replace(/</g, '\\u003c')},u='/api/copilot/page/'+encodeURIComponent(c);
function once(k){try{var s=sessionStorage.getItem('cp-pg-'+k+c);if(s)return false;sessionStorage.setItem('cp-pg-'+k+c,'1');}catch(e){}return true;}
function hit(k){if(!once(k))return;var b=JSON.stringify({kind:k});try{if(navigator.sendBeacon&&navigator.sendBeacon(u,new Blob([b],{type:'application/json'})))return;}catch(e){}try{fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:b,keepalive:true});}catch(e){}}
hit('open');var a=document.getElementById('ask');if(a)a.addEventListener('click',function(){hit('tap');});})();`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(i.title)}</title>
<meta property="og:title" content="${esc(i.title)}">
${summary ? `<meta name="description" content="${esc(summary)}">\n<meta property="og:description" content="${esc(summary)}">` : ''}
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<style>
:root{--ink:#1A1D29;--muted:#5F6578;--bg:#F5F6FA;--card:#FFFFFF;--accent:#4F63D2;--line:#E7E9F1}
@media (prefers-color-scheme:dark){:root{--ink:#ECEDF3;--muted:#A3A8BA;--bg:#12141B;--card:#1B1E28;--accent:#8C9BFF;--line:#2A2E3B}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:640px;margin:0 auto;padding:40px 20px 48px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:28px 22px}
h1{font-size:28px;line-height:1.2;letter-spacing:-.01em;margin:0 0 16px}
h2{font-size:18px;line-height:1.35;margin:24px 0 8px}
p{margin:0 0 12px;color:var(--ink)}
ul{margin:0 0 12px;padding-left:20px}li{margin:0 0 6px}
.ask{display:block;margin:24px 0 4px;padding:15px 18px;border-radius:999px;background:var(--accent);color:#fff;font-weight:600;text-align:center;text-decoration:none;font-size:16px}
.ask:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
footer{margin-top:20px;text-align:center;font-size:12px;color:var(--muted)}
footer a{color:var(--muted)}
</style>
</head>
<body>
<main>
<div class="card">
<h1>${esc(i.title)}</h1>
${html}
<a id="ask" class="ask" href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(i.ask.label)}</a>
</div>
${i.madeWith ? `<footer>Made with <a href="${esc(i.madeWith)}" rel="noopener">Copilot</a></footer>` : ''}
</main>
<script nonce="${esc(i.nonce)}">${script}</script>
</body>
</html>`;
}

/** What a page that could not be read says: not that it is gone, because it may not be. */
export const PAGE_UNREAD = 'This page could not be shown just now. Try again in a minute.';

/**
 * The page that answers when there is none to show: not found or taken offline
 * (one answer, so the address says nothing about which), or not read just now.
 */
export function goneHtml(why: string = PAGE_GONE): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not online</title>
<style>body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F5F6FA;color:#1A1D29}main{max-width:520px;margin:0 auto;padding:80px 20px;text-align:center}</style></head>
<body><main><p>${esc(why)}</p></main></body></html>`;
}

/** Why a version cannot go online, or null when it can. The route and the sheet say the same. */
export function publishRefusal(a: { kind: string; retired: boolean } | null, v: { body: string | null } | null): string | null {
  if (!a) return 'That page is not in your assets.';
  if (a.kind !== 'landing_page') return `Only a landing page goes online, and this is your ${ASSET_LABEL[a.kind as keyof typeof ASSET_LABEL]?.toLowerCase() ?? 'asset'}.`;
  if (a.retired) return 'That page is put away. Bring it back first.';
  if (!v) return 'That version is not in its history.';
  if (!v.body?.trim()) return 'That version has no words in it to show. Write it out first.';
  return null;
}
