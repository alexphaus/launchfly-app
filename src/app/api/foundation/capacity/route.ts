// GET /api/foundation/capacity  → available modes + current selection
// PUT /api/foundation/capacity  → set capacity and get everything re-ranked
//
// The sheet promises "matches and today's plan re-rank instantly". This route
// keeps that promise: one profile write, then a pure in-memory re-sort of
// already-scored rows. No embeddings, no model call, no recompute.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import { CAPACITY, CAPACITY_MODES, isCapacityMode, rerankForCapacity } from '@/lib/foundation/capacity';
import { ensureProfile } from '@/lib/foundation/context';
import type { CapacityMode, FoundationAction } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const profile = await ensureProfile(userId);
    return NextResponse.json({
      current: profile.capacity_mode,
      set_at: profile.capacity_set_at,
      options: CAPACITY_MODES.map((mode) => CAPACITY[mode]),
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const mode = body.mode as CapacityMode;

    if (!isCapacityMode(mode)) {
      return NextResponse.json(
        { error: `mode must be one of: ${CAPACITY_MODES.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();
    await ensureProfile(userId);
    const { error } = await supabase
      .from('foundation_profiles')
      .update({ capacity_mode: mode, capacity_set_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;

    const [{ data: matchRows }, { data: actionRows }] = await Promise.all([
      supabase
        .from('foundation_matches')
        .select(`
          id, score, capacity_fit, reason,
          foundation_opportunities!inner (id, title, type, value_amount, value_currency, status)
        `)
        .eq('user_id', userId)
        .in('foundation_opportunities.status', ['new', 'saved', 'pursuing'])
        .order('score', { ascending: false })
        .limit(25),
      supabase
        .from('foundation_actions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .limit(50),
    ]);

    const actions = (actionRows ?? []) as FoundationAction[];

    await logEvent(userId, 'capacity_set', { mode }, undefined);

    return NextResponse.json({
      current: mode,
      capacity: CAPACITY[mode],
      matches: rerankForCapacity(
        (matchRows ?? []).map((r) => {
          const row = r as unknown as {
            id: string; score: number; capacity_fit: CapacityMode; reason: string | null;
            foundation_opportunities: Record<string, unknown>;
          };
          return {
            match_id: row.id,
            score: row.score,
            capacity_fit: row.capacity_fit,
            reason: row.reason,
            opportunity: row.foundation_opportunities,
          };
        }),
        mode,
      ),
      actions: rerankForCapacity(
        actions.map((a) => ({
          ...a,
          score: a.urgency === 'overdue' ? 95 : a.urgency === 'today' ? 85 : 50,
          capacity_fit: a.min_capacity,
        })),
        mode,
      ),
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
