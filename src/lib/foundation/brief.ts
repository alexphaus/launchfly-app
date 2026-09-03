// src/lib/foundation/brief.ts
// ═══════════════════════════════════════════════════════════════════════════
// The daily brief — "Today's read" + the leverage plan
//
// This is the highest-trust surface in the product: it tells someone how to
// spend their day, in the first person, with numbers. So it is built in two
// strictly separated passes:
//
//   1. OBSERVE (code)  — gather checkable facts from the operator's own data.
//                        Each one becomes a BriefEvidence row, stored with the
//                        brief. "See the reasoning →" renders these.
//   2. NARRATE (model) — turn the observations into one short paragraph, with
//                        an explicit ban on facts that are not in the list.
//
// If step 2 fails we still ship the brief, assembled from the observations.
// A day without a model call is a plainer brief, not a broken one.
// ═══════════════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { deepseek, CHAT_MODEL } from '@/lib/ai-provider';
import { getServiceClient, logEvent } from './db';
import { loadOperatorContext, countEvents, SOURCE_COPY } from './context';
import { CAPACITY, fitPlanToCapacity, capacityForMinutes } from './capacity';
import { recomputeMatches } from './matcher';
import type { BriefEvidence, FoundationBrief, OperatorContext } from './types';

export interface BriefResult {
  brief: FoundationBrief;
  planActionIds: string[];
  regenerated: boolean;
}

// ─── Pass 1: observations ────────────────────────────────────────────────

interface Observation extends BriefEvidence {
  /** 0-1. Drives which observations reach the paragraph. */
  weight: number;
}

function observe(ctx: OperatorContext, now: Date): Observation[] {
  const obs: Observation[] = [];
  const iso = now.toISOString();

  // Outreach volume vs. reply rate — the "40 DMs at 3%" reading.
  const sent = countEvents(ctx, 'outreach_sent', 7);
  const replies = countEvents(ctx, 'outreach_reply', 7);
  if (sent >= 5) {
    const rate = replies / sent;
    obs.push({
      claim: `${sent} outreach messages sent in the last 7 days with ${replies} replies (${Math.round(rate * 100)}% reply rate)`,
      value: Math.round(rate * 100),
      source: 'foundation_events',
      observed_at: iso,
      weight: rate < 0.05 ? 0.95 : 0.5,
    });
  }

  // Deals going cold — the "day 4 with no deposit" reading.
  const stalled = ctx.openOpportunities.filter((o) => {
    if (o.status !== 'pursuing') return false;
    const age = (now.getTime() - new Date(o.posted_at).getTime()) / 86_400_000;
    return age >= 3;
  });
  for (const opp of stalled.slice(0, 3)) {
    const days = Math.floor((now.getTime() - new Date(opp.posted_at).getTime()) / 86_400_000);
    obs.push({
      claim: `${opp.title} has been in "pursuing" for ${days} days with no close`,
      value: days,
      source: 'foundation_opportunities',
      observed_at: iso,
      weight: 0.9,
    });
  }

  // Overdue work already on the list.
  const overdue = ctx.openActions.filter(
    (a) => a.due_at && new Date(a.due_at) < now && a.status === 'pending',
  );
  if (overdue.length) {
    obs.push({
      claim: `${overdue.length} action${overdue.length > 1 ? 's are' : ' is'} overdue, oldest: ${overdue[0].title}`,
      value: overdue.length,
      source: 'foundation_actions',
      observed_at: iso,
      weight: 0.85,
    });
  }

  // Goal pressure.
  for (const goal of ctx.goals) {
    if (goal.kind === 'runway' && goal.current_value > 0 && goal.current_value < 6) {
      obs.push({
        claim: `Runway is ${goal.current_value} months`,
        value: goal.current_value,
        source: 'foundation_goals',
        observed_at: iso,
        weight: goal.current_value < 4 ? 0.95 : 0.7,
      });
    }
    if (goal.kind === 'revenue' && goal.target_value) {
      const gap = Math.max(0, goal.target_value - goal.current_value);
      obs.push({
        claim: `${goal.label}: ${goal.current_value} of ${goal.target_value} (${Math.round((goal.current_value / goal.target_value) * 100)}%), ${gap} to go`,
        value: gap,
        source: 'foundation_goals',
        observed_at: iso,
        weight: gap > 0 ? 0.75 : 0.3,
      });
    }
  }

  // Capacity the operator declared, and when.
  const capacity = CAPACITY[ctx.profile.capacity_mode];
  obs.push({
    claim: `Capacity is set to "${capacity.label}" — about ${capacity.budgetMinutes} focused minutes`,
    value: capacity.budgetMinutes,
    source: 'foundation_profiles',
    observed_at: ctx.profile.capacity_set_at ?? iso,
    weight: 0.4,
  });

  // Honesty about what we cannot see.
  if (ctx.missingSources.length) {
    obs.push({
      claim: `No ${ctx.missingSources.map((k) => SOURCE_COPY[k].label).join(' or ')} connected — this read is based only on what you have told the copilot`,
      value: null,
      source: 'foundation_context_sources',
      observed_at: iso,
      weight: ctx.confidence < 0.5 ? 0.8 : 0.35,
    });
  }

  return obs.sort((a, b) => b.weight - a.weight);
}

// ─── Pass 2: narration ───────────────────────────────────────────────────

async function narrate(
  ctx: OperatorContext,
  observations: Observation[],
  topMatchTitles: string[],
): Promise<{ text: string; model: string | null }> {
  const fallback = () => ({
    text: observations.slice(0, 3).map((o) => o.claim).join('. ') + '.',
    model: null,
  });

  if (!process.env.DEEPSEEK_API_KEY || !observations.length) return fallback();

  try {
    const { text } = await generateText({
      model: deepseek(CHAT_MODEL),
      temperature: 0.4,
      prompt: `You are a copilot for a solo operator. Write "today's read": ONE paragraph, 45-70 words, that tells them what the day's data actually means and what to shift.

Observations (the ONLY facts you may use):
${observations.map((o) => `- ${o.claim}`).join('\n')}

${topMatchTitles.length ? `Top matched opportunities right now: ${topMatchTitles.join('; ')}` : ''}

Rules:
- Never state a number, name or fact that is not in the observations above.
- Lead with the sharpest observation, then the implication, then one concrete shift.
- Address them as "you". No greeting, no sign-off, no bullet points, no headings.
- Plain and direct. No "leverage", "synergy", "crush it", no exclamation marks.
- If the observations are thin, say what you would need to see rather than padding.

Write only the paragraph.`,
    });

    const cleaned = text.trim().replace(/^["']|["']$/g, '');
    if (!cleaned) return fallback();
    return { text: cleaned, model: CHAT_MODEL };
  } catch (err) {
    console.warn('[foundation] brief narration failed:', (err as Error).message);
    return fallback();
  }
}

// ─── Plan assembly ───────────────────────────────────────────────────────

/**
 * Turn the top matches and open actions into today's plan, fitted to capacity.
 * Plan rows are real `foundation_actions` — the UI's "AI drafted" / "Needs you"
 * chips are `kind`, and an approved draft is what actually gets sent.
 */
async function buildPlan(
  userId: string,
  ctx: OperatorContext,
  briefDate: string,
): Promise<string[]> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from('foundation_actions')
    .select('id')
    .eq('user_id', userId)
    .eq('brief_date', briefDate)
    .eq('lane', 'plan');
  if (existing?.length) return existing.map((r) => r.id);

  const { data: matchRows } = await supabase
    .from('foundation_matches')
    .select('opportunity_id, score, reason, capacity_fit, foundation_opportunities!inner(id, title, type, status, effort_hours)')
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(10);

  type Candidate = {
    title: string;
    detail: string | null;
    kind: 'ai_drafted' | 'needs_you';
    estimated_minutes: number;
    score: number;
    source_kind: string;
    source_id: string | null;
    category: string | null;
  };

  const candidates: Candidate[] = [];

  for (const row of matchRows ?? []) {
    const opp = (row as unknown as { foundation_opportunities: { id: string; title: string; type: string; status: string; effort_hours: number | null } }).foundation_opportunities;
    if (!opp || opp.status === 'dismissed') continue;
    const pursuing = opp.status === 'pursuing';
    candidates.push({
      title: pursuing
        ? `Move ${opp.title} forward — send the next message`
        : `Open ${opp.title}`,
      detail: (row as { reason: string | null }).reason,
      // Outreach on a scored match is draftable; scoping real work is not.
      kind: opp.type === 'client' || opp.type === 'person' ? 'ai_drafted' : 'needs_you',
      estimated_minutes: pursuing ? 20 : 30,
      score: (row as { score: number }).score,
      source_kind: 'opportunity',
      source_id: opp.id,
      category: 'outreach',
    });
  }

  // Existing open actions compete for the same minutes as new work.
  for (const action of ctx.openActions) {
    if (action.lane !== 'next') continue;
    candidates.push({
      title: action.title,
      detail: action.detail,
      kind: action.kind,
      estimated_minutes: action.estimated_minutes ?? 30,
      score: action.urgency === 'overdue' ? 95 : action.urgency === 'today' ? 85 : 50,
      source_kind: 'action',
      source_id: action.id,
      category: action.category,
    });
  }

  if (!candidates.length) return [];

  const chosen = fitPlanToCapacity(candidates, ctx.profile.capacity_mode).slice(0, 5);

  const { data: inserted, error } = await supabase
    .from('foundation_actions')
    .insert(
      chosen.map((c) => ({
        user_id: userId,
        title: c.title,
        detail: c.detail,
        kind: c.kind,
        lane: 'plan' as const,
        urgency: 'today' as const,
        category: c.category,
        estimated_minutes: c.estimated_minutes,
        min_capacity: capacityForMinutes(c.estimated_minutes),
        source_kind: c.source_kind,
        source_id: c.source_id,
        brief_date: briefDate,
      })),
    )
    .select('id');
  if (error) throw error;
  return (inserted ?? []).map((r) => r.id);
}

// ─── Entry point ─────────────────────────────────────────────────────────

export function localDate(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function greetingFor(timezone: string, name: string | null, now = new Date()): string {
  let hour = now.getUTCHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now),
    );
  } catch { /* fall back to UTC */ }
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return name ? `Good ${part}, ${name}` : `Good ${part}`;
}

/**
 * Build (or return) today's brief. One brief per operator per local day;
 * `force` regenerates it, which is what the pull-to-refresh gesture calls.
 */
export async function generateDailyBrief(
  userId: string,
  opts: { force?: boolean; now?: Date } = {},
): Promise<BriefResult> {
  const now = opts.now ?? new Date();
  const supabase = getServiceClient();
  const ctx = await loadOperatorContext(userId);
  const briefDate = localDate(ctx.profile.timezone, now);

  if (!opts.force) {
    const { data: existing } = await supabase
      .from('foundation_briefs')
      .select('*')
      .eq('user_id', userId)
      .eq('brief_date', briefDate)
      .maybeSingle();
    if (existing) {
      const { data: planRows } = await supabase
        .from('foundation_actions')
        .select('id')
        .eq('user_id', userId)
        .eq('brief_date', briefDate)
        .eq('lane', 'plan');
      return {
        brief: existing as FoundationBrief,
        planActionIds: (planRows ?? []).map((r) => r.id),
        regenerated: false,
      };
    }
  }

  const matches = await recomputeMatches(userId, { ctx });
  const observations = observe(ctx, now);
  const { text, model } = await narrate(
    ctx,
    observations,
    matches.slice(0, 3).map((m) => m.opportunity.title),
  );

  const unseenMatches = matches.filter((m) => m.score >= 55).length;
  const needsYou = ctx.openActions.filter((a) => a.kind === 'needs_you' && a.status === 'pending').length;
  const urgent = ctx.openActions.filter(
    (a) => a.status === 'pending' && (a.urgency === 'overdue' || a.urgency === 'today'),
  ).length;

  const { data: brief, error } = await supabase
    .from('foundation_briefs')
    .upsert(
      {
        user_id: userId,
        brief_date: briefDate,
        greeting: greetingFor(ctx.profile.timezone, ctx.profile.display_name, now),
        read_text: text,
        // Strip the internal weight — evidence is a user-facing record.
        evidence: observations.map(({ weight: _weight, ...rest }) => rest),
        metrics: { new_matches: unseenMatches, needs_you: needsYou, urgent },
        confidence: ctx.confidence,
        model,
      },
      { onConflict: 'user_id,brief_date' },
    )
    .select('*')
    .single();
  if (error) throw error;

  const planActionIds = await buildPlan(userId, ctx, briefDate);
  await logEvent(userId, 'brief_generated', {
    brief_date: briefDate,
    observations: observations.length,
    plan_size: planActionIds.length,
    model,
  });

  return { brief: brief as FoundationBrief, planActionIds, regenerated: true };
}
