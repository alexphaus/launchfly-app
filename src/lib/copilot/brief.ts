// src/lib/copilot/brief.ts
// Runs the agent for one profile and persists the result. Every run is logged in
// copilot_agent_runs. If the configured agent fails we fall back to the starter
// so the user always gets a Today view.

import { StarterAgent, getAgent } from './agent';
import { buildContextPack } from './context';
import { copilotDb } from './db';
import { scoreOpportunity } from './ranking';
import { getProfile } from './store';
import type { BriefOutput, OpportunityAgent, Profile, ContextPack } from './types';

export interface BriefResult { runId: string; agent: OpportunityAgent['name']; output: BriefOutput; fellBack: boolean }

export async function runBrief(profileId: string, opts: { reason?: string } = {}): Promise<BriefResult> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');
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
  await persistBrief(profile, pack, runId, output);
  return { runId, agent: agent.name, output, fellBack };
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

async function persistBrief(profile: Profile, pack: ContextPack, runId: string, out: BriefOutput) {
  const db = copilotDb();
  const pid = profile.id;
  const today = pack.today;
  const norm = (s: string) => s.trim().toLowerCase();

  // Insight: one per day.
  await db.from('copilot_insights').delete().eq('profile_id', pid).eq('for_date', today);
  await db.from('copilot_insights').insert({ profile_id: pid, for_date: today, body: out.insight.body, reasoning: out.insight.reasoning ?? null, agent_run_id: runId });

  // Today's plan: replace what is still open, keep what the user finished.
  await db.from('copilot_actions').delete().eq('profile_id', pid).eq('kind', 'plan').eq('for_date', today).eq('status', 'open');
  if (out.plan.length) {
    await db.from('copilot_actions').insert(out.plan.map((p) => ({
      profile_id: pid, kind: 'plan', owner: p.owner, title: p.title, detail: p.detail ?? null, ai_draft: p.ai_draft ?? null,
      minutes: p.minutes ?? null, for_date: today, agent_run_id: runId,
    })));
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
    .eq('profile_id', pid).eq('kind', 'nudge').eq('status', 'open').neq('urgency', 'urgent');

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
          { type: o.type, effort: o.effort ?? 'medium', fit_score: o.fit_score, created_at },
          { capacity: profile.capacity, huntTypes: profile.hunt_types, typeAffinity: pack.typeAffinity, now },
        );
        return {
          profile_id: pid, type: o.type, title: o.title, reason: o.reason, value_label: o.value_label ?? null,
          value_amount: o.value_amount ?? null, currency: o.currency ?? null, effort: o.effort ?? 'medium',
          fit_score: o.fit_score, score, source: o.source ?? 'inferred', url: o.url ?? null, agent_run_id: runId,
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
}
