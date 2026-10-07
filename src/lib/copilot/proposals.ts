// src/lib/copilot/proposals.ts
// What Claude may propose, and how a proposal waits for the person.
//
// Why. The connector read the record and could write nothing, and the record's
// slowest input was the person typing what happened: the owner's bet counted
// conversations, and none had been logged in a month. Claude is where they talk
// things through — a call recapped, an idea worked out — and the words that
// belong in the record were then retyped on a phone, or not at all. A proposal
// carries them over: a conversation to log, or a test for the shelf, drafted in
// the chat and held in the app until the person keeps it, changes it or drops
// it.
//
// What it is not. Not a write to the record: nothing proposed is logged, kept or
// counted until the person's tap, so a model's draft never stands as their row
// (the rule the mic's sheets and the AI's asset drafts already keep). Not a way
// in for anything that acts: no bet started, none called off, no sale, no
// message — `commit` is never autonomous and `reach` is the person's (invariants
// 4 and 11), and starting a bet is the person writing a line before the result.
// And not on by default: proposing is its own scope, granted on the consent
// screen by a tick, so a connection made to read cannot start writing (invariant
// 7's reason: the capability and its consent ship together).
//
// Each proposal is held, when it arrives and again when it is kept, to exactly
// what the person's own entry is held to: normalizeTalk for a conversation,
// normalizeShelf and its refusals for a test. A proposal that could not be kept
// as it stands is refused to Claude with the reason, so it can correct the call.
//
// Stored without a migration, as copilot_events rows. Pure: no DB import.

import { LINK_LABEL } from './business';
import {
  BELIEF_MAX, COMMITMENTS, COMMITMENT_LABEL, PROBLEM_LABEL, TALK_ROLE_LABEL, countRefusal, normalizeShelf, normalizeTalk, playLine, shelfRefusal,
  type ShelfDraft, type ShelfEntry, type TalkDraft,
} from './lab';
import type { FoundBy } from './types';

export const MCP_PROPOSAL = 'mcp_proposal';
/** A proposal's end: kept (as it stood, or changed first) or dropped. The first end is the one. */
export const MCP_PROPOSAL_END = 'mcp_proposal_end';
export const PROPOSAL_EVENTS = [MCP_PROPOSAL, MCP_PROPOSAL_END] as const;

export type ProposalKind = 'talk' | 'test';
export type ProposalOutcome = 'kept' | 'dropped';

const READ_BACK_PRICE = 1;

/** Open at once. Past it the inbox is a backlog, and a backlog of a model's drafts is noise the person did not ask for. */
export const PROPOSALS_OPEN_MAX = 10;
/** Claude's line on where it came from: "From the call you described". Short, and never shown as the person's words. */
export const PROPOSAL_WHY_MAX = 200;

export interface Proposal {
  id: string;
  kind: ProposalKind;
  at: string;
  /** The connection that proposed it (oauth.ts grant). */
  grant: string | null;
  why: string | null;
  talk: TalkDraft | null;
  test: ShelfDraft | null;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);

export interface ProposalContext {
  today: string;
  price: number | null;
  priceLabel: string | null;
  foundBy: FoundBy | null;
  /** The shelf as it stands, so a test already kept is not proposed again. */
  shelf: Array<Pick<ShelfEntry, 'part' | 'belief' | 'metric' | 'play' | 'idea'>>;
  /** Proposals still waiting. */
  open: Proposal[];
}

/**
 * A conversation Claude proposes logging. How it ended is required, not
 * defaulted: "nothing" is an answer The Mom Test counts, and a model that did
 * not say should not have the person's log say it for them. No introduction is
 * named — which conversation one came through is the person's to pick.
 */
export function proposeTalk(raw: unknown, ctx: ProposalContext): Result<{ talk: TalkDraft; why: string | null }> {
  const r = obj(raw);
  if (!(COMMITMENTS as readonly string[]).includes(r.commitment as string)) {
    return { ok: false, error: 'Say how it ended: commitment is one of none, time (another call), intro or money. A compliment is none.' };
  }
  if (r.via != null && r.via !== '') return { ok: false, error: 'Leave out via: which introduction a conversation came through is for the person to pick when they keep it.' };
  const v = normalizeTalk({ ...r, via: null }, ctx.today);
  if (!v.ok) return v;
  if (ctx.open.filter((p) => p.kind === 'talk').some((p) => sameTalk(p.talk!, v.value))) return { ok: false, error: 'That conversation is already proposed and waiting for the person.' };
  return { ok: true, value: { talk: v.value, why: text(r.why, PROPOSAL_WHY_MAX) } };
}

const sameTalk = (a: TalkDraft, b: TalkDraft) =>
  a.on === b.on && (a.who ?? '').toLowerCase() === (b.who ?? '').toLowerCase() && a.role === b.role && a.commitment === b.commitment && (a.said ?? '') === (b.said ?? '');

/**
 * A test Claude proposes for the shelf: a belief, a count, a line and a length,
 * held to what the person's own test is held to — a count this business can
 * keep, not one already on the shelf. Its play is said as Claude's, so the
 * shelf and the idea writer never read it as a book's or the person's.
 */
export function proposeTest(raw: unknown, ctx: ProposalContext): Result<{ test: ShelfDraft; why: string | null }> {
  const r = obj(raw);
  const label = text(r.play, 80) ?? text(obj(r.idea).label, 80);
  const how = text(r.how, 320) ?? text(obj(r.idea).how, 320);
  const idea = label && how ? { label, how, from: 'Claude, proposed' } : null;
  const v = normalizeShelf({ ...r, play: null, idea }, { today: ctx.today, price: ctx.price, priceLabel: ctx.priceLabel });
  if (!v.ok) return v;
  const off = countRefusal(v.value.metric, v.value.tries, ctx.foundBy);
  if (off) return { ok: false, error: off };
  const waiting = ctx.open.filter((p) => p.kind === 'test').map((p) => p.test!);
  const no = shelfRefusal([...ctx.shelf, ...waiting], v.value);
  if (no) return { ok: false, error: no === 'That is already on your shelf.' ? 'That test is already on the shelf or waiting as a proposal.' : no };
  return { ok: true, value: { test: v.value, why: text(r.why, PROPOSAL_WHY_MAX) } };
}

/** Whether another proposal can wait: refused past PROPOSALS_OPEN_MAX, with what to do instead. */
export function proposalRoom(open: Proposal[]): string | null {
  return open.length >= PROPOSALS_OPEN_MAX
    ? `${PROPOSALS_OPEN_MAX} proposals are already waiting for the person. Ask them to keep or drop some in the app first.`
    : null;
}

/* ─── What was stored ─────────────────────────────────────────────────────── */

export interface ProposalEventRow { id: number | string; event_type: string; payload: unknown; created_at: string }

/**
 * The proposals still waiting, newest first. One whose stored draft no longer
 * holds together — a field this version does not read — is dropped rather than
 * shown half; the person never sees a proposal they could not keep.
 */
export function openProposals(rows: ProposalEventRow[], today: string): Proposal[] {
  const ended = new Set(rows.filter((r) => r.event_type === MCP_PROPOSAL_END).map((r) => obj(r.payload).proposal).filter((x): x is string => typeof x === 'string'));
  const out: Proposal[] = [];
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (r.event_type !== MCP_PROPOSAL || ended.has(String(r.id))) continue;
    const p = obj(r.payload);
    const base = { id: String(r.id), at: r.created_at, grant: typeof p.grant === 'string' ? p.grant : null, why: text(p.why, PROPOSAL_WHY_MAX) };
    if (p.kind === 'talk') {
      // Read back by the same rule, against its own day: a proposal made yesterday is still yesterday's conversation.
      const t = normalizeTalk({ ...obj(p.talk), via: null }, today, []);
      if (t.ok) out.push({ ...base, kind: 'talk', talk: t.value, test: null });
    } else if (p.kind === 'test') {
      // The price a test is held to is decided the day it starts, not the day it
      // is read back: a stand-in price lets a priced count read, and keeping it
      // checks it against the real one.
      const s = normalizeShelf({ ...obj(p.test), play: null }, { today, price: READ_BACK_PRICE, priceLabel: null });
      if (s.ok) out.push({ ...base, kind: 'test', talk: null, test: s.value });
    }
  }
  return out;
}

/** One line for a proposal, as Needs you and Claude's own read say it. */
export function proposalLine(p: Proposal, priceLabel: string | null = null): string {
  if (p.kind === 'talk' && p.talk) {
    const t = p.talk;
    const bits = [TALK_ROLE_LABEL[t.role].toLowerCase(), t.problem !== 'unasked' ? PROBLEM_LABEL[t.problem].toLowerCase() : null, COMMITMENT_LABEL[t.commitment].toLowerCase()].filter(Boolean);
    return `A conversation${t.who ? ` with ${t.who}` : ''}: ${bits.join(', ')}`;
  }
  if (p.kind === 'test' && p.test) {
    const s = p.test;
    const belief = s.belief.length > 80 ? `${s.belief.slice(0, 79)}…` : s.belief;
    return `A test on ${LINK_LABEL[s.part].toLowerCase()}: “${belief}” — ${playLine(s, priceLabel)}`;
  }
  return 'A proposal';
}

/** The belief's own cap, for the tool's schema. */
export const PROPOSAL_BELIEF_MAX = BELIEF_MAX;
