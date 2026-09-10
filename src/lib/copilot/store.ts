// src/lib/copilot/store.ts
// Data access for the copilot vertical. Every function takes a profileId that
// has already been authenticated by the session cookie.

import { getProfile, logEvent, setActionStatus, touchProfile } from './base';
import { selectReplies, selectSentExamples, type PackReply, type PackSentExample } from './conversations';
import { addDays, copilotDb, todayIso } from './db';
import { DECISION_RESPONSES, VERIFY_AFTER_DAYS, decisionReview, metricValue, snapshotOf, type Change, type Decision, type DecisionDraft, type DecisionMetric, type DecisionResponse, type DecisionSnapshot, type DontDraft } from './decision';
import { diagnose, growthEdge, segmentOf, selectLesson, type DiagnoseInput } from './diagnose';
import { cancelOpenDrafts, channelsConfigured, executionsForActions, latestExecutionByOpportunity, loadSendQueue, regenerateOpeners } from './execution';
import { SELLS_MAX, offerChangedMaterially, offerIsEmpty } from './offer';
import { availableJobs } from './jobs';
import { orderMoves } from './moves';
import { stageOf } from './pipeline';
import { canTriage, orderTriage, segmentKeepRate, type TriageCard, type TriageEvent } from './triage';
import type { Move } from './types';
import { lastOutcomeByOpportunity, loadMetrics, outcomeStatsByType } from './outcomes';
import { hasSubscription, vapidPublicKey } from './push';
import { billingConfigured, effectivePlan, isPlanKey, remaining } from './plans';
import { computeOutcomeAffinity, rankOpportunities, selectPlan } from './ranking';
import { getUsage, periodKey } from './usage';

export { getProfile, logEvent, setActionStatus, touchProfile };
import {
  SOURCE_KEYS,
  type Action, type Capacity, type ContextItem, type ContextSource, type EventRow, type Finance, type Goal,
  type GrowthItem, type HomeData, type Insight, type Offer, type Opportunity, type OpportunityType, type PipelineRow, type Profile, type SendMode, type SourceKey,
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

/**
 * Rows for the diagnosis: every opportunity (not just open ones), every
 * execution and every outcome. The funnel is meaningless if acted-on rows are
 * filtered out of the top of it. Shared by the home read and the weekly brief.
 */
export async function loadDiagnosisRows(profileId: string): Promise<Pick<DiagnoseInput, 'opportunities' | 'executions' | 'outcomes'>> {
  const db = copilotDb();
  const [opportunities, executions, outcomes] = await Promise.all([
    db.from('copilot_opportunities').select('id, status, source, source_kind, data, reason, title, created_at').eq('profile_id', profileId).then((r) => (r.data ?? []) as DiagnoseInput['opportunities']),
    db.from('copilot_executions').select('approval_state, channel, opportunity_id').eq('profile_id', profileId).then((r) => (r.data ?? []) as DiagnoseInput['executions']),
    db.from('copilot_outcomes').select('kind, opportunity_id').eq('profile_id', profileId).then((r) => (r.data ?? []) as DiagnoseInput['outcomes']),
  ]);
  return { opportunities, executions, outcomes };
}

/**
 * The unjudged pile, ordered by what this user actually keeps.
 *
 * Reads the swipe history rather than inferring from status: a dismissed
 * opportunity could have been dismissed from anywhere, and only the triage
 * event knows it was this decision.
 */
export async function loadTriage(profileId: string, rows: PipelineRow[]): Promise<TriageCard[]> {
  const unjudged = rows.filter((r) => r.stage === 'not_drafted');
  if (!unjudged.length) return [];

  const { data } = await copilotDb()
    .from('copilot_events')
    .select('event_type, payload')
    .eq('profile_id', profileId).eq('event_type', 'triage_answered')
    .order('created_at', { ascending: false })
    .limit(400);

  const cards: TriageCard[] = unjudged.map(({ opportunity: o }) => ({
    id: o.id,
    title: o.title,
    segment: segmentOf({ id: o.id, status: o.status, source: o.source, source_kind: o.source_kind, data: o.data, reason: o.reason, title: o.title }, []),
    reason: o.reason ?? '',
    score: o.score ?? 0,
    contact: { whatsapp: !!o.contact?.whatsapp, email: !!o.contact?.email },
    url: o.url ?? null,
  })).filter(canTriage);

  return orderTriage(cards, segmentKeepRate((data ?? []) as TriageEvent[]));
}

/**
 * Finished work waiting on a yes or no. Open only — a Move that was done or
 * dismissed stays in the table as the record and leaves the screen, the same
 * way an answered decision does.
 *
 * Degrades to an empty list when the table is not there yet: this ships before
 * its migration is applied by hand, and an empty Moves section is a far better
 * failure than a blank Today.
 */
const MOVE_COLS = 'id, job, kind, headline, why, artifact, cost_label, status, created_at';
const MOVE_COLS_V2 = `${MOVE_COLS}, stake`;

export async function loadMoves(profileId: string, limit = 8): Promise<{ moves: Move[]; tableMissing: boolean }> {
  const read = (cols: string) => copilotDb()
    .from('copilot_moves')
    .select(cols)
    .eq('profile_id', profileId).eq('status', 'open')
    .order('created_at', { ascending: false })
    // Read wider than the screen, then let orderMoves pick: cutting to `limit`
    // in SQL would drop an earn written on Monday in favour of a learn written
    // last night, before anything had a chance to rank them.
    .limit(limit * 4);
  let { data, error } = await read(MOVE_COLS_V2);
  // `stake` ships in a migration this code does not wait for; without it a Move
  // still renders and still ranks, on its kind prior alone.
  if (error) ({ data, error } = await read(MOVE_COLS));
  // Still degrades to an empty list rather than a blank Today — but says so,
  // because the first build swallowed this and an unapplied migration was
  // indistinguishable from a quiet day.
  if (error) return { moves: [], tableMissing: true };
  return { moves: orderMoves((data ?? []) as unknown as Move[], limit), tableMissing: false };
}

/**
 * One Move by id, for the case where the promoted call is not in the screen's
 * top slice. Rare — the winner is usually near the top of orderMoves too — but a
 * Call rendering without its artifact is the exact failure this whole change is
 * meant to end.
 */
export async function loadMoveById(profileId: string, id: string): Promise<Move | null> {
  const read = (cols: string) => copilotDb().from('copilot_moves').select(cols)
    .eq('profile_id', profileId).eq('id', id).maybeSingle();
  let { data, error } = await read(MOVE_COLS_V2);
  if (error) ({ data, error } = await read(MOVE_COLS));
  return error || !data ? null : (data as unknown as Move);
}

export async function setMoveStatus(profileId: string, id: string, status: 'done' | 'dismissed'): Promise<void> {
  await copilotDb().from('copilot_moves')
    .update({ status, acted_at: new Date().toISOString() })
    .eq('id', id).eq('profile_id', profileId);
  await logEvent(profileId, 'move_answered', { move_id: id, status });
}

/**
 * What the user's own matches have in common, read straight off their listings.
 *
 * Narrower than loadDiagnosisRows on purpose: openings only ever look at sourced
 * rows, and only need the columns openingsOf/segmentOf read. Capped because the
 * pack build is on the brief's critical path — newest first, so the weekly
 * trend is always whole and only the far tail of the all-time count is lost.
 */
const MAX_OPENING_ROWS = 500;

export async function loadOpeningRows(profileId: string): Promise<DiagnoseInput['opportunities']> {
  const { data } = await copilotDb()
    .from('copilot_opportunities')
    .select('id, status, source, source_kind, data, reason, title, created_at')
    .eq('profile_id', profileId)
    .eq('source_kind', 'sourced')
    .order('created_at', { ascending: false })
    .limit(MAX_OPENING_ROWS);
  return (data ?? []) as DiagnoseInput['opportunities'];
}

/**
 * The two halves of a conversation: what this person sent, and what came back
 * in the other person's own words. Both were already in the database and
 * neither had ever reached the agent.
 */
export async function loadConversations(profileId: string, now = new Date()): Promise<{ replies: PackReply[]; sent: PackSentExample[] }> {
  const db = copilotDb();
  // Read wider than the pack carries: selectReplies drops rows with no body
  // (every reply matched before the body was captured), and selectSentExamples
  // needs enough history to find three that have actually been ignored.
  const [replyRows, sentRows] = await Promise.all([
    db.from('copilot_outcomes').select('note, occurred_at, opportunity_id')
      .eq('profile_id', profileId).eq('kind', 'reply')
      .order('occurred_at', { ascending: false }).limit(40)
      .then((r) => (r.data ?? []) as Array<{ note: string | null; occurred_at: string; opportunity_id: string | null }>),
    db.from('copilot_executions').select('id, body, sent_at')
      .eq('profile_id', profileId).eq('approval_state', 'sent')
      .order('sent_at', { ascending: false }).limit(60)
      .then((r) => (r.data ?? []) as Array<{ id: string; body: string | null; sent_at: string | null }>),
  ]);

  // Name the business that replied, so a reply reads as coming from someone
  // rather than from nowhere. And ask directly which of THESE openers were
  // answered: deriving that from the reply window above would mislabel an
  // opener whose reply fell outside it, teaching the model that a message
  // which worked did not.
  const oppIds = [...new Set(replyRows.map((r) => r.opportunity_id).filter((id): id is string => !!id))];
  const execIds = sentRows.map((r) => r.id);
  const [titles, repliedExecutionIds] = await Promise.all([
    (async () => {
      const map = new Map<string, string>();
      if (!oppIds.length) return map;
      const { data } = await db.from('copilot_opportunities').select('id, title').in('id', oppIds);
      for (const o of (data ?? []) as Array<{ id: string; title: string }>) map.set(o.id, o.title);
      return map;
    })(),
    (async () => {
      if (!execIds.length) return new Set<string>();
      const { data } = await db.from('copilot_outcomes').select('execution_id')
        .eq('profile_id', profileId).eq('kind', 'reply').in('execution_id', execIds);
      return new Set(((data ?? []) as Array<{ execution_id: string | null }>).map((r) => r.execution_id).filter((id): id is string => !!id));
    })(),
  ]);

  return {
    replies: selectReplies(replyRows.map((r) => ({ note: r.note, occurred_at: r.occurred_at, business: r.opportunity_id ? titles.get(r.opportunity_id) ?? null : null }))),
    sent: selectSentExamples(sentRows, repliedExecutionIds, { now }),
  };
}

/**
 * Newest insight of one kind. If the `kind` column is not there yet (migration
 * 20260908 not applied), fall back to the unfiltered newest row for 'daily' so
 * Today never shows "No brief yet" because of deploy order.
 */
async function latestInsight(profileId: string, kind: 'daily' | 'weekly'): Promise<Insight | null> {
  const db = copilotDb();
  const q = () => db.from('copilot_insights').select('id, for_date, eyebrow, body, reasoning, kind').eq('profile_id', profileId).order('for_date', { ascending: false }).order('created_at', { ascending: false }).limit(1);
  const r = await q().eq('kind', kind).maybeSingle();
  if (!r.error) return (r.data as Insight | null) ?? null;
  if (kind === 'weekly') return null;
  const fallback = await db.from('copilot_insights').select('id, for_date, eyebrow, body, reasoning').eq('profile_id', profileId).order('for_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (fallback.data as Insight | null) ?? null;
}

// ---------------------------------------------------------------------------
// Decisions: the calls this app made, and how they landed
// ---------------------------------------------------------------------------
// The one table a frontier model cannot reconstruct for a user. Everything here
// is read-mostly; the sweep that grades old calls lives in daily.ts.

const DECISION_COLS = 'id, for_date, headline, because, instead_of, confidence, missing, topic, dont_title, dont_why, changed, snapshot, response, verify_metric, verify_baseline, verify_after, verified_at';
/** With the promoted-Move link. Arrives in 20260911_copilot_arbitration.sql, so
 *  every read and write of it falls back to DECISION_COLS on an unmigrated
 *  database rather than losing the call entirely. */
const DECISION_COLS_V2 = `${DECISION_COLS}, source_move_id`;

interface DecisionRow {
  id: string; for_date: string; headline: string; because: unknown; instead_of: string | null;
  confidence: string; missing: string | null; topic: string | null;
  dont_title: string | null; dont_why: string | null; changed: unknown; snapshot: unknown;
  response: string; verify_metric: string | null; verify_baseline: number | string | null;
  verify_after: number | string | null; verified_at: string | null;
  source_move_id?: string | null;
}

const asNum = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : 0);

function toDecision(r: DecisionRow): Decision {
  return {
    id: r.id,
    for_date: r.for_date,
    headline: r.headline,
    because: Array.isArray(r.because) ? (r.because as unknown[]).filter((b): b is string => typeof b === 'string') : [],
    instead_of: r.instead_of,
    source_move_id: r.source_move_id ?? null,
    confidence: r.confidence === 'low' ? 'low' : 'high',
    missing: r.missing,
    topic: r.topic,
    dont: r.dont_title ? { title: r.dont_title, why: r.dont_why ?? '' } : null,
    changed: Array.isArray(r.changed) ? (r.changed as Change[]) : [],
    response: (DECISION_RESPONSES as readonly string[]).includes(r.response) ? (r.response as DecisionResponse) : 'pending',
    verify: {
      metric: (r.verify_metric ?? 'none') as DecisionMetric,
      baseline: asNum(r.verify_baseline),
      // Postgres numerics arrive as strings; an unverified call must stay null
      // rather than silently grading itself as "moved by 0".
      after: r.verify_after == null ? null : asNum(r.verify_after),
      verifiedAt: r.verified_at,
    },
  };
}

/** Newest first. Powers today's card and the record on Signals from one read. */
export async function loadDecisions(profileId: string, limit = 10): Promise<Decision[]> {
  const read = (cols: string) => copilotDb()
    .from('copilot_decisions').select(cols)
    .eq('profile_id', profileId).order('for_date', { ascending: false }).limit(limit);
  let { data, error } = await read(DECISION_COLS_V2);
  // source_move_id ships in a migration this code does not wait for. Losing the
  // whole call because one column is missing would be a worse bug than the one
  // arbitration fixes, so drop it and read the rest.
  if (error) ({ data, error } = await read(DECISION_COLS));
  // The table itself arrives in a later migration than the code that reads it,
  // so a missing table degrades to "no calls yet" instead of a blank Today.
  if (error) return [];
  return ((data ?? []) as unknown as DecisionRow[]).map(toDecision);
}

/** The snapshot the NEXT brief diffs against: the most recent call before today. */
export async function previousSnapshot(profileId: string, beforeDate: string): Promise<DecisionSnapshot | null> {
  const { data, error } = await copilotDb()
    .from('copilot_decisions').select('snapshot')
    .eq('profile_id', profileId).lt('for_date', beforeDate)
    .order('for_date', { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.snapshot || typeof data.snapshot !== 'object') return null;
  const snap = data.snapshot as Partial<DecisionSnapshot>;
  return typeof snap.sent === 'number' ? (snap as DecisionSnapshot) : null;
}

export interface SaveDecisionInput {
  forDate: string;
  runId: string | null;
  draft: DecisionDraft;
  dont: DontDraft | null;
  changed: Change[];
  snapshot: DecisionSnapshot;
  /** The named metric as it stands right now. The call is graded against this. */
  baseline: number;
}

/** One call per day: a re-run of the brief replaces today's rather than stacking. */
export async function saveDecision(profileId: string, input: SaveDecisionInput): Promise<void> {
  const d = input.draft;
  const row: Record<string, unknown> = {
    profile_id: profileId,
    for_date: input.forDate,
    agent_run_id: input.runId,
    headline: d.headline,
    because: d.because ?? [],
    instead_of: d.instead_of ?? null,
    confidence: d.confidence === 'low' ? 'low' : 'high',
    missing: d.missing ?? null,
    topic: d.topic ?? null,
    dont_title: input.dont?.title ?? null,
    dont_why: input.dont?.why ?? null,
    changed: input.changed,
    snapshot: input.snapshot,
    verify_metric: d.verify_metric ?? 'none',
    verify_baseline: input.baseline,
    source_move_id: d.source_move_id ?? null,
  };
  const write = (r: Record<string, unknown>) =>
    copilotDb().from('copilot_decisions').upsert(r, { onConflict: 'profile_id,for_date' });
  let { error } = await write(row);
  if (error) {
    // Same reason as the read: on a database without the column, a call written
    // without its Move link beats no call at all.
    const { source_move_id: _dropped, ...rest } = row;
    ({ error } = await write(rest));
  }
  if (error) console.error('[copilot] saveDecision failed', error.message);
}

/**
 * What the user did about today's call. 'ignored' is never accepted here — it is
 * inferred by the sweep from a call that was still pending when the next one
 * arrived, because asking someone to self-report having ignored something
 * produces a flattering record rather than a true one.
 */
export async function respondToDecision(profileId: string, forDate: string, response: Exclude<DecisionResponse, 'pending' | 'ignored'>): Promise<Decision | null> {
  const write = (cols: string) => copilotDb()
    .from('copilot_decisions')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('profile_id', profileId).eq('for_date', forDate)
    .select(cols).maybeSingle();
  let { data, error } = await write(DECISION_COLS_V2);
  // A tap on "I did it" must record even where source_move_id does not exist yet.
  if (error) ({ data, error } = await write(DECISION_COLS));
  if (error || !data) return null;
  await logEvent(profileId, 'decision_response', { for_date: forDate, response });
  return toDecision(data as unknown as DecisionRow);
}

export interface DecisionSweep { ignored: number; verified: number }

/**
 * Grade the open record before a new call is made. Two passes, both against the
 * ledger rather than against anyone's memory:
 *
 *  1. A call still pending when the next one arrives was ignored. This is
 *     inferred, never asked — a self-reported "did you do it?" produces a
 *     flattering record, and a flattering record is worth nothing.
 *  2. A call old enough to have landed gets its named metric read back. The
 *     metric window rolls, so a value can fall as well as rise; the delta is
 *     the signal, and a call that named a number which then went nowhere is a
 *     call that did not work, whatever it felt like at the time.
 *
 * Never throws: grading yesterday must not be able to stop today's brief.
 */
export async function gradeDecisions(profileId: string, opts: { now?: Date } = {}): Promise<DecisionSweep> {
  const out: DecisionSweep = { ignored: 0, verified: 0 };
  try {
    const db = copilotDb();
    const profile = await getProfile(profileId);
    if (!profile) return out;
    const now = opts.now ?? new Date();
    const today = todayIso(profile.timezone);

    const expired = await db.from('copilot_decisions')
      .update({ response: 'ignored', responded_at: now.toISOString() })
      .eq('profile_id', profileId).eq('response', 'pending').lt('for_date', today)
      .select('id');
    out.ignored = expired.data?.length ?? 0;

    const due = await db.from('copilot_decisions')
      .select('id, verify_metric')
      .eq('profile_id', profileId).is('verified_at', null)
      .lte('for_date', addDays(today, -VERIFY_AFTER_DAYS))
      .neq('verify_metric', 'none')
      .limit(30);
    const rows = (due.data ?? []) as Array<{ id: string; verify_metric: DecisionMetric }>;
    if (!rows.length) return out;

    const metrics = await loadMetrics(profileId, profile);
    // One update per distinct metric rather than one per row: at most five.
    const byMetric = new Map<DecisionMetric, string[]>();
    for (const r of rows) byMetric.set(r.verify_metric, [...(byMetric.get(r.verify_metric) ?? []), r.id]);
    for (const [metric, ids] of byMetric) {
      await db.from('copilot_decisions')
        .update({ verify_after: metricValue(metrics, metric), verified_at: now.toISOString() })
        .in('id', ids);
      out.verified += ids.length;
    }
  } catch (e) {
    console.error('[copilot] gradeDecisions failed', e);
  }
  return out;
}

/**
 * A nudge is a reminder about a particular day. Nothing ever closed one, so an
 * open row stayed on screen forever: "45 drafted messages are waiting for your
 * approval" was still in Also today days after that nudge stopped being written
 * at all, sitting directly under the card that already said it.
 */
const NUDGE_STALE_DAYS = 3;

export async function loadHome(profileId: string): Promise<HomeData | null> {
  const db = copilotDb();
  const profile = await getProfile(profileId);
  if (!profile) return null;
  const today = todayIso(profile.timezone);

  const [goals, insight, planRows, nudgeRows, oppRows, growth, sources, ctxCount, affinity, lastRun, lastCronRun, metrics, supplyRun, pushEnabled, diagRows, weekly, usage, queue, pipelineRows, decisionLog, movesRead, jobKeys] = await Promise.all([
    db.from('copilot_goals').select('*').eq('profile_id', profileId).eq('status', 'active').order('priority').then((r) => (r.data ?? []) as Goal[]),
    latestInsight(profileId, 'daily'),
    db.from('copilot_actions').select('*').eq('profile_id', profileId).eq('kind', 'plan').eq('for_date', today).in('status', ['open', 'done']).order('created_at').then((r) => (r.data ?? []) as Action[]),
    db.from('copilot_actions').select('*').eq('profile_id', profileId).eq('kind', 'nudge').eq('status', 'open').gte('for_date', addDays(today, -NUDGE_STALE_DAYS)).order('created_at', { ascending: false }).limit(12).then((r) => (r.data ?? []) as Action[]),
    db.from('copilot_opportunities').select('*').eq('profile_id', profileId).in('status', ['new', 'saved']).order('created_at', { ascending: false }).limit(60).then((r) => ((r.data ?? []) as (Opportunity & { expires_at: string | null })[]).filter((o) => !o.expires_at || new Date(o.expires_at) > new Date()).slice(0, 40)),
    db.from('copilot_growth_items').select('*').eq('profile_id', profileId).eq('status', 'active').order('created_at', { ascending: false }).limit(12).then((r) => (r.data ?? []) as GrowthItem[]),
    ensureSources(profileId),
    db.from('copilot_context_items').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).then((r) => r.count ?? 0),
    typeAffinityFor(profileId),
    db.from('copilot_agent_runs').select('status, agent, finished_at').eq('profile_id', profileId).eq('kind', 'daily_brief').order('started_at', { ascending: false }).limit(1).maybeSingle().then((r) => (r.data as HomeData['lastRun']) ?? null),
    // Nightly runs only. brief.ts records the reason on every run, so this is
    // the one honest answer to "is anything happening while I am not looking".
    db.from('copilot_agent_runs').select('finished_at')
      .eq('profile_id', profileId).eq('kind', 'daily_brief')
      .filter('input_summary->>reason', 'eq', 'cron')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false }).limit(1).maybeSingle()
      .then((r) => (r.data?.finished_at as string | null) ?? null),
    loadMetrics(profileId, profile),
    db.from('copilot_agent_runs').select('finished_at').eq('profile_id', profileId).eq('kind', 'supply').order('started_at', { ascending: false }).limit(1).maybeSingle().then((r) => (r.data?.finished_at as string | null) ?? null),
    hasSubscription(profileId),
    loadDiagnosisRows(profileId),
    latestInsight(profileId, 'weekly'),
    getUsage(profileId, periodKey(profile.timezone)),
    loadSendQueue(profileId),
    // The pipeline: real businesses only, whatever state they are in. Dismissed
    // ones are gone; everything else has a place on the board.
    db.from('copilot_opportunities').select('*').eq('profile_id', profileId).eq('source_kind', 'sourced').in('status', ['new', 'saved', 'acted']).order('score', { ascending: false }).limit(200).then((r) => (r.data ?? []) as Opportunity[]),
    loadDecisions(profileId),
    loadMoves(profileId),
    availableJobs(profile),
  ]);

  // Join send-ready drafts onto today's plan, the latest outcome onto each
  // match, and the latest execution onto each pipeline row.
  const pipelineIds = pipelineRows.map((o) => o.id);
  const [execMap, outcomeMap, latestExecByOpp] = await Promise.all([
    executionsForActions(profileId, planRows.map((a) => a.id)),
    lastOutcomeByOpportunity(profileId, [...new Set([...oppRows.map((o) => o.id), ...pipelineIds])]),
    latestExecutionByOpportunity(profileId, pipelineIds),
  ]);
  const pipeline: PipelineRow[] = pipelineRows.map((o) => {
    const opportunity = { ...o, last_outcome: outcomeMap[o.id] ?? null };
    const execution = latestExecByOpp[o.id] ?? null;
    return { opportunity, execution, stage: stageOf(opportunity, execution) };
  });
  // Needs the staged rows, so it cannot ride in the Promise.all above.
  const triage = await loadTriage(profileId, pipeline);

  // Anything in the send queue is rendered there, not in the plan too.
  const queueIds = new Set(queue.map((q) => q.id));
  const planWithExec = planRows.filter((a) => !queueIds.has(a.id)).map((a) => ({ ...a, execution: execMap[a.id] ?? null }));
  const shortlist = selectPlan(planWithExec, profile.capacity);
  const planOverflow = planWithExec.filter((a) => a.status === 'open' && !shortlist.includes(a)).length;
  const oppsWithOutcome = oppRows.map((o) => ({ ...o, last_outcome: outcomeMap[o.id] ?? null }));

  const URGENCY_ORDER = { urgent: 0, normal: 1, info: 2 } as const;
  const nudges = [...nudgeRows].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]).slice(0, 6);

  const opportunities = rankOpportunities(oppsWithOutcome, { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: affinity });

  // The call, and the Move it was promoted from. The promoted Move is rendered
  // as the call, so it must not also appear in the stack below it — that is the
  // same instruction twice, which is the thing this whole redesign is against.
  const decision = decisionLog.find((d) => d.for_date === today) ?? null;
  const promotedId = decision?.source_move_id ?? null;
  const callMove = promotedId
    ? movesRead.moves.find((m) => m.id === promotedId) ?? await loadMoveById(profileId, promotedId)
    : null;
  const stackMoves = promotedId ? movesRead.moves.filter((m) => m.id !== promotedId) : movesRead.moves;

  const diagnosis = diagnose({ ...diagRows, offer: profile.offer ?? {}, targetSegments: profile.target_segments, now: new Date() });
  const lessons = selectLesson(growth, diagnosis);
  // The record is what makes "you keep doing this and it does not work"
  // possible; nothing else in the app can see it.
  const edge = growthEdge(diagnosis, { deadTopic: decisionReview(decisionLog).deadTopic });

  return {
    profile,
    goals,
    insight,
    // Today's call leads the screen; the rest of the log is the record on Signals.
    decision,
    callMove,
    decisionLog,
    plan: shortlist,
    planOverflow,
    queue,
    pipeline,
    weekly,
    billing: {
      plan: isPlanKey(profile.plan) ? profile.plan : 'free',
      effective: effectivePlan(profile).key,
      status: profile.plan_status ?? 'active',
      renewsAt: profile.plan_renews_at ?? null,
      cancelsAtPeriodEnd: !!profile.plan_cancels_at_period_end,
      matches: {
        used: usage.matches,
        limit: effectivePlan(profile).limits.matchesPerMonth,
        remaining: remaining(effectivePlan(profile).limits.matchesPerMonth, usage.matches),
      },
      checkoutReady: billingConfigured(),
    },
    nudges,
    opportunities,
    diagnosis,
    lessons,
    edge,
    sources,
    contextCount: ctxCount,
    triage,
    moves: stackMoves,
    // Only ever a reason for an EMPTY list. A move on screen answers the
    // question by existing — including one promoted to the call.
    movesBlocked: movesRead.moves.length ? null
      : movesRead.tableMissing ? 'migration'
      : jobKeys.length === 0 ? 'no_sensor'
      : null,
    needsBrief: !insight || insight.for_date !== today,
    // Configured to look, and nothing found. Deliberately not "has supply ever
    // run": an account whose matches were all dismissed is in the same
    // position as a new one, and a fresh look is the right answer for both.
    // Spending credits without being asked is guarded where it should be —
    // the route enforces the monthly allowance and a 10-a-day rate limit.
    needsFirstSupply:
      profile.target_segments.length > 0
      && !!(profile.target_area || profile.location)
      && metrics.pipeline.sourced === 0
      && remaining(effectivePlan(profile).limits.matchesPerMonth, usage.matches) > 0,
    lastRun,
    lastCronRun,
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

/**
 * Save targeting. Dropping a segment also retires that segment's waiting drafts
 * and sets its businesses aside (status only — reversible in SQL), so Pipeline
 * and Today stop showing work the user just said they do not want.
 */
export async function setTargeting(profileId: string, t: { target_segments?: string[]; target_area?: string | null }): Promise<{ dropped: number }> {
  const db = copilotDb();
  const before = await getProfile(profileId);
  const patch: Record<string, unknown> = {};
  if (t.target_segments) patch.target_segments = t.target_segments.map((x) => x.trim()).filter(Boolean).slice(0, 8);
  if (t.target_area !== undefined) patch.target_area = t.target_area?.trim() || null;
  if (Object.keys(patch).length) await db.from('copilot_profiles').update(patch).eq('id', profileId);
  await logEvent(profileId, 'targeting_updated', patch);

  let dropped = 0;
  if (before && t.target_segments) {
    const norm = (s: string) => s.trim().toLowerCase();
    const next = new Set(t.target_segments.map(norm));
    const removed = before.target_segments.map(norm).filter((s) => s && !next.has(s));
    if (removed.length) {
      const { data } = await db.from('copilot_opportunities').select('id, data, status, source, source_kind, reason, title')
        .eq('profile_id', profileId).eq('source_kind', 'sourced').in('status', ['new', 'saved']);
      const removedSet = new Set(removed);
      const ids = ((data ?? []) as DiagnoseInput['opportunities']).filter((o) => { const s = segmentOf(o, removed); return !!s && removedSet.has(s); }).map((o) => o.id);
      if (ids.length) {
        await cancelOpenDrafts(profileId, { reason: 'segment_dropped', opportunityIds: ids });
        await db.from('copilot_opportunities').update({ status: 'dismissed' }).in('id', ids);
        await logEvent(profileId, 'segment_dropped', { segments: removed, businesses: ids.length });
        dropped = ids.length;
      }
    }
  }
  return { dropped };
}

/**
 * Save the offer. When it changes materially, every opener written from the old
 * offer is retired and rewritten from the new one right away, so the queue is
 * full of the user's own words the moment they save — not three days later.
 */
export async function setOffer(profileId: string, offer: Offer): Promise<{ offer: Offer; rewritten: number }> {
  const clean: Offer = {
    sells: offer.sells?.trim().slice(0, SELLS_MAX) || undefined,
    for_who: offer.for_who?.trim().slice(0, 120) || undefined,
    problem: offer.problem?.trim().slice(0, 240) || undefined,
    price_band: offer.price_band?.trim().slice(0, 60) || undefined,
    proof_url: offer.proof_url?.trim().slice(0, 300) || undefined,
  };
  const before = await getProfile(profileId);
  await copilotDb().from('copilot_profiles').update({ offer: clean }).eq('id', profileId);
  // The offer is the single biggest lever on message quality, so it is context too.
  const line = [clean.sells && `I sell ${clean.sells}`, clean.for_who && `to ${clean.for_who}`, clean.problem && `— the problem it solves: ${clean.problem}`, clean.price_band && `(${clean.price_band})`].filter(Boolean).join(' ');
  if (line) await addContextItem(profileId, { source: 'offer', kind: 'fact', content: line, weight: 1.6 });
  await logEvent(profileId, 'offer_updated', { has_proof: !!clean.proof_url });

  let rewritten = 0;
  if (before && offerChangedMaterially(before.offer, clean) && !offerIsEmpty(clean)) {
    const { opportunityIds } = await cancelOpenDrafts(profileId, { reason: 'offer_changed' });
    rewritten = await regenerateOpeners({ ...before, offer: clean }, opportunityIds);
  }
  return { offer: clean, rewritten };
}

export async function setSendMode(profileId: string, mode: SendMode, emailFrom?: string | null) {
  const patch: Record<string, unknown> = { send_mode: mode };
  if (emailFrom !== undefined) patch.email_from = emailFrom?.trim() || null;
  await copilotDb().from('copilot_profiles').update(patch).eq('id', profileId);
  await logEvent(profileId, 'send_mode_set', { mode });
}
