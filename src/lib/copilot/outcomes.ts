// src/lib/copilot/outcomes.ts
// The loop closes here. Outcomes come from the user (won / lost / meeting), from
// reconciling inbound WhatsApp messages against what we sent, and later from
// webhooks. They move goals, ranking, and the read.

import { REPLY_TEXT_MAX, trimMessage } from './conversations';
import { copilotDb } from './db';
import { segmentOf } from './diagnose';
import { computeMetrics } from './metrics';
import { sendPush } from './push';
import { getProfile, logEvent } from './base';
import { worthByJob, type WorthRecord, type WorthRow } from './worth';
import type { ApprovalState, Execution, Metrics, Opportunity, OpportunityType, Outcome, OutcomeKind, Profile } from './types';

export interface OutcomeInput {
  opportunity_id?: string | null;
  action_id?: string | null;
  execution_id?: string | null;
  /** The Move this is the outcome of. See Outcome.move_id. */
  move_id?: string | null;
  /** The mandate this closed. */
  commission_id?: string | null;
  kind: OutcomeKind;
  amount?: number | null;
  currency?: string | null;
  note?: string | null;
  source?: Outcome['source'];
  occurred_at?: string;
}

export async function recordOutcome(profileId: string, input: OutcomeInput): Promise<Outcome> {
  const db = copilotDb();
  const { data, error } = await db.from('copilot_outcomes').insert({
    profile_id: profileId, opportunity_id: input.opportunity_id ?? null, action_id: input.action_id ?? null, execution_id: input.execution_id ?? null,
    move_id: input.move_id ?? null, commission_id: input.commission_id ?? null,
    kind: input.kind, amount: input.amount ?? null, currency: input.currency ?? null, note: input.note ?? null,
    source: input.source ?? 'manual', occurred_at: input.occurred_at ?? new Date().toISOString(),
  }).select('*').single();
  // Thrown, never swallowed. An unapplied 20260921 rejects move_id with PGRST204
  // and `delivered` with 23514, and a caller that carried on regardless would
  // report a recorded verdict that does not exist — the shape of bug invariant 13
  // is about. closeCommission catches this one and says so on the screen.
  if (error) throw error;
  const outcome = data as Outcome;

  let oppType: OpportunityType | undefined;
  let oppTitle: string | undefined;
  if (input.opportunity_id) {
    const { data: opp } = await db.from('copilot_opportunities').select('type, title').eq('id', input.opportunity_id).maybeSingle();
    oppType = opp?.type; oppTitle = opp?.title;
    // Won or lost closes the opportunity; a reply keeps it live.
    if (input.kind === 'won' || input.kind === 'lost') {
      await db.from('copilot_opportunities').update({ status: 'acted' }).eq('id', input.opportunity_id).eq('profile_id', profileId);
    }
  }

  // Money moves the primary revenue goal. The goal bar stops being typed.
  if (input.kind === 'won' && input.amount && input.amount > 0) {
    const { data: goal } = await db.from('copilot_goals').select('id, current_value').eq('profile_id', profileId).eq('status', 'active').eq('metric', 'currency').order('priority').limit(1).maybeSingle();
    if (goal) await db.from('copilot_goals').update({ current_value: Number(goal.current_value ?? 0) + input.amount }).eq('id', goal.id);
  }

  await logEvent(profileId, `outcome_${input.kind}`, { outcome_id: outcome.id, opportunity_id: input.opportunity_id ?? null, type: oppType, amount: input.amount ?? null, source: outcome.source });

  if (input.kind === 'reply' && outcome.source !== 'manual') {
    void sendPush(profileId, { title: 'Reply', body: `${oppTitle ?? 'Someone'} replied to your message.`, url: '/copilot', tag: `reply-${input.opportunity_id ?? outcome.id}` });
  }
  return outcome;
}

/**
 * Match inbound WhatsApp messages (chat_history, role = user) to sent executions
 * by phone. Runs from the cron and on app open; needs no change to the webhooks.
 */
export async function reconcileReplies(profileId: string): Promise<{ checked: number; matched: number }> {
  const db = copilotDb();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: sent } = await db.from('copilot_executions')
    .select('id, action_id, opportunity_id, recipient, sent_at')
    .eq('profile_id', profileId).eq('channel', 'whatsapp').eq('approval_state', 'sent').gte('sent_at', since);
  const execs = (sent ?? []) as Pick<Execution, 'id' | 'action_id' | 'opportunity_id' | 'recipient' | 'sent_at'>[];
  if (!execs.length) return { checked: 0, matched: 0 };

  const { data: already } = await db.from('copilot_outcomes').select('execution_id').eq('profile_id', profileId).eq('kind', 'reply').in('execution_id', execs.map((e) => e.id));
  const done = new Set((already ?? []).map((r: { execution_id: string }) => r.execution_id));
  const pending = execs.filter((e) => !done.has(e.id));
  if (!pending.length) return { checked: execs.length, matched: 0 };

  const phones = [...new Set(pending.map((e) => digits(e.recipient)))];
  const earliest = pending.reduce((m, e) => (e.sent_at! < m ? e.sent_at! : m), pending[0].sent_at!);
  // content, not just the timestamp. Selecting only phone and created_at is how
  // this ran for months: the system knew that somebody replied and never once
  // knew what they said, which is the most useful text it has access to.
  // The body is only ever read for a phone this profile itself sent to, after
  // its own sent_at — the match below is what keeps one user's inbox out of
  // another's pack.
  const { data: inbound } = await db.from('chat_history').select('phone, content, created_at').in('phone', phones).eq('role', 'user').gte('created_at', earliest).order('created_at');
  const msgs = (inbound ?? []) as { phone: string; content: string | null; created_at: string }[];

  let matched = 0;
  for (const e of pending) {
    const p = digits(e.recipient);
    const hit = msgs.find((m) => (m.phone === p || m.phone.endsWith(p.slice(-9))) && m.created_at > e.sent_at!);
    if (!hit) continue;
    await recordOutcome(profileId, {
      kind: 'reply', source: 'system', execution_id: e.id, action_id: e.action_id, opportunity_id: e.opportunity_id,
      occurred_at: hit.created_at,
      // note already existed on copilot_outcomes and was always null for a
      // system-matched reply. Trimmed at the write so the row cannot grow
      // without bound on a pasted wall of text.
      note: trimMessage(hit.content, REPLY_TEXT_MAX) || null,
    });
    matched += 1;
  }
  return { checked: execs.length, matched };
}

export async function loadMetrics(profileId: string, profile?: Profile | null): Promise<Metrics> {
  const db = copilotDb();
  const p = profile ?? (await getProfile(profileId));
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [execs, outs, opps] = await Promise.all([
    db.from('copilot_executions').select('approval_state, sent_at, created_at').eq('profile_id', profileId).gte('created_at', since).then((r) => (r.data ?? []) as Pick<Execution, 'approval_state' | 'sent_at' | 'created_at'>[]),
    db.from('copilot_outcomes').select('kind, amount, occurred_at').eq('profile_id', profileId).gte('occurred_at', since).then((r) => (r.data ?? []) as Pick<Outcome, 'kind' | 'amount' | 'occurred_at'>[]),
    db.from('copilot_opportunities').select('status, source_kind').eq('profile_id', profileId).in('status', ['new', 'saved']).then((r) => (r.data ?? []) as Pick<Opportunity, 'status' | 'source_kind'>[]),
  ]);
  return computeMetrics({ executions: execs, outcomes: outs, opportunities: opps, finance: p?.finance ?? {} });
}

/** Per-type send and outcome counts, for outcome-weighted ranking. */
export async function outcomeStatsByType(profileId: string): Promise<{ sentByType: Partial<Record<OpportunityType, number>>; outcomesByType: Partial<Record<OpportunityType, Partial<Record<OutcomeKind, number>>>> }> {
  const db = copilotDb();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [execs, outs] = await Promise.all([
    db.from('copilot_executions').select('opportunity_id').eq('profile_id', profileId).eq('approval_state', 'sent').gte('sent_at', since).then((r) => (r.data ?? []) as { opportunity_id: string | null }[]),
    db.from('copilot_outcomes').select('kind, opportunity_id').eq('profile_id', profileId).gte('occurred_at', since).then((r) => (r.data ?? []) as { kind: OutcomeKind; opportunity_id: string | null }[]),
  ]);
  const ids = [...new Set([...execs, ...outs].map((r) => r.opportunity_id).filter((x): x is string => !!x))];
  if (!ids.length) return { sentByType: {}, outcomesByType: {} };
  const { data: opps } = await db.from('copilot_opportunities').select('id, type').in('id', ids);
  const typeOf = new Map((opps ?? []).map((o: { id: string; type: OpportunityType }) => [o.id, o.type]));
  const sentByType: Partial<Record<OpportunityType, number>> = {};
  const outcomesByType: Partial<Record<OpportunityType, Partial<Record<OutcomeKind, number>>>> = {};
  for (const e of execs) { const t = e.opportunity_id && typeOf.get(e.opportunity_id); if (t) sentByType[t] = (sentByType[t] ?? 0) + 1; }
  for (const o of outs) { const t = o.opportunity_id && typeOf.get(o.opportunity_id); if (t) { outcomesByType[t] ??= {}; outcomesByType[t]![o.kind] = (outcomesByType[t]![o.kind] ?? 0) + 1; } }
  return { sentByType, outcomesByType };
}

export async function lastOutcomeByOpportunity(profileId: string, oppIds: string[]): Promise<Record<string, OutcomeKind>> {
  if (!oppIds.length) return {};
  const { data } = await copilotDb().from('copilot_outcomes').select('opportunity_id, kind, occurred_at').eq('profile_id', profileId).in('opportunity_id', oppIds).order('occurred_at', { ascending: false });
  const out: Record<string, OutcomeKind> = {};
  for (const r of (data ?? []) as { opportunity_id: string; kind: OutcomeKind }[]) if (!out[r.opportunity_id]) out[r.opportunity_id] = r.kind;
  return out;
}

/**
 * How far back the worth ledger is read.
 *
 * Wider than the 90-day metrics window and for the same reason RANKING_WINDOW is
 * wider than REFUSAL_WINDOW: "you had this done three times and got nothing out
 * of it once" is a verdict, not a mood, and it does not stop being true because a
 * quarter passed. Bounded at all so a two-year-old account is not re-deciding
 * today on work from its first month.
 */
export const WORTH_WINDOW_DAYS = 365;

/**
 * Worth per job key, for the ranker.
 *
 * Two hops, because the job key lives on the Move rather than on the outcome:
 * outcomes carrying a move_id are resolved through copilot_moves.job, and an
 * outcome carrying a commission_id is attributed to 'commission' — the key
 * commissionJob already publishes, so "handing work over" is graded as a kind of
 * work like any other rather than as a special case.
 *
 * Returns {} on ANY error, and an empty record means scoreMove has no opinion,
 * which is precisely its behaviour before 20260921 — so an unapplied migration
 * costs the weighting and nothing else. It is not silent: the same columns are
 * probed by /api/copilot/health, which names the migration that is missing. A
 * read path that degrades has to be visible SOMEWHERE, and the screen it belongs
 * on is the one about what this deployment actually has.
 */
export async function loadWorthLedger(profileId: string): Promise<Record<string, WorthRecord>> {
  const db = copilotDb();
  const since = new Date(Date.now() - WORTH_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.from('copilot_outcomes')
    .select('kind, amount, move_id, commission_id')
    .eq('profile_id', profileId).gte('occurred_at', since)
    // Rows with neither attribution are funnel events the metrics already grade,
    // and pulling them would only be thrown away by worthByJob.
    .or('move_id.not.is.null,commission_id.not.is.null');
  if (error) return {};

  const raw = (data ?? []) as Array<Pick<Outcome, 'kind' | 'amount' | 'move_id' | 'commission_id'>>;
  if (!raw.length) return {};

  const moveIds = [...new Set(raw.map((r) => r.move_id).filter((x): x is string => !!x))];
  const jobOf = new Map<string, string>();
  if (moveIds.length) {
    const { data: moves } = await db.from('copilot_moves').select('id, job').eq('profile_id', profileId).in('id', moveIds);
    for (const m of (moves ?? []) as Array<{ id: string; job: string | null }>) if (m.job) jobOf.set(m.id, m.job);
  }

  const rows: WorthRow[] = raw.map((r) => ({
    kind: r.kind,
    amount: r.amount,
    // A commission wins over a move id when a row somehow carries both: the
    // mandate is the larger unit of work and the one the user actually graded.
    job: r.commission_id ? 'commission' : (r.move_id ? jobOf.get(r.move_id) ?? null : null),
  }));
  return worthByJob(rows);
}

/**
 * The rows the ask surface counts over: the draft funnel, and replies per segment.
 *
 * One batch rather than five, because every question on that screen reads the same
 * three tables and answering them one route at a time would be five round trips
 * for one sheet.
 *
 * `segmentOf` is the same pure derivation the triage deck and the openings read
 * use — so "which segment replies" and "which segment you keep drafting for" are
 * grouped the same way. Two different groupings of the same businesses on two
 * screens is how a user learns not to trust either.
 */
export async function loadAskRows(profileId: string): Promise<{
  drafts: { written: number; opened: number; sent: number; replied: number; cancelled: number };
  segments: Array<{ segment: string; sent: number; replied: number }>;
}> {
  const db = copilotDb();
  const [execs, outs, opps] = await Promise.all([
    db.from('copilot_executions').select('approval_state, opened_at, opportunity_id').eq('profile_id', profileId)
      // A local shape, not Pick<Execution>: `opened_at` ships in 20260913 and is
      // a real column that the Execution type has never carried. store.ts reads
      // it the same way. Missing column → the select errors → [], and the Opened
      // row reads 0 rather than the sheet failing.
      .then((r) => (r.error ? [] : (r.data ?? []) as Array<{ approval_state: ApprovalState; opened_at: string | null; opportunity_id: string | null }>)),
    db.from('copilot_outcomes').select('kind, opportunity_id').eq('profile_id', profileId)
      .then((r) => (r.error ? [] : (r.data ?? []) as Array<Pick<Outcome, 'kind' | 'opportunity_id'>>)),
    db.from('copilot_opportunities').select('id, status, source, source_kind, data, reason, title').eq('profile_id', profileId)
      .then((r) => (r.error ? [] : (r.data ?? []) as Array<Parameters<typeof segmentOf>[0]>)),
  ]);

  const drafts = {
    written: execs.length,
    opened: execs.filter((e) => !!e.opened_at).length,
    sent: execs.filter((e) => e.approval_state === 'sent').length,
    replied: outs.filter((o) => o.kind === 'reply').length,
    cancelled: execs.filter((e) => e.approval_state === 'cancelled').length,
  };

  const segmentFor = new Map<string, string>();
  for (const o of opps) {
    const seg = segmentOf(o, []);
    if (seg) segmentFor.set(o.id, seg);
  }
  const tally = new Map<string, { sent: number; replied: number }>();
  const bump = (oppId: string | null, key: 'sent' | 'replied') => {
    const seg = oppId ? segmentFor.get(oppId) : undefined;
    if (!seg) return;
    const t = tally.get(seg) ?? { sent: 0, replied: 0 };
    t[key] += 1;
    tally.set(seg, t);
  };
  for (const e of execs) if (e.approval_state === 'sent') bump(e.opportunity_id, 'sent');
  for (const o of outs) if (o.kind === 'reply') bump(o.opportunity_id, 'replied');

  return { drafts, segments: [...tally].map(([segment, t]) => ({ segment, ...t })) };
}

const digits = (s: string) => s.replace(/\D/g, '');
