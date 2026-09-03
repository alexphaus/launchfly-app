// GET  /api/foundation/opportunities  → the Opps tab (filtered, capacity-ranked)
// POST /api/foundation/opportunities  → ingest opportunities from any source

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, requireUser } from '@/lib/foundation/db';
import { ingestOpportunities, recomputeMatches, type IngestInput } from '@/lib/foundation/matcher';
import { loadOperatorContext } from '@/lib/foundation/context';
import { rerankForCapacity, isCapacityMode } from '@/lib/foundation/capacity';
import type { CapacityMode, OpportunityType } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

const TYPES: OpportunityType[] = ['client', 'person', 'service', 'community', 'signal'];

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const typeParam = params.get('type');
    const type = typeParam && TYPES.includes(typeParam as OpportunityType)
      ? (typeParam as OpportunityType)
      : null;
    const limit = Math.min(Number(params.get('limit')) || 25, 100);

    const ctx = await loadOperatorContext(userId);
    const capacityParam = params.get('capacity');
    const capacity: CapacityMode = isCapacityMode(capacityParam)
      ? capacityParam
      : ctx.profile.capacity_mode;

    // Recompute only when asked (a scraper just ran, or the operator pulled to
    // refresh). The normal read path serves stored matches — a tab switch must
    // never cost an embedding pass.
    if (params.get('recompute') === 'true') {
      await recomputeMatches(userId, { ctx });
    }

    const supabase = getServiceClient();
    let query = supabase
      .from('foundation_matches')
      .select(`
        id, score, breakdown, confidence, reason, capacity_fit, seen_at, computed_at,
        foundation_opportunities!inner (
          id, type, title, summary, source, source_url, value_amount, value_currency,
          value_kind, effort_hours, required_skills, deadline_at, posted_at, status
        )
      `)
      .eq('user_id', userId)
      .in('foundation_opportunities.status', ['new', 'saved', 'pursuing'])
      .order('score', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('foundation_opportunities.type', type);

    const { data, error } = await query;
    if (error) throw error;

    const shaped = (data ?? []).map((row) => {
      const r = row as unknown as {
        id: string; score: number; breakdown: Record<string, unknown>; confidence: number;
        reason: string | null; capacity_fit: CapacityMode; seen_at: string | null;
        foundation_opportunities: Record<string, unknown>;
      };
      return {
        match_id: r.id,
        score: r.score,
        capacity_fit: r.capacity_fit,
        reason: r.reason,
        confidence: r.confidence,
        breakdown: r.breakdown,
        seen: Boolean(r.seen_at),
        opportunity: r.foundation_opportunities,
      };
    });

    return NextResponse.json({
      capacity,
      count: shaped.length,
      // Ranked for the capacity being viewed, without touching stored scores.
      matches: rerankForCapacity(shaped, capacity),
      confidence: ctx.confidence,
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const items: IngestInput[] = Array.isArray(body) ? body : body.items ?? [body];

    const valid = items.filter((i) => i && typeof i.title === 'string' && i.title.trim());
    if (!valid.length) {
      return NextResponse.json({ error: 'At least one item with a title is required' }, { status: 400 });
    }
    if (valid.length > 100) {
      return NextResponse.json({ error: 'Ingest at most 100 items per call' }, { status: 400 });
    }

    const { inserted } = await ingestOpportunities(userId, valid);
    const matches = await recomputeMatches(userId);

    return NextResponse.json({
      inserted,
      matches: matches.slice(0, 25).map((m) => ({
        opportunity_id: m.opportunity.id,
        title: m.opportunity.title,
        score: m.score,
        adjusted_score: m.adjustedScore,
        reason: m.reason,
      })),
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
