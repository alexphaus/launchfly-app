// src/lib/copilot/context.ts
// Builds the ContextPack the agent sees. This is the single place where "more
// data in" turns into "more context for the agent": add a new source (calendar,
// CRM, finance sync) by writing copilot_context_items and it shows up here.

import { copilotDb, todayIso } from './db';
import { getProfile, typeAffinityFor } from './store';
import type { Action, ContextItem, ContextPack, ContextSource, Goal, Opportunity } from './types';

const MAX_CONTEXT_ITEMS = 60;

export async function buildContextPack(profileId: string): Promise<ContextPack> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  const [goals, context, sources, opps, actions, affinity] = await Promise.all([
    db.from('copilot_goals').select('title, metric, unit, target_value, current_value, horizon_days, priority, note').eq('profile_id', profileId).eq('status', 'active').order('priority').then((r) => (r.data ?? []) as Goal[]),
    db.from('copilot_context_items').select('source, kind, content, created_at, weight').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(MAX_CONTEXT_ITEMS).then((r) => (r.data ?? []) as ContextItem[]),
    db.from('copilot_context_sources').select('source_key, status, last_synced_at').eq('profile_id', profileId).then((r) => (r.data ?? []) as ContextSource[]),
    db.from('copilot_opportunities').select('type, title, status').eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(60).then((r) => (r.data ?? []) as Opportunity[]),
    db.from('copilot_actions').select('title, owner, urgency, status').eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(40).then((r) => (r.data ?? []) as Action[]),
    typeAffinityFor(profileId),
  ]);

  const pick = (s: Opportunity['status']) => opps.filter((o) => o.status === s).map((o) => ({ type: o.type, title: o.title }));

  return {
    today: todayIso(profile.timezone),
    profile: {
      name: profile.name, headline: profile.headline, location: profile.location,
      timezone: profile.timezone, capacity: profile.capacity, hunt_types: profile.hunt_types,
    },
    goals,
    context: context
      .sort((a, b) => (b.weight - a.weight) || (a.created_at < b.created_at ? 1 : -1))
      .map((c) => ({ source: c.source, kind: c.kind, content: c.content, created_at: c.created_at })),
    sources,
    history: {
      saved: pick('saved'),
      dismissed: pick('dismissed'),
      acted: pick('acted'),
      doneActions: actions.filter((a) => a.status === 'done').map((a) => ({ title: a.title, owner: a.owner })),
      openActions: actions.filter((a) => a.status === 'open').map((a) => ({ title: a.title, owner: a.owner, urgency: a.urgency })),
    },
    typeAffinity: affinity,
  };
}
