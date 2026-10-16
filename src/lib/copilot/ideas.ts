// src/lib/copilot/ideas.ts
// Ideas for a bet, written by a model for this business, from its own record.
//
// Why. The catalogue of plays (lab.ts PLAYS) is the same for everybody: open
// Proof twice and it says the same thing twice, whatever happened in between.
// Its owner asked for the tab to be powered by AI so it is not always the same.
// So for the part of the business being worked on, a model is shown what the
// person wrote and what the rows show — the chain's verdict on that part with
// its numbers, the bets already run and how each ended, the conversations
// logged, who they were with and what those people said — and asked for three
// plays that fit this business now, each with a count it can be judged on.
// What people said is what a catalogue can never hold, and it is the person's
// own record: an idea built on a buyer's words fits this business and no other.
//
// What a model may and may not do here is the app's usual rule (DIRECTION.md):
// it proposes, the rows judge. An idea is a proposal the person turns into a
// bet or ignores; its pass line is theirs to change before it starts; nothing it
// says becomes context about the business (invariant 12), and its reason for an
// idea is dropped when it cites a number the person never gave (invariant 2).
// Every idea is held to the rules a bet is held to (lab.ts) before it is kept,
// so any idea on screen can become a bet as it stands.
//
// Written, then read again. Six candidates are written and a second call reads
// them as a skeptical operator would before three are kept (writeIdeaSet): its
// owner's first set offered a United States loan program to a founder in Manila
// and two ideas that were one idea, and both read as fine to the model that
// wrote them. The review sets aside what cannot work where the person is, what
// already failed, what one person cannot start this week and what repeats
// another idea; a rule then keeps one idea per mechanism, so three bets are
// three different causes and a fail of one says something the others cannot.
// It only sets aside: the order is still the writer's, and which bet comes
// first is still a rule over it (proof.ts nextBet) — a second call choosing
// the move is what DIRECTION.md declined.
//
// Each idea carries the claim it tests in the person's voice (`belief`), so the
// card says what the play tests rather than the part's one sentence for every
// play — held to ideaBeliefOf (lab.ts) before it can become a bet's belief.
//
// Pure: no DB import, and no model import — the caller passes the call in
// (writeIdeaSet's `ask`), so the whole write is tested with a stand-in and
// scripts/copilot-ideas-eval.ts runs it on fixtures with a real one. proofai.ts reads
// the record, runs the search, makes the calls and stores what was kept.

import { ASSET_KINDS, numberOutside, type AssetKind } from './assets';
import { LINK_LABEL, type BusinessLink, type LinkKey } from './business';
import { extractJson } from './agent/schema';
import {
  BET_DAYS_MAX, HEARD_ROLES_NOTE, IDEA_HOW_MAX, IDEA_LABEL_MAX, IDEA_REASON_MAX, LAB_METRICS, PLANNED_MAX, PLAY_BOOKS, TALK_BACK_DAYS, TALK_ROLES, TALK_ROLE_LABEL,
  TARGET_MAX, TRIES_FOR, ideaBeliefOf, isBuyer, metricsFor, playLine, unitOf, type BetView, type Idea, type LabMetric, type Talk, type TalkRole,
} from './lab';
import { citedSources, evidenceLines, rankIdeas, type Evidence, type IdeaResearch } from './idearesearch';
import { FOUND_BY_LABEL } from './offer';
import { secondPerson } from './you';
import type { FoundBy, Offer } from './types';

/** Ideas kept per ask. Three is a choice; ten is homework. */
export const IDEAS_PER_ASK = 3;
/** Ideas written per ask, for the review to keep three of: twice as many, so setting half aside still leaves a choice. */
export const IDEA_CANDIDATES = 6;

/**
 * How an idea gets its result: the cause it works through. Two ideas through
 * one cause are one idea said twice — "ask advisers for introductions" and
 * "talk to people who sell to founders" both borrow somebody else's trust — and
 * a fail of one says what a fail of the other would. The model tags each; a
 * rule keeps the first of each (oneEach). "other" says nothing about sameness,
 * so it is never treated as a repeat.
 */
export const IDEA_MECHANISMS = ['warm', 'clients', 'partners', 'community', 'content', 'direct', 'events', 'listing', 'offer', 'free', 'ask', 'proof', 'process', 'other'] as const;
export type IdeaMechanism = (typeof IDEA_MECHANISMS)[number];
const MECHANISM_HELP: Record<IdeaMechanism, string> = {
  warm: 'people you already know personally',
  clients: 'your past or current clients: their referrals, reviews or more work',
  partners: 'people who already serve your buyers and can introduce or recommend you',
  community: 'groups, forums and threads where your buyers already talk',
  content: 'what you publish yourself: posts, videos, articles, a newsletter',
  direct: 'messages, calls or visits to people who do not know you yet',
  events: 'meetups, talks, workshops and fairs, in person or online',
  listing: 'directories, marketplaces, maps, your own page or profile',
  offer: 'what you sell: its price, package, trial or guarantee',
  free: 'something free that shows the work: a sample, an audit, a tool',
  ask: 'how a conversation is run: the questions, the ask, the follow-up',
  proof: 'what buyers can check: results, testimonials, a demo',
  process: 'how the work gets done: templates, tools, help, fewer steps',
  other: 'none of these',
};

/** An idea as written, before three are kept: with the cause it works through. */
export type Candidate = Idea & { mechanism: IdeaMechanism };

/** Books a model may name as the source of an idea: the catalogue's, and a few more of the same kind — playbooks with things to do, not ways of thinking. */
export const IDEA_BOOKS: string[] = [
  ...PLAY_BOOKS,
  'Running Lean', 'The 1-Page Marketing Plan', 'Obviously Awesome', 'The Personal MBA', 'This Is Marketing',
  'Influence', 'Company of One', 'Contagious', 'Hooked', 'Zero to One',
];

export interface IdeasContext {
  part: LinkKey;
  offer: Offer;
  foundBy: FoundBy | null;
  /** The working file as the person wrote it. */
  working: string | null;
  /** The chain, as Proof shows it: each part's state, rule and facts. */
  links: Array<Pick<BusinessLink, 'key' | 'label' | 'state' | 'why' | 'facts'>>;
  /** Bets already run, newest first: what was tried and how the rows judged it. */
  bets: Array<Pick<BetView, 'state' | 'result'> & { belief: string; part: LinkKey; line: string }>;
  /** Conversations with possible buyers, all time (talkTotals). */
  talks: { n: number; problem: number; committed: number };
  /** The last month's conversations by who they were with (lab.ts talkCounts). */
  coverage?: Record<TalkRole, number> | null;
  /** What people said, newest first, as lab.ts heardLine writes it. */
  heard?: string[];
  /**
   * The tests already kept on the shelf, so an idea is not written that the person
   * has already written down: their belief, and the play's name where a book or the
   * app's own ideas gave it. A play that came in as a shared reply is not named — a
   * chat's words are never shown to a model (invariants 2 and 12).
   */
  shelf?: Array<{ belief: string; play: string | null }>;
  /** Kinds of asset the business already has. */
  assets: AssetKind[];
  /**
   * What others did, from the search run for this set (idearesearch.ts). Null
   * when none ran, said to the model as none; left out, nothing is said — the
   * prompt as it was before searches.
   */
  research?: IdeaResearch | null;
  /**
   * Where the business is (the profile's location) and where it sells, when
   * that is said and somewhere else (its target area). Programs, platforms and
   * events are national or local: "talk to an SBA counselor" is advice for a
   * founder in Ohio, and was given to one in Manila. Left out, nothing is said.
   */
  place?: { based: string | null; area: string | null } | null;
}

export const IDEAS_SYSTEM = [
  'You suggest experiments for a small business owner: things to try in the next one to three weeks, each judged by a count.',
  'Each idea is concrete: what to do, to whom, and the one count that would show it worked, with a pass line set before it starts.',
  // Two kinds of knowledge, kept apart: the business's facts are only what the
  // record says; how businesses like it win customers is what the model knows
  // and what the pages show. "Use only what you are told" kept every idea
  // inside the record, and its owner asked how it could know what works anywhere else.
  'About this business, use only what you are told: never invent a fact, a customer or a number about it.',
  'About how businesses like it win and keep customers, use what is known — proven playbooks, what others did, cause and effect — and the pages given, citing the ones an idea rests on.',
  // A program, platform or event is somewhere: what works for a founder in Ohio
  // can be no use at all in Manila, and a page found on the web is usually American.
  'Only suggest programs, institutions, platforms, events and places that exist and are used where the owner is based or sells; a government or local program from another country is no use to them. Where they have not said where they are, suggest nothing that depends on a place.',
  'Do not repeat an idea the record shows was already tried and did not pass, unless you change what made it fail.',
  'Where the owner logged what people said, start from it: an idea that answers something a buyer said beats one that could be for anybody.',
  'Where few conversations are logged, or all with one kind of person, one idea may be to talk to the people around the money the owner has not: buyers, people who sell to them, people who run the work, people already earning from them, people who know them.',
  'Make the ideas different from each other: each works through a different mechanism, so a fail of one teaches something the others cannot.',
  'Never invent a number about the business: no rates, results or figures it did not give you. A number one person said is what they said, not a rate. The pass line is your proposal and the owner can change it.',
  'For each idea say how it would work — the cause it relies on — and what a fail would tell the owner, so the count teaches something either way.',
  // The claim is what the bet is filed under once it starts: the part's one
  // sentence stood over every idea, so a fail of "ask advisers for introductions"
  // would have been recorded against "they find me online".
  'Give each idea its belief: the claim it tests, as the owner would say it about their own business — in their voice (I, me, my), with no numbers, which belong in the pass line.',
  'List the ideas best first: the one you would run first given the weakest part, what it costs, and how soon it gives an answer.',
  // The screen reads these to the person: "the owner knows" read as a report about somebody else.
  'Write label, how, why, works and fails to the owner as "you" and "your", never "the owner"; the belief alone is in their own voice.',
  'Name a book only when the idea is genuinely that book\'s, and only from the list given; otherwise use null.',
  'Answer with JSON only.',
].join(' ');

/** The prompt: the part, the business in its own words, the rows, what was tried, and the shape of an answer. */
export function ideasPrompt(c: IdeasContext): string {
  const allowed = metricsFor(c.foundBy);
  const metricLines = allowed.map((m) => `- "${m}": ${METRIC_HELP[m]}`);
  const part = c.links.find((l) => l.key === c.part);
  return [
    `Suggest ${IDEA_CANDIDATES} experiments on one part of this business: ${LINK_LABEL[c.part].toLowerCase()}.`,
    part ? `How that part stands now: ${part.state}. ${part.why}${part.facts ? ` (${part.facts})` : ''}` : null,
    ...contextLines(c),
    '',
    'Counts an idea can be judged on (use these keys exactly):',
    ...metricLines,
    'For "logged", also give "unit": the plural word for what the owner counts by hand, like "sign-ups" or "enquiries".',
    `An idea may give "tries": what it takes, as {"metric": one key, "planned": number}, only when that count comes before the main one (${triesLine(allowed)}), and never fewer than the pass line.`,
    `It may give "prep": an asset to draft first, as {"label": "...", "asset": one of ${ASSET_KINDS.map((k) => `"${k}"`).join(', ')}}.`,
    'The mechanism, the cause an idea works through (one key each, a different one for each idea where you can):',
    ...IDEA_MECHANISMS.map((m) => `- "${m}": ${MECHANISM_HELP[m]}`),
    `Books you may name: ${IDEA_BOOKS.join('; ')}.`,
    '',
    'Return {"ideas": [{"label": "short name, starting with a verb or a noun", "how": "what to do, in one or two sentences", "belief": "the claim it tests, in the owner\'s own voice: I, me, my; no numbers", "mechanism": "...", "metric": "...", "unit": "...", "target": number, "tries": {...}, "days": number, "book": "..." or null, "why": "one sentence on why this, from the record above", "works": "one sentence: the cause it relies on", "fails": "one sentence: if it does not pass, what that says", "sources": [page numbers it rests on], "prep": {...}}], "first_why": "one sentence on why the first idea is the one to run now"}',
    'Every sentence is to the owner, as "you" — except the belief, which is theirs.',
  ].filter((l): l is string => l !== null).join('\n');
}

/**
 * What both calls read about the business: its own words, where it is, the
 * chain, the conversations and what people said, what was tried and kept, and
 * the pages. The writer and the review are shown the same record, so the
 * review judges the ideas against what they were written from.
 */
function contextLines(c: IdeasContext): Array<string | null> {
  const o = c.offer;
  return [
    '',
    'The business, in the owner\'s words:',
    `- Sells: ${o.sells ?? ''}`,
    o.for_who ? `- To: ${o.for_who}` : null,
    o.problem ? `- The problem it solves: ${o.problem}` : null,
    o.price_band ? `- Price: ${o.price_band}` : null,
    `- How buyers find them: ${c.foundBy ? FOUND_BY_LABEL[c.foundBy] : 'not said'}`,
    ...placeLines(c.place),
    c.working ? `\nWhat the owner wrote about how they work:\n${c.working}` : null,
    '\nThe whole chain, as the app reads it from the rows:',
    ...c.links.map((l) => `- ${l.label}: ${l.state}. ${l.why}`),
    c.talks.n ? `\nConversations with possible buyers: ${c.talks.n}; ${c.talks.problem} had the problem; ${c.talks.committed} committed to something.` : null,
    coverageLine(c.coverage),
    ...(c.heard?.length ? ['\nWhat people said, in their words, newest first:', ...c.heard.map((h) => `- ${h}`), HEARD_ROLES_NOTE] : []),
    c.bets.length ? '\nExperiments already run, newest first:' : '\nNo experiments run yet.',
    ...c.bets.slice(0, 8).map((b) => `- On ${LINK_LABEL[b.part].toLowerCase()}: "${b.belief}" — ${b.state === 'running' ? 'running' : b.state === 'passed' ? 'passed' : b.state === 'failed' ? 'did not pass' : 'called off'} (${b.line})`),
    c.shelf?.length ? '\nKept on the owner\'s shelf to run later, so do not suggest these again:' : null,
    ...(c.shelf ?? []).slice(0, 10).map((e) => `- "${e.belief}"${e.play ? ` (the play: ${e.play})` : ''}`),
    c.assets.length ? `\nAssets they already have: ${c.assets.join(', ')}.` : null,
    ...(c.research !== undefined ? evidenceLines(c.research) : []),
  ];
}

/** Where they are, as the model is told it: based, and where they sell when that is said and differs. Nothing when the context does not carry it. */
function placeLines(p: IdeasContext['place']): string[] {
  if (p === undefined) return [];
  const based = p?.based?.trim() || null;
  const area = p?.area?.trim() || null;
  if (!based && !area) return ['- Where: not said'];
  return [
    based ? `- Based in: ${based}` : null,
    area && area.toLowerCase() !== based?.toLowerCase() ? `- Sells to people in: ${area}` : null,
  ].filter((l): l is string => !!l);
}

/**
 * "Who the last 30 days' conversations were with: 4 could buy, 0 sells to them,
 * …" — every kind, the empty ones too, because the empty ones are the point.
 * Nothing when there were none.
 */
function coverageLine(by: IdeasContext['coverage']): string | null {
  if (!by || !TALK_ROLES.some((r) => by[r] > 0)) return null;
  return `Who the last ${TALK_BACK_DAYS} days' conversations were with: ${TALK_ROLES.map((r) => `${by[r]} ${TALK_ROLE_LABEL[r].toLowerCase()}`).join(', ')}.`;
}

/**
 * Which count can stand before which, among the ones this business can keep:
 * "meetings from replied or talks". A count whose only step before it is one
 * the business cannot keep is left out, rather than offered with nothing after
 * "from".
 */
function triesLine(allowed: LabMetric[]): string {
  return (Object.entries(TRIES_FOR) as Array<[LabMetric, readonly LabMetric[]]>)
    .filter(([m]) => allowed.includes(m))
    .map(([m, t]) => [m, t.filter((x) => allowed.includes(x))] as const)
    .filter(([, t]) => t.length)
    .map(([m, t]) => `${m} from ${t.join(' or ')}`)
    .join('; ');
}

/** Each count, as the model is told it: what it is, and who keeps it. */
const METRIC_HELP: Record<LabMetric, string> = {
  sent: 'messages sent through the app',
  replied: 'businesses that replied to a message',
  meetings: 'meetings or calls held',
  paid: 'sales logged, any amount',
  paid_at_price: 'sales at the owner\'s full price or more',
  talks: 'conversations the owner logs with possible buyers',
  committed: 'conversations that ended in a commitment: another call, an introduction or money',
  handed: 'projects the owner\'s agent finished',
  logged: 'anything else the owner counts by hand: sign-ups, enquiries, orders, visits',
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** Trimmed and single-spaced; too long is refused by the caller, never cut, because a cut idea reads as finished. */
const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const int = (v: unknown) => (typeof v === 'number' ? Math.round(v) : typeof v === 'string' && v.trim() ? Math.round(Number(v)) : NaN);
const PLACEHOLDER = /\[[^\]]{0,40}\]|\{\{|\}\}|<[a-z][^>]*>/i;
/**
 * Said about the person instead of to them. "Your" where the model wrote "the
 * owner's" reads the same; "the owner knows" has no safe rewrite ("you knows"),
 * so a line still saying it is not kept — dropped, not repaired, as the rest.
 */
const toYou = (s: string | null): string | null => (s ? secondPerson(s) : s);
const ABOUT_THEM = /\bthe (?:business )?owner\b/i;
const REASON_MAX = IDEA_REASON_MAX;

/** A sentence of reasoning, held to the rules a reason is: its own length, no placeholder, no "the owner", no number from nowhere. */
function reasonOf(v: unknown, sources: string[]): string | null {
  const r = toYou(clean(v));
  return r && r.length <= REASON_MAX && !PLACEHOLDER.test(r) && !ABOUT_THEM.test(r) && !numberOutside(r, sources) ? r : null;
}

/** Why the model put its first idea first: kept as a reason is, or not at all. */
export function firstWhyOf(raw: unknown, c: { sources: string[]; evidence?: Evidence[] }): string | null {
  return reasonOf(obj(raw).first_why, [...c.sources, ...evidenceText(c.evidence)]);
}

/** A page's words count as somewhere a number came from — it is the page's number, cited as the page's. */
const evidenceText = (e: Evidence[] | undefined) => (e ?? []).flatMap((x) => [x.title, x.said ?? '']);

/**
 * The model's ideas, each held to what a bet is held to. An idea that does not
 * fit is dropped, not repaired: a count this business cannot keep, a pass line
 * out of range, a placeholder. A reason that cites a number the person never
 * gave loses the reason, not the idea; a plan that is not the step before the
 * count, or asks for fewer tries than the line ("three meetings from two
 * replies"), loses the plan; a belief that is not the person's voice is not
 * kept. A book not on the list is not said. `max` is three for a set, more
 * for the candidates a review chooses from.
 */
export function normalizeIdeas(raw: unknown, c: Pick<IdeasContext, 'part' | 'foundBy'> & { sources: string[]; evidence?: Evidence[] }, max = IDEAS_PER_ASK): Candidate[] {
  const list = Array.isArray(obj(raw).ideas) ? (obj(raw).ideas as unknown[]) : Array.isArray(raw) ? raw : [];
  const allowed = new Set(metricsFor(c.foundBy));
  const books = new Map(IDEA_BOOKS.map((b) => [b.toLowerCase(), b]));
  const out: Candidate[] = [];
  for (const x of list) {
    const o = obj(x);
    const label = toYou(clean(o.label));
    const how = toYou(clean(o.how));
    if (!label || !how || label.length > IDEA_LABEL_MAX || how.length > IDEA_HOW_MAX) continue;
    if (PLACEHOLDER.test(label) || PLACEHOLDER.test(how) || ABOUT_THEM.test(label) || ABOUT_THEM.test(how)) continue;
    const metric = typeof o.metric === 'string' && (LAB_METRICS as readonly string[]).includes(o.metric) ? (o.metric as LabMetric) : null;
    if (!metric || !allowed.has(metric)) continue;
    const unit = metric === 'logged' ? unitOf(o.unit) : null;
    if (metric === 'logged' && !unit) continue;
    const target = int(o.target);
    const days = int(o.days);
    if (!(target >= 1 && target <= TARGET_MAX) || !(days >= 1 && days <= BET_DAYS_MAX)) continue;
    // A number in what to do is a step of the play ("ask five people") and
    // fine; the same number reads as a claim in the reason, which is checked.
    const t = obj(o.tries);
    const planned = int(t.planned);
    const triesMetric = typeof t.metric === 'string' && (LAB_METRICS as readonly string[]).includes(t.metric) ? (t.metric as LabMetric) : null;
    const tries = triesMetric && allowed.has(triesMetric) && TRIES_FOR[metric].includes(triesMetric) && planned >= target && planned <= PLANNED_MAX
      ? { metric: triesMetric, planned } : null;
    const bookRaw = clean(o.book);
    const book = bookRaw ? books.get(bookRaw.toLowerCase()) ?? null : null;
    // Why this, now: from the person's record alone. How it would work may lean on a page's numbers, which are the page's.
    const why = reasonOf(o.why, c.sources);
    const read = [...c.sources, ...evidenceText(c.evidence)];
    const p = obj(o.prep);
    const prepLabel = clean(p.label);
    const asset = typeof p.asset === 'string' && (ASSET_KINDS as readonly string[]).includes(p.asset) ? (p.asset as AssetKind) : null;
    if (out.some((i) => i.label.toLowerCase() === label.toLowerCase())) continue;
    const mech = typeof o.mechanism === 'string' ? o.mechanism.trim().toLowerCase() : '';
    out.push({
      key: `ai-${out.length}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`,
      part: c.part, label, how, metric, unit, target, tries, days, book, why,
      prep: prepLabel && asset && prepLabel.length <= IDEA_LABEL_MAX ? { label: prepLabel, asset } : null,
      works: reasonOf(o.works, read), fails: reasonOf(o.fails, read),
      sources: citedSources(o.sources, c.evidence ?? []),
      belief: ideaBeliefOf(o.belief),
      mechanism: (IDEA_MECHANISMS as readonly string[]).includes(mech) ? (mech as IdeaMechanism) : 'other',
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Everything an idea's reason may take a number from: the person's words and the rows the prompt gave. */
export function ideaSources(c: IdeasContext): string[] {
  const o = c.offer;
  return [
    o.sells, o.for_who, o.problem, o.price_band, c.working,
    ...c.links.flatMap((l) => [l.why, l.facts]),
    ...c.bets.map((b) => `${b.belief} ${b.line}`),
    // The beliefs only, which are the person's: a play's name is a book's or the app's, and a number in it is not theirs.
    ...(c.shelf ?? []).map((e) => e.belief),
    c.talks.n ? `${c.talks.n} ${c.talks.problem} ${c.talks.committed}` : null,
    coverageLine(c.coverage),
    ...(c.heard ?? []),
  ].filter((s): s is string => typeof s === 'string' && !!s);
}

/**
 * The talk counts the chain and the prompt carry: conversations with possible
 * buyers, all time. Somebody who sells to the buyers, or knows them, is heard
 * — their words go to the model — but is not a buyer, and counted as one would
 * make "who buys" look tested by people who never could.
 */
export function talkTotals(talks: Talk[]): { n: number; problem: number; committed: number } {
  const buyers = talks.filter(isBuyer);
  return { n: buyers.length, problem: buyers.filter((t) => t.problem === 'yes').length, committed: buyers.filter((t) => t.commitment !== 'none').length };
}


/* ─── Written, then read again ────────────────────────────────────────────── */

/** The write's own ceiling: a reasoning model needs minutes for six ideas, with the review's share still left after. */
export const IDEAS_WRITE_MS = 150_000;
/** The review's: it reads and sets aside, it does not write. */
export const IDEAS_REVIEW_MS = 90_000;
/** Less than this left, and the review is skipped and said to be: a review cut off half way is no review. */
export const IDEAS_REVIEW_MIN_MS = 20_000;
/**
 * Both calls, from the end of the search: with the search's 15s and the reads
 * around them, under IDEAS_STALE_MS (lab.ts) — after which an ask still being
 * written reads as stopped — and under the route's 300s.
 */
export const IDEAS_BUDGET_MS = 250_000;

export const IDEAS_REVIEW_SYSTEM = [
  'You review experiments another model proposed for a small business owner, before the owner sees any of them.',
  'You are the skeptical operator who has watched many small businesses try things: keep only what this owner could start this week and learn from in the days given.',
  'Set an idea aside (keep: false) when it relies on a program, institution, platform, event or place that does not exist or is not used where the owner is based or sells — a national program from another country is no use to them;',
  'when it repeats an experiment the record shows did not pass without changing what made it fail, or one the owner already kept to run later;',
  'when one person could not start it this week with what the record says they have;',
  'when its count would not show whether it worked, or its pass line could be met by chance or not at all;',
  'or when it reaches the same people the same way as another idea: keep the better of the two.',
  'Never set an idea aside for being simple: a plain idea run well beats a clever one.',
  'For each idea you keep, list in "supported" the pages that really support it; a page about something else does not.',
  'Only keep or set aside: do not reorder the ideas or rewrite them.',
  'About this business, use only what you are told: never invent a fact or a number about it.',
  'Write "why" to the owner as "you", never "the owner".',
  'Answer with JSON only.',
].join(' ');

/** The review's prompt: the same record the ideas were written from, then each idea as it would start. */
export function reviewPrompt(c: IdeasContext, cands: Candidate[]): string {
  const part = c.links.find((l) => l.key === c.part);
  const pageOf = (url: string) => c.research?.evidence.find((e) => e.url === url)?.n ?? null;
  return [
    `Review ${cands.length} experiments proposed for one part of this business: ${LINK_LABEL[c.part].toLowerCase()}.`,
    part ? `How that part stands now: ${part.state}. ${part.why}${part.facts ? ` (${part.facts})` : ''}` : null,
    ...contextLines(c),
    '',
    'The experiments proposed:',
    ...cands.flatMap((x, i) => {
      const pages = (x.sources ?? []).map((s) => pageOf(s.url)).filter((n): n is number => n != null);
      return [
        `[${i + 1}] ${x.label} (mechanism: ${x.mechanism})`,
        `    What: ${x.how}`,
        `    Tests: ${x.belief ? `"${x.belief}"` : 'not said'}`,
        `    Pass line: ${playLine(x, null)}`,
        `    Cites: ${pages.length ? pages.map((n) => `[${n}]`).join(', ') : 'no pages'}`,
      ];
    }),
    '',
    'Return {"reviews": [{"n": the idea\'s number, "keep": true or false, "why": "one sentence", "supported": [numbers of the pages that really support it]}]}',
  ].filter((l): l is string => l !== null).join('\n');
}

export interface Reviewed {
  /** Kept, in the order written: one the review did not mention is kept. */
  ideas: Candidate[];
  /** Set aside, and the review's reason where it gave one that holds. */
  dropped: Array<{ label: string; why: string | null }>;
}

const nums = (v: unknown): number[] => (Array.isArray(v) ? v.map(int).filter((n) => Number.isFinite(n)) : []);

/**
 * The review's answer, applied. Null when it is not an answer — no reviews at
 * all — so the caller says the review did not run rather than keeping all six
 * as if it had. A source stays only where the writer cited it and the review
 * says it supports the idea: a link on the card is a page somebody checked,
 * and a page about something else is not a reason. An order or a pick in the
 * answer is not read: the review sets aside, the writer's order stands.
 */
export function applyReview(raw: unknown, cands: Candidate[], c: { sources: string[]; evidence: Evidence[] }): Reviewed | null {
  const o = obj(raw);
  if (!Array.isArray(o.reviews)) return null;
  const reviews = new Map<number, { keep: boolean; why: string | null; supported: number[] }>();
  for (const r of o.reviews) {
    const x = obj(r);
    const n = int(x.n);
    if (!(n >= 1 && n <= cands.length) || reviews.has(n)) continue;
    reviews.set(n, { keep: x.keep !== false && x.keep !== 'false', why: reasonOf(x.why, [...c.sources, ...evidenceText(c.evidence)]), supported: nums(x.supported) });
  }
  if (!reviews.size) return null;
  const urlOf = new Map(c.evidence.map((e) => [e.n, e.url]));
  const ideas: Candidate[] = [];
  const dropped: Reviewed['dropped'] = [];
  cands.forEach((idea, i) => {
    const r = reviews.get(i + 1);
    if (r && !r.keep) { dropped.push({ label: idea.label, why: r.why }); return; }
    const checked = r ? new Set(r.supported.map((n) => urlOf.get(n)).filter((u): u is string => !!u)) : null;
    ideas.push(checked ? { ...idea, sources: (idea.sources ?? []).filter((s) => checked.has(s.url)) } : idea);
  });
  return { ideas, dropped };
}

/** The first idea of each mechanism, in the order given, and the ones that repeated one. "other" is never a repeat. */
export function oneEach(ideas: Candidate[]): { kept: Candidate[]; same: Candidate[] } {
  const seen = new Set<IdeaMechanism>();
  const kept: Candidate[] = [];
  const same: Candidate[] = [];
  for (const i of ideas) {
    if (i.mechanism !== 'other' && seen.has(i.mechanism)) { same.push(i); continue; }
    seen.add(i.mechanism);
    kept.push(i);
  }
  return { kept, same };
}

/**
 * One call to a model, made by the caller: proofai.ts through the app's
 * provider, scripts/copilot-ideas-eval.ts through an endpoint it names, a test
 * through a stand-in.
 * It throws an Error whose message is already said in words ("… did not answer
 * within 150s"). `maxOutputTokens` is what this call needs; the caller may
 * raise it for a model that thinks before it answers.
 */
export type AskModel = (call: { system: string; prompt: string; temperature: number; maxOutputTokens: number; timeoutMs: number }) => Promise<string>;

export interface WrittenSet {
  ideas: Candidate[];
  pick: string | null;
  /** Ideas that held to what a bet needs, of the ones asked for. */
  written: number;
  review:
    | { ran: true; why: null; dropped: Reviewed['dropped']; same: string[] }
    | { ran: false; why: string; same: string[] };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/[.\s]+$/, '');

/**
 * A set of ideas for one part, written and read again: six candidates, the ones
 * that hold to what a bet needs, preferring those that say what they test, less
 * the ones the review sets aside, one per mechanism, three kept in the writer's
 * order with a page behind an idea ranking it first (rankIdeas). The writer's
 * reason for its first stays only while that idea is still first. Throws with
 * the reason in words when there is nothing to keep — the model did not answer,
 * nothing held, or the review set every one aside — and never when only the
 * review failed: then nothing is set aside, and the set says it was not read
 * again and why (invariant 13).
 */
export async function writeIdeaSet(c: IdeasContext, ask: AskModel, o: { budgetMs?: number; now?: () => number } = {}): Promise<WrittenSet> {
  const now = o.now ?? Date.now;
  const began = now();
  const budget = o.budgetMs ?? IDEAS_BUDGET_MS;
  const sources = ideaSources(c);
  const evidence = c.research?.evidence ?? [];
  let text: string;
  try {
    // Higher than a draft's: the point is ideas the catalogue would not have.
    text = await ask({ system: IDEAS_SYSTEM, prompt: ideasPrompt(c), temperature: 0.8, maxOutputTokens: 4000, timeoutMs: Math.min(IDEAS_WRITE_MS, budget) });
  } catch (e) {
    throw new Error(`No new ideas: ${errText(e)}.`);
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch { throw new Error('No new ideas: the model did not answer in the shape asked for. Try again.'); }
  const all = normalizeIdeas(parsed, { part: c.part, foundBy: c.foundBy, sources, evidence }, IDEA_CANDIDATES);
  if (!all.length) throw new Error('No new ideas: none of the model\'s held to what a bet needs — a count this business can keep and a line in range. Try again.');
  // One that says what it tests beats one that does not: without, the card would
  // say you were testing the part's one sentence, whatever the play.
  const told = all.filter((x) => x.belief);
  const pool = told.length ? told : all;
  let kept = pool;
  let review: { ran: true; dropped: Reviewed['dropped'] } | { ran: false; why: string };
  const left = budget - (now() - began);
  if (pool.length < 2) {
    review = { ran: false, why: 'only one idea held, so there was nothing to choose between' };
  } else if (left < IDEAS_REVIEW_MIN_MS) {
    review = { ran: false, why: `no time was left for it after the ideas took ${Math.round((now() - began) / 1000)}s` };
  } else {
    let answer: Reviewed | null = null;
    let failed: string | null = null;
    try {
      const reply = await ask({ system: IDEAS_REVIEW_SYSTEM, prompt: reviewPrompt(c, pool), temperature: 0.2, maxOutputTokens: 2000, timeoutMs: Math.min(IDEAS_REVIEW_MS, left) });
      let raw: unknown = null;
      try { raw = extractJson(reply); } catch { /* not an answer: said below */ }
      answer = raw == null ? null : applyReview(raw, pool, { sources, evidence });
      if (!answer) failed = 'it did not answer in the shape asked for';
    } catch (e) {
      failed = errText(e);
    }
    if (answer && !answer.ideas.length) {
      const why = answer.dropped.find((d) => d.why)?.why;
      throw new Error(`No new ideas: a second read set all ${pool.length} aside${why ? ` — ${why.replace(/[.\s]+$/, '')}` : ''}. Try again.`);
    }
    if (answer) {
      kept = answer.ideas;
      review = { ran: true, dropped: answer.dropped };
    } else {
      review = { ran: false, why: `the review failed: ${failed}` };
    }
  }
  const { kept: distinct, same } = oneEach(kept);
  const firstWhy = distinct[0]?.key === all[0].key ? firstWhyOf(parsed, { sources, evidence }) : null;
  const ranked = rankIdeas(distinct.slice(0, IDEAS_PER_ASK), firstWhy);
  const sameLabels = same.map((x) => x.label);
  return {
    ideas: ranked.ideas, pick: ranked.pick, written: all.length,
    review: review.ran ? { ran: true, why: null, dropped: review.dropped, same: sameLabels } : { ran: false, why: review.why, same: sameLabels },
  };
}
