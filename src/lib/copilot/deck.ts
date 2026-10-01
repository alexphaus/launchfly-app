// src/lib/copilot/deck.ts
// The Swipe tab: one match at a time, the whole screen, with the message already
// written on it. Right sends it, left is not for me.
//
// This app had a deck once (triage.ts) and folded it into the Matches list, for
// a reason worth keeping in view: a deck works only when both answers cost the
// same flick. There, "yes" meant a draft to go and send later, "no" was done,
// and the cheap side won every session — a cleared deck and nothing sent. 45 of
// 54 drafts never went; on the live account it became 57 of 76.
//
// So the change is not the gesture, it is what "yes" is. Everything the Matches
// card sent the owner off to open is on this card — the photo, what the place
// is, why it was picked, the post itself for a find, and how they can actually
// be reached — and so is the message, written for this one card before it is
// shown. Right is the send: from the person's own number or address when they
// connected one, otherwise their own WhatsApp, texts, phone or mail with the
// message already in it (invariant 4 — never the server's identity). Both sides
// cost one flick again.
//
// The metric that decides whether this tab stays is the one triage.ts named:
// sends per session, not swipes per session.
//
// How someone can be reached is said, not assumed. A Maps listing's phone went
// into `contact.whatsapp` whatever it was, and on the owner's account many were
// landlines: a WhatsApp link to a landline opens an error, and that was a draft
// that could never go. A Philippine number says which it is (639… is a mobile,
// 632… a Manila landline), so a landline is offered a call and a mobile is
// offered WhatsApp or a text. Elsewhere the number cannot say, so both are
// offered.
//
// Pure: no DB import, so copilot-core.test.ts covers the deck, the reach and the
// guard on what a model writes.

import type { MatchGroup, MatchItem, StageCard } from './matches';
import { imageOf, monogramOf, ratingOf } from './matches';
import type { Channel, Move, Offer, PipelineRow, QueueItem } from './types';

/* ── The cards ──────────────────────────────────────────────────────────── */

/** How a card's message can go, best first on the card. */
export type ReachVia = 'whatsapp' | 'sms' | 'call' | 'email' | 'site' | 'post';

export interface Reach {
  via: ReachVia;
  /** A dialable number ("+639171234567", or the digits as listed when the country is unknown), an address, or a page. */
  to: string;
}

export interface DeckCard {
  /** Stable across reloads: 'q:<action>' for a written draft, 'o:<opportunity>', 'm:<move>'. */
  key: string;
  /**
   * `draft`    a message already in To send — the person said yes to this business once
   * `business` a listing from supply, nothing written yet
   * `find`     a post, a role, a thread a watched source turned up
   */
  kind: 'draft' | 'business' | 'find';
  /** What the answer is recorded against: the action for a draft, the opportunity, the Move. */
  id: string;
  oppId: string | null;
  /** A find is answered through triage (it came through the deck) or as a Move (the watcher's own). */
  answer: 'triage' | 'move' | 'draft';
  group: MatchGroup;
  title: string;
  /** What it is and where: "Pest control service · Manila", "Earn · reddit.com". */
  sub: string | null;
  image: string | null;
  initials: string;
  fresh: boolean;
  /** A day-3 follow-up to someone already written to. */
  followUp: boolean;
  /** Why it was picked, in full — the Matches card cut this to two lines. */
  why: string[];
  /** Short facts off the listing: "4.2★ (31)", "No website". Never a number the listing did not carry. */
  facts: string[];
  /** A find's post, as posted. */
  post: string | null;
  /** The site a find came from, or the business's own domain. */
  source: string | null;
  /** Where to look them up: the post, the listing. */
  link: string | null;
  /** Every way to reach them, best first. A business with none is not dealt. */
  reach: Reach[];
  /** The draft already written, for a card from To send. */
  written: { actionId: string; body: string; subject: string | null; channel: Channel } | null;
  costLabel: string | null;
  createdAt: string | null;
}

export interface DeckInput {
  now: Date;
  /** Today in the person's zone: a follow-up is dealt from its own day, not before. */
  today: string;
  /** The New list, already judged and ordered (matches.ts matchFeed, what cleared the bar). */
  items: MatchItem[];
  /** To send, as the Matches pill shows it, in the queue's order. */
  toSend: StageCard[];
  queue: QueueItem[];
  pipeline: PipelineRow[];
  /** Open Moves: a find's post and reasons are read off its Move. */
  moves: Move[];
}

/** Past this the pile is a list again, and every card costs a model call. */
export const DECK_MAX = 60;

/** Facts on a card. Past four they stop being read at a glance. */
const MAX_FACTS = 4;
/** A post is shown whole up to here, then cut at a word. */
const POST_MAX = 1200;

/**
 * The deck, in the order it is dealt.
 *
 * Fresh finds lead: a gig posted last night is competed for today, and a thread
 * goes cold in days. Then To send, first messages before follow-ups: those are
 * businesses the person already said yes to, and they have been waiting longest.
 * Then everything else New, in the list's own order (fresh, learned keep-rate,
 * score). A follow-up is dealt from its own day — before it, it is a second
 * message chasing a first that has had no time to be answered.
 */
export function deckCards(input: DeckInput): DeckCard[] {
  const oppById = new Map(input.pipeline.map((r) => [r.opportunity.id, r.opportunity]));
  const moveById = new Map(input.moves.map((m) => [m.id, m]));
  const queueById = new Map(input.queue.map((q) => [q.id, q]));

  const finds: DeckCard[] = [];
  const businesses: DeckCard[] = [];
  const written = new Set<string>();

  const drafts: DeckCard[] = [];
  const followUps: DeckCard[] = [];
  for (const s of input.toSend) {
    const q = s.draftId ? queueById.get(s.draftId) : undefined;
    if (!q) continue;
    const followUp = q.title.startsWith('Follow-up to ');
    if (followUp && q.for_date > input.today) continue;
    const o = s.oppId ? oppById.get(s.oppId) : undefined;
    if (s.oppId) written.add(s.oppId);
    const exec = q.execution;
    // Only the ways on the draft's own channel: a written WhatsApp can go as a
    // text or be said on a call, to the same number, but an email is another
    // recipient and another draft.
    const reach = exec.channel === 'email' ? [{ via: 'email' as const, to: exec.recipient }] : phoneReach(exec.recipient, countryOf(o?.data));
    const card: DeckCard = {
      key: `q:${q.id}`,
      kind: 'draft',
      id: q.id,
      oppId: s.oppId,
      answer: 'draft',
      group: 'clients',
      title: s.title,
      sub: s.sub,
      image: s.image,
      initials: s.initials,
      fresh: false,
      followUp,
      why: o?.reason ? [o.reason] : [],
      facts: factsOf(o?.data),
      post: null,
      source: hostOf(o?.contact?.website ?? null),
      link: webUrl(o?.url) ?? webUrl(o?.contact?.website),
      reach,
      written: { actionId: q.id, body: exec.body, subject: exec.subject, channel: exec.channel },
      costLabel: null,
      createdAt: exec.created_at,
    };
    (followUp ? followUps : drafts).push(card);
  }

  for (const i of input.items) {
    if (i.from === 'feed') {
      const m = moveById.get(i.id);
      const post = m?.artifact?.value && m.artifact.value.trim() !== i.title.trim() ? clip(m.artifact.value, POST_MAX) : null;
      finds.push({
        key: `m:${i.id}`,
        kind: 'find',
        id: i.id,
        oppId: null,
        answer: i.answer,
        group: i.group,
        title: i.title,
        sub: i.sub,
        image: null,
        initials: '',
        fresh: i.fresh,
        followUp: false,
        why: m?.why?.length ? m.why.filter(Boolean) : i.reason ? [i.reason] : [],
        facts: [],
        post,
        source: hostOf(i.url),
        link: webUrl(i.url),
        reach: webUrl(i.url) ? [{ via: 'post', to: i.url! }] : [],
        written: null,
        costLabel: i.costLabel,
        createdAt: i.created_at,
      });
      continue;
    }
    if (written.has(i.id)) continue;
    const o = oppById.get(i.id);
    if (!o) continue;
    const reach = businessReach(o.contact ?? {}, countryOf(o.data));
    if (!reach.length) continue;
    businesses.push({
      key: `o:${i.id}`,
      kind: 'business',
      id: i.id,
      oppId: i.id,
      answer: 'triage',
      group: i.group,
      title: i.title,
      sub: i.sub,
      image: i.image ?? imageOf(o.data),
      initials: i.initials || monogramOf(i.title),
      fresh: i.fresh,
      followUp: false,
      why: i.reason ? [i.reason] : [],
      facts: factsOf(o.data),
      post: null,
      source: hostOf(o.contact?.website ?? null),
      link: webUrl(o.url) ?? webUrl(o.contact?.website),
      reach,
      written: null,
      costLabel: null,
      createdAt: i.created_at,
    });
  }

  const freshFinds = finds.filter((f) => f.fresh);
  const laterFinds = finds.filter((f) => !f.fresh);
  // Everything New keeps the list's own order between businesses and older finds.
  const rest = input.items
    .map((i) => (i.from === 'feed' ? laterFinds.find((f) => f.id === i.id) : businesses.find((b) => b.id === i.id)))
    .filter((c): c is DeckCard => !!c);
  return [...freshFinds, ...drafts, ...rest, ...followUps].slice(0, DECK_MAX);
}

/** "4.2★ (31)", "No website" — off the listing, never guessed. */
export function factsOf(d: Record<string, unknown> | null | undefined): string[] {
  const out: string[] = [];
  const rating = ratingOf(d);
  if (rating) out.push(rating);
  else if (d && Number(d.reviews_count) === 0 && d.rating != null) out.push('No reviews yet');
  const pains = Array.isArray(d?.pain_signals) ? (d!.pain_signals as unknown[]).map(String) : [];
  if (pains.includes('no_website')) out.push('No website');
  const role = typeof d?.role === 'string' && d.role.trim() ? d.role.trim() : null;
  if (role) out.push(role);
  return out.slice(0, MAX_FACTS);
}

/* ── How they can be reached ────────────────────────────────────────────── */

export type PhoneKind = 'mobile' | 'landline' | 'unknown';

/** The listing's country, as the scraper gave it. */
function countryOf(d: Record<string, unknown> | null | undefined): string | null {
  const c = d?.country_code;
  return typeof c === 'string' && /^[A-Za-z]{2}$/.test(c.trim()) ? c.trim().toUpperCase() : null;
}

/**
 * What a phone number is, when it can say. Philippine numbers can: a mobile is
 * 09XX locally and 639XX internationally, and everything else — 02 for Manila,
 * 032 for Cebu — is a landline, which WhatsApp and texts do not reach. Anywhere
 * else a number does not say, so both ways are offered.
 */
export function phoneKind(raw: string, country: string | null): { kind: PhoneKind; dial: string } {
  const d = raw.replace(/\D/g, '');
  if (/^639\d{9}$/.test(d)) return { kind: 'mobile', dial: `+${d}` };
  if (/^09\d{9}$/.test(d)) return { kind: 'mobile', dial: `+63${d.slice(1)}` };
  if (/^63[2-8]\d{7,9}$/.test(d)) return { kind: 'landline', dial: `+${d}` };
  if (country === 'PH') {
    if (/^9\d{9}$/.test(d)) return { kind: 'mobile', dial: `+63${d}` };
    if (/^0[2-8]\d{6,9}$/.test(d)) return { kind: 'landline', dial: `+63${d.slice(1)}` };
  }
  return { kind: 'unknown', dial: dialable(d) };
}

/**
 * A number as a phone dials it: with its country code when it carries one (the
 * scraper keeps it for most countries), as listed when it is written the local
 * way — "0281234567" is a Manila number to a phone in Manila, and "+0281…" is
 * nobody's.
 */
export function dialable(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.startsWith('0') || d.length < 10 ? d : `+${d}`;
}

export function phoneReach(raw: string | null | undefined, country: string | null): Reach[] {
  if (!raw || raw.replace(/\D/g, '').length < 7) return [];
  const { kind, dial } = phoneKind(raw, country);
  if (kind === 'landline') return [{ via: 'call', to: dial }];
  if (kind === 'mobile') return [{ via: 'whatsapp', to: dial }, { via: 'sms', to: dial }, { via: 'call', to: dial }];
  return [{ via: 'whatsapp', to: dial }, { via: 'call', to: dial }];
}

/**
 * A page a card may link to: http or https and nothing else. A listing's
 * website is whatever a scraper or a feed wrote, and an href of
 * "javascript:…" from one would run in this app's page.
 */
export function webUrl(u: string | null | undefined): string | null {
  const t = u?.trim();
  return t && /^https?:\/\/[^\s]+$/i.test(t) ? t : null;
}

const siteReach = (site: string | null | undefined): Reach[] => {
  const url = webUrl(site);
  return url ? [{ via: 'site', to: url }] : [];
};

export function businessReach(contact: { whatsapp?: string; email?: string; website?: string }, country: string | null): Reach[] {
  return [
    ...phoneReach(contact.whatsapp, country),
    ...(contact.email && /@/.test(contact.email) ? [{ via: 'email' as const, to: contact.email.trim() }] : []),
    ...siteReach(contact.website),
  ];
}

/** The channel a send is recorded on. A text and a call go to the same number WhatsApp does. */
export function channelOf(via: ReachVia): Channel | null {
  if (via === 'whatsapp' || via === 'sms' || via === 'call') return 'whatsapp';
  if (via === 'email') return 'email';
  return null;
}

/** What the right swipe says, for the way it goes. */
export const VIA_LABEL: Record<ReachVia, string> = {
  whatsapp: 'WhatsApp', sms: 'Text', call: 'Call', email: 'Email', site: 'Their site', post: 'Reply',
};

/**
 * The link that opens the message in the person's own app, filled in.
 *
 * `sms:` takes its body after `?&` — Android reads `?body=`, iOS reads `&body=`,
 * and both ignore the other half. A call carries no text: the message is what
 * to say, shown on the card while it rings. A site or a post opens as itself;
 * the message is copied first, since no page takes it through a link.
 */
export function reachLink(r: Reach, msg: { body: string; subject?: string | null }): string | null {
  const body = encodeURIComponent(msg.body);
  const digits = r.to.replace(/\D/g, '');
  switch (r.via) {
    case 'whatsapp': return digits.length >= 7 ? `https://wa.me/${digits}?text=${body}` : null;
    case 'sms': return digits.length >= 7 ? `sms:${r.to.startsWith('+') ? `+${digits}` : digits}?&body=${body}` : null;
    case 'call': return digits.length >= 7 ? `tel:${r.to.startsWith('+') ? `+${digits}` : digits}` : null;
    case 'email': {
      const q = new URLSearchParams();
      if (msg.subject) q.set('subject', msg.subject);
      q.set('body', msg.body);
      return /@/.test(r.to) ? `mailto:${r.to}?${q.toString().replace(/\+/g, '%20')}` : null;
    }
    default: return /^https?:\/\//i.test(r.to) ? r.to : null;
  }
}

/* ── What the server answers ────────────────────────────────────────────── */

/** A card's message, as the deck route returns it (deckstore.ts writeDeckDraft). */
export interface DeckDraft {
  body: string;
  subject: string | null;
  /** Who wrote it. `offer` is the template, and `note` says why it is not the model's. */
  from: 'model' | 'offer';
  note: string | null;
}

/** The right swipe, as the deck route returns it (deckstore.ts reachDeckCard). */
export interface DeckReach {
  /** `sent`: it went from their own number or address. `open`: their own app does it. */
  mode: 'sent' | 'open';
  /** The draft it became, for "did it go?" — none for a find or a website, which have no recipient. */
  actionId: string | null;
  link: string | null;
  error?: string | null;
}

/* ── The message on the card ────────────────────────────────────────────── */

/** How long each way's message may be. A text is read on a lock screen; a post reply can say more. */
export const DRAFT_MAX: Record<ReachVia, number> = { whatsapp: 600, sms: 450, call: 500, email: 1400, site: 900, post: 1100 };

export const DRAFT_SYSTEM = [
  'You write one message from a person to one business, or one reply to one post, that they will send as themselves.',
  'It has to read like they wrote it for this one: say what you noticed about them, what you do about it, and ask for one small next step.',
  '',
  'Rules:',
  '- Use only the facts given: the listing, the post, the offer, what they know about their own work. Never invent a client, a result, a number, a name or a link.',
  '- A number may appear only if it is written in what you were given. A price only if the offer states it.',
  '- Link: only the proof link, exactly as given, and only if one is given.',
  '- No placeholders, no brackets, no sign-off templates, no emoji walls, no "I hope this finds you well".',
  '- Plain and short. WhatsApp or a text: 2 to 4 sentences. A call: what to say in the first 20 seconds, then one question. Email: a subject and at most 120 words. A reply to a post or a job: answer exactly what they asked, at most 120 words.',
  '- Write in the language the post or listing is written in; English when unsure.',
  '',
  'Answer with JSON only: {"message": "...", "subject": "..."} — subject only for email.',
].join('\n');

export interface DraftInput {
  name: string;
  offer: Offer;
  /** What they know about their own work (working.ts workingBrief), or null. */
  working: string | null;
  area: string | null;
  card: Pick<DeckCard, 'kind' | 'title' | 'sub' | 'why' | 'facts' | 'post' | 'source' | 'followUp'>;
  via: ReachVia;
  /** For a follow-up, the first message, so the second one does not repeat it. */
  firstMessage?: string | null;
}

export function draftPrompt(i: DraftInput): string {
  const o = i.offer;
  const find = i.card.kind === 'find';
  return [
    `FROM: ${i.name}${i.area ? `, working in ${i.area}` : ''}.`,
    'WHAT THEY SELL:',
    [o.sells && `- sells: ${o.sells}`, o.for_who && `- for: ${o.for_who}`, o.problem && `- the problem it fixes: ${o.problem}`,
      o.price_band && `- price: ${o.price_band}`, o.proof_url && `- proof link: ${o.proof_url}`].filter(Boolean).join('\n'),
    i.working ? `WHAT THEY KNOW ABOUT THEIR OWN WORK:\n${i.working}` : null,
    '',
    find ? 'THE POST THEY ARE ANSWERING:' : 'THE BUSINESS:',
    `- ${i.card.title}${i.card.sub ? ` (${i.card.sub})` : ''}`,
    i.card.source ? `- found on: ${i.card.source}` : null,
    ...i.card.facts.map((f) => `- ${f}`),
    i.card.post ? `- the post: ${i.card.post}` : null,
    i.card.why.length ? `- why it was picked for them: ${i.card.why.join(' ')}` : null,
    '',
    i.card.followUp && i.firstMessage ? `THIS IS A FOLLOW-UP. Their first message, which had no answer:\n${i.firstMessage}\n` : null,
    `WRITE IT FOR: ${VIA_WORDS[i.via]}.`,
  ].filter((l) => l !== null).join('\n');
}

const VIA_WORDS: Record<ReachVia, string> = {
  whatsapp: 'a WhatsApp message',
  sms: 'a text message (SMS)',
  call: 'a phone call — what to say when they pick up',
  email: 'an email, with a subject',
  site: 'the contact form on their website',
  post: 'a reply to the post (or, for a job listing, a short application note)',
};

/**
 * What a model wrote, held to the rules before it reaches a card — or refused
 * with the reason, and the card falls back to the message written from the
 * offer and says why.
 *
 * The number rule is the one that matters. The message goes out under the
 * person's name, so "we helped 40 clinics" in it is them claiming it
 * (invariant 2). A number survives only if its digits are in something they
 * were given — the offer, the listing, the post — compared without separators,
 * as valueFromItem does for a find's price. Durations are the one exception
 * ("a 10-minute call"): they are an ask, not a claim.
 */
export function checkDraft(raw: string, subjectRaw: string | null, sources: string[], via: ReachVia, proofUrl?: string | null):
  { ok: true; body: string; subject: string | null } | { ok: false; why: string } {
  let body = raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const subject = via === 'email' ? (subjectRaw?.trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, 140) || null) : null;
  if (!body) return { ok: false, why: 'the model wrote nothing' };
  if (/\[[^\]]{0,40}\]|\{\{|\}\}|<[a-z][^>]*>|\b(your name|company name|business name)\b/i.test(body)) {
    return { ok: false, why: 'it left a placeholder in the message' };
  }
  // The proof link is the only one a message may carry: a link the person did
  // not give is a page they have not seen, going out under their name.
  const proof = proofUrl ? urlKey(proofUrl) : null;
  for (const url of body.match(/\b(?:https?:\/\/|www\.)[^\s)]+/gi) ?? []) {
    if (!proof || urlKey(url) !== proof) return { ok: false, why: `it put in a link you did not give (${url.replace(/[.,;:!?]+$/, '').slice(0, 60)})` };
  }
  const haystack = sources.join(' ').replace(/[,\s_]/g, '');
  // A duration or a time of day is an ask ("a 10-minute call", "at 3pm"), not a claim.
  const text = body
    .replace(/\b\d{1,2}\s?-?\s?(?:min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi, '');
  for (const n of text.match(/\d[\d,.]*/g) ?? []) {
    const digits = n.replace(/[,.]+$/, '').replace(/,/g, '');
    if (!digits || /^[.]/.test(digits)) continue;
    if (!haystack.includes(digits.replace(/\.\d+$/, '')) && !haystack.includes(digits)) {
      return { ok: false, why: `it wrote a number that is not in your offer or their listing (${n.replace(/[,.]+$/, '')})` };
    }
  }
  const max = DRAFT_MAX[via];
  if (body.length > max) {
    // Cut at the last sentence that fits; a message cut mid-sentence is not sent.
    const cut = body.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf('.\n'), cut.lastIndexOf('?\n'));
    if (end < max * 0.5) return { ok: false, why: 'it wrote more than fits' };
    body = cut.slice(0, end + 1).trim();
  }
  return { ok: true, body, subject };
}

/** Everything a draft may take a number or a word from. */
export function draftSources(i: DraftInput): string[] {
  const o = i.offer;
  return [o.sells, o.for_who, o.problem, o.price_band, o.proof_url, i.working, i.card.title, i.card.sub, i.card.post, ...i.card.why, ...i.card.facts, i.firstMessage, i.area]
    .filter((s): s is string => typeof s === 'string' && !!s);
}

/**
 * The message for a find when no model writes one: short, in the person's own
 * offer's words, and honest about being a reply to what they posted. The one
 * for a business is openerTemplate (agent/starter.ts), as the Draft button uses.
 */
export function findReplyTemplate(name: string, offer: Offer, card: Pick<DeckCard, 'title' | 'group'>): string {
  const first = name.split(' ')[0] || name;
  const what = offer.sells?.trim();
  const job = card.group === 'work';
  const opening = job ? `Hi — I'd like to be considered for this.` : `Hi — saw your post and this is exactly what I do.`;
  const middle = what ? ` I ${/^(build|make|set up|design|write|run|help|do|create|fix|automate|manage)\b/i.test(what) ? what : `work on ${what}`}${offer.for_who ? ` for ${offer.for_who}` : ''}.` : '';
  const proof = offer.proof_url ? ` An example: ${offer.proof_url}` : '';
  return `${opening}${middle}${proof} Happy to share more — what would be most useful? — ${first}`;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** A link compared as a person would: no scheme, no www, no trailing slash or full stop, any case. */
function urlKey(u: string): string {
  return u.trim().replace(/[.,;:!?]+$/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '') || null; } catch { return null; }
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+\n/g, '\n').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${cut.slice(0, at > max * 0.7 ? at : max).trim()}…`;
}
