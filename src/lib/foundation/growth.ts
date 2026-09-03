// src/lib/foundation/growth.ts
// ═══════════════════════════════════════════════════════════════════════════
// Skill gaps and learning suggestions
//
// The Growth tab's credibility rests on one thing: every gap and every lesson
// must be traceable to demand the operator actually saw and missed. So gaps are
// derived from the opportunity corpus, not from a model's opinion of what a
// freelancer "should" learn:
//
//   demand_count  = opportunities requiring the skill
//   matched_count = of those, how many the operator scored well on
//   gap           = high demand, low proficiency
//
// A skill with zero demand in the corpus never appears, however trendy it is.
// ═══════════════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { deepseek, MINI_MODEL } from '@/lib/ai-provider';
import { getServiceClient } from './db';
import { loadOperatorContext } from './context';
import type { FoundationSkill, OperatorContext } from './types';

const MATCH_THRESHOLD = 60;   // below this, the operator effectively missed it

export interface SkillGap {
  slug: string;
  label: string;
  proficiency: number;
  demandCount: number;
  missedCount: number;
  /** 0-1 — how much this gap is costing them right now. */
  pressure: number;
  note: string;
}

export interface GrowthSnapshot {
  gaps: SkillGap[];
  strengths: SkillGap[];
  learning: Array<{
    title: string;
    minutes: number | null;
    rationale: string;
    skill_slug: string | null;
    status: string;
  }>;
  confidence: number;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Recount demand across the operator's opportunity corpus and upsert the
 * counters onto foundation_skills. Skills seen only in demand are created with
 * proficiency 0 — that is exactly the "Voice AI intake — 0%" row.
 */
export async function refreshSkillDemand(userId: string, days = 30): Promise<FoundationSkill[]> {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: opportunities }, { data: matches }, { data: skills }] = await Promise.all([
    supabase
      .from('foundation_opportunities')
      .select('id, title, required_skills, posted_at')
      .eq('user_id', userId)
      .gte('posted_at', since),
    supabase.from('foundation_matches').select('opportunity_id, score').eq('user_id', userId),
    supabase.from('foundation_skills').select('*').eq('user_id', userId),
  ]);

  const scoreByOpp = new Map((matches ?? []).map((m) => [m.opportunity_id, m.score]));
  const demand = new Map<string, { count: number; matched: number; lastSeen: string; example: string }>();

  for (const opp of opportunities ?? []) {
    const score = scoreByOpp.get(opp.id) ?? 0;
    for (const raw of opp.required_skills ?? []) {
      const slug = slugify(raw);
      if (!slug) continue;
      const entry = demand.get(slug) ?? { count: 0, matched: 0, lastSeen: opp.posted_at, example: opp.title };
      entry.count += 1;
      if (score >= MATCH_THRESHOLD) entry.matched += 1;
      if (opp.posted_at > entry.lastSeen) entry.lastSeen = opp.posted_at;
      demand.set(slug, entry);
    }
  }

  const existing = new Map((skills ?? []).map((s: FoundationSkill) => [s.slug, s]));
  const rows = [...demand.entries()].map(([slug, entry]) => {
    const prior = existing.get(slug);
    return {
      user_id: userId,
      slug,
      label: prior?.label ?? slug.replace(/-/g, ' '),
      proficiency: prior?.proficiency ?? 0,
      source: prior?.source ?? 'demand',
      demand_count: entry.count,
      matched_count: entry.matched,
      last_seen_at: entry.lastSeen,
      evidence: prior?.evidence ?? [{ kind: 'demand', note: `Seen in "${entry.example}"` }],
    };
  });

  // Skills with no demand this window drop to zero rather than keeping a stale count.
  for (const skill of skills ?? []) {
    if (!demand.has(skill.slug)) {
      rows.push({
        user_id: userId,
        slug: skill.slug,
        label: skill.label,
        proficiency: skill.proficiency,
        source: skill.source,
        demand_count: 0,
        matched_count: 0,
        last_seen_at: skill.last_seen_at,
        evidence: skill.evidence,
      });
    }
  }

  if (!rows.length) return (skills ?? []) as FoundationSkill[];

  const { data, error } = await supabase
    .from('foundation_skills')
    .upsert(rows, { onConflict: 'user_id,slug' })
    .select('*');
  if (error) throw error;
  return (data ?? []) as FoundationSkill[];
}

function toGap(skill: FoundationSkill): SkillGap {
  const missed = Math.max(0, skill.demand_count - skill.matched_count);
  // Pressure: demand you are missing, scaled by how far below competent you are.
  const shortfall = (100 - skill.proficiency) / 100;
  const pressure = Math.min(1, (missed / 5) * shortfall);
  const note =
    skill.demand_count === 0
      ? 'No demand for this in your feed over the last 30 days.'
      : missed > 0
        ? `Shows up in ${skill.demand_count} ${skill.demand_count === 1 ? 'opportunity' : 'opportunities'} this month; you weren't a strong match on ${missed}.`
        : `Shows up in ${skill.demand_count} ${skill.demand_count === 1 ? 'opportunity' : 'opportunities'} this month and you matched on all of them.`;

  return {
    slug: skill.slug,
    label: skill.label,
    proficiency: skill.proficiency,
    demandCount: skill.demand_count,
    missedCount: missed,
    pressure: Math.round(pressure * 100) / 100,
    note,
  };
}

export async function getGrowthSnapshot(
  userId: string,
  opts: { ctx?: OperatorContext; refresh?: boolean } = {},
): Promise<GrowthSnapshot> {
  const ctx = opts.ctx ?? (await loadOperatorContext(userId));
  const skills = opts.refresh === false ? ctx.skills : await refreshSkillDemand(userId);

  const scored = skills.map(toGap);
  const gaps = scored
    .filter((g) => g.demandCount > 0 && g.proficiency < 50)
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, 5);
  const strengths = scored
    .filter((g) => g.proficiency >= 50)
    .sort((a, b) => b.proficiency - a.proficiency)
    .slice(0, 5);

  const weekOf = startOfWeek(new Date());
  const supabase = getServiceClient();
  const { data: learning } = await supabase
    .from('foundation_learning_items')
    .select('title, minutes, rationale, skill_slug, status')
    .eq('user_id', userId)
    .eq('week_of', weekOf)
    .order('position', { ascending: true });

  return {
    gaps,
    strengths,
    learning: learning ?? [],
    confidence: ctx.confidence,
  };
}

export function startOfWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();             // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));  // back to Monday
  return d.toISOString().slice(0, 10);
}

/**
 * Suggest this week's learning. The model picks the framing; the gaps and the
 * rationale numbers come from the corpus, and every suggestion must name the
 * gap it closes — otherwise it is dropped.
 */
export async function suggestLearning(
  userId: string,
  opts: { limit?: number } = {},
): Promise<GrowthSnapshot['learning']> {
  const limit = opts.limit ?? 2;
  const snapshot = await getGrowthSnapshot(userId);
  if (!snapshot.gaps.length || !process.env.DEEPSEEK_API_KEY) return snapshot.learning;

  const weekOf = startOfWeek(new Date());
  const supabase = getServiceClient();

  try {
    const { text } = await generateText({
      model: deepseek(MINI_MODEL),
      temperature: 0.3,
      prompt: `A solo operator has these skill gaps, each measured from real opportunities in their feed:

${snapshot.gaps.map((g) => `- ${g.label} (proficiency ${g.proficiency}%): ${g.note}`).join('\n')}

Suggest ${limit} short, concrete things to learn this week. Each must close one of the gaps above.

Rules:
- "title" names a specific, learnable thing and its time cost is given separately (10-90 minutes).
- "rationale" must reference the demand evidence for that gap. No invented numbers.
- "skill_slug" must be one of: ${snapshot.gaps.map((g) => g.slug).join(', ')}
- No course names, no URLs, no vendor recommendations.

Return ONLY JSON: [{"title":"...","minutes":12,"rationale":"...","skill_slug":"..."}]`,
    });

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return snapshot.learning;

    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{
      title: string; minutes?: number; rationale: string; skill_slug: string;
    }>;

    const validSlugs = new Set(snapshot.gaps.map((g) => g.slug));
    const rows = parsed
      .filter((r) => r.title && r.rationale && validSlugs.has(r.skill_slug))
      .slice(0, limit)
      .map((r, i) => ({
        user_id: userId,
        title: r.title.trim(),
        minutes: typeof r.minutes === 'number' ? Math.min(Math.max(r.minutes, 5), 120) : null,
        rationale: r.rationale.trim(),
        skill_slug: r.skill_slug,
        position: i,
        week_of: weekOf,
      }));

    if (!rows.length) return snapshot.learning;

    const { data, error } = await supabase
      .from('foundation_learning_items')
      .upsert(rows, { onConflict: 'user_id,week_of,title' })
      .select('title, minutes, rationale, skill_slug, status');
    if (error) throw error;
    return data ?? snapshot.learning;
  } catch (err) {
    console.warn('[foundation] learning suggestion failed:', (err as Error).message);
    return snapshot.learning;
  }
}
