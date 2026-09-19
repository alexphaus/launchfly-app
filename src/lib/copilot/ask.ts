// src/lib/copilot/ask.ts
// Questions you can ask about your own rows. Deliberately not a chatbot.
//
// The gap. This app writes constantly and can be asked nothing. Every screen is a
// decision it has made or a record it has rendered, and the one thing a person
// actually says out loud after a fortnight of use — "hang on, which of these
// segments ever replies?" — has nowhere to go. The answer is in the database. It
// has always been in the database.
//
// Why it is a fixed list and not a text box, since a text box is obviously
// cheaper to build and obviously what a demo would show. A free-text question over
// this data has to be answered by a model, and a model answering "which segment
// replies" from rows will produce a number. It will be a plausible number. It will
// sometimes be wrong, and nobody — including the person who built it — will be
// able to tell which time. That breaks invariant 2 at its root: the whole reason
// the skill levels and the estimated percentages were deleted in 3eaa03f is that
// a figure nobody can trace is worse than no figure, because it gets acted on.
//
// So: five questions somebody actually asks, each answered by counting. The
// answers are dull, checkable and never wrong. A question worth adding is one
// that can be counted; a question that needs a guess belongs in the handoff
// export, pasted into a model that says it is guessing.
//
// Pure — no DB import — so copilot-core.test.ts covers every answer. The route
// loads the rows once and calls answerAll.

import { PLANS, type PlanKey } from './plans';
import { verdictOf } from './decision';
import type { Decision } from './types';
import type { WorthRecord } from './worth';

export const ASK_IDS = ['replies', 'stood_down', 'worked', 'drafts', 'worth'] as const;
export type AskId = (typeof ASK_IDS)[number];

/**
 * Below this, a rate is one person's week rather than a fact about a segment.
 *
 * Same reasoning as MIN_TRIAGE_SAMPLE and the same number. An answer computed off
 * three sends is not a smaller answer, it is a different kind of thing, and
 * rendering it next to one computed off eighty is how a reader is misled by
 * arithmetic that is technically correct.
 */
export const MIN_ASK_SAMPLE = 6;

export interface AskRow {
  label: string;
  /** The number, already formatted. Never a bare ratio. */
  value: string;
  /** What the number is out of, or what it is evidence of. */
  note?: string;
}

export interface AskAnswer {
  id: AskId;
  /** The question in the words somebody would use out loud. */
  q: string;
  /** The answer in one line, or what is missing. Never empty. */
  headline: string;
  rows: AskRow[];
  /**
   * Why there is not an answer yet, when there is not.
   *
   * Always set when rows is empty, and the reason this type has the field at all:
   * three separate bugs in this codebase shared the shape of a component failing,
   * the failure being swallowed, and the screen reporting calm. An empty answer
   * card that says nothing is that shape again, in a feature whose entire job is
   * to tell the truth about the record.
   */
  thin: string | null;
}

/* ─── What the route hands in ─────────────────────────────────────────────── */

export interface AskInput {
  /** Newest first. The same window the ranker reads. */
  decisions: Array<Pick<Decision, 'topic' | 'response' | 'verify' | 'headline' | 'for_date'>>;
  /** Per segment, over sourced matches this profile actually messaged. */
  segments: Array<{ segment: string; sent: number; replied: number }>;
  /** The draft funnel, counted from executions rather than from today's plan. */
  drafts: { written: number; opened: number; sent: number; replied: number; cancelled: number };
  /** Jobs stood down for good, already turned into phrases. */
  standing: string[];
  /** Topics the ledger says do not work. */
  dead: Array<{ topic: string; count: number }>;
  /** Worth per job key, from worthByJob. */
  worth: Record<string, WorthRecord>;
  /** Job key → the phrase a person would use for it. */
  phraseFor: (job: string) => string;
  /** The profile's own currency, which is what its money is counted in. */
  currency: string;
  /**
   * The currency the PLAN is priced in — a deployment-wide setting, not the
   * user's. Kept separate because it usually is not theirs, and subtracting one
   * from the other at par would be an invented number of the exact kind
   * invariant 2 exists to keep off the screen: it would tell somebody on a
   * ₱-denominated business that a $29 plan had paid for itself out of ₱100.
   */
  planCurrency: string;
  /** The plan being paid for, so "worth it" has something to be compared against. */
  plan: PlanKey;
  /** How long this account has existed, in whole months, at least 1. */
  monthsActive: number;
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');
const money = (n: number, currency: string) => `${currency}${Math.round(n).toLocaleString()}`;

/* ─── The five answers ────────────────────────────────────────────────────── */

function repliesAnswer(i: AskInput): AskAnswer {
  const q = 'Which segment actually replies?';
  // Ordered by rate, but only among segments with enough sends to have one.
  const enough = i.segments.filter((s) => s.sent >= MIN_ASK_SAMPLE).sort((a, b) => (b.replied / b.sent) - (a.replied / a.sent));
  const thinOnes = i.segments.filter((s) => s.sent > 0 && s.sent < MIN_ASK_SAMPLE);
  if (!enough.length) {
    return {
      id: 'replies', q, rows: [], headline: 'Not enough sent yet to tell.',
      thin: thinOnes.length
        ? `${thinOnes.length} segment${thinOnes.length === 1 ? '' : 's'} with something sent, none with ${MIN_ASK_SAMPLE}. A reply rate off three messages is one person's week, not a fact about a segment.`
        : `Nothing sent to a segment yet. This answers itself after about ${MIN_ASK_SAMPLE} messages to one kind of business.`,
    };
  }
  const best = enough[0];
  const worst = enough[enough.length - 1];
  return {
    id: 'replies', q,
    headline: enough.length > 1 && best.replied > 0
      ? `${best.segment} replies ${pct(best.replied, best.sent)} of the time. ${worst.segment} replies ${pct(worst.replied, worst.sent)}.`
      : best.replied > 0
        ? `${best.segment} is the only one with enough sent: ${pct(best.replied, best.sent)} reply.`
        : `Nothing has replied yet, across ${enough.reduce((n, s) => n + s.sent, 0)} messages to ${enough.length} segment${enough.length === 1 ? '' : 's'}.`,
    rows: enough.map((s) => ({ label: s.segment, value: pct(s.replied, s.sent), note: `${s.replied} of ${s.sent} sent` })),
    thin: thinOnes.length ? `${thinOnes.map((s) => s.segment).join(', ')} left out — under ${MIN_ASK_SAMPLE} sent.` : null,
  };
}

function stoodDownAnswer(i: AskInput): AskAnswer {
  const q = 'What have I told it to stop suggesting?';
  const rows: AskRow[] = [
    ...i.standing.map((s) => ({ label: s, value: 'Stopped', note: 'You said stop, not "not today". It never expires.' })),
    ...i.dead.map((d) => ({ label: i.phraseFor(d.topic), value: 'Does not work', note: `You did it ${d.count} times and the number it named never moved.` })),
  ];
  if (!rows.length) {
    return {
      id: 'stood_down', q, rows: [], headline: 'Nothing is barred.',
      thin: 'Refusing a call three times bars it for a while; the two-step refusal on a call bars it for good. Neither has happened yet.',
    };
  }
  return {
    id: 'stood_down', q,
    headline: `${rows.length} thing${rows.length === 1 ? '' : 's'} will not be suggested as the day's call.`,
    rows,
    // The lift path, named, because a bar nobody can find is indistinguishable
    // from the app having quietly stopped working.
    thin: i.standing.length ? 'Lift a permanent one by deleting its line from the refuse section of your working file.' : null,
  };
}

function workedAnswer(i: AskInput): AskAnswer {
  const q = 'Which of its calls actually worked?';
  const graded = i.decisions.map((d) => ({ d, v: verdictOf(d) }));
  const worked = graded.filter((x) => x.v === 'worked');
  const noMovement = graded.filter((x) => x.v === 'no_movement');
  const ignored = graded.filter((x) => x.v === 'ignored' || x.v === 'rejected');
  const measuring = graded.filter((x) => x.v === 'measuring');
  const decided = worked.length + noMovement.length;
  if (!graded.length) {
    return { id: 'worked', q, rows: [], headline: 'No calls on the record yet.', thin: 'One a day, from tomorrow.' };
  }
  if (!decided) {
    return {
      id: 'worked', q, rows: [], headline: `${graded.length} call${graded.length === 1 ? '' : 's'} so far, none graded yet.`,
      thin: ignored.length === graded.length
        ? `You have not done any of them, so there is nothing to grade. That is an answer about the calls, not about you.`
        : `${measuring.length} still being measured — a call is graded when its number is read back, a few days after you do it.`,
    };
  }
  return {
    id: 'worked', q,
    headline: `${worked.length} of ${decided} call${decided === 1 ? '' : 's'} you carried out moved the number it named.`,
    rows: [
      { label: 'Moved the number', value: String(worked.length), note: worked.slice(0, 3).map((x) => x.d.headline).join(' · ') || undefined },
      { label: 'Did it, nothing moved', value: String(noMovement.length), note: noMovement.slice(0, 3).map((x) => x.d.headline).join(' · ') || undefined },
      { label: 'Never done', value: String(ignored.length), note: ignored.length ? 'Ignored or refused.' : undefined },
      ...(measuring.length ? [{ label: 'Still measuring', value: String(measuring.length) }] : []),
    ],
    thin: null,
  };
}

function draftsAnswer(i: AskInput): AskAnswer {
  const q = 'Where do my drafts die?';
  const d = i.drafts;
  if (!d.written) {
    return { id: 'drafts', q, rows: [], headline: 'No drafts written yet.', thin: 'This fills in as soon as one is.' };
  }
  // Named at the widest drop, because that is the only part of this that is a
  // decision rather than a number.
  const stage = d.sent === 0 ? 'Nothing you have written has been sent.'
    : d.replied === 0 ? `${d.sent} sent and nothing has replied.`
    : `${pct(d.replied, d.sent)} of what you send gets a reply. The drop is between writing and sending: ${pct(d.sent, d.written)} of drafts go.`;
  return {
    id: 'drafts', q,
    headline: stage,
    rows: [
      { label: 'Written', value: String(d.written) },
      { label: 'Opened', value: String(d.opened), note: pct(d.opened, d.written) },
      { label: 'Sent', value: String(d.sent), note: pct(d.sent, d.written) },
      { label: 'Replied', value: String(d.replied), note: pct(d.replied, d.sent || 1) },
      { label: 'Cancelled', value: String(d.cancelled), note: d.cancelled ? 'Written and decided against. Still the most informative number here.' : undefined },
    ],
    thin: null,
  };
}

function worthAnswer(i: AskInput): AskAnswer {
  const q = 'Has any of this been worth anything?';
  const jobs = Object.entries(i.worth).sort((a, b) => b[1].money - a[1].money || b[1].closes - a[1].closes);
  const closes = jobs.reduce((n, [, w]) => n + w.closes, 0);
  const made = jobs.reduce((n, [, w]) => n + w.money, 0);
  const nothing = jobs.reduce((n, [, w]) => n + w.nothing, 0);
  if (!closes) {
    return {
      id: 'worth', q, rows: [], headline: 'Nothing has been graded yet.',
      thin: 'Every mandate asks what it was worth when you close it — including "nothing", which is the answer that changes the most. Nothing has been closed with an answer yet.',
    };
  }
  // The comparison the user asked for, drawn only when it is honest to draw.
  //
  // Three cases and they are genuinely different. A free plan costs nothing, so
  // "did it pay for itself" is not a question it can fail. A paid plan in the
  // user's own currency can be subtracted. A paid plan in some other currency
  // cannot — both figures are real and the arithmetic between them is not, so
  // both are stated and the comparison is left to the person who knows the rate.
  const monthly = PLANS[i.plan].price.monthly;
  const spent = monthly * Math.max(i.monthsActive, 1);
  const comparable = spent > 0 && !!i.currency && i.currency === i.planCurrency;
  const verdict = comparable
    ? made > spent
      ? `${money(made, i.currency)} attributed against ${money(spent, i.planCurrency)} paid. It has paid for itself.`
      : `${money(made, i.currency)} attributed against ${money(spent, i.planCurrency)} paid. It has not paid for itself yet.`
    : spent > 0
      ? `${money(made, i.currency)} attributed across ${closes} closed piece${closes === 1 ? '' : 's'} of work. You have paid ${money(spent, i.planCurrency)} — a different currency, so that subtraction is yours to make.`
      : made > 0
        ? `${money(made, i.currency)} attributed across ${closes} closed piece${closes === 1 ? '' : 's'} of work. You are on the free plan, so it has cost you nothing.`
        : `${closes} closed, and none of it has been worth money yet.`;
  return {
    id: 'worth', q,
    headline: verdict,
    rows: [
      ...jobs.map(([job, w]) => ({
        label: i.phraseFor(job),
        value: w.money > 0 ? money(w.money, i.currency) : w.nothing === w.closes ? 'Nothing' : '—',
        note: `${w.closes} closed${w.nothing ? `, ${w.nothing} worth nothing` : ''}`,
      })),
    ],
    thin: nothing === closes
      ? 'Every piece of work you have graded came back worth nothing. That is the strongest signal this app collects, and it is now weighing on what gets suggested.'
      : null,
  };
}

/**
 * Every answer, from one batch of rows. The route does the loading.
 *
 * The order here is the reading order and is deliberately not ASK_IDS' order,
 * which is only the membership list: the two funnel questions come first because
 * they are the ones somebody opens this screen to ask, and the two about the
 * app's own record come after, because they are only interesting once you
 * believe the first two.
 */
export function answerAll(i: AskInput): AskAnswer[] {
  return [repliesAnswer(i), draftsAnswer(i), workedAnswer(i), stoodDownAnswer(i), worthAnswer(i)];
}
