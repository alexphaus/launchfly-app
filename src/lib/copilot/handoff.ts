// src/lib/copilot/handoff.ts
// Everything the app knows, as text you can paste into any model.
//
// Why this exists, stated plainly, because it looks like a feature that gives the
// product away. The whole thesis of this app is that judgement about what is worth
// doing today gets better with THIS user's data and not with a better model —
// which is a claim, and until now an untestable one. A general model asked "what
// should I do now?" has no funnel, no record of what was refused, no working file
// and no ledger. If handing it all of that closes the gap, the value is in the
// rows and the product should be a system of record. If it does not, the value is
// in the arbitration and the product should keep building it. Either answer is
// worth more than the argument, and this button is the cheapest way to get one.
//
// It is also the honest answer to lock-in. Somebody whose context cannot leave is
// a hostage, and a product that is only chosen because leaving is expensive finds
// out what it was worth the moment that changes.
//
// Pure — no DB import — so copilot-core.test.ts covers the rendering. The route
// loads the pack and the four things buildContextPack does not carry.

import { SECTION, SECTIONS, type WorkingEntry } from './working';
import type { Commission } from './commission';
import type { Obligation } from './obligations';
import type { ContextPack } from './types';

/**
 * Hard ceiling on the rendered text.
 *
 * Generous, because the destination is a chat box and not a prompt budget this
 * code controls — but bounded, because an account with two years of decisions
 * would otherwise produce something no model will read and no clipboard should
 * hold. When it bites, the text says so: silently dropping the tail would make
 * the paste look complete while the most recent half was missing.
 */
export const HANDOFF_MAX = 24_000;

/** Per-section caps. Newest first everywhere, so a cap drops the stale end. */
const MAX_DECISIONS = 14;
const MAX_REPLIES = 8;
const MAX_CANDIDATES = 10;
const MAX_NOTES = 10;
const MAX_OPENINGS = 6;

export interface HandoffInput {
  pack: ContextPack;
  /**
   * The working file as ROWS rather than as workingBrief's block, so `you` and
   * `observed` can be told apart in the export. A reader who cannot see which
   * lines are the user's own and which the app counted has been handed one
   * undifferentiated opinion — invariant 12, which is the whole reason there are
   * two sources and never a third.
   */
  working: WorkingEntry[];
  /** Jobs stood down for good, by the phrase a person would use. */
  standing: string[];
  /**
   * Topics the ledger says do not work, already turned into the phrase a person
   * would use. The raw topic is a JOB KEY — `send_queue` — and putting one of
   * those in a document meant to be pasted into a model is the database talking.
   * phraseFor lives in call.ts, which imports store.ts, so the route does it.
   */
  dead: Array<{ phrase: string; count: number }>;
  /** Money owed either way, open rows only. */
  obligations: Obligation[];
  /** Mandates still live: what the app is carrying right now. */
  commissions: Array<Pick<Commission, 'objective' | 'status' | 'authority' | 'why'>>;
  /** Open drafts, including the ones the queue cannot render. */
  queueTotal: number;
}

const bullet = (s: string) => `- ${s}`;

/**
 * The context pack as prose.
 *
 * Ordered by what a reader needs first to say something useful, not by what the
 * database holds: who this is, then where they actually are, then what has
 * already been tried and refused — because that last part is the only section a
 * general model cannot reconstruct and the one that makes the difference between
 * advice and a repeat of yesterday's advice.
 */
export function renderHandoff(input: HandoffInput): string {
  const { pack, working, standing, dead, obligations, commissions, queueTotal } = input;
  const p = pack.profile;
  const m = pack.metrics;
  const out: string[] = [];
  const section = (title: string, lines: string[]) => {
    if (!lines.length) return;
    out.push(`## ${title}`, ...lines, '');
  };

  out.push(`# What I am working on`, '', `As of ${pack.today}. Written by my own app from my own rows — every number below is counted, none is estimated.`, '');

  section('Me', [
    [p.name, p.headline].filter(Boolean).join(' — '),
    [p.location, p.timezone].filter(Boolean).join(' · '),
    p.offer?.sells ? `I sell: ${p.offer.sells}` : 'I have not written down what I sell.',
    p.offer?.for_who ? `For: ${p.offer.for_who}` : '',
    p.offer?.price_band ? `Price: ${p.offer.price_band}` : '',
    p.target_segments?.length ? `I target: ${p.target_segments.join(', ')}${p.target_area ? ` in ${p.target_area}` : ''}` : '',
    `Time I have today: ${p.capacity}`,
  ].filter(Boolean));

  // The two-source split is preserved in the export, and the count comes with
  // the observed rows: "4 of your last 6" is a different claim from "you said so".
  const live = working.filter((w) => w.status === 'live');
  section('What I know about my own work', SECTIONS
    .filter((s) => live.some((w) => w.section === s))
    .flatMap((s) => [
      `**${SECTION[s].label}**`,
      // `evidence` is the rows behind an observed line — "4 of your last 6" —
      // and it is what makes the two sources distinguishable in the export.
      // Without it a counted reading and a stated one read as one voice.
      ...live.filter((w) => w.section === s).map((w) =>
        bullet(`${w.body}${w.source === 'observed' ? ` _(my app counted this${w.evidence ? `: ${w.evidence}` : ''} — I did not say it)_` : ''}`)),
    ]));

  section('Goals', pack.goals.map((g) => bullet(
    `${g.title}: ${g.current_value ?? 0} of ${g.target_value ?? '?'}${g.unit ? ` ${g.unit}` : ''}${g.horizon_days ? `, ${g.horizon_days} days` : ''}`)));

  section(`Where I actually am (last ${m.window_days} days)`, [
    bullet(`${m.sent} messages sent, ${m.replies} replies${m.reply_rate != null ? ` (${Math.round(m.reply_rate * 100)}%)` : ''}, ${m.meetings} meetings, ${m.won} won`),
    bullet(`${queueTotal} drafts written and not sent`),
    m.runway_months != null ? bullet(`${m.runway_months} months of runway`) : '',
    bullet(`${m.pipeline.sourced} real matches in the pipeline`),
  ].filter(Boolean));

  // The section nothing general can reconstruct, and the reason this export is
  // worth making at all.
  section('What has already been suggested, and what I did about it',
    pack.recentDecisions.slice(0, MAX_DECISIONS).map((d) => bullet(
      `${d.for_date} · ${d.headline} · I ${verb(d.response)}${d.moved != null ? ` · the number moved ${d.moved > 0 ? '+' : ''}${d.moved}` : ''}`)));

  section('What I have decided not to do again', [
    ...standing.map((s) => bullet(`${s} — I have said stop suggesting this, not "not today".`)),
    ...dead.map((d) => bullet(`${d.phrase} — I did it ${d.count} times and the number it named never moved.`)),
  ]);

  section('What is running right now', [
    ...commissions.map((c) => bullet(`${c.objective} — ${c.status}${c.why ? `. Why: ${c.why}` : ''}`)),
    ...pack.history.openActions.slice(0, 8).map((a) => bullet(`${a.title} (${a.owner})`)),
  ]);

  section('Money owed', obligations.map((o) => bullet(
    `${o.direction === 'in' ? 'Owed to me' : 'I owe'}: ${o.currency ?? ''}${o.amount} · ${o.counterparty} · due ${o.due_on}`)));

  // Their words, not a summary of them. The most useful text this app holds.
  section('What people wrote back', pack.replies.slice(0, MAX_REPLIES).map((r) => bullet(`"${r.text}"`)));

  section('What my own market keeps asking for', pack.openings.slice(0, MAX_OPENINGS).map((o) => bullet(
    `${o.term} — ${o.businesses} businesses${o.segment ? `, mostly ${o.segment}` : ''}${o.trend ? `, ${o.trend}` : ''}`)));

  section('Live matches nobody has judged yet', pack.candidates.slice(0, MAX_CANDIDATES).map((c) => bullet(
    `${c.title}${c.source && c.source !== 'unknown' ? ` (${c.source})` : ''}${c.summary ? ` — ${c.summary}` : ''}`)));

  section('Things I have told it', pack.context.slice(0, MAX_NOTES).map((c) => bullet(`${c.content}`)));

  const text = out.join('\n').trimEnd();
  if (text.length <= HANDOFF_MAX) return text;
  // Said out loud rather than trimmed quietly: a paste that looks whole and is
  // not is worse than a short one, because the reader cannot tell.
  return `${text.slice(0, HANDOFF_MAX)}\n\n[Cut here — the full record is longer than ${HANDOFF_MAX.toLocaleString()} characters.]`;
}

/** The response, in the first person. `pending` is a call nobody answered. */
function verb(r: string): string {
  return r === 'did' ? 'did it'
    : r === 'rejected' ? 'said no'
    : r === 'ignored' ? 'ignored it'
    : r === 'wrong' ? 'said it was the wrong call'
    : 'have not answered yet';
}
