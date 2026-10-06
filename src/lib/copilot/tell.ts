// src/lib/copilot/tell.ts
// What was said into the mic, sorted into the record it belongs to.
//
// Why. The corner mic only understood money: "coffee 130" opened the book
// filled in, and anything else said into it was read as a move with no amount.
// Its owner asked for more — talk to the app the way you would to a person —
// and the honest version of that is not a chat. An assistant you talk ideas
// over with is what Claude and ChatGPT already are, better than this app would
// build one and given away (DIRECTION.md, the survival test). What only this
// app can do is put what you said into rows: a conversation, a sale, a meeting,
// a change to the offer, a note the plan is redrawn from. So the mic sorts, and
// every sort opens the sheet that kind already had, filled in, with the words
// shown above it. Keeping it is still the person's tap.
//
// What a model may do here is smaller than anywhere else in the app. It says
// which kind of record a sentence is, and copies details out of it; it never
// answers, advises or adds. Every detail is held to the words (invariant 2): a
// name or a quote that does not appear in what was said is dropped, an amount
// has to be one the person said, the day comes from the app's own reading of
// the words and never from the model, and a note is kept in the person's words
// — never a model's rewrite of them, which would be a third source the working
// file does not have (invariant 12). How a conversation ended and whether they
// have the problem are the model's proposals, shown as chips already picked for
// the person to change before they keep it.
//
// Without a model, the app's own rules sort what they can and ask about the
// rest: a chooser with the words, never a guess. A model that fails says why on
// the sheet, and the rules sort that one (invariant 13).
//
// Pure: no DB import, no model call. The route (api/copilot/tell) makes the
// call; the shell (CopilotApp2) opens the sheet.

import { COMMITMENTS, PROBLEMS, SAID_MAX, TALK_BACK_DAYS, WHO_MAX, type Commitment, type Problem } from './lab';
import { shiftDay } from './focus';
import { parseSpoken } from './money/spoken';

export const TOLD_KINDS = ['money', 'talk', 'sale', 'meeting', 'offer', 'note', 'question'] as const;
export type ToldKind = (typeof TOLD_KINDS)[number];

/** Said words the reader takes. A breath is a sentence or two; past this it is a dictated document, and the plan's own box takes those. */
export const HEARD_MAX = 600;
/** A note kept from the mic, as the plan's box keeps one (api/copilot/context). */
export const NOTE_MAX = 2000;

export const OFFER_FIELDS = ['sells', 'for_who', 'problem', 'price_band'] as const;
export type OfferField = (typeof OFFER_FIELDS)[number];
/** The offer sheet's own limits, so a field read from the words always fits the field it lands in. */
const OFFER_MAX: Record<OfferField, number> = { sells: 240, for_who: 120, problem: 240, price_band: 60 };

export interface ToldTalk {
  who: string | null;
  problem: Problem | null;
  commitment: Commitment | null;
  /** Their words, as they appear in what was said. */
  said: string | null;
  /** The day, when one was said; null is today. */
  on: string | null;
}

export interface ToldSale {
  who: string | null;
  /** As the amount field takes it ("150"); only an amount that was said. */
  amount: string | null;
  /** A currency said beside the amount; null keeps the sheet's own. */
  currency: string | null;
  on: string | null;
}

export type ToldOffer = Partial<Record<OfferField, string>>;

export type Told =
  | { kind: 'money' }
  | { kind: 'question' }
  | { kind: 'talk'; talk: ToldTalk }
  | { kind: 'sale' | 'meeting'; sale: ToldSale }
  | { kind: 'offer'; offer: ToldOffer }
  | { kind: 'note'; note: { content: string } };

/**
 * Who sorted it — a model, the app's rules, or the person picking the kind on
 * the chooser — and, where it was not the model that was asked, why. Said on
 * the sheet.
 */
export interface ToldMeta {
  heard: string;
  by: 'model' | 'rules' | 'you';
  why: string | null;
}

/** A sort, or null when it could not be told: the chooser asks. */
export interface Reading {
  meta: ToldMeta;
  told: Told | null;
}

/* ─── Reading the words ───────────────────────────────────────────────────── */

/** The words as one line, cut where the reader stops. */
export function cleanHeard(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, HEARD_MAX) : '';
}

/** For comparing: lower case, letters and digits only, single spaces. */
const flat = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * What the app itself reads off the words, with no model: the amounts said,
 * the currency beside the first, and the day — the money reader's own, so a
 * day reads the same in every sheet the mic opens.
 */
export function spokenFacts(heard: string, today: string): { amounts: string[]; currency: string | null; on: string | null } {
  const m = parseSpoken(heard, { categories: { out: [], in: [] }, today });
  const amounts = [m.amount, ...m.more.map((n) => String(Math.round(n * 100) / 100))].filter((a): a is string => !!a);
  // A day said for something logged now is one already lived, and inside the
  // month a conversation can still be logged for.
  const on = m.onSaid && m.on <= today && m.on >= shiftDay(today, -TALK_BACK_DAYS) ? m.on : null;
  return { amounts, currency: m.amount ? m.currency : null, on };
}

/** A detail copied out of the words, kept only when it is in them: a name or a quote nobody said is not a detail, it is an invention. */
export function inWords(v: unknown, heard: string, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').replace(/\s+/g, ' ');
  if (!s || s.length > max) return null;
  const f = flat(s);
  return f && ` ${flat(heard)} `.includes(` ${f} `) ? s : null;
}

// Only the words that open a question and almost never a statement: "was at
// the market", "have a call with Joel" and "will call Mara" are things told.
const QUESTION = /^(how|what|whats|what's|who|whom|whose|when|why|which|where|should|do|does|did|is|are|am)\b/i;
/** Asked, not told. Recognition rarely writes a question mark, so the first word decides as often as the last mark. */
export function isQuestion(heard: string): boolean {
  return /\?\s*$/.test(heard) || QUESTION.test(heard.trim());
}

/** A conversation, said as one: who it was with comes after "to" or "with". */
const TALK = /\b(talked|talk to|spoke|spoken|chatted|chat with|met with|met|had a call|call with|called|conversation with|meeting with)\b/i;
/** A meeting the funnel counts: booked, or on the calendar. */
const MEETING = /\b(booked|scheduled|set up)\b.*\b(call|meeting|demo)\b|\b(call|meeting|demo)\b.*\b(booked|scheduled)\b|\b(have|got) a (call|meeting|demo) with\b/i;
/**
 * A customer paying for what is sold. "Paid" alone is spending ("paid rent
 * 12000"), "sold my old phone" is money in, and "deposit 5000 to savings" is a
 * transfer — so only the ways of saying it that name a buyer.
 */
const SALE = /\b(paid me|bought from me|closed (?:a |the )?deal|sold (?:[\p{L}\p{N}]+ ){0,4}to|deposit from|got a deposit|invoice (?:was )?paid|new client|signed (?:up |on )?(?:a |the |my |our )?(?:client|customer|deal))\b/iu;
/** Somebody else paid: "Pia paid 150". Not "I", not a word that only leads into "paid". */
const SOMEONE_PAID = /\b([\p{L}][\p{L}'’.-]*)\s+paid\b/iu;
const NOT_A_PAYER = new Set(['i', 'we', 'just', 'already', 'also', 'then', 'and', 'finally', 'have', 'has', 'had', 'was', 'got', 'been', 'is', 'not', 'never', 'still', 'you']);
/** The offer, changed: its price, or what it is and for whom. */
const OFFER = /\b(my price|price to|new price|raised? (?:my |the )?price|lowered? (?:my |the )?price|i charge|charge \w+ now|my offer|the offer|i (?:now )?sell)\b/i;

function someonePaid(heard: string): string | null {
  const m = heard.match(SOMEONE_PAID);
  return m && !NOT_A_PAYER.has(m[1].toLowerCase()) ? m[1] : null;
}

/** Words that only money moves are said with. A figure alone is not one: "sent 20 messages" has a number in it and no money. */
const MONEY_WORD = /\b(spent|spend|paid|pay|bought|buy|salary|sweldo|received|income|refund(?:ed)?|bill|rent|load|fare|gas|fuel|grocer\w*|coffee|lunch|dinner|breakfast|snack\w*|food|grab|taxi|uber|transfer\w*|withdr[ae]w\w*|atm|fee|fees|came in|got paid|deposit(?:ed)?|savings?|saved|cash|sold|earned)\b/i;

/**
 * Said like a money move and nothing else: an amount, said with a money word,
 * a currency or one of the person's own categories, and none of the words that
 * make it a sale, a conversation, a change of price or a question. The
 * corner's commonest use waits on no model — "coffee 130" opens the book as it
 * always has. Anything that could be more goes to the sort, where a money move
 * costs a second and anything else is not filed as spending.
 */
export function clearlyMoney(heard: string, today: string, categories: { out: string[]; in: string[] } = { out: [], in: [] }): boolean {
  if (!heard || isQuestion(heard)) return false;
  if (TALK.test(heard) || MEETING.test(heard) || SALE.test(heard) || OFFER.test(heard) || someonePaid(heard)) return false;
  const m = parseSpoken(heard, { categories, today });
  return !!m.amount && (!!m.category || !!m.currency || MONEY_WORD.test(heard));
}

const NAME_STOP = new Set([
  'she', 'he', 'they', 'who', 'and', 'about', 'yesterday', 'today', 'tomorrow', 'tonight', 'this', 'last', 'next', 'later', 'on', 'at', 'for',
  'that', 'said', 'says', 'told', 'we', 'i', 'it', 'but', 'so', 'because', 'her', 'his', 'their', 'again', 'wants', 'want', 'paid', 'is', 'was',
]);
/**
 * Who it was, as the rules read it: the words after "to", "with" or "from", up
 * to where the sentence moves on — a figure, a day, a "she said". Four words
 * at most: "Joel from Rapid Pest" is a name; a clause is not.
 */
function namedAfter(heard: string, preps: string): string | null {
  const m = heard.match(new RegExp(`\\b(?:${preps})\\s+([^,.;!?]+)`, 'i'));
  if (!m) return null;
  const out: string[] = [];
  for (const w of m[1].trim().split(/\s+/)) {
    if (NAME_STOP.has(w.toLowerCase()) || /\d/.test(w) || out.length >= 4) break;
    out.push(w);
  }
  const who = out.join(' ').trim();
  return who && who.length <= WHO_MAX ? who : null;
}
const talkedWith = (heard: string) => namedAfter(heard, 'to|with');

/**
 * A meeting's day is the day it was booked or held. "Booked a demo for
 * Thursday" was booked today — the Thursday it is for is not the day it
 * counts — so a booking keeps today, and only one said as held takes its day.
 */
const meetingDay = (heard: string, on: string | null): string | null => (/\b(booked|scheduled|set up|have a|got a)\b/i.test(heard) ? null : on);

/** A sale's amount when more than one figure was said: the largest — "sold 3 stickers to Joel for 450" sold for 450, not for 3. */
const saleAmount = (amounts: string[]): string | null => (amounts.length ? amounts.reduce((a, b) => (Number(b) > Number(a) ? b : a)) : null);

/**
 * The app's own sort, with no model: what the rules can tell, and null for
 * what they cannot — the chooser asks then, rather than the rules guessing.
 * A statement long enough to be one is a note: the plan reads it, and nothing
 * is counted from it.
 */
export function readByRules(heard: string, today: string, categories?: { out: string[]; in: string[] }): Told | null {
  if (!heard) return null;
  const facts = spokenFacts(heard, today);
  if (isQuestion(heard)) return { kind: 'question' };
  if (MEETING.test(heard)) return { kind: 'meeting', sale: { who: talkedWith(heard), amount: null, currency: null, on: meetingDay(heard, facts.on) } };
  if (TALK.test(heard)) return { kind: 'talk', talk: { who: talkedWith(heard), problem: null, commitment: null, said: null, on: facts.on } };
  const payer = someonePaid(heard);
  if ((payer || SALE.test(heard)) && facts.amounts.length) {
    return { kind: 'sale', sale: { who: payer ?? namedAfter(heard, 'to|from'), amount: saleAmount(facts.amounts), currency: facts.currency, on: facts.on } };
  }
  if (OFFER.test(heard) && /\b(price|charge)\b/i.test(heard) && facts.amounts.length) return { kind: 'offer', offer: { price_band: facts.amounts[0] } };
  if (clearlyMoney(heard, today, categories)) return { kind: 'money' };
  const n = heard.split(/\s+/).length;
  // A figure with nothing to say what it is — "Juan 500" — is asked about,
  // not filed as spending; a sentence is a note the plan reads.
  if (n >= 4) return { kind: 'note', note: { content: heard.slice(0, NOTE_MAX) } };
  return null;
}

/**
 * One kind, read from the words by the rules: what the chooser opens when the
 * person says which kind it was. Never null — the sheet takes it from there.
 */
export function toldAs(kind: ToldKind, heard: string, today: string): Told {
  const facts = spokenFacts(heard, today);
  switch (kind) {
    case 'money': return { kind };
    case 'question': return { kind };
    case 'talk': return { kind, talk: { who: talkedWith(heard), problem: null, commitment: null, said: null, on: facts.on } };
    case 'sale': return { kind, sale: { who: someonePaid(heard) ?? namedAfter(heard, 'to|from'), amount: saleAmount(facts.amounts), currency: facts.currency, on: facts.on } };
    case 'meeting': return { kind, sale: { who: talkedWith(heard), amount: null, currency: null, on: meetingDay(heard, facts.on) } };
    case 'offer': return { kind, offer: facts.amounts.length && /\bprice|charge\b/i.test(heard) ? { price_band: facts.amounts[0] } : {} };
    case 'note': return { kind, note: { content: heard.slice(0, NOTE_MAX) } };
  }
}

/* ─── What a model is asked ───────────────────────────────────────────────── */

export const TELL_SYSTEM = [
  'You sort one thing a small business owner said out loud into the record it belongs to.',
  'You never answer it, advise, or add anything: you only say which kind of record it is and copy the details that were said.',
  'Copy names and words exactly as they appear in the text. Never invent a name, a number, a quote or a day. A detail that was not said is null.',
  'Answer with JSON only.',
].join(' ');

const KIND_HELP: Record<ToldKind, string> = {
  money: 'spending, or money in that is not a customer paying for what they sell: coffee, rent, a bill, a salary, a transfer',
  talk: 'a conversation they had with someone — a possible buyer, someone who sells to their buyers, someone who knows people — and how it ended',
  sale: 'a customer paid them for what they sell',
  meeting: 'a meeting, call or demo with a possible buyer was booked or held',
  offer: 'they changed what they sell, who it is for, the problem it solves, or their price',
  note: 'anything else true about their business or their life that should change their plan',
  question: 'they asked something',
};

/** The prompt: the words, the day and the offer they are read against, and the shape of an answer. */
export function tellPrompt(heard: string, c: { today: string; weekday: string; offer: { sells?: string | null; for_who?: string | null; price_band?: string | null } }): string {
  const o = c.offer;
  return [
    `Today is ${c.weekday} ${c.today}.`,
    o.sells ? `What they sell: ${o.sells}${o.for_who ? `, for ${o.for_who}` : ''}${o.price_band ? `, at ${o.price_band}` : ''}.` : 'They have not said what they sell yet.',
    '',
    'What they said:',
    `"${heard}"`,
    '',
    'Kinds:',
    ...TOLD_KINDS.map((k) => `- "${k}": ${KIND_HELP[k]}`),
    '',
    'For "talk": "who" (the person or business, as said), "said" (their words, copied exactly, or null), "problem" (one of "yes", "no", "unasked": whether they have the problem the owner fixes), "commitment" (one of "none", "time", "intro", "money": another call, an introduction, money, or nothing).',
    'For "sale" and "meeting": "who", and for a sale "amount" (a number, as said) and "currency" (only if said).',
    'For "offer": "offer": {"sells", "for_who", "problem", "price_band"}, each only if they said it, in their words.',
    '',
    'Return {"kind": "...", "who": ..., "said": ..., "problem": ..., "commitment": ..., "amount": ..., "currency": ..., "offer": {...}}',
  ].join('\n');
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const digits = (s: string) => s.replace(/[^\d]/g, '');

/**
 * A model's sort, held to the words. The kind is the model's; every detail is
 * checked against what was said, and the day is the app's reading, never the
 * model's. Null when the kind is not one there is, or an offer that changes
 * nothing that was said — the rules sort it then.
 */
export function normalizeTold(raw: unknown, c: { heard: string; today: string }): Told | null {
  const o = obj(raw);
  const kind = oneOf(TOLD_KINDS, o.kind);
  if (!kind) return null;
  const facts = spokenFacts(c.heard, c.today);
  switch (kind) {
    case 'money':
    case 'question':
      return { kind };
    case 'note':
      // The person's words, as said: a model's rewrite of a note is a view of
      // the business the working file has no tier for (invariant 12).
      return { kind, note: { content: c.heard.slice(0, NOTE_MAX) } };
    case 'talk':
      return {
        kind,
        talk: {
          who: inWords(o.who, c.heard, WHO_MAX),
          said: inWords(o.said, c.heard, SAID_MAX),
          problem: oneOf(PROBLEMS, o.problem),
          commitment: oneOf(COMMITMENTS, o.commitment),
          on: facts.on,
        },
      };
    case 'sale':
    case 'meeting': {
      // An amount the model gives must be one the words carry; failing that,
      // the one the app read off them, or none.
      const given = typeof o.amount === 'number' || typeof o.amount === 'string' ? String(o.amount).replace(/,/g, '') : '';
      const said = given && facts.amounts.find((a) => Number(a) === Number(given)) ? facts.amounts.find((a) => Number(a) === Number(given))! : null;
      return {
        kind,
        sale: {
          who: inWords(o.who, c.heard, WHO_MAX),
          amount: kind === 'sale' ? said ?? saleAmount(facts.amounts) : null,
          currency: kind === 'sale' ? facts.currency : null,
          on: kind === 'meeting' ? meetingDay(c.heard, facts.on) : facts.on,
        },
      };
    }
    case 'offer': {
      const given = obj(o.offer);
      const offer: ToldOffer = {};
      for (const f of OFFER_FIELDS) {
        const v = given[f];
        if (typeof v !== 'string' || !v.trim()) continue;
        if (f === 'price_band') {
          // A price is held by its figures: "$200" said as "two hundred" is
          // still not a price anybody can find in the words, so it goes.
          const p = v.trim();
          const fig = digits(p);
          if (fig && p.length <= OFFER_MAX[f] && facts.amounts.some((a) => digits(a) === fig || digits(a.replace(/\.0+$/, '')) === fig)) offer[f] = p;
        } else {
          const w = inWords(v, c.heard, OFFER_MAX[f]);
          if (w) offer[f] = w;
        }
      }
      return Object.keys(offer).length ? { kind, offer } : null;
    }
  }
}

/* ─── A sale or a meeting, on its day ─────────────────────────────────────── */

/**
 * The instant an outcome said for a past day is kept at: noon UTC of that day,
 * as the money book keeps a statement's day — the same calendar day for every
 * zone within eleven hours of UTC, which is every zone a bet reads it in but
 * the Pacific's edge. Today, or no day, is now. A day ahead or past the month
 * a conversation can be logged for is refused.
 */
export function occurredOn(on: unknown, today: string): { ok: true; at: string | null } | { ok: false; error: string } {
  if (on == null || on === '' || on === today) return { ok: true, at: null };
  if (typeof on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(`${on}T00:00:00Z`))) return { ok: false, error: 'That is not a day.' };
  if (on > today) return { ok: false, error: 'That day has not happened yet.' };
  if (on < shiftDay(today, -TALK_BACK_DAYS)) return { ok: false, error: `Only the last ${TALK_BACK_DAYS} days can be logged.` };
  return { ok: true, at: `${on}T12:00:00.000Z` };
}

/** What each kind is called where the sheet asks "not a …?". */
export const TOLD_LABEL: Record<ToldKind, string> = {
  money: 'Money', talk: 'A conversation', sale: 'A sale', meeting: 'A meeting', offer: 'A change to your offer', note: 'A note for your plan', question: 'A question',
};
