// PATCH /api/foundation/opportunities/[id]  → save / pursue / dismiss / won / lost
//
// Every transition writes a foundation_events row. That log is the training
// signal for ranking: a dismissed 92% match is the most valuable feedback the
// system can get, and it must not be thrown away as a UI-only state change.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import type { OpportunityStatus } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

const ALLOWED: OpportunityStatus[] = ['new', 'saved', 'pursuing', 'won', 'lost', 'dismissed'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const body = await request.json();
    const status = body.status as OpportunityStatus;

    if (!ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();

    // Capture what we scored it at, so the event carries the disagreement.
    const { data: match } = await supabase
      .from('foundation_matches')
      .select('score, breakdown, reason')
      .eq('user_id', userId)
      .eq('opportunity_id', id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('foundation_opportunities')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)       // ownership is enforced here, not by the caller
      .select('id, title, type, status, value_amount')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

    await logEvent(
      userId,
      `opportunity_${status}`,
      {
        title: data.title,
        type: data.type,
        value_amount: data.value_amount,
        scored_at: match?.score ?? null,
        reason_shown: match?.reason ?? null,
        note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
      },
      { kind: 'opportunity', id },
    );

    return NextResponse.json({ opportunity: data });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** Mark a match as seen — drives the "3 new" counter. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const { error } = await getServiceClient()
      .from('foundation_matches')
      .update({ seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('opportunity_id', id)
      .is('seen_at', null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
