// src/app/api/assistants/trigger/resume/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Workflow Resume Endpoint  —  Called by QStash after a delay action
//
// If the customer replied since the sequence was scheduled, we abort
// silently so we don't spam them on top of a live conversation.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeActions, type Action, type EventContext } from '@/lib/automations/executor';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actions: Action[] = body.actions;
    const ctx: EventContext = body.ctx;
    const scheduledAt: string | undefined = body.scheduledAt;

    if (!actions?.length || !ctx?.businessId) {
      return NextResponse.json({ error: 'Missing actions or context' }, { status: 400 });
    }

    // ── Auto-cancel if customer replied since this was scheduled ──
    if (scheduledAt && ctx.phone) {
      const phoneNorm = ctx.phone.replace(/^\+/, '');
      const supabase = getSupabase();
      const { count } = await supabase
        .from('chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', ctx.businessId)
        .eq('phone', phoneNorm)
        .eq('role', 'user')
        .gt('created_at', scheduledAt);

      if (count && count > 0) {
        console.log(`[resume] Customer ${ctx.phone} replied since ${scheduledAt} — aborting ${actions.length} remaining actions`);
        return NextResponse.json({ ok: true, cancelled: true, reason: 'customer_replied' });
      }
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
