// GET  /api/foundation/growth  → the Growth tab: gaps, strengths, learning
// POST /api/foundation/growth  → refresh demand counts and re-suggest learning

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireUser } from '@/lib/foundation/db';
import { getGrowthSnapshot, suggestLearning } from '@/lib/foundation/growth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const snapshot = await getGrowthSnapshot(userId, {
      refresh: request.nextUrl.searchParams.get('refresh') !== 'false',
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const learning = await suggestLearning(userId);
    const snapshot = await getGrowthSnapshot(userId, { refresh: false });
    return NextResponse.json({ ...snapshot, learning });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
