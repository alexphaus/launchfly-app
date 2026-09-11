// src/lib/copilot/watch/judge.ts
// One model call per source per night, and what it is allowed to come back with.
//
// Pure — no DB import, no fetch — so copilot-core.test.ts covers the rules that
// decide what a stranger's feed is allowed to put on somebody's morning screen.
//
// The economics are the design. Judging an item at a time is a model call per
// post, which for six feeds on a busy week is hundreds a night; judging a whole
// source at once is one. The batch is also what makes the answer better: asked
// to pick three from twenty-five, a model compares, and comparison is the
// judgement being bought. Asked about one item in isolation it grades, and a
// grader shown a plausible item says yes.
//
// The brief is assembled from rows the user created — their goals, their offer,
// their area, their runway. Nothing here asks a model what the user wants. That
// distinction is the whole difference between a watcher and a feed reader.

import { MOVE_KINDS, type KeepRates, type MoveDraft, type MoveKind, keepSummary } from '../moves';
import type { Stake } from '../stake';
import type { FeedItem } from './feed';
import type { Goal, Metrics, Offer, Profile } from '../types';

/** Most a single source may promote in one night, however good the feed is. */
export const MAX_PICKS_PER_SOURCE = 3;
/** Nothing is urgent for longer than this; nothing is due sooner than tomorrow. */
export const MIN_WITHIN_DAYS = 1;
export const MAX_WITHIN_DAYS = 30;
/** An item published today is worth acting on today; a two-week-old one is not. */
export const FRESH_WITHIN_DAYS = 3;
export const STALE_WITHIN_DAYS = 14;

export interface WatchSourceRef {
  id: string;
  label: string;
  url: string;
  /** Why the user added it, in their words. The judge is told. */
  intent?: string | null;
}

/**
 * What the judge is told about the person, entirely from their own rows.
 *
 * Deliberately not "a summary of the user" — it is the four things that decide
 * whether an item is worth their morning: what they are trying to do, what they
 * can do, where they are, and what an hour of theirs is against.
 */
export interface WatchBrief {
  /** One line: what they do. From the offer, falling back to the headline. */
  who: string;
  /** Their active goals, with the gap where there is one. */
  goals: string[];
  /** Area, time today, runway. What makes an item actionable or not. */
  constraints: string[];
  /**
   * What they have actually acted on, read off answered Moves. Empty until
   * MIN_MOVE_SAMPLE of a kind have been answered, because a rate computed from
   * one dismissal is a bad morning, not a preference.
   *
   * The only line here that is about the app's own history rather than the
   * user's rows, and it is the feedback this judge had none of: it picked three
   * items out of twenty-five every night and never once found out whether any
   * of them were wanted.
   */
  acts?: { kept: MoveKind[]; binned: MoveKind[] };
}

const money = (n: number, unit?: string | null) => `${unit || '$'}${Math.round(n).toLocaleString('en-US')}`;

export function watchBrief(input: {
  profile: Pick<Profile, 'headline' | 'location' | 'target_area' | 'offer' | 'capacity'>;
  goals: Goal[];
  metrics: Pick<Metrics, 'runway_months'>;
  capacityMinutes: number;
  keeps?: KeepRates;
}): WatchBrief {
  const offer: Offer = input.profile.offer ?? {};
  const who = [offer.sells, offer.for_who && `for ${offer.for_who}`, offer.price_band]
    .filter(Boolean).join(', ') || input.profile.headline || 'No offer on file yet';

  const goals = input.goals.slice(0, 4).map((g) => {
    const target = g.target_value;
    if (g.metric === 'currency' && typeof target === 'number' && target > 0) {
      const now = g.current_value ?? 0;
      return `${g.title} — ${money(now, g.unit)} of ${money(target, g.unit)}${g.horizon_days ? `, ${g.horizon_days} days left` : ''}`;
    }
    // A goal with no meter is still the most important sentence here. It is the
    // one that turns a job board into a job board worth reading.
    return g.note ? `${g.title} — ${g.note}` : g.title;
  });

  const area = input.profile.target_area || input.profile.location;
  const constraints = [
    area ? `Based in ${area}` : 'No location set, so treat remote and on-site as equal',
    `About ${input.capacityMinutes} minutes free today`,
    input.metrics.runway_months != null
      ? `${input.metrics.runway_months} months of runway, so unpaid work is the expensive kind`
      : 'No runway on file',
  ];

  const acts = input.keeps ? keepSummary(input.keeps) : null;
  return {
    who, goals, constraints,
    // Omitted entirely when neither list has anything to say, so the prompt
    // never carries a heading with nothing under it.
    ...(acts && (acts.kept.length || acts.binned.length) ? { acts } : {}),
  };
}

export function briefText(b: WatchBrief): string {
  return [
    `WHO THEY ARE: ${b.who}`,
    b.goals.length ? `WHAT THEY ARE TRYING TO DO:\n${b.goals.map((g) => `- ${g}`).join('\n')}` : 'WHAT THEY ARE TRYING TO DO: nothing written down yet',
    `CONSTRAINTS:\n${b.constraints.map((c) => `- ${c}`).join('\n')}`,
    // Stated as behaviour rather than as an instruction, because it is evidence
    // about this person and the model should weigh it against the item in front
    // of it — a binned kind that is unmistakably the right answer today still is.
    b.acts
      ? `WHAT THEY ACT ON: ${[
          b.acts.kept.length ? `they follow through on ${b.acts.kept.join(', ')}` : null,
          b.acts.binned.length ? `they bin ${b.acts.binned.join(', ')} almost every time` : null,
        ].filter(Boolean).join('; ')}.`
      : null,
  ].filter((l) => l !== null).join('\n\n');
}

export const JUDGE_SYSTEM = [
  'You read one feed on behalf of one person and pick only what is worth their morning.',
  '',
  'You are not a summariser and not a recommender. The default answer is an empty list:',
  'most days a feed contains nothing that moves this person, and saying so is the correct',
  'and most valuable answer. Picking something mediocre costs more than picking nothing,',
  'because the next day they stop reading.',
  '',
  'Pick an item only if all of these hold:',
  '1. It connects to something they said they are trying to do, not merely to their industry.',
  '2. There is a concrete first action available today — apply, reply, book, buy, watch, quote.',
  '3. Their constraints do not rule it out (location, time, money).',
  '',
  'Each pick carries one imperative headline naming the action, and one or two reasons that',
  'quote the item. Never state a number — a rate, a budget, a price — that is not written in',
  'the item you are quoting. If the item does not say what it pays, say it does not say.',
  '',
  'Answer with JSON only: {"picks":[{"id","kind","headline","why":[],"cost_label","value","within_days"}]}',
  `kind is one of: ${MOVE_KINDS.join(', ')}.`,
  'value is the money the item itself states, as a bare number, omitted when it states none.',
  'within_days is how soon it stops being available, omitted when the item does not say.',
].join('\n');

/** The batch. One source, its items numbered, and nothing else. */
export function judgePrompt(brief: WatchBrief, source: WatchSourceRef, items: FeedItem[]): string {
  return [
    briefText(brief),
    '',
    `THE FEED: ${source.label} (${source.url})`,
    source.intent ? `They added it because: ${source.intent}` : null,
    '',
    'NEW ITEMS:',
    items.map((it, i) => [
      `[${i + 1}] id=${it.id}`,
      `title: ${it.title}`,
      it.publishedAt ? `posted: ${it.publishedAt.slice(0, 10)}` : null,
      it.text ? `body: ${it.text}` : null,
    ].filter(Boolean).join('\n')).join('\n\n'),
    '',
    `Pick at most ${MAX_PICKS_PER_SOURCE}. Pick none if none of them earn it.`,
  ].filter((l) => l !== null).join('\n');
}

export interface Verdict {
  id: string;
  kind: MoveKind;
  headline: string;
  why: string[];
  costLabel: string | null;
  value: number | null;
  withinDays: number | null;
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.\-]/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * The one number the model is not trusted with.
 *
 * "The user's numbers are never invented" is an invariant of this codebase, and a
 * value on a Move feeds straight into scoreMove's money factor — a hallucinated
 * $5,000 on a post that mentions no budget would buy the top of the screen. So a
 * value survives only if its digits actually appear in the item it came from.
 * Compared without separators, because a feed writes "1,200" and "1200" and
 * "1.2k" for the same thing and only the first two are checkable.
 */
export function valueFromItem(value: number | null, item: FeedItem): number | null {
  if (value == null || value <= 0) return null;
  const haystack = `${item.title} ${item.text}`.replace(/[,\s_]/g, '');
  const digits = String(Math.round(value));
  return haystack.includes(digits) ? value : null;
}

/**
 * How soon this stops being available. The model's answer when the item states a
 * deadline, otherwise read off the posting date: a gig posted today is competed
 * for today, and one posted three weeks ago is mostly gone. Never invented —
 * both inputs are things somebody wrote down.
 */
export function withinDaysFor(modelValue: number | null, item: FeedItem, now: Date): number {
  if (modelValue != null) return Math.min(MAX_WITHIN_DAYS, Math.max(MIN_WITHIN_DAYS, Math.round(modelValue)));
  if (!item.publishedAt) return STALE_WITHIN_DAYS;
  const ageDays = (now.getTime() - Date.parse(item.publishedAt)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return STALE_WITHIN_DAYS;
  return ageDays <= FRESH_WITHIN_DAYS ? FRESH_WITHIN_DAYS : STALE_WITHIN_DAYS;
}

/**
 * Whatever the model returned, forced into verdicts against the items actually
 * shown. A pick whose id is not one of them is dropped rather than repaired:
 * that is the failure mode where a model writes a plausible opportunity that
 * nobody posted, and there is no safe way to render it.
 */
export function parseVerdicts(raw: unknown, items: FeedItem[]): Verdict[] {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const picks = Array.isArray(root.picks) ? root.picks : Array.isArray(raw) ? raw : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: Verdict[] = [];

  for (const p of picks) {
    const r = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const id = str(r.id, 300);
    // Models number things. Accept "[2]" or 2 as the index it was shown, since
    // refusing it would throw away a good pick over a formatting habit.
    const byIndex = id == null || !byId.has(id) ? items[(num(r.index ?? r.id) ?? 0) - 1] : null;
    const item = (id && byId.get(id)) || byIndex;
    if (!item || seen.has(item.id)) continue;

    const headline = str(r.headline ?? r.title, 160);
    const why = (Array.isArray(r.why) ? r.why : [r.why])
      .map((w) => str(w, 200)).filter((w): w is string => !!w).slice(0, 2);
    if (!headline || !why.length) continue;   // a pick that cites nothing is a guess

    seen.add(item.id);
    out.push({
      id: item.id,
      kind: MOVE_KINDS.includes(r.kind as MoveKind) ? (r.kind as MoveKind) : 'earn',
      headline, why,
      costLabel: str(r.cost_label ?? r.costLabel, 40),
      value: valueFromItem(num(r.value), item),
      withinDays: num(r.within_days ?? r.withinDays),
    });
    if (out.length >= MAX_PICKS_PER_SOURCE) break;
  }
  return out;
}

/**
 * Verdicts become Moves — not Opportunities.
 *
 * This is the point of the whole file. supply/types.ts types everything it finds
 * as an OpportunityType, all five of which are somebody to message, so a YouTube
 * tutorial and a flight price and a subcontract brief all had to arrive as a
 * business with a contact or not arrive at all. A Move has eight kinds and
 * carries the thing itself, so the tutorial is a `learn` whose artifact is the
 * link and the brief is an `earn` whose artifact is the post.
 */
export function movesFromVerdicts(
  verdicts: Verdict[],
  items: FeedItem[],
  source: WatchSourceRef,
  now: Date,
): MoveDraft[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return verdicts.flatMap((v) => {
    const item = byId.get(v.id);
    if (!item) return [];
    const withinDays = withinDaysFor(v.withinDays, item, now);
    const stake: Stake = {
      // What a found opportunity claims: a reply from somebody new. `won_amount`
      // would be the honest metric for a gig, but nothing here has been priced
      // or agreed, and a stake the ledger cannot read back is a promise.
      metric: v.kind === 'earn' ? 'replies' : 'none',
      direction: 'up',
      by: 1,
      withinDays,
      ...(v.value != null ? { value: v.value } : {}),
    };
    return [{
      job: 'watch',
      kind: v.kind,
      // Namespaced by source: two feeds carrying the same crosspost are one
      // Move, and a source removed and re-added does not replay its backlog.
      external_id: `${source.id}:${item.id}`.slice(0, 200),
      headline: v.headline,
      why: [...v.why, `From ${source.label}${item.publishedAt ? `, posted ${item.publishedAt.slice(0, 10)}` : ''}.`],
      artifact: item.url
        ? { kind: 'link' as const, label: 'Open it', value: item.text || item.title, href: item.url }
        // A feed item with no link is rare and still worth reading; it just
        // cannot pretend to have a destination. isDeliverable enforces the same.
        : { kind: 'text' as const, label: 'Read it', value: item.text || item.title },
      cost_label: v.costLabel,
      stake,
    }];
  });
}
