// src/lib/copilot/types.ts
// Shared types for the /copilot vertical. Kept independent from the rest of Launchfly.

import type { Diagnosis } from './diagnose';
import type { PlanKey, PlanStatus } from './plans';

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
export type SourceKind = 'sourced' | 'inferred';
export type Channel = 'whatsapp' | 'email';
export type ApprovalState = 'needs_approval' | 'approved' | 'sent' | 'failed' | 'cancelled';
export type OutcomeKind = 'reply' | 'meeting' | 'proposal' | 'won' | 'lost' | 'no_reply';
export type SendMode = 'manual' | 'api';
export type Dispatch = 'api' | 'manual';

/**
 * What this person sells. Replaces guessing from a one-line headline, and is
 * what every drafted message is built from — so the copy is theirs, not the
 * template author's.
 */
export interface Offer {
  sells?: string;        // "WhatsApp booking automations"
  for_who?: string;      // "resorts and tour operators"
  problem?: string;      // "enquiries arrive after hours and go unanswered"
  price_band?: string;   // "$400-1,500 per build"
  proof_url?: string;    // one link that shows the work
}

/** How to reach the other side of an opportunity. All optional; sourced rows fill what they can. */
export interface Contact { name?: string; whatsapp?: string; email?: string; website?: string }

/** Manual runway inputs. Runway = cash / monthly_burn. */
export interface Finance { monthly_burn?: number; cash?: number; currency?: string; updated_at?: string }

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
  /** Who they sell to and where; drives the supply adapters. */
  target_segments: string[];
  target_area: string | null;
  linked_business_id: string | null;
  finance: Finance;
  offer: Offer;
  send_mode: SendMode;
  email_from: string | null;
  email_verified_at: string | null;
  plan: PlanKey;
  plan_status: PlanStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_renews_at: string | null;
  plan_cancels_at_period_end: boolean;
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
  external_id: string | null;
  source_kind: SourceKind;
  contact: Contact;
  scored_at: string | null;
  /** Latest outcome recorded against this opportunity; computed at read time. */
  last_outcome?: OutcomeKind | null;
  created_at: string;
}

export interface Execution {
  id: string;
  action_id: string | null;
  opportunity_id: string | null;
  channel: Channel;
  recipient: string;
  subject: string | null;
  body: string;
  approval_state: ApprovalState;
  provider: string | null;
  external_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  dispatch: Dispatch;
  /** Pre-filled wa.me / mailto link, present when this execution is sent by hand. */
  deep_link?: string | null;
  created_at: string;
}

export interface Outcome {
  id: string;
  opportunity_id: string | null;
  action_id: string | null;
  execution_id: string | null;
  kind: OutcomeKind;
  amount: number | null;
  currency: string | null;
  note: string | null;
  source: 'manual' | 'system' | 'webhook';
  occurred_at: string;
}

/** Real numbers computed from executions and outcomes. The read must cite these. */
export interface Metrics {
  window_days: number;
  sent: number;
  replies: number;
  reply_rate: number | null;      // 0..1, null when nothing sent
  meetings: number;
  won: number;
  won_amount: number;
  lost: number;
  awaiting_approval: number;
  pipeline: { new: number; saved: number; sourced: number; inferred: number };
  runway_months: number | null;
}

/** A sourced opportunity handed to the agent for ranking. */
export interface Candidate {
  id: string;
  type: OpportunityType;
  title: string;
  summary: string;
  source: string;
  url: string | null;
  contact: Contact;
  fit_score: number;
  scored: boolean;
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
  /** Draft ready to approve and send, when the agent produced one. Joined at read time. */
  execution?: Execution | null;
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

export interface BillingSummary {
  plan: PlanKey;
  /** The plan whose limits actually apply — free when a subscription has lapsed. */
  effective: PlanKey;
  status: PlanStatus;
  renewsAt: string | null;
  cancelsAtPeriodEnd: boolean;
  matches: { used: number; limit: number; remaining: number };
  /** False when Stripe is not configured, so the UI hides upgrade buttons that cannot work. */
  checkoutReady: boolean;
}

/**
 * One row of the send queue: a draft waiting for the user, from ANY day. It is
 * the action row (so the action sheet works unchanged) plus the execution that
 * makes it sendable and the business it is addressed to.
 */
export interface QueueItem extends Action {
  execution: Execution;
  opp: { id: string; title: string; name: string | null; segment: string | null; score: number } | null;
}

/** Everything the client needs to render all four tabs. One request. */
export interface HomeData {
  profile: Profile;
  goals: Goal[];
  insight: Insight | null;
  plan: Action[];
  nudges: Action[];
  opportunities: Opportunity[];
  /** Computed from real rows. Replaces the old invented skill levels. */
  diagnosis: Diagnosis;
  /** Open plan items that did not fit today's shortlist. They are not lost — they queue. */
  planOverflow: number;
  /**
   * Every draft still waiting to be sent, whatever day it was written. Built
   * from executions, not from today's plan — a draft from Tuesday that nobody
   * sent is still the most important thing on Thursday.
   */
  queue: QueueItem[];
  /** Current plan and what is left of this month's metered allowance. */
  billing: BillingSummary;
  /** At most one lesson, and only when the diagnosis produced a stuck point. */
  lessons: GrowthItem[];
  sources: ContextSource[];
  contextCount: number;
  /** True when there is no brief for today yet; the client triggers one. */
  needsBrief: boolean;
  lastRun: { status: string; agent: string; finished_at: string | null } | null;
  metrics: Metrics;
  supplyLastRun: string | null;
  account: { email: string | null; verified: boolean };
  push: { publicKey: string | null; enabled: boolean };
  /** Whether this PROFILE may send on each channel through the API, and how it sends. */
  channels: { whatsapp: boolean; email: boolean; mode: SendMode };
}

// ---------------------------------------------------------------------------
// Agent contract. This is the seam for the external AI agent.
// The agent receives a ContextPack and returns a BriefOutput. Nothing else.
// ---------------------------------------------------------------------------

export interface ContextPack {
  today: string; // ISO date
  profile: Pick<Profile, 'name' | 'headline' | 'location' | 'timezone' | 'capacity' | 'hunt_types' | 'target_segments' | 'target_area' | 'offer'>;
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
  /** Sourced opportunities awaiting or refreshing a rank. The agent scores these; it does not invent them. */
  candidates: Candidate[];
  /** Real numbers. The insight must cite at least one. */
  metrics: Metrics;
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
  /** Candidate id this action targets. With a channel and ai_draft it becomes a send-ready execution. */
  opportunity_ref?: string;
  channel?: Channel;
}

export interface BriefNudge {
  title: string;
  urgency: Urgency;
  due_label?: string;
}

export interface BriefOutput {
  insight: { body: string; reasoning?: string };
  /** Scores for candidates in the pack. Unknown ids are ignored. */
  rankings: Array<{ id: string; fit_score: number; reason: string }>;
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
