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
// Pure: no DB import, no model call. proofai.ts makes the call.

import { ASSET_KINDS, numberOutside, type AssetKind } from './assets';
import { LINK_LABEL, type BusinessLink, type LinkKey } from './business';
import {
  BET_DAYS_MAX, HEARD_ROLES_NOTE, IDEA_HOW_MAX, IDEA_LABEL_MAX, LAB_METRICS, PLANNED_MAX, PLAY_BOOKS, TALK_BACK_DAYS, TALK_ROLES, TALK_ROLE_LABEL,
  TARGET_MAX, TRIES_FOR, isBuyer, metricsFor, unitOf, type BetView, type Idea, type LabMetric, type Talk, type TalkRole,
} from './lab';
import { FOUND_BY_LABEL } from './offer';
import type { FoundBy, Offer } from './types';

/** Ideas kept per ask. Three is a choice; ten is homework. */
export const IDEAS_PER_ASK = 3;

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
  /** The beliefs already kept on the shelf — the person's own words — so an idea is not written that they have already written down. */
  shelf?: string[];
  /** Kinds of asset the business already has. */
  assets: AssetKind[];
}

export const IDEAS_SYSTEM = [
  'You suggest experiments for a small business owner: three things to try in the next one to three weeks, each judged by a count.',
  'Each idea is concrete: what to do, to whom, and the one count that would show it worked, with a pass line set before it starts.',
  'Use only what you are told about this business. Do not repeat an idea the record shows was already tried and did not pass, unless you change what made it fail.',
  'Where the owner logged what people said, start from it: an idea that answers something a buyer said beats one that could be for anybody.',
  'Where few conversations are logged, or all with one kind of person, one idea may be to talk to the people around the money the owner has not: buyers, people who sell to them, people who run the work, people already earning from them, people who know them.',
  'Never invent a number about the business: no rates, results or figures it did not give you. A number one person said is what they said, not a rate. The pass line is your proposal and the owner can change it.',
  'Name a book only when the idea is genuinely that book\'s, and only from the list given; otherwise use null.',
  'Answer with JSON only.',
].join(' ');

/** The prompt: the part, the business in its own words, the rows, what was tried, and the shape of an answer. */
export function ideasPrompt(c: IdeasContext): string {
  const allowed = metricsFor(c.foundBy);
  const metricLines = allowed.map((m) => `- "${m}": ${METRIC_HELP[m]}`);
  const o = c.offer;
  const part = c.links.find((l) => l.key === c.part);
  return [
    `Suggest ${IDEAS_PER_ASK} experiments on one part of this business: ${LINK_LABEL[c.part].toLowerCase()}.`,
    part ? `How that part stands now: ${part.state}. ${part.why}${part.facts ? ` (${part.facts})` : ''}` : null,
    '',
    'The business, in the owner\'s words:',
    `- Sells: ${o.sells ?? ''}`,
    o.for_who ? `- To: ${o.for_who}` : null,
    o.problem ? `- The problem it solves: ${o.problem}` : null,
    o.price_band ? `- Price: ${o.price_band}` : null,
    `- How buyers find them: ${c.foundBy ? FOUND_BY_LABEL[c.foundBy] : 'not said'}`,
    c.working ? `\nWhat the owner wrote about how they work:\n${c.working}` : null,
    '\nThe whole chain, as the app reads it from the rows:',
    ...c.links.map((l) => `- ${l.label}: ${l.state}. ${l.why}`),
    c.talks.n ? `\nConversations with possible buyers: ${c.talks.n}; ${c.talks.problem} had the problem; ${c.talks.committed} committed to something.` : null,
    coverageLine(c.coverage),
    ...(c.heard?.length ? ['\nWhat people said, in their words, newest first:', ...c.heard.map((h) => `- ${h}`), HEARD_ROLES_NOTE] : []),
    c.bets.length ? '\nExperiments already run, newest first:' : '\nNo experiments run yet.',
    ...c.bets.slice(0, 8).map((b) => `- On ${LINK_LABEL[b.part].toLowerCase()}: "${b.belief}" — ${b.state === 'running' ? 'running' : b.state === 'passed' ? 'passed' : b.state === 'failed' ? 'did not pass' : 'called off'} (${b.line})`),
    c.shelf?.length ? '\nKept on the owner\'s shelf to run later, so do not suggest these again:' : null,
    ...(c.shelf ?? []).slice(0, 10).map((b) => `- ${b}`),
    c.assets.length ? `\nAssets they already have: ${c.assets.join(', ')}.` : null,
    '',
    'Counts an idea can be judged on (use these keys exactly):',
    ...metricLines,
    'For "logged", also give "unit": the plural word for what the owner counts by hand, like "sign-ups" or "enquiries".',
    `An idea may give "tries": what it takes, as {"metric": one key, "planned": number}, only when that count comes before the main one (${triesLine(allowed)}).`,
    `It may give "prep": an asset to draft first, as {"label": "...", "asset": one of ${ASSET_KINDS.map((k) => `"${k}"`).join(', ')}}.`,
    `Books you may name: ${IDEA_BOOKS.join('; ')}.`,
    '',
    'Return {"ideas": [{"label": "short name, starting with a verb or a noun", "how": "what to do, in one or two sentences", "metric": "...", "unit": "...", "target": number, "tries": {...}, "days": number, "book": "..." or null, "why": "one sentence on why this, from the record above", "prep": {...}}]}',
  ].filter((l): l is string => l !== null).join('\n');
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
 * The model's ideas, each held to what a bet is held to. An idea that does not
 * fit is dropped, not repaired: a count this business cannot keep, a pass line
 * out of range, a plan that is not the step before the count, a placeholder.
 * A reason that cites a number the person never gave loses the reason, not the
 * idea. A book not on the list is not said.
 */
export function normalizeIdeas(raw: unknown, c: Pick<IdeasContext, 'part' | 'foundBy'> & { sources: string[] }): Idea[] {
  const list = Array.isArray(obj(raw).ideas) ? (obj(raw).ideas as unknown[]) : Array.isArray(raw) ? raw : [];
  const allowed = new Set(metricsFor(c.foundBy));
  const books = new Map(IDEA_BOOKS.map((b) => [b.toLowerCase(), b]));
  const out: Idea[] = [];
  for (const x of list) {
    const o = obj(x);
    const label = clean(o.label);
    const how = clean(o.how);
    if (!label || !how || label.length > IDEA_LABEL_MAX || how.length > IDEA_HOW_MAX) continue;
    if (PLACEHOLDER.test(label) || PLACEHOLDER.test(how)) continue;
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
    const tries = triesMetric && allowed.has(triesMetric) && TRIES_FOR[metric].includes(triesMetric) && planned >= 1 && planned <= PLANNED_MAX
      ? { metric: triesMetric, planned } : null;
    const bookRaw = clean(o.book);
    const book = bookRaw ? books.get(bookRaw.toLowerCase()) ?? null : null;
    const whyRaw = clean(o.why);
    const why = whyRaw && whyRaw.length <= 240 && !PLACEHOLDER.test(whyRaw) && !numberOutside(whyRaw, c.sources) ? whyRaw : null;
    const p = obj(o.prep);
    const prepLabel = clean(p.label);
    const asset = typeof p.asset === 'string' && (ASSET_KINDS as readonly string[]).includes(p.asset) ? (p.asset as AssetKind) : null;
    if (out.some((i) => i.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({
      key: `ai-${out.length}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`,
      part: c.part, label, how, metric, unit, target, tries, days, book, why,
      prep: prepLabel && asset && prepLabel.length <= IDEA_LABEL_MAX ? { label: prepLabel, asset } : null,
    });
    if (out.length >= IDEAS_PER_ASK) break;
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
    ...(c.shelf ?? []),
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

