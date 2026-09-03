// src/lib/foundation/context.ts
// ═══════════════════════════════════════════════════════════════════════════
// Operator context assembly
//
// One read of everything the copilot knows about a person, plus an honest
// confidence number. The prototype's closing line is the spec here:
//
//   "Nothing is connected yet — matches run on what you tell the copilot
//    directly. Each source you add sharpens ranking, it doesn't unlock new tabs."
//
// So: a user with no connected sources is a first-class user. Missing context
// lowers confidence and changes the copy; it never blocks a surface.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from './db';
import { scoreConfidence } from './scoring';
import type {
  ContextSourceKind,
  FoundationAction,
  FoundationContextSource,
  FoundationGoal,
  FoundationOpportunity,
  FoundationProfile,
  FoundationSkill,
  OperatorContext,
} from './types';

/** Ordered by how much each one sharpens ranking, most useful first. */
export const SOURCE_PRIORITY: ContextSourceKind[] = ['crm', 'finance', 'calendar', 'email'];

export const SOURCE_COPY: Record<ContextSourceKind, { label: string; effect: string }> = {
  calendar:  { label: 'Calendar',            effect: 'Sharpens focus-window and nudge timing' },
  crm:       { label: 'Business notes / CRM', effect: 'Improves client and lead matching' },
  finance:   { label: 'Finances',             effect: 'Keeps pricing and runway guidance current' },
  email:     { label: 'Email',                effect: 'Surfaces threads that went cold' },
  chat:      { label: 'Chat / DMs',           effect: 'Tracks outreach volume and reply rate' },
  files:     { label: 'Files',                effect: 'Grounds proposals in your past work' },
  launchfly: { label: 'Launchfly business',   effect: 'Pulls revenue and lead data you already have' },
};

/** Create the profile row on first use so no surface has to handle "no profile". */
export async function ensureProfile(userId: string): Promise<FoundationProfile> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('foundation_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as FoundationProfile;

  const { data: created, error: insertError } = await supabase
    .from('foundation_profiles')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created as FoundationProfile;
}

export async function loadOperatorContext(userId: string): Promise<OperatorContext> {
  const supabase = getServiceClient();
  const profile = await ensureProfile(userId);

  const [skills, goals, sources, opportunities, actions, events] = await Promise.all([
    supabase.from('foundation_skills').select('*').eq('user_id', userId).order('proficiency', { ascending: false }),
    supabase.from('foundation_goals').select('*').eq('user_id', userId).eq('status', 'active').order('priority', { ascending: false }),
    supabase.from('foundation_context_sources').select('*').eq('user_id', userId),
    supabase
      .from('foundation_opportunities')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['new', 'saved', 'pursuing'])
      .order('posted_at', { ascending: false })
      .limit(200),
    supabase
      .from('foundation_actions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved', 'snoozed'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from('foundation_events')
      .select('kind, payload, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const sourceRows = (sources.data ?? []) as FoundationContextSource[];
  const skillRows = (skills.data ?? []) as FoundationSkill[];
  const connected = sourceRows.filter((s) => s.status === 'connected');

  const confidence = scoreConfidence({
    connectedSources: connected.length,
    hasPositioning: Boolean(profile.positioning || profile.headline),
    declaredSkills: skillRows.filter((s) => s.source !== 'demand').length,
    taggedRequirements: (opportunities.data ?? []).some(
      (o: FoundationOpportunity) => (o.required_skills ?? []).length > 0,
    ),
  });

  const connectedKinds = new Set(connected.map((s) => s.kind));
  const missingSources = SOURCE_PRIORITY.filter((kind) => !connectedKinds.has(kind));

  return {
    profile,
    skills: skillRows,
    goals: (goals.data ?? []) as FoundationGoal[],
    sources: sourceRows,
    openOpportunities: (opportunities.data ?? []) as FoundationOpportunity[],
    openActions: (actions.data ?? []) as FoundationAction[],
    recentEvents: (events.data ?? []) as OperatorContext['recentEvents'],
    confidence,
    missingSources,
  };
}

/**
 * Count events of a kind in the last N days — the raw material for the daily
 * read's factual claims ("40 DMs this week", "3% reply rate").
 */
export function countEvents(
  ctx: OperatorContext,
  kind: string,
  days = 7,
): number {
  const cutoff = Date.now() - days * 86_400_000;
  return ctx.recentEvents.filter(
    (e) => e.kind === kind && new Date(e.created_at).getTime() >= cutoff,
  ).length;
}
