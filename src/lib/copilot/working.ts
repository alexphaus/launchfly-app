// src/lib/copilot/working.ts
// What the app knows about this business, as opposed to what it can guess.
//
// Every draft, every judged feed item and every commissioned piece of research
// is written from offer.sells, for_who, problem, price_band and proof_url. Five
// strings. That is a headline, and it is why the output reads like a template
// however good the model is: there is nothing specific for it to be specific
// about. A cofounder knows how delivery actually happens, what was quoted last
// time and whether it closed, which customer worked out, what has already been
// tried and failed, and what this person will not do. None of that is derivable
// from a headline, and all of it changes what should be written.
//
// The rule that shapes the whole file: TWO sources and never a third.
//
//   'you'       the user wrote it. True because they said so.
//   'observed'  computed from their rows and carrying the count. "3 of your 4
//               replies came from resorts" is a fact this app can state because
//               it can point at the rows behind it.
//
// What is missing is the interesting part. There is no 'inferred'. The app does
// not form a view about somebody's business and then feed that view back to
// itself as context — that is the mechanism by which an assistant becomes
// confidently wrong about the one subject its user knows better than it does,
// and it is invariant 2 at the level of prose rather than numbers.
//
// So observedFrom below produces sentences that are arithmetic with words around
// them, never conclusions. "3 of 4 replies came from resorts" is in; "you are
// good at resorts" is out, and the test says so.
//
// Pure: no DB import. store.ts reads and writes; the prompts read workingBrief.

import type { Diagnosis } from './diagnose';
import type { Metrics } from './types';

/* ─── Sections ────────────────────────────────────────────────────────────── */

export const SECTIONS = ['deliver', 'price', 'works_for', 'tried', 'refuse', 'voice'] as const;
export type WorkingSection = (typeof SECTIONS)[number];

export interface SectionMeta {
  label: string;
  /** What goes in it, in the user's terms. Shown above the field. */
  blurb: string;
  /** A real example, so the field is not answered with one word. */
  placeholder: string;
  /** Why the app wants it — what changes when it is filled in. */
  changes: string;
}

export const SECTION: Record<WorkingSection, SectionMeta> = {
  deliver: {
    label: 'How you deliver',
    blurb: 'The actual steps, how long they take, and what you need from them to start.',
    placeholder: 'Two calls, then I build it in their account. Five working days. I need admin access and their current reply templates.',
    changes: 'Lets a draft say "live in five days" instead of "quick turnaround".',
  },
  price: {
    label: 'What you charge',
    blurb: 'What you quoted, and whether it closed. Both halves — a price nobody paid is the useful half.',
    placeholder: '$900 for the build, $150/mo after. Quoted $1,800 twice and lost both.',
    changes: 'Lets the app name a number without inventing one.',
  },
  works_for: {
    label: 'Who it works for',
    blurb: 'The ones that went well, the ones that did not, and what was different.',
    placeholder: 'Resorts with 20+ rooms and one person answering the phone. Restaurants were a bad fit — too few enquiries to matter.',
    changes: 'Changes who gets sourced and who gets skipped.',
  },
  tried: {
    label: 'What you have tried',
    blurb: 'And what came of it. Especially the things that did not work.',
    placeholder: 'Cold DMs on Instagram for six weeks — 90 sent, 2 replies, 0 calls. Facebook groups got me two clients.',
    changes: 'Stops the app proposing the thing you already know fails.',
  },
  refuse: {
    label: 'What you will not do',
    blurb: 'Out of scope, out of the question, or just not worth it to you.',
    placeholder: 'No full websites. No retainers under $100. Nothing that needs me on a call before 9am.',
    changes: 'Stops Moves you would bin on sight — before they cost you the read.',
  },
  voice: {
    label: 'How you write',
    blurb: 'So a draft sounds like you and not like an app.',
    placeholder: 'Short. No "I hope this finds you well". I open with what I noticed about their place.',
    changes: 'Changes every draft, which is most of what this app produces.',
  },
};

/* ─── The entry ───────────────────────────────────────────────────────────── */

export type WorkingSource = 'you' | 'observed';
export type WorkingStatus = 'live' | 'proposed' | 'declined';

export interface WorkingEntry {
  id: string;
  section: WorkingSection;
  body: string;
  source: WorkingSource;
  /** The rows behind an observed entry. Null for anything the user wrote. */
  evidence: string | null;
  status: WorkingStatus;
  observed_key: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export const BODY_MAX = 600;
export const EVIDENCE_MAX = 160;
/** Per section. Past this it is a document, and a document nobody reads. */
export const MAX_PER_SECTION = 8;
/**
 * Rows a reading needs before it is worth stating. Four matches the Move
 * keep-rate's floor for the same reason: below it a pattern is one good week.
 */
export const MIN_OBSERVED = 4;

export function isSection(v: unknown): v is WorkingSection {
  return typeof v === 'string' && (SECTIONS as readonly string[]).includes(v);
}

/* ─── What the app can honestly observe ───────────────────────────────────── */

export interface ObservedDraft {
  section: WorkingSection;
  body: string;
  evidence: string;
  /** Stable per reading, so recomputing updates the row instead of stacking. */
  observed_key: string;
}

const pct = (n: number, of: number) => Math.round((n / of) * 100);

/**
 * Readings the ledger can support, as sentences that are arithmetic with words
 * around them.
 *
 * Every line here names its own numbers, and that is not a stylistic choice —
 * it is what separates this from the skill levels and estimated percentages
 * deleted in 3eaa03f. A sentence carrying its count can be checked by the person
 * reading it; one that says "you are strong at X" cannot be checked at all, and
 * a user who disagrees with it has no way to argue.
 *
 * Nothing is emitted below MIN_OBSERVED, and nothing is emitted about a funnel
 * the diagnosis itself calls thin. An app that states a pattern from two rows is
 * wrong more often than it is right, and it only has to be wrong once about
 * somebody's own business to stop being believed about anything.
 */
export function observedFrom(diagnosis: Diagnosis, metrics: Metrics): ObservedDraft[] {
  const out: ObservedDraft[] = [];
  if (diagnosis.thin) return out;

  // What the market in front of you keeps asking for. The one measurement in
  // this product nothing general can reconstruct.
  const top = diagnosis.openings[0];
  if (top && top.count >= MIN_OBSERVED) {
    out.push({
      section: 'works_for',
      body: `${top.count} of your matches mention ${top.term}, and your offer does not cover it.`,
      evidence: `${top.count} matches`,
      observed_key: `opening:${top.term}`,
    });
  }

  // Where replies actually come from. Segment, not guess.
  const bySegment = [...diagnosis.segments].sort((a, b) => b.businesses - a.businesses)[0];
  if (bySegment && bySegment.businesses >= MIN_OBSERVED) {
    const also = bySegment.openings[0];
    out.push({
      section: 'works_for',
      // The segment alone is a headcount; the segment plus what they all
      // mention is the thing that changes who gets sourced next.
      body: `${bySegment.businesses} of your matches are ${bySegment.segment}`
        + (also && also.count >= 2 ? `, and ${also.count} of them mention ${also.term}.` : '.'),
      evidence: `${bySegment.businesses} matches`,
      observed_key: `segment:${bySegment.segment}`,
    });
  }

  // The funnel's worst step, stated as the two counts rather than as a verdict.
  const b = diagnosis.bottleneck;
  if (b && b.rate != null && b.count >= 1) {
    const above = diagnosis.stages[diagnosis.stages.findIndex((s) => s.key === b.key) - 1];
    if (above && above.count >= MIN_OBSERVED) {
      out.push({
        section: 'tried',
        body: `${above.count} reached ${above.label.toLowerCase()} and ${b.count} reached ${b.label.toLowerCase()} — ${pct(b.count, above.count)}%.`,
        evidence: `${above.count} → ${b.count}`,
        observed_key: `funnel:${b.key}`,
      });
    }
  }

  // What closed, and for how much. Only with a real amount: won_amount has sat
  // at $1 against six meetings on the live account, and "you have won $1" is a
  // true sentence that teaches a model nothing except a wrong price band.
  if (metrics.won >= 1 && metrics.won_amount > 0 && metrics.won_amount / metrics.won >= 1) {
    const avg = Math.round(metrics.won_amount / metrics.won);
    out.push({
      section: 'price',
      body: `${metrics.won} closed, averaging ${avg} each.`,
      evidence: `${metrics.won} won`,
      observed_key: 'price:won-average',
    });
  }

  // Sends against replies. The rate the whole product is judged on, and the one
  // that has to be stated as both counts or it reads as a grade.
  if (metrics.sent >= MIN_OBSERVED) {
    out.push({
      section: 'tried',
      body: `${metrics.sent} sent in the last ${metrics.window_days} days, ${metrics.replies} replied.`,
      evidence: `${metrics.sent} sent`,
      observed_key: 'funnel:reply-rate',
    });
  }

  return out;
}

/**
 * Proposals worth writing: nothing the user already declined, nothing unchanged.
 *
 * Both filters matter. Re-proposing a declined reading every night is the app
 * not listening, which is the failure REFUSAL_DECAY exists to stop one layer
 * up. Rewriting an unchanged row bumps updated_at and makes the sheet look like
 * something happened when nothing did.
 */
export function newObserved(drafts: ObservedDraft[], existing: WorkingEntry[]): ObservedDraft[] {
  const byKey = new Map(existing.filter((e) => e.observed_key).map((e) => [e.observed_key!, e]));
  return drafts.filter((d) => {
    const prev = byKey.get(d.observed_key);
    if (!prev) return true;
    if (prev.status === 'declined') return false;
    return prev.body !== d.body;
  });
}

/* ─── What the prompts read ───────────────────────────────────────────────── */

/**
 * The working file as a block for a prompt.
 *
 * Only 'live'. A proposal is the app's reading waiting on the person who lived
 * it, and feeding it to a model before they have seen it would make the
 * confirmation step decorative — the app would already be acting on it.
 *
 * Observed lines carry their evidence into the prompt too, so a model weighing
 * "3 of 4 replies came from resorts" against something the user typed can tell
 * which is a count and which is a statement. Prose that hides where it came from
 * is how a guess gets treated as a fact two hops later.
 */
export function workingBrief(entries: WorkingEntry[], maxPerSection = MAX_PER_SECTION): string {
  const live = entries.filter((e) => e.status === 'live');
  if (!live.length) return '';

  const lines: string[] = [];
  for (const section of SECTIONS) {
    const rows = live.filter((e) => e.section === section).slice(0, maxPerSection);
    if (!rows.length) continue;
    lines.push(`${SECTION[section].label}:`);
    for (const r of rows) {
      lines.push(`- ${r.body}${r.source === 'observed' && r.evidence ? ` (from your rows: ${r.evidence})` : ''}`);
    }
  }
  return lines.join('\n');
}

/** Sections with nothing in them, so the sheet can ask for the ones that matter. */
export function emptySections(entries: WorkingEntry[]): WorkingSection[] {
  const live = new Set(entries.filter((e) => e.status === 'live').map((e) => e.section));
  return SECTIONS.filter((s) => !live.has(s));
}

/**
 * How much of the file is filled in, as a count rather than a percentage.
 *
 * A percentage would imply a finished state, and this is never finished — it is
 * a file somebody keeps. "4 of 6" says where you are without pretending there is
 * a score to max out.
 */
export function workingProgress(entries: WorkingEntry[]): { filled: number; total: number; proposals: number } {
  return {
    filled: SECTIONS.length - emptySections(entries).length,
    total: SECTIONS.length,
    proposals: entries.filter((e) => e.status === 'proposed').length,
  };
}
