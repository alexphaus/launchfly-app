// GET  /api/foundation/today  → the Today tab: brief, leverage plan, next actions
// POST /api/foundation/today  → force a regenerate (pull-to-refresh)

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, requireUser } from '@/lib/foundation/db';
import { generateDailyBrief } from '@/lib/foundation/brief';
import { loadOperatorContext, SOURCE_COPY } from '@/lib/foundation/context';
import { CAPACITY, rerankForCapacity } from '@/lib/foundation/capacity';
import type { FoundationAction } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

async function buildToday(userId: string, force: boolean) {
  const { brief } = await generateDailyBrief(userId, { force });
  const ctx = await loadOperatorContext(userId);
  const supabase = getServiceClient();

  const { data: actions } = await supabase
    .from('foundation_actions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved'])
    .order('urgency', { ascending: true })
    .limit(50);

  const rows = (actions ?? []) as FoundationAction[];
  const plan = rows.filter((a) => a.lane === 'plan' && a.brief_date === brief.brief_date);
  const next = rows.filter((a) => a.lane === 'next');

  // Next actions re-rank against current capacity the same way matches do.
  const rankedNext = rerankForCapacity(
    next.map((a) => ({
      ...a,
      score: a.urgency === 'overdue' ? 95 : a.urgency === 'today' ? 85 : 50,
      capacity_fit: a.min_capacity,
    })),
    ctx.profile.capacity_mode,
  );

  return {
    greeting: brief.greeting,
    subtitle: `${brief.metrics.new_matches} new matches · ${brief.metrics.needs_you} need you`,
    capacity: CAPACITY[ctx.profile.capacity_mode],
    read: {
      text: brief.read_text,
      // "See the reasoning →" renders these; they are observations, not prose.
      evidence: brief.evidence,
      confidence: brief.confidence,
      model: brief.model,
      date: brief.brief_date,
    },
    plan,
    next: rankedNext,
    metrics: brief.metrics,
    context: {
      confidence: ctx.confidence,
      missing: ctx.missingSources.map((kind) => ({ kind, ...SOURCE_COPY[kind] })),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    return NextResponse.json(await buildToday(userId, false));
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    return NextResponse.json(await buildToday(userId, true));
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
