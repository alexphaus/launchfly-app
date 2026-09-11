// src/lib/copilot/brief.ts
// Runs the agent for one profile and persists the result. Every run is logged in
// copilot_agent_runs. If the configured agent fails we fall back to the starter
// so the user always gets a Today view.

import { StarterAgent, getAgent } from './agent';
import { budgetForReason } from './agent/llm';
import { buildContextPack } from './context';
import { copilotDb } from './db';
import { promoteCall } from './call';
import { metricValue, snapshotOf, starterDecision } from './decision';
import { offerIsEmpty } from './offer';
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
  const reason = opts.reason ?? 'manual';
  // How long the agent gets depends on who is waiting. The cron is not behind
  // the proxy and can afford a real generation; a tap cannot.
  const budget = budgetForReason(reason);
  // budget_ms is recorded because the run row is usually the only evidence left:
  // a timeout that does not say what it was bounded by reads like a rejection.
  const summary = { reason, budget_ms: budget, goals: pack.goals.length, context: pack.context.length, capacity: pack.profile.capacity };

  let agent = getAgent();
  let runId = await startRun(profileId, agent, summary);
  let output: BriefOutput;
  let fellBack = false;
  try {
    output = await agent.generateBrief(pack, { timeoutMs: budget });
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
  const pushed = await persistBrief(profile, pack, runId, output, reason);
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

  // Insight: one per day.
  // Only today's daily row is replaced. Older rows, including the weekly reads
  // written before that surface was cut, are left alone rather than swept.
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
  // The ladder is in call.ts. Short version: a blank offer forces the offer
  // call; otherwise the winning Move takes it, because it is grounded in a real
  // row and carries an artifact where prose does not; otherwise the agent's;
  // otherwise the starter's floor.
  const promoted = blankOffer ? null : await promoteCall(profile, pack.metrics).catch((e) => {
    // Arbitration failing must not cost the whole brief. Falling through to the
    // written call is exactly the behaviour that existed before it.
    console.error('[copilot/brief] promoteCall failed', e);
    return null;
  });
  const useFloor = blankOffer || (!promoted && !out.decision);
  out.decision = blankOffer ? floor.decision : promoted ? promoted.draft : (out.decision ?? floor.decision);
  // A promoted Move brings its own trade-off (the runner-up) and its own
  // artifact, so a separate "not today" line beside it is a second opinion
  // nobody asked for.
  out.dont = promoted ? null : useFloor ? floor.dont : out.dont;
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

  // The agent no longer writes plan items or nudges, so there is nothing here to
  // purge, insert or carry. Both were asked for in the same response that wrote
  // the Call, over the same context, and restated it — see BriefOutput.
  //
  // The one real capability that went with them is the agent auto-drafting an
  // opener into the queue. That is deliberate, not collateral: a model writing
  // five openers a night into a queue nobody empties is how a queue reaches
  // forty-one. Drafting is now only ever deliberate — the deck's "Draft it" and
  // the draft button on a business — and both are gated on the send queue.
  //
  // copilot_actions and kind='plan' stay: draftOpener writes one per opener and
  // createDraftExecution in execution.ts links to it, so the table is load-bearing
  // for every draft in the queue. Only the model's rows are gone.

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
  out: { decision: { headline: string } | null },
  reason: string,
): { title: string; body: string } | null {
  if (reason !== 'cron') return null;
  // The call, or silence. The urgent-nudge fallback went with the nudges: it
  // fired when the run produced no decision, which is exactly the morning there
  // is nothing worth a notification — and it pushed a restatement of a card the
  // user would see anyway the moment they opened the app.
  return out.decision ? { title: 'Today’s call', body: out.decision.headline } : null;
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
