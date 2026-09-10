// src/lib/copilot/context.ts
// Builds the ContextPack the agent sees. This is the single place where "more
// data in" turns into "more context for the agent": add a new source (calendar,
// CRM, finance sync) by writing copilot_context_items and it shows up here.
// Since the loop closed, the pack also carries real candidates to rank and real
// metrics to cite — and now the three things that were already in the database
// and had never reached the agent: what prospects wrote back, which openers got
// a reply, and what this person's own matches keep asking for.

import { copilotDb, todayIso } from './db';
import { changesSince, movedBy, snapshotOf } from './decision';
import { openingTrend } from './diagnose';
import { loadMetrics } from './outcomes';
import { getProfile, loadConversations, loadDecisions, loadOpeningRows, previousSnapshot, typeAffinityFor } from './store';
import type { Action, Candidate, ContextItem, ContextPack, ContextSource, Goal, Opportunity, PackOpening } from './types';

const MAX_CONTEXT_ITEMS = 60;
const MAX_CANDIDATES = 25;
/** Top openings only. openingTrend already applies the MIN_OPENING floor that
 *  keeps one scrape's noise out; this is purely a prompt budget. */
const MAX_OPENING_TERMS = 6;

export async function buildContextPack(profileId: string): Promise<ContextPack> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  const today = todayIso(profile.timezone);
  const [goals, context, sources, opps, actions, affinity, candidateRows, metrics, prevSnap, recent, conversations, openingRows] = await Promise.all([
    db.from('copilot_goals').select('title, metric, unit, target_value, current_value, horizon_days, priority, note').eq('profile_id', profileId).eq('status', 'active').order('priority').then((r) => (r.data ?? []) as Goal[]),
    db.from('copilot_context_items').select('source, kind, content, created_at, weight').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(MAX_CONTEXT_ITEMS).then((r) => (r.data ?? []) as ContextItem[]),
    db.from('copilot_context_sources').select('source_key, status, last_synced_at').eq('profile_id', profileId).then((r) => (r.data ?? []) as ContextSource[]),
    db.from('copilot_opportunities').select('type, title, status').eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(60).then((r) => (r.data ?? []) as Opportunity[]),
    db.from('copilot_actions').select('title, owner, urgency, status').eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(40).then((r) => (r.data ?? []) as Action[]),
    typeAffinityFor(profileId),
    // Unscored candidates first, then the freshest already-scored ones so the agent can re-rank with new context.
    db.from('copilot_opportunities').select('id, type, title, reason, source, url, contact, fit_score, scored_at')
      .eq('profile_id', profileId).eq('source_kind', 'sourced').in('status', ['new', 'saved'])
      .order('scored_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false }).limit(MAX_CANDIDATES)
      .then((r) => (r.data ?? []) as Pick<Opportunity, 'id' | 'type' | 'title' | 'reason' | 'source' | 'url' | 'contact' | 'fit_score' | 'scored_at'>[]),
    loadMetrics(profileId, profile),
    previousSnapshot(profileId, today),
    loadDecisions(profileId, 8),
    loadConversations(profileId),
    loadOpeningRows(profileId),
  ]);

  const pick = (s: Opportunity['status']) => opps.filter((o) => o.status === s).map((o) => ({ type: o.type, title: o.title }));

  const candidates: Candidate[] = candidateRows.map((c) => ({
    id: c.id, type: c.type, title: c.title, summary: c.reason, source: c.source ?? 'unknown', url: c.url,
    contact: { name: c.contact?.name, whatsapp: c.contact?.whatsapp ? 'yes' : undefined, email: c.contact?.email ? 'yes' : undefined, website: c.contact?.website },
    fit_score: c.fit_score, scored: !!c.scored_at,
  }));

  // The one computation nothing general can reproduce: what this person's own
  // live pool keeps asking for. It has driven the Signals tab since Phase 2 and
  // the agent has never seen it, so every draft was written blind to the market
  // it was being sent into.
  const openings: PackOpening[] = openingTrend(openingRows, profile.offer, { targetSegments: profile.target_segments })
    .slice(0, MAX_OPENING_TERMS)
    .map((d) => ({ term: d.term, businesses: d.count, trend: d.trend, segment: d.segments[0]?.segment ?? null }));

  return {
    today,
    profile: {
      name: profile.name, headline: profile.headline, location: profile.location,
      timezone: profile.timezone, capacity: profile.capacity, hunt_types: profile.hunt_types,
      target_segments: profile.target_segments, target_area: profile.target_area, offer: profile.offer,
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
    // Computed here, not asked of the model: "what moved" is a fact about the
    // ledger, and a model asked to remember it will invent it.
    changed: changesSince(prevSnap, snapshotOf(metrics)),
    // The record of previous calls. Without it the agent recommends the same
    // thing every morning and never learns it has been ignored eight times.
    recentDecisions: recent.map((d) => ({ for_date: d.for_date, headline: d.headline, topic: d.topic, response: d.response, moved: movedBy(d) })),
    typeAffinity: affinity,
    candidates,
    replies: conversations.replies,
    sent: conversations.sent,
    openings,
    metrics,
  };
}
