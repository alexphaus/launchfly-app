// src/app/api/assistants/trigger/resume/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Workflow Resume Endpoint  —  Called by QStash after a delay action
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeActions, type Action, type EventContext } from '@/lib/automations/executor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actions: Action[] = body.actions;
    const ctx: EventContext = body.ctx;

    if (!actions?.length || !ctx?.businessId) {
      return NextResponse.json({ error: 'Missing actions or context' }, { status: 400 });
    }

    console.log(`[resume] Resuming ${actions.length} actions for ${ctx.businessId} (event=${ctx.event})`);

    const results: { ok: boolean; detail: string }[] = [];
    await executeActions(actions, 0, ctx, results);

    console.log(`[resume] Completed: ${results.filter(r => r.ok).length}/${results.length} succeeded`);

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error('[resume] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
