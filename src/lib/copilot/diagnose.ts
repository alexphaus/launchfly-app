// src/lib/copilot/diagnose.ts
// Replaces the invented "skill level 0-100" with arithmetic.
//
// Rules this module obeys, because the old Growth tab broke all three:
//   1. Never show a number that was not computed from rows.
//   2. Never compare two things without a minimum sample on both sides.
//   3. When there is not enough data, say so plainly — an honest "nothing to
//      diagnose yet, here is why" beats four confident fabrications.
//
// Pure functions only: store.ts loads the rows, this turns them into a
// Diagnosis. Everything here is unit-tested.

import type { Execution, Offer, Opportunity, Outcome, OutcomeKind } from './types';

/** Minimum sends before a channel/source comparison is allowed to claim anything. */
export const MIN_SAMPLE = 5;
/** How many matches must mention a term before it counts as market demand. */
export const MIN_DEMAND = 3;

export interface FunnelStage {
  key: 'matched' | 'drafted' | 'sent' | 'replied' | 'meeting' | 'won';
  label: string;
  count: number;
  /** Conversion from the previous stage, null for the first and when the previous stage is 0. Never above 1. */
  rate: number | null;
  /** True when this stage holds more than the one above it — outcomes logged for
   *  work this app did not send. The count is still the truth; the rate is not. */
  exceedsPrevious?: boolean;
}

export interface Finding {
  kind: 'bottleneck' | 'channel' | 'source' | 'demand' | 'outside' | 'insufficient';
  /** One sentence, always citing the numbers behind it. */
  headline: string;
  detail: string;
  /** What to do about it. Present only when the data actually implies an action. */
  action?: string;
  /** A term the user should consider learning or adding to their offer. */
  topic?: string;
}

export interface Diagnosis {
  stages: FunnelStage[];
  /**
   * Outcomes recorded against matches this app never sent — logged by hand, or
   * work that happened over the phone. Real, but outside the funnel's chain, so
   * the rates below Sent understate what actually happened.
   */
  outsideFunnel: number;
  /** The stage with the worst conversion that has enough data to judge. */
  bottleneck: FunnelStage | null;
  findings: Finding[];
  /** True when nothing can honestly be concluded yet. */
  thin: boolean;
}

export interface DiagnoseInput {
  opportunities: Array<Pick<Opportunity, 'status' | 'source' | 'source_kind' | 'data' | 'reason' | 'title'> & { id: string }>;
  executions: Array<Pick<Execution, 'approval_state' | 'channel' | 'opportunity_id'>>;
  outcomes: Array<Pick<Outcome, 'kind' | 'opportunity_id'>>;
  offer: Offer;
}

// A conversion rate is a share of the stage above it, so it is capped at 1.
// Without this, 6 meetings logged against 1 reply rendered as "600%".
const pctOf = (n: number, d: number): number | null => (d > 0 ? Math.min(1, Math.round((n / d) * 1000) / 1000) : null);
const asPct = (r: number) => `${Math.round(r * 100)}%`;

export function diagnose(input: DiagnoseInput): Diagnosis {
  const { opportunities, executions, outcomes, offer } = input;

  const sentExecs = executions.filter((e) => e.approval_state === 'sent');
  const drafted = executions.filter((e) => e.approval_state !== 'cancelled').length;
  const count = (k: OutcomeKind) => outcomes.filter((o) => o.kind === k).length;

  const matched = opportunities.length;
  const sent = sentExecs.length;
  // A reply counts once per opportunity; two replies from one lead is still one converted lead.
  const repliedOpps = new Set(outcomes.filter((o) => o.kind === 'reply' && o.opportunity_id).map((o) => o.opportunity_id));
  const replied = repliedOpps.size || count('reply');

  const stages: FunnelStage[] = [
    { key: 'matched', label: 'Matched', count: matched, rate: null },
    { key: 'drafted', label: 'Drafted', count: drafted, rate: pctOf(drafted, matched) },
    { key: 'sent', label: 'Sent', count: sent, rate: pctOf(sent, drafted) },
    { key: 'replied', label: 'Replied', count: replied, rate: pctOf(replied, sent) },
    { key: 'meeting', label: 'Meeting', count: count('meeting'), rate: pctOf(count('meeting'), replied) },
    { key: 'won', label: 'Won', count: count('won'), rate: pctOf(count('won'), count('meeting') || replied) },
  ];
  // Flag any stage holding more than the one above it. The count stays honest;
  // the flag tells the UI not to present its rate as a conversion.
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].count > stages[i - 1].count) stages[i].exceedsPrevious = true;
  }

  // Outcomes on opportunities with no sent execution: real work the app did not do.
  const sentOppIds = new Set(sentExecs.map((e) => e.opportunity_id).filter(Boolean));
  const outsideFunnel = new Set(
    outcomes.filter((o) => o.opportunity_id && !sentOppIds.has(o.opportunity_id)).map((o) => o.opportunity_id),
  ).size;

  const findings: Finding[] = [];

  // --- The bottleneck: the earliest stage that loses the most, with enough volume to judge.
  const judgeable = stages.filter((s, i) => s.rate !== null && !s.exceedsPrevious && stages[i - 1].count >= MIN_SAMPLE);
  const bottleneck = judgeable.length ? judgeable.reduce((worst, s) => (s.rate! < worst.rate! ? s : worst)) : null;

  if (bottleneck) {
    const prev = stages[stages.findIndex((s) => s.key === bottleneck.key) - 1];
    findings.push({
      kind: 'bottleneck',
      headline: `${prev.label} → ${bottleneck.label} is where you lose most: ${bottleneck.count} of ${prev.count} (${asPct(bottleneck.rate!)}).`,
      detail: BOTTLENECK_DETAIL[bottleneck.key],
      action: BOTTLENECK_ACTION[bottleneck.key],
      topic: BOTTLENECK_TOPIC[bottleneck.key],
    });
  }

  // --- Channel comparison, only with a real sample on both sides.
  const byChannel = ['whatsapp', 'email'].map((ch) => {
    const es = sentExecs.filter((e) => e.channel === ch);
    const reps = es.filter((e) => e.opportunity_id && repliedOpps.has(e.opportunity_id)).length;
    return { ch, sent: es.length, replied: reps, rate: pctOf(reps, es.length) };
  }).filter((c) => c.sent >= MIN_SAMPLE);

  if (byChannel.length === 2) {
    const [a, b] = [...byChannel].sort((x, y) => (y.rate ?? 0) - (x.rate ?? 0));
    if ((a.rate ?? 0) - (b.rate ?? 0) >= 0.1) {
      findings.push({
        kind: 'channel',
        headline: `${label(a.ch)} replies at ${asPct(a.rate!)}, ${label(b.ch)} at ${asPct(b.rate!)}.`,
        detail: `${a.sent} sent on ${label(a.ch)} for ${a.replied} replies; ${b.sent} on ${label(b.ch)} for ${b.replied}. Same person, same offer — so this is the channel or the opener, not the market.`,
        action: `Move your next batch to ${label(a.ch)}, or rewrite the ${label(b.ch)} opener before sending more.`,
      });
    }
  }

  // --- Source comparison: which supply actually converts.
  const oppSource = new Map(opportunities.map((o) => [o.id, o.source ?? 'unknown']));
  const bySource = new Map<string, { sent: number; replied: number }>();
  for (const e of sentExecs) {
    const src = (e.opportunity_id && oppSource.get(e.opportunity_id)) || 'unknown';
    const row = bySource.get(src) ?? { sent: 0, replied: 0 };
    row.sent += 1;
    if (e.opportunity_id && repliedOpps.has(e.opportunity_id)) row.replied += 1;
    bySource.set(src, row);
  }
  const sources = [...bySource.entries()].filter(([, v]) => v.sent >= MIN_SAMPLE)
    .map(([k, v]) => ({ source: k, ...v, rate: pctOf(v.replied, v.sent)! }))
    .sort((a, b) => b.rate - a.rate);
  if (sources.length >= 2 && sources[0].rate - sources[sources.length - 1].rate >= 0.1) {
    const best = sources[0]; const worst = sources[sources.length - 1];
    findings.push({
      kind: 'source',
      headline: `Matches from ${best.source} reply at ${asPct(best.rate)}; ${worst.source} at ${asPct(worst.rate)}.`,
      detail: `${best.replied}/${best.sent} versus ${worst.replied}/${worst.sent}. Where a match comes from is predicting whether it answers.`,
      action: `Weight ${best.source} higher and spend less time on ${worst.source}.`,
    });
  }

  // --- Demand the offer does not cover: terms recurring across real matches.
  const demand = demandGap(opportunities, offer);
  if (demand.length) {
    const top = demand[0];
    findings.push({
      kind: 'demand',
      headline: `"${top.term}" appears in ${top.count} of your matches and is not in your offer.`,
      detail: demand.length > 1
        ? `Also recurring: ${demand.slice(1, 4).map((d) => `${d.term} (${d.count})`).join(', ')}. These are what the market in front of you keeps asking for.`
        : 'That is what the market in front of you keeps asking for.',
      action: `Either add it to your offer, or stop matching on segments that need it.`,
      topic: top.term,
    });
  }

  // --- Outcomes logged outside the app: explain the funnel rather than let it look broken.
  if (outsideFunnel > 0) {
    findings.push({
      kind: 'outside',
      headline: `${outsideFunnel} ${outsideFunnel === 1 ? 'match has an outcome' : 'matches have outcomes'} this app never sent.`,
      detail: 'You logged a reply, meeting or win on work that went out some other way. The counts above include it; the rates below Sent do not, so they read lower than reality.',
      action: 'Send through the copilot — even by tapping "I sent it" — and the funnel starts measuring the whole picture.',
    });
  }

  // --- Nothing yet: say exactly what is missing rather than filling space.
  const thin = findings.every((f) => f.kind === 'outside');
  if (thin) {
    const blocker = sent === 0
      ? drafted === 0
        ? matched === 0
          ? { headline: 'No matches yet, so there is nothing to measure.', action: 'Set your targeting in the You tab, then tap Find new matches.' }
          : { headline: `${matched} matches, nothing drafted yet.`, action: 'Open a match and draft an opener. The funnel starts there.' }
        : { headline: `${drafted} drafted, nothing sent yet.`, action: 'Approve a draft, or open it in WhatsApp and tap "I sent it".' }
      : { headline: `Only ${sent} sent so far — too few to tell signal from luck.`, action: `Get to ${MIN_SAMPLE} sends on a channel and this fills in by itself.` };
    findings.push({ kind: 'insufficient', headline: blocker.headline, detail: 'Everything on this tab is computed from what you actually sent and what came back. Nothing here is estimated.', action: blocker.action });
  }

  return { stages, bottleneck, findings, thin, outsideFunnel };
}

/**
 * The one lesson the Growth tab may show.
 *
 * "Worth learning — because of the above" is a promise, so it is enforced here
 * rather than assumed: no stuck point in the diagnosis, no lesson. GrowthView
 * already says the right thing in that case — the gap is something to change,
 * not something to study.
 *
 * A lesson with no url is also never shown. Rows written before the agent schema
 * required a working link open as a dead end: a title, a note, and no way to
 * actually learn the thing.
 */
export function selectLesson<T extends { kind: string; url?: string | null }>(
  items: T[],
  diagnosis: Pick<Diagnosis, 'findings'>,
): T[] {
  const stuckPoint = diagnosis.findings.some((f) => f.topic);
  if (!stuckPoint) return [];
  return items.filter((g) => g.kind === 'lesson' && !!g.url).slice(0, 1);
}

const label = (ch: string) => (ch === 'whatsapp' ? 'WhatsApp' : 'Email');

const BOTTLENECK_DETAIL: Record<FunnelStage['key'], string> = {
  matched: '',
  drafted: 'Matches are arriving but not turning into messages. Either the matches are wrong, or drafting is too much friction.',
  sent: 'Drafts are piling up unapproved. The writing is done; the sending is not.',
  replied: 'People are receiving your message and not answering. That is the opener, not the list.',
  meeting: 'People reply but do not book. The gap is between interest and the ask.',
  won: 'Meetings happen but do not close. The gap is scope, price or proof.',
};

const BOTTLENECK_ACTION: Record<FunnelStage['key'], string | undefined> = {
  matched: undefined,
  drafted: 'Draft from the top three matches today, or tighten targeting so fewer, better ones arrive.',
  sent: 'Clear the approval queue before finding more matches.',
  replied: 'Change one thing in the opener — the first line or the ask — and send the next batch before changing anything else.',
  meeting: 'Make the ask smaller and more specific: a named time beats "worth a call?".',
  won: 'Add proof to the offer and lead with the price band so it is not a surprise.',
};

const BOTTLENECK_TOPIC: Record<FunnelStage['key'], string | undefined> = {
  matched: undefined, drafted: undefined, sent: undefined,
  replied: 'writing cold openers that get replies',
  meeting: 'converting replies into booked calls',
  won: 'closing and pricing small projects',
};

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'you', 'your', 'are', 'has', 'have', 'not', 'new', 'all', 'any', 'can', 'per', 'via', 'inc', 'ltd', 'llc', 'com', 'www', 'services', 'service', 'business', 'company', 'pain', 'signals', 'none', 'other', 'general']);

/** Terms recurring across real matches that the offer never mentions. */
export function demandGap(
  opportunities: DiagnoseInput['opportunities'],
  offer: Offer,
): Array<{ term: string; count: number }> {
  const offerText = [offer.sells, offer.for_who, offer.problem].filter(Boolean).join(' ').toLowerCase();
  const counts = new Map<string, number>();

  for (const o of opportunities) {
    if (o.source_kind !== 'sourced') continue;      // only real matches carry real demand
    const d = o.data ?? {};
    const terms = new Set<string>();
    for (const key of ['tags', 'pain_signals']) {
      const v = (d as Record<string, unknown>)[key];
      if (Array.isArray(v)) for (const t of v) if (typeof t === 'string') terms.add(t.toLowerCase().replace(/_/g, ' ').trim());
    }
    for (const key of ['segment', 'service_type', 'category']) {
      const v = (d as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) terms.add(v.toLowerCase().replace(/_/g, ' ').trim());
    }
    // Count each term once per opportunity.
    for (const t of terms) {
      if (t.length < 3 || STOPWORDS.has(t)) continue;
      if (offerText.includes(t)) continue;           // already part of what they sell
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, c]) => c >= MIN_DEMAND)
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
