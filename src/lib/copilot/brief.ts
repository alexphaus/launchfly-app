// src/lib/copilot/brief.ts
// Runs the agent for one profile and persists the result. Every run is logged in
// copilot_agent_runs. If the configured agent fails we fall back to the starter
// so the user always gets a Today view.

import { StarterAgent, getAgent } from './agent';
import { buildContextPack } from './context';
import { copilotDb } from './db';
import { metricValue, snapshotOf, starterDecision } from './decision';
import { createDraftExecution, openDraftForOpportunity } from './execution';
import { OFFER_TASK_DETAIL, OFFER_TASK_TITLE, offerIsEmpty } from './offer';
import { sendPush } from './push';
import { scoreOpportunity } from './ranking';
import { getProfile, gradeDecisions, saveDecision } from './store';
import type { DecisionSweep } from './store';
import type { BriefOutput, OpportunityAgent, Profile, ContextPack } from './types';

export interface BriefResult { runId: string; agent: OpportunityAgent['name']; output: BriefOutput; fellBack: boolean; graded: DecisionSweep; pushed: number }

export async function runBrief(profileId: string, opts: { reason?: string } = {}): Promise<BriefResult> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');
  // Grade the open record first, so the pack the agent reads already knows
  // which of its previous calls were ignored and which moved nothing.
  const graded = await gradeDecisions(profileId);
  const pack = await buildContextPack(profileId);
  const summary = { reason: opts.reason ?? 'manual', goals: pack.goals.length, context: pack.context.length, capacity: pack.profile.capacity };

  let agent = getAgent();
  let runId = await startRun(profileId, agent, summary);
  let output: BriefOutput;
  let fellBack = false;
  try {
    output = await agent.generateBrief(pack);
    await finishRun(runId, 'ok', output);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(runId, 'error', null, message);
    if (agent.name === 'starter') throw err;
    console.error(`[copilot] ${agent.name} agent failed, falling back to starter:`, message);
    const failed = agent.name;
    agent = new StarterAgent();
    fellBack = true;
    runId = await startRun(profileId, agent, { ...summary, fallback_from: failed });
    output = await agent.generateBrief(pack);
    await finishRun(runId, 'ok', output);
  }
  const pushed = await persistBrief(profile, pack, runId, output, opts.reason ?? 'manual');
  return { runId, agent: agent.name, output, fellBack, graded, pushed };
}

async function startRun(profileId: string, agent: OpportunityAgent, input_summary: Record<string, unknown>): Promise<string> {
  const { data, error } = await copilotDb()
    .from('copilot_agent_runs')
    .insert({ profile_id: profileId, kind: 'daily_brief', agent: agent.name, model: agent.model ?? null, input_summary })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishRun(runId: string, status: 'ok' | 'error', output: BriefOutput | null, error?: string) {
  await copilotDb().from('copilot_agent_runs').update({ status, output, error: error ?? null, finished_at: new Date().toISOString() }).eq('id', runId);
}

async function persistBrief(profile: Profile, pack: ContextPack, runId: string, out: BriefOutput, reason: string): Promise<number> {
  const db = copilotDb();
  const pid = profile.id;
  const today = pack.today;
  const norm = (s: string) => s.trim().toLowerCase();

  // Insight: one per day.
  // Only the daily row is replaced; the weekly Signals read lives beside it.
  await db.from('copilot_insights').delete().eq('profile_id', pid).eq('for_date', today).eq('kind', 'daily');
  await db.from('copilot_insights').insert({ profile_id: pid, kind: 'daily', for_date: today, body: out.insight.body, reasoning: out.insight.reasoning ?? null, agent_run_id: runId });

  // ─── Today's call ─────────────────────────────────────────────────────────
  // A brief with no decision is the old product: a list of things to consider.
  // The starter's ladder is the floor, so Today always leads with one move.
  // And when the offer is blank the server picks the call whatever the agent
  // proposed — the same rule that strips drafts written from nothing, because
  // "send the waiting drafts" is wrong advice when none of them can exist.
  const blankOffer = offerIsEmpty(profile.offer);
  const floor = starterDecision({
    metrics: pack.metrics,
    candidates: pack.candidates.length,
    offerEmpty: blankOffer,
    hasSegments: profile.target_segments.length > 0,
  });
  const useFloor = blankOffer || !out.decision;
  out.decision = useFloor ? floor.decision : out.decision;
  out.dont = useFloor ? floor.dont : out.dont;
  if (out.decision) {
    await saveDecision(pid, {
      forDate: today, runId, draft: out.decision, dont: out.dont,
      changed: pack.changed,
      snapshot: snapshotOf(pack.metrics),
      baseline: metricValue(pack.metrics, out.decision.verify_metric ?? 'none'),
    });
  }

  const candidateIds = new Set(pack.candidates.map((c) => c.id));
  const rankCtx = { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: pack.typeAffinity };

  // Rankings: the agent scored real candidates. Update fit, reason and stored score.
  for (const r of out.rankings) {
    if (!candidateIds.has(r.id)) continue;
    const cand = pack.candidates.find((c) => c.id === r.id)!;
    const stamp = new Date().toISOString();
    await db.from('copilot_opportunities').update({
      fit_score: r.fit_score, reason: r.reason || cand.summary, scored_at: stamp,
      score: scoreOpportunity({ type: cand.type, effort: 'medium', fit_score: r.fit_score, created_at: stamp, source_kind: 'sourced' }, rankCtx),
    }).eq('id', r.id).eq('profile_id', pid);
  }

  // Today's plan: replace what the AGENT generated and is still open. Keep what
  // the user finished and anything the system scheduled (day-3 follow-ups have
  // no agent_run_id and must survive the daily purge).
  await db.from('copilot_actions').delete()
    .eq('profile_id', pid).eq('kind', 'plan').eq('for_date', today).eq('status', 'open').not('agent_run_id', 'is', null);

  // Server-side rule, whatever the agent proposed: no draft is written from an
  // empty offer. The message would be a stranger's template, and the account
  // this was built for proved nobody sends those. The plan carries one task
  // instead — set the offer — and every draft is written the moment it is.
  if (blankOffer) {
    out.plan = out.plan.filter((p) => !(p.owner === 'ai' && p.ai_draft && p.channel && p.opportunity_ref));
    const norm2 = (s: string) => s.trim().toLowerCase();
    if (!out.plan.some((p) => norm2(p.title) === norm2(OFFER_TASK_TITLE))) {
      out.plan.unshift({ owner: 'you', title: OFFER_TASK_TITLE, detail: OFFER_TASK_DETAIL, minutes: 3 });
    }
  }

  if (out.plan.length) {
    const rows = out.plan.map((p) => ({
      profile_id: pid, kind: 'plan', owner: p.owner, title: p.title, detail: p.detail ?? null, ai_draft: p.ai_draft ?? null,
      minutes: p.minutes ?? null, for_date: today, agent_run_id: runId,
      opportunity_id: p.opportunity_ref && candidateIds.has(p.opportunity_ref) ? p.opportunity_ref : null,
    }));
    const { data: inserted } = await db.from('copilot_actions').insert(rows).select('id, title, opportunity_id');
    // AI drafts that target a real candidate on a channel become send-ready executions.
    for (const p of out.plan) {
      if (p.owner !== 'ai' || !p.ai_draft || !p.channel || !p.opportunity_ref || !candidateIds.has(p.opportunity_ref)) continue;
      const row = (inserted ?? []).find((r: { title: string; opportunity_id: string | null }) => r.title === p.title && r.opportunity_id === p.opportunity_ref);
      if (!row) continue;
      try {
        // Never queue a second message to someone who already has one waiting.
        if (await openDraftForOpportunity(pid, p.opportunity_ref)) continue;
        await createDraftExecution(pid, { actionId: row.id, opportunityId: p.opportunity_ref, channel: p.channel, body: p.ai_draft });
      } catch (e) { console.error('[copilot] draft execution failed', e); }
    }
  }

  // Nudges: routine ones are regenerated freely so they never pile up, but an
  // URGENT nudge the user has not acted on is never dropped just because this
  // run failed to repeat it — that is real work quietly disappearing.
  const { data: urgentOpen } = await db
    .from('copilot_actions')
    .select('title')
    .eq('profile_id', pid).eq('kind', 'nudge').eq('status', 'open').eq('urgency', 'urgent');
  const carried = new Set((urgentOpen ?? []).map((n: { title: string }) => norm(n.title)));

  await db.from('copilot_actions').delete()
    .eq('profile_id', pid).eq('kind', 'nudge').eq('status', 'open').neq('urgency', 'urgent').not('agent_run_id', 'is', null);

  const freshNudges = out.nudges.filter((n) => !carried.has(norm(n.title)));
  if (freshNudges.length) {
    await db.from('copilot_actions').insert(freshNudges.map((n) => ({
      profile_id: pid, kind: 'nudge', owner: 'you', title: n.title, urgency: n.urgency, due_label: n.due_label ?? null, for_date: today, agent_run_id: runId,
    })));
  }

  // Opportunities: add new ones, never re-suggest a title the user already saw.
  if (out.opportunities.length) {
    const { data: existing } = await db.from('copilot_opportunities').select('title').eq('profile_id', pid);
    const seen = new Set((existing ?? []).map((r: { title: string }) => norm(r.title)));
    const now = new Date();
    const rows = out.opportunities
      .filter((o) => !seen.has(norm(o.title)))
      .map((o) => {
        const created_at = now.toISOString();
        const score = scoreOpportunity(
          { type: o.type, effort: o.effort ?? 'medium', fit_score: o.fit_score, created_at, source_kind: 'inferred' },
          { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: pack.typeAffinity, now },
        );
        return {
          profile_id: pid, type: o.type, title: o.title, reason: o.reason, value_label: o.value_label ?? null,
          value_amount: o.value_amount ?? null, currency: o.currency ?? null, effort: o.effort ?? 'medium',
          fit_score: o.fit_score, score, source: o.source ?? 'inferred', source_kind: 'inferred', contact: {}, url: o.url ?? null, agent_run_id: runId,
          expires_at: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
        };
      });
    if (rows.length) await db.from('copilot_opportunities').insert(rows);
  }

  // Skills: upsert by title. Lessons: add if not already active.
  if (out.skills.length || out.lessons.length) {
    const { data: growth } = await db.from('copilot_growth_items').select('id, kind, title, status').eq('profile_id', pid);
    const byKey = new Map((growth ?? []).map((g: { id: string; kind: string; title: string; status: string }) => [`${g.kind}:${norm(g.title)}`, g]));
    for (const s of out.skills) {
      const hit = byKey.get(`skill:${norm(s.title)}`);
      if (hit) await db.from('copilot_growth_items').update({ level: s.level, note: s.note ?? null, cta: s.cta ?? null, status: 'active', agent_run_id: runId }).eq('id', hit.id);
      else await db.from('copilot_growth_items').insert({ profile_id: pid, kind: 'skill', title: s.title, level: s.level, note: s.note ?? null, cta: s.cta ?? null, agent_run_id: runId });
    }
    const newLessons = out.lessons.filter((l) => !byKey.has(`lesson:${norm(l.title)}`));
    if (newLessons.length) {
      await db.from('copilot_growth_items').insert(newLessons.map((l) => ({ profile_id: pid, kind: 'lesson', title: l.title, minutes: l.minutes ?? null, note: l.note ?? null, url: l.url ?? null, agent_run_id: runId })));
    }
  }

  return notifyBrief(profile, out, reason, today);
}

/**
 * One notification a day, carrying the call.
 *
 * Push has existed for months and has never delivered anything, for three
 * reasons that all had to be fixed at once:
 *
 *  - It only ever fired for urgent nudges, and only for *fresh* ones. Urgent
 *    nudges are deliberately carried forward until acted on, so anything that
 *    persists — "follow up with Briones" — pushes once and is silent forever
 *    after. The nudges that matter most were the ones that went quiet.
 *  - It fired from any brief, including the one that runs when the app is
 *    opened. A notification sent to somebody already looking at the screen is
 *    at best suppressed and at worst noise, so this now sends only from the
 *    cron: the one moment the user is definitionally not here.
 *  - It never carried the decision, which is the only thing in the app worth
 *    interrupting someone for. A count of nudges is not a reason to open a
 *    phone; "send the 7 drafts already written" is.
 *
 * Never throws, and awaited rather than fired-and-forgotten so the cron report
 * can say whether it actually went.
 */
/** What today's notification should say, or null for silence. Pure, so the
 *  rules above are testable without a database or a push service. */
export function notifyPayload(
  out: { decision: { headline: string } | null; nudges: Array<{ title: string; urgency: string }> },
  reason: string,
): { title: string; body: string } | null {
  if (reason !== 'cron') return null;
  if (out.decision) return { title: 'Today’s call', body: out.decision.headline };
  const urgent = out.nudges.filter((n) => n.urgency === 'urgent');
  if (!urgent.length) return null;
  return { title: urgent.length === 1 ? 'Needs you today' : `${urgent.length} things need you today`, body: urgent[0].title };
}

async function notifyBrief(profile: Profile, out: BriefOutput, reason: string, today: string): Promise<number> {
  const payload = notifyPayload(out, reason);
  if (!payload) return 0;
  try {
    // One tag per day: a second run replaces the notification rather than
    // stacking a duplicate on the lock screen.
    const { sent } = await sendPush(profile.id, { ...payload, url: '/copilot', tag: `daily-${today}` });
    return sent;
  } catch (e) {
    console.error('[copilot] daily push failed', e);
    return 0;
  }
}
