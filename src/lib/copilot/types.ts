// src/lib/copilot/types.ts
// Shared types for the /copilot vertical. Kept independent from the rest of Launchfly.

export type Capacity = 'deep' | 'moderate' | 'low';
export type OpportunityType = 'client' | 'people' | 'service' | 'community' | 'signal';
export type Effort = 'light' | 'medium' | 'deep';
export type OpportunityStatus = 'new' | 'saved' | 'dismissed' | 'acted';
export type ActionKind = 'plan' | 'nudge';
export type ActionOwner = 'ai' | 'you';
export type Urgency = 'urgent' | 'normal' | 'info';
export type ActionStatus = 'open' | 'done' | 'dismissed';
export type GoalMetric = 'currency' | 'number' | 'percent' | 'none';
export type SourceKey = 'calendar' | 'crm' | 'finance';
export type SourceStatus = 'not_connected' | 'requested' | 'connected' | 'error';

export const OPPORTUNITY_TYPES: OpportunityType[] = ['client', 'people', 'service', 'community', 'signal'];
export const SOURCE_KEYS: SourceKey[] = ['calendar', 'crm', 'finance'];

export const CAPACITY_META: Record<Capacity, { label: string; sub: string; minutes: number }> = {
  deep: { label: 'Deep focus', sub: '2+ hours, high-value work', minutes: 150 },
  moderate: { label: 'Moderate', sub: '~1 hour, calls and reviews', minutes: 60 },
  low: { label: 'Low energy', sub: '30 min, light admin only', minutes: 30 },
};

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  headline: string | null;
  location: string | null;
  timezone: string;
  capacity: Capacity;
  hunt_types: OpportunityType[];
  onboarding_complete: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  profile_id: string;
  title: string;
  metric: GoalMetric;
  unit: string | null;
  target_value: number | null;
  current_value: number | null;
  horizon_days: number | null;
  priority: number;
  status: 'active' | 'done' | 'paused';
  note: string | null;
}

export interface ContextItem {
  id: string;
  source: string;
  kind: string;
  content: string;
  data: Record<string, unknown>;
  weight: number;
  created_at: string;
}

export interface ContextSource {
  source_key: SourceKey;
  status: SourceStatus;
  last_synced_at: string | null;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  reason: string;
  value_label: string | null;
  value_amount: number | null;
  currency: string | null;
  effort: Effort;
  fit_score: number;
  score: number;
  source: string | null;
  url: string | null;
  status: OpportunityStatus;
  data: Record<string, unknown>;
  created_at: string;
}

export interface Action {
  id: string;
  kind: ActionKind;
  owner: ActionOwner;
  title: string;
  detail: string | null;
  ai_draft: string | null;
  urgency: Urgency;
  due_label: string | null;
  minutes: number | null;
  status: ActionStatus;
  opportunity_id: string | null;
  for_date: string;
}

export interface Insight {
  id: string;
  for_date: string;
  eyebrow: string;
  body: string;
  reasoning: string | null;
}

export interface GrowthItem {
  id: string;
  kind: 'skill' | 'lesson';
  title: string;
  level: number | null;
  minutes: number | null;
  note: string | null;
  cta: string | null;
  url: string | null;
  status: 'active' | 'done' | 'dismissed';
}

export interface EventRow {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Everything the client needs to render all four tabs. One request. */
export interface HomeData {
  profile: Profile;
  goals: Goal[];
  insight: Insight | null;
  plan: Action[];
  nudges: Action[];
  opportunities: Opportunity[];
  skills: GrowthItem[];
  lessons: GrowthItem[];
  sources: ContextSource[];
  contextCount: number;
  /** True when there is no brief for today yet; the client triggers one. */
  needsBrief: boolean;
  lastRun: { status: string; agent: string; finished_at: string | null } | null;
}

// ---------------------------------------------------------------------------
// Agent contract. This is the seam for the external AI agent.
// The agent receives a ContextPack and returns a BriefOutput. Nothing else.
// ---------------------------------------------------------------------------

export interface ContextPack {
  today: string; // ISO date
  profile: Pick<Profile, 'name' | 'headline' | 'location' | 'timezone' | 'capacity' | 'hunt_types'>;
  goals: Array<Pick<Goal, 'title' | 'metric' | 'unit' | 'target_value' | 'current_value' | 'horizon_days' | 'priority' | 'note'>>;
  context: Array<Pick<ContextItem, 'source' | 'kind' | 'content' | 'created_at'>>;
  sources: ContextSource[];
  /** What the user did with previous suggestions, so the agent can learn. */
  history: {
    saved: Array<Pick<Opportunity, 'type' | 'title'>>;
    dismissed: Array<Pick<Opportunity, 'type' | 'title'>>;
    acted: Array<Pick<Opportunity, 'type' | 'title'>>;
    doneActions: Array<Pick<Action, 'title' | 'owner'>>;
    openActions: Array<Pick<Action, 'title' | 'owner' | 'urgency'>>;
  };
  /** Learned preference weights per type, 0.5 .. 1.5 (1 = neutral). */
  typeAffinity: Record<OpportunityType, number>;
}

export interface BriefOpportunity {
  type: OpportunityType;
  title: string;
  reason: string;
  value_label?: string;
  value_amount?: number;
  currency?: string;
  effort?: Effort;
  fit_score: number;
  source?: string;
  url?: string;
}

export interface BriefAction {
  owner: ActionOwner;
  title: string;
  detail?: string;
  ai_draft?: string;
  minutes?: number;
}

export interface BriefNudge {
  title: string;
  urgency: Urgency;
  due_label?: string;
}

export interface BriefOutput {
  insight: { body: string; reasoning?: string };
  plan: BriefAction[];
  nudges: BriefNudge[];
  opportunities: BriefOpportunity[];
  skills: Array<{ title: string; level: number; note?: string; cta?: string }>;
  lessons: Array<{ title: string; minutes?: number; note?: string; url?: string }>;
}

export interface OpportunityAgent {
  readonly name: 'webhook' | 'llm' | 'starter';
  readonly model?: string;
  generateBrief(pack: ContextPack): Promise<BriefOutput>;
}
