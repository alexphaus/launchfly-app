// src/lib/copilot/types.ts
// Shared types for the /copilot vertical. Kept independent from the rest of Launchfly.

import type { PackReply, PackSentExample } from './conversations';
import type { MoveArtifact, MoveKind } from './moves';
import type { Stake } from './stake';
import type { MotionRow } from './motion';
import type { WatchSourceKind } from './watch/catalogue';
import type { TriageCard } from './triage';
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
  /** Always 'daily' now. The weekly Signals read was a second insight nobody
   *  read, on a Monday cron branch that never fired. Kept on the row because the
   *  column exists and old rows carry it. */
  kind?: 'daily' | 'weekly';
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
  /**
   * What is already running: sent and waiting, a call being read back, what the
   * sources turned up. The only part of Today that is not an instruction.
   * Replaces `nudges` and the plan shortlist — see motion.ts.
   */
  motion: MotionRow[];
  opportunities: Opportunity[];
  /** Computed from real rows. Replaces the old invented skill levels. */
  diagnosis: Diagnosis;
  /**
   * Every draft still waiting to be sent, whatever day it was written. Built
   * from executions, not from today's plan — a draft from Tuesday that nobody
   * sent is still the most important thing on Thursday.
   */
  queue: QueueItem[];
  /** Sourced businesses only — the ones with a contact — grouped by stage on the Pipeline tab. */
  pipeline: PipelineRow[];
  /** Current plan and what is left of this month's metered allowance. */
  billing: BillingSummary;
  /**
   * The one capability to work on, computed from the funnel, the openings read and
   * the decision record. Replaces a section that asked a model for an article
   * URL and therefore sat empty almost every day.
   */
  edge: GrowthEdge | null;
  sources: ContextSource[];
  /**
   * The feeds this person watches. Empty when the migration has not been run —
   * the Sources sheet reads that as "none added yet", which is the same screen a
   * new account sees and the correct one for both.
   */
  watchSources: WatchSource[];
  contextCount: number;
  /**
   * Finished work waiting on a yes or no, from every Job — not just outbound.
   * The queue below is one kind of move; these are the other seven.
   */
  moves: Move[];
  /**
   * The Move today's call was promoted from, when arbitration picked one. It is
   * NOT in `moves` — it is rendered as the call, and rendering it twice is the
   * duplication this redesign exists to remove. Null when the call was written
   * rather than promoted.
   */
  callMove: Move | null;
  /**
   * Matches nobody has judged yet, ordered by what this user keeps drafting.
   * One decision at a time on the only judgement in this app cheap enough to
   * make with a thumb — see triage.ts for why it is not the send queue.
   */
  triage: TriageCard[];
  /**
   * Why the deck is not asking about businesses today. 'queue' means the send
   * queue is deep and stale enough that writing more drafts is avoidance —
   * watched-feed cards still show, because keeping one costs nothing. Null when
   * the deck is live.
   */
  triageHeld: 'queue' | null;
  /**
   * Why the Moves list is empty, when it is — never set while a move is on
   * screen. 'migration' means copilot_moves is not there yet; 'no_sensor' means
   * no job can see anything for this profile. Both used to render as silence.
   */
  movesBlocked: 'migration' | 'no_sensor' | 'quiet' | null;
  /**
   * What the last jobs run did, so an empty Moves list can report rather than
   * render nothing. Null before the first run, or if the read fails.
   */
  jobsRun: JobsRunSummary | null;
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
  /**
   * When the NIGHTLY run last finished, as opposed to a run the user triggered
   * by opening the app. Null means it has never fired.
   *
   * This is the difference between a copilot and a report you generate by
   * looking at it: with no cron there are no overnight Moves, no push, and no
   * graded decisions, so every morning is identical because the user is the one
   * computing it. It was invisible — a scheduled task nobody had set up looks
   * exactly like a quiet week — so the app now says so.
   */
  lastCronRun: string | null;
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
   * What this person's own live pool has in common — the one signal in the
   * product that nothing general can reconstruct. The agent wrote every draft
   * blind to it until now.
   */
  openings: PackOpening[];
  /** Real numbers. The insight must cite at least one. */
  metrics: Metrics;
}

/**
 * One opening, as the agent sees it. Deliberately thinner than Opening: the
 * weekly arithmetic behind the trend is the app's business, not the model's.
 *
 * An OPENING, not a want. Each term was written by a scraper about the
 * prospect — a missing website, thin reviews, ad spend landing in a hand-typed
 * inbox — so it is a weakness to sell against, never something anyone asked to
 * buy. Every term here is already a GAP: openingsOf() drops anything the offer
 * already names, so the agent never has to work out which of these are new.
 */
export interface PackOpening {
  term: string;
  /** Businesses in their own matches whose listing shows this. */
  businesses: number;
  trend: 'new' | 'rising' | 'steady' | 'falling';
  /** The segment it shows up in most, when one dominates. */
  segment: string | null;
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
}
// Five fields were removed from here rather than left empty.
//
// `plan` and `nudges` went last. They were asked for in the same response that
// wrote the Call, over the same context, and so restated it: the live screen
// carried "approve and send 15 drafts", "approve and send 15 drafts today",
// "approve and send 10 drafts today" and "send 10 drafts today" as four rows,
// above a queue card saying it a fifth time — the 15 and the 10 disagreeing
// because they came from different runs and nothing reconciled them. It was also
// the last surface in the app not held to the artifact rule: imperatives with
// nothing attached, which is the definition of advice.
//
// Drafting moves entirely to the deliberate paths — the deck's "Draft it" and
// the draft button on a business — which are now gated on the send queue. A
// model writing five openers a night into a queue nobody empties is how a queue
// gets to forty-one.
//
// `skills` was already dead — the limit was zero, so the model's answer was
// sliced to nothing while the prompt still asked for it and brief.ts still
// carried a full upsert that could never fire.
//
// `opportunities` was up to eight matches the MODEL invented, capped at score 70
// and rendered beside real scraped businesses behind an "Inferred" badge. A
// guess sitting next to a listing is the thing invariant 3 exists to prevent,
// and a badge is not a defence — the row is still on the screen, still ranked,
// still costing prompt tokens to produce.
//
// `lessons` was one article a day, and only with a working URL. A URL is the
// single thing a language model is least able to supply, so it was almost always
// empty; when it was not, nobody could tell whether the link was real. The
// computed GrowthEdge ("get better at") stays — that one is read off the funnel.

/** What the caller can afford to wait for a brief. The nightly cron reaches the
 *  app on localhost and has minutes; every other caller is a tap sitting behind
 *  a reverse proxy that gives up long before the model does. */
export interface BriefRunOpts { timeoutMs?: number }

export interface OpportunityAgent {
  readonly name: 'webhook' | 'llm' | 'starter';
  readonly model?: string;
  generateBrief(pack: ContextPack, opts?: BriefRunOpts): Promise<BriefOutput>;
}

/** One finished piece of work, as the client renders it. */
/** One nightly jobs run, summarised for the screen. Written by runJobs. */
export interface JobsRunSummary {
  at: string;
  /** Sensors that actually looked — available, and not skipped. */
  ran: number;
  produced: number;
  /** New after dedupe. Produced-but-not-written means it was already answered. */
  written: number;
  /** Job keys that looked and found nothing. */
  quiet: string[];
}

export interface Move {
  id: string;
  job: string;
  kind: MoveKind;
  headline: string;
  why: string[];
  artifact: MoveArtifact;
  cost_label: string | null;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
  /** What it claims it will move. Null on rows written before arbitration. */
  stake?: Stake | null;
}

/**
 * One place this profile watches. The supply list is rows now, not an ADAPTERS
 * array: three adapters compiled into the build all answered "which local
 * business should I message", which is one person's world. A feed URL somebody
 * pasted answers whatever question they are actually asking.
 */
export interface WatchSource {
  id: string;
  /** Only 'feed' is implemented. See watch/catalogue.ts for why the others exist. */
  kind: WatchSourceKind;
  url: string;
  label: string;
  /** Why they added it, in their words. The judge is told, so it can rule out. */
  intent: string | null;
  every_hours: number;
  status: 'active' | 'paused' | 'error';
  /** The last few hundred item ids, so dedupe works on feeds with no dates. */
  seen_ids: string[];
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
}
