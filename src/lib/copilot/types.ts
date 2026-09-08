// src/lib/copilot/types.ts
// Shared types for the /copilot vertical. Kept independent from the rest of Launchfly.

import type { PackReply, PackSentExample } from './conversations';
import type { Decision, DecisionDraft, DontDraft, Change, DecisionMetric, DecisionResponse } from './decision';
import type { Diagnosis, GrowthEdge } from './diagnose';
import type { PipelineStage } from './pipeline';
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
  /** 'daily' is the brief; 'weekly' is the Signals read. Absent on rows older than the column. */
  kind?: 'daily' | 'weekly';
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

export type { Decision, DecisionDraft, DontDraft, Change, DecisionMetric, DecisionResponse };

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

/** One real business in the pipeline, with where it actually is. */
export interface PipelineRow {
  opportunity: Opportunity;
  /** Latest execution for this business, if any, with its deep link. */
  execution: Execution | null;
  stage: PipelineStage;
}

/** Everything the client needs to render the three tabs and the You sheet. One request. */
export interface HomeData {
  profile: Profile;
  goals: Goal[];
  insight: Insight | null;
  /**
   * Today's one call: what to do, what it is instead of, and the number that
   * should move if it was right. The insight above is the read of the
   * situation; this is the decision that follows from it.
   */
  decision: Decision | null;
  /** The recent record of calls, newest first. Read back on Signals. */
  decisionLog: Decision[];
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
  /** Sourced businesses only — the ones with a contact — grouped by stage on the Pipeline tab. */
  pipeline: PipelineRow[];
  /** The latest weekly Signals read, when one has been written. */
  weekly: Insight | null;
  /** Current plan and what is left of this month's metered allowance. */
  billing: BillingSummary;
  /** At most one lesson, and only when the diagnosis produced a stuck point. */
  lessons: GrowthItem[];
  /**
   * The one capability to work on, computed from the funnel, the demand read and
   * the decision record. Replaces a section that asked a model for an article
   * URL and therefore sat empty almost every day.
   */
  edge: GrowthEdge | null;
  sources: ContextSource[];
  contextCount: number;
  /** True when there is no brief for today yet; the client triggers one. */
  needsBrief: boolean;
  /**
   * True when this account is configured to find businesses and has none. The
   * client runs the first supply pass itself, because onboarding deliberately
   * does not: scraping takes minutes and the onboarding request cannot hold
   * the door open that long.
   *
   * Without this the first screen after signing up is four zeros and three
   * empty boxes — a well-built shell around no data, which is what somebody
   * being shown the product for the first time actually judges.
   */
  needsFirstSupply: boolean;
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
  /** What moved since the previous brief. Computed here, never by the model. */
  changed: Change[];
  /**
   * The calls this app has already made, and how they landed. Without this the
   * agent recommends the same thing every morning and never learns that the
   * user has ignored it nine times.
   */
  recentDecisions: Array<{ for_date: string; headline: string; topic: string | null; response: DecisionResponse; moved: number | null }>;
  /** Learned preference weights per type, 0.5 .. 1.5 (1 = neutral). */
  typeAffinity: Record<OpportunityType, number>;
  /** Sourced opportunities awaiting or refreshing a rank. The agent scores these; it does not invent them. */
  candidates: Candidate[];
  /**
   * What prospects actually wrote back, in their own words. The most valuable
   * text this system holds and for months the only text it threw away:
   * reconcileReplies matched inbound WhatsApp messages by phone and selected
   * everything about them except what they said.
   */
  replies: PackReply[];
  /**
   * Openers that got a reply beside openers that did not, so "what works for
   * me" is read off the ledger instead of guessed. Never one without the other.
   */
  sent: PackSentExample[];
  /**
   * Aggregate demand computed from this person's own live pool — the one
   * signal in the product that nothing general can reconstruct. The agent
   * wrote every draft blind to it until now.
   */
  demand: PackDemand[];
  /** Real numbers. The insight must cite at least one. */
  metrics: Metrics;
}

/**
 * One want, as the agent sees it. Deliberately thinner than DemandTerm: the
 * weekly arithmetic behind the trend is the app's business, not the model's.
 *
 * Every term here is already a GAP — wantsOf() drops anything the offer
 * mentions — so the agent never has to work out which of these are new.
 */
export interface PackDemand {
  term: string;
  /** Businesses in their own matches carrying this want. */
  businesses: number;
  trend: 'new' | 'rising' | 'steady' | 'falling';
  /** The segment it shows up in most, when one dominates. */
  segment: string | null;
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
  /** The one move for today, with its trade-off and the metric it stakes itself on. */
  decision: DecisionDraft | null;
  /** The one thing explicitly not worth doing today. */
  dont: DontDraft | null;
  /** Scores for candidates in the pack. Unknown ids are ignored. */
  rankings: Array<{ id: string; fit_score: number; reason: string }>;
  plan: BriefAction[];
  nudges: BriefNudge[];
  opportunities: BriefOpportunity[];
  skills: Array<{ title: string; level: number; note?: string; cta?: string }>;
  lessons: Array<{ title: string; minutes?: number; note?: string; url?: string }>;
}

/** What the caller can afford to wait for a brief. The nightly cron reaches the
 *  app on localhost and has minutes; every other caller is a tap sitting behind
 *  a reverse proxy that gives up long before the model does. */
export interface BriefRunOpts { timeoutMs?: number }

export interface OpportunityAgent {
  readonly name: 'webhook' | 'llm' | 'starter';
  readonly model?: string;
  generateBrief(pack: ContextPack, opts?: BriefRunOpts): Promise<BriefOutput>;
}
