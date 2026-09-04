// src/lib/copilot/outcomes.ts
// The loop closes here. Outcomes come from the user (won / lost / meeting), from
// reconciling inbound WhatsApp messages against what we sent, and later from
// webhooks. They move goals, ranking, and the read.

import { copilotDb } from './db';
import { computeMetrics } from './metrics';
import { sendPush } from './push';
import { getProfile, logEvent } from './base';
import type { Execution, Metrics, Opportunity, OpportunityType, Outcome, OutcomeKind, Profile } from './types';

export interface OutcomeInput {
  opportunity_id?: string | null;
  action_id?: string | null;
  execution_id?: string | null;
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
    kind: input.kind, amount: input.amount ?? null, currency: input.currency ?? null, note: input.note ?? null,
    source: input.source ?? 'manual', occurred_at: input.occurred_at ?? new Date().toISOString(),
  }).select('*').single();
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
  const { data: inbound } = await db.from('chat_history').select('phone, created_at').in('phone', phones).eq('role', 'user').gte('created_at', earliest).order('created_at');
  const msgs = (inbound ?? []) as { phone: string; created_at: string }[];

  let matched = 0;
  for (const e of pending) {
    const p = digits(e.recipient);
    const hit = msgs.find((m) => (m.phone === p || m.phone.endsWith(p.slice(-9))) && m.created_at > e.sent_at!);
    if (!hit) continue;
    await recordOutcome(profileId, { kind: 'reply', source: 'system', execution_id: e.id, action_id: e.action_id, opportunity_id: e.opportunity_id, occurred_at: hit.created_at });
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

const digits = (s: string) => s.replace(/\D/g, '');
