// src/lib/foundation/matcher.ts
// ═══════════════════════════════════════════════════════════════════════════
// Match pipeline: ingest → embed → score → explain → persist
//
// Split of responsibility, which is the whole point of this module:
//   scoring.ts  decides the number   (deterministic, testable, auditable)
//   this file   decides the sentence (a model, constrained to the breakdown)
//
// The model is given the factor notes and told to compress them. It is never
// given the score to justify, and it cannot change ranking. If the model call
// fails, matches still persist with the top factor note as the reason — the
// feature degrades to "less pretty", never to "no matches".
// ═══════════════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { deepseek, MINI_MODEL } from '@/lib/ai-provider';
import { getServiceClient, logEvent } from './db';
import { loadOperatorContext } from './context';
import { scoreOpportunity } from './scoring';
import {
  cosineSimilarity,
  embed,
  embedMany,
  operatorEmbeddingText,
  opportunityEmbeddingText,
} from './embeddings';
import type { FoundationOpportunity, OperatorContext, ScoreBreakdown } from './types';

const MAX_EXPLAINED = 12;   // only the visible top slice gets a written reason

export interface IngestInput {
  type?: FoundationOpportunity['type'];
  title: string;
  summary?: string;
  body?: string;
  source?: string;
  source_url?: string;
  external_id?: string;
  value_amount?: number;
  value_currency?: string;
  value_kind?: FoundationOpportunity['value_kind'];
  effort_hours?: number;
  required_skills?: string[];
  deadline_at?: string;
  posted_at?: string;
  expires_at?: string;
  raw?: Record<string, unknown>;
}

/**
 * Ingest opportunities for a user, embedding them in one batched call.
 * Idempotent per (user, source, external_id) — safe to re-run a scraper.
 */
export async function ingestOpportunities(
  userId: string,
  items: IngestInput[],
): Promise<{ inserted: number; ids: string[] }> {
  if (!items.length) return { inserted: 0, ids: [] };
  const supabase = getServiceClient();

  const embeddings = await embedMany(
    items.map((item) =>
      opportunityEmbeddingText({
        title: item.title,
        summary: item.summary,
        body: item.body,
        required_skills: item.required_skills,
      }),
    ),
  );

  const rows = items.map((item, i) => ({
    user_id: userId,
    type: item.type ?? 'client',
    title: item.title,
    summary: item.summary ?? null,
    body: item.body ?? null,
    source: item.source ?? 'manual',
    source_url: item.source_url ?? null,
    external_id: item.external_id ?? null,
    value_amount: item.value_amount ?? null,
    value_currency: item.value_currency ?? 'USD',
    value_kind: item.value_kind ?? (item.value_amount == null ? 'none' : 'fixed'),
    effort_hours: item.effort_hours ?? null,
    required_skills: item.required_skills ?? [],
    deadline_at: item.deadline_at ?? null,
    posted_at: item.posted_at ?? new Date().toISOString(),
    expires_at: item.expires_at ?? null,
    raw: item.raw ?? {},
    embedding: embeddings[i],
  }));

  // Rows carrying an external_id can upsert on the dedupe key; rows without
  // one are plain inserts (a manual add is always a new opportunity).
  const withKey = rows.filter((r) => r.external_id);
  const withoutKey = rows.filter((r) => !r.external_id);
  const ids: string[] = [];

  if (withKey.length) {
    const { data, error } = await supabase
      .from('foundation_opportunities')
      .upsert(withKey, { onConflict: 'user_id,source,external_id', ignoreDuplicates: false })
      .select('id');
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id));
  }
  if (withoutKey.length) {
    const { data, error } = await supabase
      .from('foundation_opportunities')
      .insert(withoutKey)
      .select('id');
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id));
  }

  await logEvent(userId, 'opportunities_ingested', {
    count: ids.length,
    sources: [...new Set(items.map((i) => i.source ?? 'manual'))],
  });
  return { inserted: ids.length, ids };
}

/** Refresh the operator's own embedding when their positioning or skills change. */
export async function refreshOperatorEmbedding(userId: string, ctx?: OperatorContext): Promise<number[] | null> {
  const context = ctx ?? (await loadOperatorContext(userId));
  const text = operatorEmbeddingText({
    headline: context.profile.headline,
    positioning: context.profile.positioning,
    skills: context.skills.map((s) => ({ label: s.label, proficiency: s.proficiency })),
  });
  if (!text.trim()) return null;

  const vector = await embed(text);
  if (!vector) return null;

  await getServiceClient()
    .from('foundation_profiles')
    .update({ embedding: vector, embedding_stale: false })
    .eq('user_id', userId);
  return vector;
}

/**
 * Score every open opportunity for a user and persist the matches.
 * Returns the matches ordered by capacity-adjusted score.
 */
export async function recomputeMatches(
  userId: string,
  opts: { explain?: boolean; ctx?: OperatorContext } = {},
): Promise<Array<{
  opportunity: FoundationOpportunity;
  score: number;
  adjustedScore: number;
  breakdown: ScoreBreakdown;
  reason: string | null;
  confidence: number;
}>> {
  const ctx = opts.ctx ?? (await loadOperatorContext(userId));
  const supabase = getServiceClient();

  if (!ctx.openOpportunities.length) return [];

  // The operator vector powers semantic fallback for untagged opportunities.
  let operatorVector: number[] | null = null;
  if (ctx.profile.embedding_stale) {
    operatorVector = await refreshOperatorEmbedding(userId, ctx);
  } else {
    const { data } = await supabase
      .from('foundation_profiles')
      .select('embedding')
      .eq('user_id', userId)
      .single();
    operatorVector = parseVector(data?.embedding);
  }

  // Opportunity vectors, only for rows we can compare against.
  const vectorsById = new Map<string, number[]>();
  if (operatorVector) {
    const { data } = await supabase
      .from('foundation_opportunities')
      .select('id, embedding')
      .eq('user_id', userId)
      .in('id', ctx.openOpportunities.map((o) => o.id));
    for (const row of data ?? []) {
      const v = parseVector(row.embedding);
      if (v) vectorsById.set(row.id, v);
    }
  }

  const scored = ctx.openOpportunities.map((opportunity) => {
    const oppVector = vectorsById.get(opportunity.id);
    const similarity =
      operatorVector && oppVector ? cosineSimilarity(operatorVector, oppVector) : null;

    const result = scoreOpportunity({
      opportunity,
      skills: ctx.skills,
      goals: ctx.goals,
      semanticSimilarity: similarity,
      minDealValue: Number(ctx.profile.min_deal_value) || 0,
      capacityMode: ctx.profile.capacity_mode,
    });

    return { opportunity, ...result };
  });

  scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

  // Explain only the slice the operator will actually see.
  const reasons = opts.explain === false
    ? new Map<string, string>()
    : await writeReasons(scored.slice(0, MAX_EXPLAINED));

  const now = new Date().toISOString();
  const rows = scored.map((s) => ({
    user_id: userId,
    opportunity_id: s.opportunity.id,
    score: s.score,
    breakdown: s.breakdown,
    confidence: ctx.confidence,
    reason: reasons.get(s.opportunity.id) ?? fallbackReason(s.breakdown),
    reason_model: reasons.has(s.opportunity.id) ? MINI_MODEL : null,
    capacity_fit: s.requiredCapacity,
    computed_at: now,
  }));

  const { error } = await supabase
    .from('foundation_matches')
    .upsert(rows, { onConflict: 'user_id,opportunity_id' });
  if (error) throw error;

  return scored.map((s) => ({
    opportunity: s.opportunity,
    score: s.score,
    adjustedScore: s.adjustedScore,
    breakdown: s.breakdown,
    reason: reasons.get(s.opportunity.id) ?? fallbackReason(s.breakdown),
    confidence: ctx.confidence,
  }));
}

/** The first factor note, used when the model is unavailable. Always true by construction. */
function fallbackReason(breakdown: ScoreBreakdown): string | null {
  return breakdown.notes[0] ?? null;
}

/**
 * One model call for the whole visible slice. The prompt carries only the
 * factor notes — no score, no invitation to editorialise.
 */
async function writeReasons(
  scored: Array<{ opportunity: FoundationOpportunity; breakdown: ScoreBreakdown }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!scored.length || !process.env.DEEPSEEK_API_KEY) return out;

  const payload = scored.map((s, i) => ({
    i,
    title: s.opportunity.title,
    type: s.opportunity.type,
    facts: s.breakdown.notes,
  }));

  try {
    const { text } = await generateText({
      model: deepseek(MINI_MODEL),
      temperature: 0.2,
      prompt: `You write one-line match explanations for a solo operator's opportunity feed.

For each item, compress its facts into ONE sentence of at most 20 words explaining why it is worth their attention.

Hard rules:
- Use ONLY the facts given. Never introduce a number, name, company or claim that is not in them.
- No hype, no "great opportunity", no exclamation marks. Plain, specific, useful.
- Write to the operator as "you"/"your".
- If the facts are weak, say so plainly rather than inventing strength.

Return ONLY a JSON array: [{"i": 0, "reason": "..."}]

Items:
${JSON.stringify(payload, null, 2)}`,
    });

    const parsed = JSON.parse(extractJsonArray(text)) as Array<{ i: number; reason: string }>;
    for (const row of parsed) {
      const item = scored[row.i];
      if (item && typeof row.reason === 'string' && row.reason.trim()) {
        out.set(item.opportunity.id, row.reason.trim());
      }
    }
  } catch (err) {
    console.warn('[foundation] reason generation failed, using factor notes:', (err as Error).message);
  }
  return out;
}

function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in model output');
  return candidate.slice(start, end + 1);
}

/** pgvector comes back as a JSON string over PostgREST. */
function parseVector(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
