// src/lib/foundation/types.ts
// ═══════════════════════════════════════════════════════════════════════════
// Foundation Copilot — shared domain types
//
// Foundation is operator-scoped: every type here belongs to a person, not to
// a business. Keep it that way — the moment a type needs business_id to make
// sense, it belongs in one of the existing business-scoped modules instead.
// ═══════════════════════════════════════════════════════════════════════════

export type CapacityMode = 'deep' | 'moderate' | 'low';
export type OpportunityType = 'client' | 'person' | 'service' | 'community' | 'signal';
export type OpportunityStatus =
  | 'new' | 'saved' | 'pursuing' | 'won' | 'lost' | 'dismissed' | 'expired';
export type ActionKind = 'ai_drafted' | 'needs_you';
export type ActionLane = 'plan' | 'next';
export type ActionUrgency = 'overdue' | 'today' | 'soon' | 'backlog';
export type ActionStatus =
  | 'pending' | 'approved' | 'sent' | 'done' | 'snoozed' | 'dismissed';
export type ContextSourceKind =
  | 'calendar' | 'crm' | 'finance' | 'email' | 'chat' | 'files' | 'launchfly';
export type ContextSourceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface FoundationProfile {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  positioning: string | null;
  timezone: string;
  currency: string;
  capacity_mode: CapacityMode;
  capacity_set_at: string | null;
  weekly_hours: number;
  min_deal_value: number;
  brief_hour: number;
  embedding_stale: boolean;
  primary_business_id: string | null;
  onboarding_complete: boolean;
}

export interface FoundationSkill {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  proficiency: number;          // 0-100
  source: 'declared' | 'inferred' | 'demand';
  evidence: Array<{ kind: string; ref?: string; note?: string }>;
  demand_count: number;
  matched_count: number;
  last_seen_at: string | null;
}

export interface FoundationGoal {
  id: string;
  user_id: string;
  key: string;
  label: string;
  kind: 'revenue' | 'runway' | 'volume' | 'custom';
  target_value: number | null;
  current_value: number;
  unit: 'currency' | 'months' | 'count' | 'percent';
  period: 'week' | 'month' | 'quarter' | 'none';
  priority: number;
  note: string | null;
  status: 'active' | 'paused' | 'hit' | 'missed';
}

export interface FoundationContextSource {
  id: string;
  user_id: string;
  kind: ContextSourceKind;
  provider: string | null;
  status: ContextSourceStatus;
  config: Record<string, unknown>;
  scopes: string[];
  last_synced_at: string | null;
  last_error: string | null;
}

export interface FoundationOpportunity {
  id: string;
  user_id: string;
  type: OpportunityType;
  title: string;
  summary: string | null;
  body: string | null;
  source: string;
  source_url: string | null;
  external_id: string | null;
  value_amount: number | null;
  value_currency: string | null;
  value_kind: 'fixed' | 'hourly' | 'recurring' | 'none';
  effort_hours: number | null;
  required_skills: string[];
  deadline_at: string | null;
  posted_at: string;
  expires_at: string | null;
  status: OpportunityStatus;
  raw: Record<string, unknown>;
}

/**
 * Per-factor contributions.
 *
 * The four weighted factors sum to the stored 0-100 `score`, which is
 * deliberately CAPACITY-NEUTRAL. Capacity is applied at read time (see
 * `rerankForCapacity`) so switching the capacity sheet re-ranks with no
 * recompute and no double-counting of effort — effort already enters the base
 * score through `valueFit`, which is an effective-hourly-rate comparison.
 */
export interface ScoreBreakdown {
  skillFit: number;        // 0-1  — can they actually do it?
  valueFit: number;        // 0-1  — is it worth their hour, at their floor rate?
  urgency: number;         // 0-1  — does it decay if ignored?
  goalAlignment: number;   // 0-1  — does it move the goal they said matters?
  /** Capacity fit at compute time. Display only — NOT part of the base score. */
  capacityFit: number;
  /** Human-readable factor notes, surfaced verbatim by "See the reasoning". */
  notes: string[];
  /** Skill slugs that carried the skillFit number. */
  matchedSkills: string[];
  /** Skills the opportunity wanted that the operator does not have. */
  missingSkills: string[];
}

export interface FoundationMatch {
  id: string;
  user_id: string;
  opportunity_id: string;
  score: number;              // 0-100, computed in code — never by a model
  breakdown: ScoreBreakdown;
  confidence: number;         // 0-1, driven by connected context sources
  reason: string | null;      // one line, model-written FROM the breakdown
  reason_model: string | null;
  capacity_fit: CapacityMode;
  seen_at: string | null;
  computed_at: string;
}

export interface FoundationAction {
  id: string;
  user_id: string;
  title: string;
  detail: string | null;
  kind: ActionKind;
  lane: ActionLane;
  urgency: ActionUrgency;
  category: string | null;
  estimated_minutes: number | null;
  min_capacity: CapacityMode;
  draft_content: string | null;
  draft_channel: string | null;
  source_kind: string | null;
  source_id: string | null;
  agent_task_id: string | null;
  status: ActionStatus;
  due_at: string | null;
  snoozed_until: string | null;
  brief_date: string | null;
}

/** One checkable claim behind the daily read. Never let the model invent these. */
export interface BriefEvidence {
  claim: string;              // "40 DMs sent this week"
  value: string | number | null;
  source: string;             // 'foundation_events' | 'crm' | 'finance' | ...
  observed_at: string;
}

export interface FoundationBrief {
  id: string;
  user_id: string;
  brief_date: string;
  greeting: string | null;
  read_text: string;
  evidence: BriefEvidence[];
  metrics: {
    new_matches: number;
    needs_you: number;
    urgent: number;
    [k: string]: number;
  };
  confidence: number;
  model: string | null;
}

/** Everything the copilot knows about an operator at one moment. */
export interface OperatorContext {
  profile: FoundationProfile;
  skills: FoundationSkill[];
  goals: FoundationGoal[];
  sources: FoundationContextSource[];
  openOpportunities: FoundationOpportunity[];
  openActions: FoundationAction[];
  recentEvents: Array<{ kind: string; payload: Record<string, unknown>; created_at: string }>;
  /** 0-1. How much of the picture we actually have. Drives every confidence field. */
  confidence: number;
  /** Which sources are missing, in the order that would help most. */
  missingSources: ContextSourceKind[];
}
