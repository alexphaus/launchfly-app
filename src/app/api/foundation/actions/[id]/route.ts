// PATCH /api/foundation/actions/[id]  → approve, complete, snooze or dismiss a plan row
//
// "AI drafted" rows carry draft_content. Approving one is the moment a machine
// draft becomes the operator's outgoing message, so approval is explicit,
// logged, and separate from sending — the send itself belongs to the channel
// module that owns the transport.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import type { ActionStatus } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

const ALLOWED: ActionStatus[] = ['pending', 'approved', 'sent', 'done', 'snoozed', 'dismissed'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const body = await request.json();
    const status = body.status as ActionStatus;

    if (!ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED.join(', ')}` },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = { status };
    if (status === 'done' || status === 'sent') update.completed_at = new Date().toISOString();
    if (status === 'snoozed') {
      const hours = Number(body.snooze_hours) || 24;
      update.snoozed_until = new Date(Date.now() + hours * 3_600_000).toISOString();
    }
    // The operator may edit an AI draft before approving it — keep their version.
    if (typeof body.draft_content === 'string') update.draft_content = body.draft_content;

    const { data, error } = await getServiceClient()
      .from('foundation_actions')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Action not found' }, { status: 404 });

    await logEvent(
      userId,
      `action_${status}`,
      {
        title: data.title,
        kind: data.kind,
        lane: data.lane,
        edited_draft: typeof body.draft_content === 'string',
      },
      { kind: 'action', id },
    );

    return NextResponse.json({ action: data });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
