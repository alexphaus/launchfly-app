// src/lib/copilot/history.ts
// The business's history: what was tried, what was made, what was decided and
// what was paid, in one list, newest first.
//
// Why. Every record the app keeps had its own screen and its own clock — bets
// on the Lab, projects on Work, sales in the funnel, the plan's experiments on
// the Path — so the one question a founder asks of a past month, "what did we
// try and what came of it", had no place to be answered. Its owner called it
// the gap of history. This fills it from rows that already exist: nothing here
// is written for the history, and nothing in it is a summary a model wrote.
//
//   a bet        when it began, and how the rows judged it when it ended
//   a decision   pivot or persevere, with the line the person wrote
//   a commitment a conversation that ended in another call, an intro or money
//   an asset     every version, with who made it and the bet it was for
//   a project    the work an agent finished or stopped, and its verdict
//   a sale       when, how much, and from whom where a business was named
//   the plan     its experiments' verdicts
//
// Pure: no DB import.

import { ASSET_LABEL, OFFER_ASSET, type Asset, type AssetKind, type Maker } from './assets';
import { LINK_LABEL } from './business';
import { STATE_WORDS, type ExperimentMark } from './experiment';
import {
  BET_STATE_LABEL, TALK_ROLE_LABEL, dayIn, dayWords, decisionWords, passLine, playOf, resultLine, roleOf,
  type BetView, type Checkpoint, type Commitment, type Talk,
} from './lab';
import { moneyLabel } from './review';

export type HistoryKind = 'bet_start' | 'bet_end' | 'checkpoint' | 'talk' | 'asset' | 'project' | 'win' | 'experiment';

export interface HistoryEntry {
  key: string;
  kind: HistoryKind;
  /** The person's own day. */
  day: string;
  /** For ordering within a day. */
  at: string;
  title: string;
  line: string | null;
  /** Who did it, where that is the point: a version by AI, a project the agent finished. */
  by: Maker | null;
  tone: 'good' | 'bad' | 'quiet' | null;
  open: { bet: string } | { asset: string } | { commission: string } | null;
  /** The kind of asset a version is of, so a row can show what it is before what it is called. */
  asset?: AssetKind;
}

export interface HistoryInput {
  bets: BetView[];
  checkpoints: Checkpoint[];
  talks: Talk[];
  assets: Asset[];
  projects: Array<{ id: string; objective: string; status: string; outcome: string | null; closedAt: string | null }>;
  wins: Array<{ at: string; amount: number | null; who: string | null }>;
  experiments: ExperimentMark[];
  currency: string;
  timezone: string;
}

/** Entries the history keeps; older ones are the long tail nobody scrolls to. */
export const MAX_HISTORY = 300;

// "Offered", not "made": whether the introduction happened is its own entry —
// the conversation logged through it.
const COMMITTED: Record<Exclude<Commitment, 'none'>, string> = { time: 'agreed to another call', intro: 'offered an introduction', money: 'committed money' };
const EXPERIMENT_TONE: Record<string, HistoryEntry['tone']> = { worked: 'good', failed: 'bad', unclear: 'quiet', dropped: 'quiet' };

/** An undated day sorts by its noon, so it lands inside its day whatever the zone. */
const noon = (day: string) => `${day}T12:00:00.000Z`;

export function historyOf(i: HistoryInput): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const day = (iso: string) => dayIn(iso, i.timezone) ?? iso.slice(0, 10);

  for (const v of i.bets) {
    const b = v.bet;
    const play = playOf(b);
    out.push({
      key: `bet-start-${b.id}`, kind: 'bet_start', day: b.start, at: b.openedAt, by: 'you', tone: null, open: { bet: b.id },
      title: `Bet on ${LINK_LABEL[b.part].toLowerCase()}: “${b.belief}”`,
      line: [play ? `${play.label} · ${play.from}` : null, `Pass line ${passLine(b, v.last)}`].filter(Boolean).join(' · '),
    });
    if (v.state !== 'running' && v.ended) {
      out.push({
        key: `bet-end-${b.id}`, kind: 'bet_end', day: v.ended, at: noon(v.ended), by: null,
        tone: v.state === 'passed' ? 'good' : v.state === 'failed' ? 'bad' : 'quiet', open: { bet: b.id },
        title: `${BET_STATE_LABEL[v.state]}: “${b.belief}”`,
        line: [resultLine(v), v.note ? `“${v.note}”` : null].filter(Boolean).join(' · '),
      });
    }
  }

  for (const c of i.checkpoints) {
    out.push({ key: `checkpoint-${c.id}`, kind: 'checkpoint', day: c.on, at: c.at, by: 'you', tone: null, open: null, title: `Checkpoint: ${decisionWords(c)}`, line: c.note });
  }

  // Only the conversations that ended in something: a compliment is not history.
  // Who they were is said where they were not a buyer, and who opened the door
  // where somebody did — the record of which people led anywhere.
  const talkById = new Map(i.talks.map((t) => [t.id, t]));
  for (const t of i.talks) {
    if (t.commitment === 'none') continue;
    const intro = t.via ? talkById.get(t.via) ?? null : null;
    const line = [
      roleOf(t) !== 'buyer' ? TALK_ROLE_LABEL[roleOf(t)] : null,
      intro ? (intro.who ? `Introduced by ${intro.who}` : 'Through an introduction') : null,
      t.said ? `“${t.said}”` : null,
    ].filter(Boolean).join(' · ');
    out.push({
      key: `talk-${t.id}`, kind: 'talk', day: t.on, at: t.at, by: 'you', tone: t.commitment === 'money' ? 'good' : null, open: null,
      title: `${t.who ?? 'Someone'} ${COMMITTED[t.commitment]}`, line: line || null,
    });
  }

  for (const a of i.assets) {
    for (const v of a.versions) {
      if (!v.at) continue;
      const what = a.id === OFFER_ASSET ? 'Offer' : ASSET_LABEL[a.kind];
      out.push({
        key: `asset-${v.id}`, kind: 'asset', day: day(v.at), at: v.at, by: v.by, tone: null, open: { asset: a.id }, asset: a.kind,
        title: `${what} v${v.n}: ${v.title}`,
        line: v.note ?? (v.n === 1 ? 'First version' : null),
      });
    }
  }

  for (const p of i.projects) {
    if (!p.closedAt || (p.status !== 'done' && p.status !== 'stopped')) continue;
    out.push({
      key: `project-${p.id}`, kind: 'project', day: day(p.closedAt), at: p.closedAt, by: 'ai',
      tone: p.status === 'done' ? null : 'quiet', open: { commission: p.id },
      title: p.objective, line: p.outcome ?? (p.status === 'done' ? 'Finished' : 'Stopped'),
    });
  }

  for (const [n, w] of i.wins.entries()) {
    out.push({
      key: `win-${w.at}-${n}`, kind: 'win', day: day(w.at), at: w.at, by: null, tone: 'good', open: null,
      title: w.amount != null ? `Paid ${moneyLabel(w.amount, i.currency)}` : 'A sale, no amount logged',
      line: w.who,
    });
  }

  for (const m of i.experiments) {
    if (!EXPERIMENT_TONE[m.state] || m.inferred) continue;
    out.push({
      key: `experiment-${m.id}-${m.state}-${m.at}`, kind: 'experiment', day: day(m.at), at: m.at, by: null, tone: EXPERIMENT_TONE[m.state], open: null,
      title: m.title || 'The plan\'s experiment', line: `The plan's experiment ${STATE_WORDS[m.state]}`,
    });
  }

  return out
    .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at) || a.key.localeCompare(b.key))
    .slice(0, MAX_HISTORY);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The history in months, newest first: "October", or "October 2025" outside the current year. */
export function historyMonths(entries: HistoryEntry[], today: string): Array<{ key: string; label: string; entries: HistoryEntry[] }> {
  const out: Array<{ key: string; label: string; entries: HistoryEntry[] }> = [];
  for (const e of entries) {
    const key = e.day.slice(0, 7);
    let g = out.find((x) => x.key === key);
    if (!g) {
      const [y, m] = key.split('-').map(Number);
      g = { key, label: `${MONTH_NAMES[m - 1] ?? key}${String(y) !== today.slice(0, 4) ? ` ${y}` : ''}`, entries: [] };
      out.push(g);
    }
    g.entries.push(e);
  }
  return out;
}

/** "Today", "Yesterday", "3 Oct": a history row's day. */
export function historyDay(day: string, today: string): string {
  if (day === today) return 'Today';
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return day === y ? 'Yesterday' : dayWords(day);
}
