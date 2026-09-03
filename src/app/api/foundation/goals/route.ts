// GET /api/foundation/goals  → the You tab's goal cards
// PUT /api/foundation/goals  → create or update a goal (upsert by key)
//
// Goals are not decoration: scoring.ts reads them directly, so a revenue target
// or a short runway measurably changes what gets ranked first.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import type { FoundationGoal } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

const KINDS = ['revenue', 'runway', 'volume', 'custom'];
const UNITS = ['currency', 'months', 'count', 'percent'];
const PERIODS = ['week', 'month', 'quarter', 'none'];

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const { data, error } = await getServiceClient()
      .from('foundation_goals')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false });
    if (error) throw error;

    const goals = (data ?? []) as FoundationGoal[];
    return NextResponse.json({
      goals: goals.map((g) => ({
        ...g,
        percent:
          g.target_value && g.target_value > 0
            ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
            : null,
      })),
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

    if (!body.key || !body.label) {
      return NextResponse.json({ error: 'key and label are required' }, { status: 400 });
    }
    if (body.kind && !KINDS.includes(body.kind)) {
      return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
    }
    if (body.unit && !UNITS.includes(body.unit)) {
      return NextResponse.json({ error: `unit must be one of: ${UNITS.join(', ')}` }, { status: 400 });
    }
    if (body.period && !PERIODS.includes(body.period)) {
      return NextResponse.json({ error: `period must be one of: ${PERIODS.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await getServiceClient()
      .from('foundation_goals')
      .upsert(
        {
          user_id: userId,
          key: String(body.key),
          label: String(body.label),
          kind: body.kind ?? 'custom',
          target_value: body.target_value ?? null,
          current_value: body.current_value ?? 0,
          unit: body.unit ?? 'currency',
          period: body.period ?? 'month',
          priority: body.priority ?? 0,
          note: body.note ?? null,
          status: body.status ?? 'active',
        },
        { onConflict: 'user_id,key' },
      )
      .select('*')
      .single();
    if (error) throw error;

    await logEvent(userId, 'goal_updated', { key: data.key, target: data.target_value, current: data.current_value }, { kind: 'goal', id: data.id });
    return NextResponse.json({ goal: data });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
