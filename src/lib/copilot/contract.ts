// src/lib/copilot/contract.ts
// What a worker may be handed, what it may do with it, and whether what it
// handed back is what was asked for.
//
// Three leaks in the commission contract. Two showed on a real account's
// Projects sheet; the third was a gap nothing had fallen through yet:
//
//   1. Writing went to the hands. "Draft one reusable reply for any post that
//      states pay" was dispatched to a browsing agent with a search tool, which
//      tried to send the reply — outside a mandate that sends nothing — and
//      stopped at Needs a fix with "could not send the reply…". Writing needs
//      the person's own words and nothing from outside; the app already holds
//      both and already has a model. So a job is sorted before it goes out
//      (jobKindOf) and writing stays in the app.
//   2. The plan was taken as written. A worker under "Research and draft" posted
//      a guesthouse plan whose second step was "Proceed toward a booking
//      confirmation", and the app stored it and drew it like any other step — a
//      step in the commit ring, on a mandate that can never commit, shown as the
//      worker's to do. The ring a step needs is now read off its words (ringOf),
//      and a step the mandate cannot do by itself is marked as the person's
//      (guardPlan). A worker that says it already did one is not believed: that
//      is a question for the owner (guardEvents).
//   3. "Done" was taken on the worker's word. That guesthouse job came back with
//      three priced options and their links, and they were good — but nothing
//      in the app could have told them from links that do not open, three where
//      five were asked for, or a night that was not the one asked for; the n8n
//      flow could only patch what its agent wrote. Invariant 10 already refused
//      the worker's claimed status; the app now refuses a done that fails its own
//      reading of the objective too (expectationsOf, verdictOf) — what was asked
//      for is a count, links that open and dates that fit, and each of those can
//      be checked without a model.
//
// Pure: no DB, no network. linkcheck.ts opens the links; deliver.ts records.

import { AUTHORITIES, AUTHORITY, canAct, datesNamed, type Authority, type CommissionArtifact, type CommissionEvent, type CommissionResult, type CommissionStep } from './commission';

/* ─── What kind of job ────────────────────────────────────────────────────── */

export const JOB_KINDS = ['write', 'research'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  write: 'Writing',
  research: 'Research',
};

/**
 * The verbs a writing job opens with. A job is writing only when its first
 * verb is one of these — "Draft three subject lines", "Rewrite my offer for
 * dentists" — because the ones that are not are the ones that need the world.
 */
const WRITE_VERB = /^(?:please\s+)?(?:re-?)?(write|draft|rewrite|redraft|edit|polish|tighten|shorten|summari[sz]e|outline|word|phrase|reword|prepare a (?:draft|script|pitch|message|reply|post|caption|bio|description)|come up with|brainstorm|suggest|propose|turn)\b/i;

/**
 * What only the world can answer. Any of these and the job is research however
 * it opens, because a model writing "the three best-rated guesthouses in Makati"
 * from memory is inventing listings (invariant 3: sourced beats inferred, and
 * nothing sourced came from a draft).
 */
const NEEDS_THE_WORLD = /\b(find|search|look ?up|research|compar(?:e|es|ing|ison)|check|verify|how much|(?:get|collect|gather|request)\s+(?:\w+\s+){0,2}(?:quotes?|prices?|rates?|costs?)|list(?:ing)?s? (?:of )?(?:the )?(?:best|top|cheapest|available)|where|which (?:are|is) the|who (?:are|is|sells|offers)|near(?:by| me)?|availability|available|open(?:ing)? hours|reviews|rated|suppliers?|vendors?|competitors?|listings?|hotels?|guesthouses?|hostels?|flights?|venues?|jobs? (?:in|at|for)|grants?|phone numbers?|addresses|sources?|https?:\/\/|www\.)\b/i;

/**
 * Writing or research, from the objective's own words.
 *
 * Conservative on purpose, and in one direction: research is the default and
 * the world's markers win. Sorting a research job as writing costs a confident
 * invented list; sorting a writing job as research costs one slower round trip.
 * Only the second is cheap.
 */
export function jobKindOf(objective: string): { kind: JobKind; why: string } {
  const text = objective.trim();
  if (!WRITE_VERB.test(text)) return { kind: 'research', why: 'It does not open with a writing verb.' };
  const world = text.match(NEEDS_THE_WORLD);
  if (world) return { kind: 'research', why: `It needs the world ("${world[0]}").` };
  return { kind: 'write', why: 'It asks for words, and nothing it asks for is outside the app.' };
}

/* ─── Which ring a sentence needs ─────────────────────────────────────────── */

/** Money leaves or a promise is made: never autonomous (AUTHORITY.commit). */
const COMMIT_VERB = /^(book(?:s|ed|ing)?|reserve[sd]?|reserving|pay(?:s|ing)?|paid|purchas(?:e[sd]?|ing)|buy(?:s|ing)?|bought|sign(?:s|ed|ing)?|subscrib(?:e[sd]?|ing)|hir(?:e[sd]?|ing)|transfer(?:s|red|ring)?|wire[sd]?|wiring|deposit(?:s|ed|ing)?|donat(?:e[sd]?|ing)|invest(?:s|ed|ing)?|accept(?:s|ed|ing)?|agree[sd]?|agreeing|commit(?:s|ted|ting)?|finali[sz](?:e[sd]?|ing)|checkout|settl(?:e[sd]?|ing)|rent(?:s|ed|ing)?|leas(?:e[sd]?|ing)|enrol(?:l)?(?:s|ed|led|ing|ling)?|order(?:s|ed|ing)?)\b/i;

/** These commit only when what follows is a booking, a payment or a deal. */
const COMMIT_IF = /^(confirm(?:s|ed|ing)?|secur(?:e[sd]?|ing)|lock(?:s|ed|ing)? in|plac(?:e[sd]?|ing)|complet(?:e[sd]?|ing)|proceed(?:s|ed|ing)?(?: (?:to|toward|towards|with))?|go(?:es|ing)? ahead(?: with)?|make|made|making|submit(?:s|ted|ting)?)\b/i;
const COMMIT_OBJECT = /\b(booking|reservation|order|purchase|payment|deposit|deal|contract|subscription|transaction|checkout|sale|hire|offer|bid|room|seat|ticket|flight|stay|tour)s?\b/i;

/** Somebody is contacted under the person's name: gated (AUTHORITY.reach, invariant 4). */
const REACH_VERB = /^(e-?mail(?:s|ed|ing)?|message[sd]?|messaging|text(?:s|ed|ing)?|sms|whats ?app|dm(?:s|ed|ing)?|call(?:s|ed|ing)?|phon(?:e[sd]?|ing)|submit(?:s|ted|ting)?|contact(?:s|ed|ing)?|reach(?:es|ed|ing)? out|send(?:s|ing)?|sent|post(?:s|ed|ing)?|publish(?:es|ed|ing)?|repl(?:y|ies|ied|ying)|respond(?:s|ed|ing)?|follow(?:s|ed|ing)? up|ask(?:s|ed|ing)?|invit(?:e[sd]?|ing)|pitch(?:es|ed|ing)?|introduc(?:e[sd]?|ing)|appl(?:y|ies|ied|ying) (?:to|for)|tweet(?:s|ed|ing)?|shar(?:e[sd]?|ing)|negotiat(?:e[sd]?|ing)|request(?:s|ed|ing)?|inquir(?:e[sd]?|ing)|enquir(?:e[sd]?|ing)|chas(?:e[sd]?|ing)|nudg(?:e[sd]?|ing)|notif(?:y|ies|ied|ying)|tell(?:s|ing)?|told|schedul(?:e[sd]?|ing)|register(?:s|ed|ing)?)\b/i;
/** Reach that opens with a commit verb: scheduling a call is talking to someone, and signing up is an identity, not a payment. */
const REACH_FIRST = /^(?:book(?:s|ed|ing)? (?:a |an )?(?:call|meeting|demo|viewing|visit|appointment|chat|consultation)|sign(?:s|ed|ing)? up)\b/i;

/** Contact with the person themselves, or with the app: not reach. "Send the shortlist to the owner", "Ask you which", "Post the results". */
const TO_THE_OWNER = /^\S+\s+(?:(?:it|this|them|that)\s+)?(?:back\s+)?(?:to\s+)?(?:you|me|the owner|owner|the user|the app)\b|\b(?:to|with)\s+(?:you|me|the owner|owner|the user|the app)\b|^\S+\s+(?:back|the results?|results|a summary|the summary|the report)\b/i;
/** A noun that only looks like a verb: "Email addresses for each", "Contact details", "Order the list by price". */
const NOT_A_VERB = /^(?:e-?mail (?:address(?:es)?|list|template|draft|copy)|contact (?:details?|info(?:rmation)?|numbers?|emails?|list|form|page)|call (?:the )?(?:api|tool|search|function|endpoint)|order (?:the |them |it )?(?:by|results|list|options|status|history|form|details)|text (?:of|for|analysis|summary|version|file|format)|message (?:templates?|drafts?|copy|text|variants?|ideas?)|post-?(?:it|code)|request (?:list|form)|share (?:of|price)|booking (?:sites?|options?|platforms?|links?|pages?|polic(?:y|ies)|terms|rules|fees?|window|dates?|process|engines?)|deposit (?:polic(?:y|ies)|amounts?|terms|rules)|rent(?:al)? (?:prices?|costs?|rates?|listings?|ranges?)|purchase (?:prices?|options?|history)|hiring (?:managers?|process|criteria|platforms?|sites?)|payment (?:methods?|options?|terms))\b/i;
/** "Then", "finally", "if it fits," — what a plan step says before its verb. */
const LEAD_IN = /^(?:(?:and|then|finally|next|lastly|also|now|once|after(?: that)?|if [^,]{1,60},|when [^,]{1,60},)\s+)+/i;

function ringOfClause(clause: string): Authority {
  const s = clause.trim().replace(LEAD_IN, '').replace(/^(?:please|try to|attempt to|go and|help (?:me )?)\s+/i, '');
  if (!s || NOT_A_VERB.test(s)) return 'read';
  if (REACH_FIRST.test(s)) return TO_THE_OWNER.test(s) ? 'read' : 'reach';
  if (COMMIT_VERB.test(s)) return 'commit';
  const iff = s.match(COMMIT_IF);
  if (iff && COMMIT_OBJECT.test(s.slice(iff[0].length, iff[0].length + 60))) return 'commit';
  if (REACH_VERB.test(s) && !TO_THE_OWNER.test(s)) return 'reach';
  return 'read';
}

const rank = (a: Authority) => AUTHORITIES.indexOf(a);

/**
 * The ring a plan step or an objective needs, read off its words: the highest
 * any of its clauses needs. "Compare the three, then book the cheapest" is a
 * commit step whatever it opens with.
 *
 * Verb-led on purpose. Plans are imperative lines, and nouns alone are
 * research: "Find the deposit policy", "Compare booking sites" and "List the
 * payment methods each accepts" are all read.
 */
export function ringOf(text: string): Authority {
  // Not on "before" or "after": "Compare prices before booking" is a read step
  // that names when the person books, not a booking.
  const clauses = text.split(/[,;:]|\s+(?:and|then)\s+|\s+-\s+|\.\s+/i);
  return clauses.reduce<Authority>((top, c) => {
    const ring = ringOfClause(c);
    return rank(ring) > rank(top) ? ring : top;
  }, 'read');
}

/* ─── Steps that are the person's ─────────────────────────────────────────── */

export interface GuardContext {
  /**
   * Whether a reach step can go out from the person's own account, each message
   * waiting for their OK (an account connected, and a worker that asks per call).
   * Without it a reach step is theirs to send — this app never sends as anybody
   * on its own account (invariant 4).
   */
  askEach?: boolean;
}

export const YOURS_NOTE: Record<'commit' | 'reach' | 'ask', string> = {
  commit: 'Yours: it spends money or makes a promise. It is prepared for you and stops there.',
  reach: 'Yours to send: this app does not contact anyone as you from its own account.',
  ask: 'Goes from your own account, and each message waits for your OK.',
};

/**
 * The plan, with every step the mandate cannot do by itself marked as the
 * person's.
 *
 * Marked, not dropped: "Book the cheapest" is a real step of "find me a room for
 * the 5th", and a plan that hides it reads as though the room will be booked.
 * And never left as done: a worker under this mandate cannot have booked
 * anything, so a commit step it marked done goes back to todo — and the claim
 * itself is raised by guardEvents, where the person can see it.
 */
export function guardPlan(plan: CommissionStep[], granted: Authority, ctx: GuardContext = {}): CommissionStep[] {
  return plan.map((s) => {
    const ring = ringOf(s.do);
    if (canAct(granted, ring)) {
      // A step that no longer needs a mark loses it: the plan changed.
      if (!s.yours) return s;
      const { yours: _was, ...rest } = s;
      return rest;
    }
    // Reach the mandate covers, from the person's own account, one OK at a time:
    // the worker can carry the step out, it just cannot skip the OK.
    if (ring === 'reach' && rank(granted) >= rank('reach') && ctx.askEach) {
      return { ...s, yours: 'ask' as const, note: s.note ?? YOURS_NOTE.ask };
    }
    const yours = ring === 'commit' ? 'commit' as const : 'reach' as const;
    return {
      ...s,
      yours,
      state: s.state === 'done' || s.state === 'doing' ? 'todo' : s.state,
      note: YOURS_NOTE[yours],
    };
  });
}

/** A past-tense act at the start of a report: "Booked the room", "Sent the three emails". */
const CLAIM_COMMIT = /^(?:i\s+(?:have\s+)?|we\s+(?:have\s+)?)?(booked|reserved|paid|purchased|bought|ordered|signed|subscribed|hired|transferred|wired|deposited|donated|invested|accepted|agreed|committed|checked out|confirmed (?:the |your |a )?(?:booking|reservation|order|purchase|payment)|placed (?:the |an |a )?order|secured (?:the |a )?(?:booking|reservation|room|seat|ticket|deal))\b/i;
const CLAIM_REACH = /^(?:i\s+(?:have\s+)?|we\s+(?:have\s+)?)?(sent|emailed|e-mailed|messaged|texted|called|phoned|contacted|reached out|posted|published|replied|responded|followed up|invited|pitched|introduced|applied|tweeted|shared|negotiated|requested|asked|notified|told|submitted|registered|signed up|dm(?:'?ed|ed))\b/i;
const CLAIM_TO_OWNER = /^(?:i\s+(?:have\s+)?|we\s+(?:have\s+)?)?\S+\s+(?:(?:it|this|them)\s+)?(?:back\s+)?(?:to\s+)?(?:you|the owner|the app|back)\b|\b(?:to|with)\s+(?:you|the owner|the app)\b/i;

/** The ring an event's summary says the worker already acted in, or read. */
export function claimedRing(summary: string): Authority {
  const s = summary.trim();
  if (CLAIM_COMMIT.test(s)) return 'commit';
  if (CLAIM_REACH.test(s) && !CLAIM_TO_OWNER.test(s)) return 'reach';
  return 'read';
}

export const BREACH_PREFIX = 'Check this — it says it did something this job does not allow: ';

/**
 * Work the worker says it did outside what it may do, refiled as a question for
 * the owner.
 *
 * Either the worker is wrong about what it did, or it did it. Both are the
 * owner's to find out before anything else happens on this job, and a line in
 * "What happened" reading "Booked the room at Casa Ana" under "Research and
 * draft" is the one entry that must not scroll past as progress. A needs_you
 * blocks the job and outranks any done (nextStatus), so the person sees it.
 *
 * `mayClaim` is what can legitimately have happened: reach, when every message
 * went from their own account through an OK they gave in the app. Commit never.
 */
export function guardEvents(events: CommissionResult['events'], mayClaim: readonly Authority[] = ['read']): { events: CommissionResult['events']; breaches: number } {
  let breaches = 0;
  const out = events.map((e) => {
    if (e.kind !== 'worked' && e.kind !== 'found' && e.kind !== 'done') return e;
    const ring = claimedRing(e.summary);
    if (ring === 'read' || mayClaim.includes(ring)) return e;
    breaches += 1;
    return { ...e, kind: 'needs_you' as const, summary: `${BREACH_PREFIX}${e.summary}`.slice(0, 300) };
  });
  return { events: out, breaches };
}

/** The whole result, held to the ring: its plan marked, its claims refiled. */
export function guardResult(r: CommissionResult, granted: Authority, ctx: GuardContext & { mayClaim?: readonly Authority[] } = {}): CommissionResult & { breaches: number } {
  const { events, breaches } = guardEvents(r.events, ctx.mayClaim ?? ['read']);
  return { ...r, events, plan: r.plan ? guardPlan(r.plan, granted, ctx) : null, breaches };
}

/* ─── What was asked for ──────────────────────────────────────────────────── */

const NUMBER_WORD: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, a_couple: 2, a_dozen: 12,
};
/** What a number counts when it is a constraint on each item, not how many items. */
const UNIT = /^(nights?|days?|hours?|hrs?|minutes?|mins?|weeks?|months?|years?|guests?|people|persons?|adults?|kids?|children|stars?|km|kms|kilometers?|kilometres?|miles?|mi|bedrooms?|beds?|baths?|bathrooms?|floors?|seats?|pesos?|dollars?|euros?|pounds?|usd|php|eur|gbp|percent|%|gb|tb|mb|inch(?:es)?|cm|kg|lbs?|am|pm|times?|rounds?|words?|characters?|chars?|sentences?|paragraphs?|pages?|slides?|seconds?|secs?|mins?)$/i;
const COUNT_LEAD = /\b(?:list|find|get|give(?: me)?|shortlist(?: of)?|pick|choose|compare|collect|gather|name|draft|write|suggest|identify|research|source|locate|prepare|create|make|build|come up with|brainstorm|top|best|from|at least|list of)\s+(?:me\s+)?(?:the\s+)?(?:top\s+|best\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a couple of|a dozen)\s+((?:[\w'-]+\s+){0,3}?)([a-z][\w'-]*)\b/i;

/**
 * The count an objective asks for, or null: "List 5 guesthouses", "Find three
 * suppliers", "a shortlist of 4", "quotes from 3 printers". Never the 5 of "Oct
 * 5", the 2 of "for 2 nights" or the 1,000 of "under $1,000": a count only
 * after a verb or "top", never after "for", "under" or "with", and never
 * counting a unit.
 */
export function countAskedFor(objective: string): number | null {
  const m = objective.match(COUNT_LEAD);
  if (!m) return null;
  const word = m[1].toLowerCase().replace(/ of$/, '').replace(/\s+/g, '_');
  const n = /^\d+$/.test(word) ? Number(word) : NUMBER_WORD[word] ?? null;
  const counted = m[3];
  if (!n || n < 1 || n > 30 || UNIT.test(counted)) return null;
  return n;
}

export interface Expectations {
  /** How many items the objective asks for, when it names a number. */
  count: number | null;
  /** Whether every item needs a source that opens: research, never writing. */
  links: boolean;
  /** The days the objective is for, ISO, oldest first. Empty when it names none. */
  dates: string[];
}

/** What the person asked for, as things that can be checked without a model. */
export function expectationsOf(objective: string, writtenOn: string, kind: JobKind): Expectations {
  return {
    count: countAskedFor(objective),
    links: kind === 'research',
    dates: datesNamed(objective, writtenOn.slice(0, 10)),
  };
}

/* ─── What came back ──────────────────────────────────────────────────────── */

const URL_RE = /\bhttps?:\/\/[^\s<>()"'\]]+/gi;
const LIST_LINE = /^\s*(?:[-*•▪◦]|\d{1,2}[.)]|[a-z][.)])\s+\S/;

const cleanUrl = (u: string) => u.replace(/[.,;:!?)\]]+$/, '');
/** A link as a person would compare two: no scheme, no www, no trailing slash, no tracking. */
export const linkKey = (u: string) => cleanUrl(u).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

export interface DeliveredItem {
  /** What it is, in the worker's words. */
  text: string;
  hrefs: string[];
  /** A done whose whole list is behind one link: a document, not an item, and not countable from here. */
  doc?: boolean;
}

type EventLike = Pick<CommissionEvent, 'kind' | 'summary' | 'artifact'>;

const artifactText = (a: CommissionArtifact | null) => (a ? [a.value, a.href ?? ''].join('\n') : '');
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Button text that names nothing: never matched against a list line. */
const GENERIC_LABEL = /^(link|source|page|here|open|view|website|site|details?|more|read more|the list|list|results?)$/i;

/** One item per key: the same place found twice is one item. */
function dedupe<T extends DeliveredItem>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = it.hrefs[0] ? linkKey(it.hrefs[0]) : words(it.text).slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The items a delivery holds.
 *
 * When the done carries a list, the list IS the deliverable — one line, one
 * item — and each line takes its link and its words from the find it names, by
 * the link or by the find's label ("Casa Ana" on the line "1. Casa Ana — $40").
 * Counting the finds and the lines together was wrong both ways on the commonest
 * delivery there is: three finds with links and a done listing the same three
 * without them counted as six, so a list of three passed "5 asked for", and the
 * three bare lines then failed as findings with no link.
 *
 * Without a list, the finds are the items. A done whose only content is one
 * link is a document: counted by nobody here, said as not counted.
 */
export function itemsDelivered(events: EventLike[]): DeliveredItem[] {
  const found = dedupe(events
    .filter((e) => e.kind === 'found' && e.artifact)
    .map((e) => {
      const text = `${e.summary}\n${artifactText(e.artifact)}`;
      return { text, hrefs: [...new Set((text.match(URL_RE) ?? []).map(cleanUrl))], label: e.artifact!.label };
    }));
  const done = [...events].reverse().find((e) => e.kind === 'done');
  const lines = done?.artifact ? done.artifact.value.split('\n').filter((l) => LIST_LINE.test(l)) : [];
  if (lines.length) {
    return dedupe(lines.map((line) => {
      const own = [...new Set((line.match(URL_RE) ?? []).map(cleanUrl))];
      const named = words(line);
      const match = found.find((f) => f.hrefs.some((h) => own.some((x) => linkKey(x) === linkKey(h))))
        ?? found.find((f) => f.label.trim().length >= 3 && !GENERIC_LABEL.test(f.label.trim()) && ` ${named} `.includes(` ${words(f.label)} `));
      return { text: match ? `${line}\n${match.text}` : line, hrefs: [...new Set([...own, ...(match?.hrefs ?? [])])] };
    }));
  }
  if (found.length) return found.map(({ text, hrefs }) => ({ text, hrefs }));
  if (done?.artifact?.href) return [{ text: done.summary, hrefs: [done.artifact.href], doc: true }];
  return [];
}

/** Every link a delivery points at, once each, at most `max`. */
export function linksDelivered(events: EventLike[], max = 12): string[] {
  const all = events
    .filter((e) => e.kind === 'found' || e.kind === 'done' || e.kind === 'worked')
    .flatMap((e) => [...(e.summary.match(URL_RE) ?? []), ...(artifactText(e.artifact).match(URL_RE) ?? [])])
    .map(cleanUrl);
  const seen = new Set<string>();
  return all.filter((u) => (seen.has(linkKey(u)) ? false : (seen.add(linkKey(u)), true))).slice(0, max);
}

/* ─── The verdict ─────────────────────────────────────────────────────────── */

export type LinkState = 'ok' | 'dead' | 'unknown';
export interface LinkResult { url: string; state: LinkState; code: number | null }

export type CheckKey = 'count' | 'links' | 'dates';
export type CheckState = 'pass' | 'fail' | 'unknown';
export interface Check { key: CheckKey; state: CheckState; line: string }

export interface Verdict {
  checks: Check[];
  /** No check failed. An unknown is not a failure: a page that refuses a robot is not a dead link. */
  passed: boolean;
  /** What the worker is told when its done is sent back. Empty when it passed. */
  sendBack: string[];
}

/** Times a done can be sent back before the job stops for the person to decide. */
export const MAX_SENDBACKS = 2;

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * The delivery, checked against what was asked for.
 *
 * Three checks and no model. Each is either something a person would check
 * first — did I get five, do the links open, is it for the right night — or it
 * is not here. An `unknown` never fails a delivery: a site that answers a robot
 * with 403 is not a dead link, and a list that names no dates is not off-date.
 * Only what the app can see is wrong is wrong.
 */
export function verdictOf(x: Expectations, events: EventLike[], links: LinkResult[], writtenOn: string): Verdict {
  const items = itemsDelivered(events);
  const checks: Check[] = [];

  if (x.count) {
    const counted = items.filter((it) => !it.doc);
    const n = counted.length;
    checks.push(n >= x.count
      ? { key: 'count', state: 'pass', line: `${n} of ${x.count} asked for` }
      : items.some((it) => it.doc)
        ? { key: 'count', state: 'unknown', line: `${x.count} asked for — the list is behind a link, so it was not counted` }
        : { key: 'count', state: 'fail', line: `${n} of ${x.count} asked for` });
  }

  if (x.links) {
    const dead = links.filter((l) => l.state === 'dead');
    const ok = links.filter((l) => l.state === 'ok');
    const sourced = items.filter((it) => it.hrefs.length).length;
    checks.push(!links.length
      ? { key: 'links', state: 'fail', line: 'No links to check — every finding needs the page it came from' }
      : dead.length
        ? { key: 'links', state: 'fail', line: `${dead.length} of ${links.length} link${links.length === 1 ? '' : 's'} do${dead.length === 1 ? 'es' : ''} not open` }
        : items.length > sourced
          ? { key: 'links', state: 'fail', line: `${items.length - sourced} of ${items.length} findings have no link` }
          : ok.length === links.length
            ? { key: 'links', state: 'pass', line: `${links.length} link${links.length === 1 ? '' : 's'} open` }
            : { key: 'links', state: 'unknown', line: `${ok.length} of ${links.length} links open; the rest would not answer a check` });
  }

  if (x.dates.length) {
    const from = x.dates[0];
    const to = x.dates[x.dates.length - 1];
    const window = from === to ? fmtDay(from) : `${fmtDay(from)} to ${fmtDay(to)}`;
    // Only items that name a day can be off it. A list that names none is not
    // wrong, it is unchecked — and saying so is the honest answer.
    const dated = items.map((it) => datesNamed(it.text, writtenOn.slice(0, 10))).filter((d) => d.length);
    const off = dated.filter((d) => !d.some((day) => day >= from && day <= to)).length;
    checks.push(!dated.length
      ? { key: 'dates', state: 'unknown', line: `For ${window} — no finding names a day, so the day was not checked` }
      : off
        ? { key: 'dates', state: 'fail', line: `${off} of ${dated.length} dated finding${dated.length === 1 ? '' : 's'} not for ${window}` }
        : { key: 'dates', state: 'pass', line: `For ${window}` });
  }

  const failed = checks.filter((c) => c.state === 'fail');
  // Each line says what to do, and every one ends the same way: a re-delivery
  // is checked on its own (deliver.ts), so the done must carry the whole list.
  const whole = 'Then report done again with the whole list in its artifact.';
  const sendBack = failed.map((c) => {
    if (c.key === 'links') {
      const dead = links.filter((l) => l.state === 'dead').map((l) => `${l.url}${l.code ? ` (${l.code})` : ''}`);
      return dead.length ? `${c.line}: ${dead.join(', ')}. Replace them with pages that open. ${whole}` : `${c.line}. Attach the page each one came from. ${whole}`;
    }
    if (c.key === 'count') return `${c.line}. Find the rest. ${whole}`;
    return `${c.line}. Each one has to be for the day asked. ${whole}`;
  });
  return { checks, passed: !failed.length, sendBack };
}

/** Whether a delivery needs checking at all: only a done, and only when something can be checked. */
export const worthChecking = (x: Expectations, events: Array<{ kind: string }>) =>
  events.some((e) => e.kind === 'done') && (x.count !== null || x.links || x.dates.length > 0);

/** The checks as one line for a card: the first failure, else what passed. */
export function verdictLine(v: Pick<Verdict, 'checks' | 'passed'>): string {
  const fail = v.checks.find((c) => c.state === 'fail');
  if (fail) return fail.line;
  return v.checks.filter((c) => c.state === 'pass').map((c) => c.line).join(' · ') || 'Nothing to check';
}

/** The ring label a step mark reads as, for the screen. */
export const YOURS_TAG: Record<'commit' | 'reach' | 'ask', string> = {
  commit: 'Yours',
  reach: 'Yours to send',
  ask: 'Asks you first',
};

/** Whether any ring above read is ever autonomous. A test pins this: if it changes, the guard's notes are wrong. */
export const NOTHING_ABOVE_READ_RUNS_ALONE = !AUTHORITY.reach.autonomous && !AUTHORITY.commit.autonomous;
