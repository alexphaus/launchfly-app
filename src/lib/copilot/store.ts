// src/lib/copilot/store.ts
// Data access for the copilot vertical. Every function takes a profileId that
// has already been authenticated by the session cookie.

import { getProfile, logEvent, setActionStatus, touchProfile } from './base';
import { copilotDb, todayIso } from './db';
import { channelsConfigured, executionsForActions } from './execution';
import { lastOutcomeByOpportunity, loadMetrics, outcomeStatsByType } from './outcomes';
import { hasSubscription, vapidPublicKey } from './push';
import { computeOutcomeAffinity, rankOpportunities, selectPlan } from './ranking';

export { getProfile, logEvent, setActionStatus, touchProfile };
import {
  SOURCE_KEYS,
  type Action, type Capacity, type ContextItem, type ContextSource, type EventRow, type Finance, type Goal,
  type GrowthItem, type HomeData, type Insight, type Offer, type Opportunity, type OpportunityType, type Profile, type SendMode, type SourceKey,
} from './types';

export async function addContextItem(profileId: string, item: { source: string; kind?: string; content: string; data?: Record<string, unknown>; weight?: number }) {
  const { data, error } = await copilotDb()
    .from('copilot_context_items')
    .insert({ profile_id: profileId, source: item.source, kind: item.kind ?? 'fact', content: item.content, data: item.data ?? {}, weight: item.weight ?? 1 })
    .select('*')
    .single();
  if (error) throw error;
  return data as ContextItem;
}

export async function recentEvents(profileId: string, days = 90, limit = 500): Promise<EventRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await copilotDb()
    .from('copilot_events')
    .select('event_type, payload, created_at')
    .eq('profile_id', profileId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as EventRow[]) ?? [];
}

export async function typeAffinityFor(profileId: string): Promise<Record<OpportunityType, number>> {
  const [events, stats] = await Promise.all([recentEvents(profileId), outcomeStatsByType(profileId)]);
  return computeOutcomeAffinity(events, stats.sentByType, stats.outcomesByType);
}

export async function ensureSources(profileId: string): Promise<ContextSource[]> {
  const db = copilotDb();
  const { data } = await db.from('copilot_context_sources').select('source_key, status, last_synced_at').eq('profile_id', profileId);
  const have = new Set((data ?? []).map((r: { source_key: string }) => r.source_key));
  const missing = SOURCE_KEYS.filter((k) => !have.has(k));
  if (missing.length) {
    await db.from('copilot_context_sources').insert(missing.map((k) => ({ profile_id: profileId, source_key: k })));
  }
  const all: ContextSource[] = [
    ...((data ?? []) as ContextSource[]),
    ...missing.map((k) => ({ source_key: k, status: 'not_connected', last_synced_at: null }) as ContextSource),
  ];
  return SOURCE_KEYS.map((k) => all.find((s) => s.source_key === k)!) as ContextSource[];
}

export async function loadHome(profileId: string): Promise<HomeData | null> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) return null;
  const today = todayIso(profile.timezone);

  const [goals, insight, planRows, nudgeRows, oppRows, growth, sources, ctxCount, affinity, lastRun, metrics, supplyRun, pushEnabled] = await Promise.all([
    db.from('copilot_goals').select('*').eq('profile_id', profileId).eq('status', 'active').order('priority').then((r) => (r.data ?? []) as Goal[]),
    db.from('copilot_insights').select('id, for_date, eyebrow, body, reasoning').eq('profile_id', profileId).order('for_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle().then((r) => (r.data as Insight | null) ?? null),
    db.from('copilot_actions').select('*').eq('profile_id', profileId).eq('kind', 'plan').eq('for_date', today).in('status', ['open', 'done']).order('created_at').then((r) => (r.data ?? []) as Action[]),
    db.from('copilot_actions').select('*').eq('profile_id', profileId).eq('kind', 'nudge').eq('status', 'open').order('created_at', { ascending: false }).limit(12).then((r) => (r.data ?? []) as Action[]),
    db.from('copilot_opportunities').select('*').eq('profile_id', profileId).in('status', ['new', 'saved']).order('created_at', { ascending: false }).limit(60).then((r) => ((r.data ?? []) as (Opportunity & { expires_at: string | null })[]).filter((o) => !o.expires_at || new Date(o.expires_at) > new Date()).slice(0, 40)),
    db.from('copilot_growth_items').select('*').eq('profile_id', profileId).eq('status', 'active').order('created_at', { ascending: false }).limit(12).then((r) => (r.data ?? []) as GrowthItem[]),
    ensureSources(profileId),
    db.from('copilot_context_items').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).then((r) => r.count ?? 0),
    typeAffinityFor(profileId),
    db.from('copilot_agent_runs').select('status, agent, finished_at').eq('profile_id', profileId).eq('kind', 'daily_brief').order('started_at', { ascending: false }).limit(1).maybeSingle().then((r) => (r.data as HomeData['lastRun']) ?? null),
    loadMetrics(profileId, profile),
    db.from('copilot_agent_runs').select('finished_at').eq('profile_id', profileId).eq('kind', 'supply').order('started_at', { ascending: false }).limit(1).maybeSingle().then((r) => (r.data?.finished_at as string | null) ?? null),
    hasSubscription(profileId),
  ]);

  // Join send-ready drafts onto today's plan and the latest outcome onto each match.
  const [execMap, outcomeMap] = await Promise.all([
    executionsForActions(profileId, planRows.map((a) => a.id)),
    lastOutcomeByOpportunity(profileId, oppRows.map((o) => o.id)),
  ]);
  const planWithExec = planRows.map((a) => ({ ...a, execution: execMap[a.id] ?? null }));
  const oppsWithOutcome = oppRows.map((o) => ({ ...o, last_outcome: outcomeMap[o.id] ?? null }));

  const URGENCY_ORDER = { urgent: 0, normal: 1, info: 2 } as const;
  const nudges = [...nudgeRows].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]).slice(0, 6);

  const opportunities = rankOpportunities(oppsWithOutcome, { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: affinity });

  return {
    profile,
    goals,
    insight,
    plan: selectPlan(planWithExec, profile.capacity),
    nudges,
    opportunities,
    skills: growth.filter((g) => g.kind === 'skill').slice(0, 4),
    lessons: growth.filter((g) => g.kind === 'lesson').slice(0, 4),
    sources,
    contextCount: ctxCount,
    needsBrief: !insight || insight.for_date !== today,
    lastRun,
    metrics,
    supplyLastRun: supplyRun,
    account: { email: profile.email, verified: !!profile.email_verified_at },
    push: { publicKey: vapidPublicKey(), enabled: pushEnabled },
    channels: channelsConfigured(profile),
  };
}

export async function setCapacity(profileId: string, capacity: Capacity) {
  await copilotDb().from('copilot_profiles').update({ capacity }).eq('id', profileId);
  await logEvent(profileId, 'capacity_set', { capacity });
}

export async function setOpportunityStatus(profileId: string, id: string, status: Opportunity['status']) {
  const db = copilotDb();
  const { data } = await db.from('copilot_opportunities').update({ status }).eq('id', id).eq('profile_id', profileId).select('id, type, title').maybeSingle();
  if (!data) return null;
  const map: Record<string, string> = { saved: 'opportunity_saved', dismissed: 'opportunity_dismissed', acted: 'opportunity_acted', new: 'opportunity_reset' };
  await logEvent(profileId, map[status], { opportunity_id: id, type: data.type, title: data.title });
  return data;
}

const GROWTH_EVENT: Record<GrowthItem['status'], string> = {
  done: 'growth_done',
  dismissed: 'growth_dismissed',
  active: 'growth_reopened',
};

export async function setGrowthItemStatus(profileId: string, id: string, status: GrowthItem['status']) {
  const db = copilotDb();
  const { data } = await db.from('copilot_growth_items').update({ status }).eq('id', id).eq('profile_id', profileId).select('id, kind, title').maybeSingle();
  if (!data) return null;
  await logEvent(profileId, GROWTH_EVENT[status], { growth_item_id: id, kind: data.kind, title: data.title });
  return data;
}

export async function upsertGoal(profileId: string, goal: Partial<Goal> & { title?: string; id?: string }) {
  const db = copilotDb();
  const patch = {
    title: goal.title, metric: goal.metric, unit: goal.unit, target_value: goal.target_value, current_value: goal.current_value,
    horizon_days: goal.horizon_days, priority: goal.priority, status: goal.status, note: goal.note,
  };
  Object.keys(patch).forEach((k) => (patch as Record<string, unknown>)[k] === undefined && delete (patch as Record<string, unknown>)[k]);
  if (goal.id) {
    const { data, error } = await db.from('copilot_goals').update(patch).eq('id', goal.id).eq('profile_id', profileId).select('*').single();
    if (error) throw error;
    await logEvent(profileId, 'goal_updated', { goal_id: goal.id, ...patch });
    return data as Goal;
  }
  if (!goal.title) throw new Error('title required');
  const { data, error } = await db.from('copilot_goals').insert({ profile_id: profileId, ...patch, title: goal.title }).select('*').single();
  if (error) throw error;
  await logEvent(profileId, 'goal_created', { goal_id: data.id, title: goal.title });
  return data as Goal;
}

export async function requestSource(profileId: string, key: SourceKey) {
  await ensureSources(profileId);
  await copilotDb().from('copilot_context_sources').update({ status: 'requested' }).eq('profile_id', profileId).eq('source_key', key);
  await logEvent(profileId, 'source_requested', { source_key: key });
}

export async function setFinance(profileId: string, finance: Finance) {
  const clean: Finance = { ...finance, updated_at: new Date().toISOString() };
  await copilotDb().from('copilot_profiles').update({ finance: clean }).eq('id', profileId);
  await logEvent(profileId, 'finance_updated', { monthly_burn: clean.monthly_burn ?? null, cash: clean.cash ?? null });
}

export async function setTargeting(profileId: string, t: { target_segments?: string[]; target_area?: string | null }) {
  const patch: Record<string, unknown> = {};
  if (t.target_segments) patch.target_segments = t.target_segments.map((x) => x.trim()).filter(Boolean).slice(0, 8);
  if (t.target_area !== undefined) patch.target_area = t.target_area?.trim() || null;
  if (Object.keys(patch).length) await copilotDb().from('copilot_profiles').update(patch).eq('id', profileId);
  await logEvent(profileId, 'targeting_updated', patch);
}

export async function setOffer(profileId: string, offer: Offer) {
  const clean: Offer = {
    sells: offer.sells?.trim().slice(0, 120) || undefined,
    for_who: offer.for_who?.trim().slice(0, 120) || undefined,
    problem: offer.problem?.trim().slice(0, 240) || undefined,
    price_band: offer.price_band?.trim().slice(0, 60) || undefined,
    proof_url: offer.proof_url?.trim().slice(0, 300) || undefined,
  };
  await copilotDb().from('copilot_profiles').update({ offer: clean }).eq('id', profileId);
  // The offer is the single biggest lever on message quality, so it is context too.
  const line = [clean.sells && `I sell ${clean.sells}`, clean.for_who && `to ${clean.for_who}`, clean.problem && `— the problem it solves: ${clean.problem}`, clean.price_band && `(${clean.price_band})`].filter(Boolean).join(' ');
  if (line) await addContextItem(profileId, { source: 'offer', kind: 'fact', content: line, weight: 1.6 });
  await logEvent(profileId, 'offer_updated', { has_proof: !!clean.proof_url });
}

export async function setSendMode(profileId: string, mode: SendMode, emailFrom?: string | null) {
  const patch: Record<string, unknown> = { send_mode: mode };
  if (emailFrom !== undefined) patch.email_from = emailFrom?.trim() || null;
  await copilotDb().from('copilot_profiles').update(patch).eq('id', profileId);
  await logEvent(profileId, 'send_mode_set', { mode });
}
