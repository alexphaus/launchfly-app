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

    // ── Pause check: if outreach is paused, re-queue with 1h delay ──
    const supabase = getSupabase();
    const { data: biz } = await supabase
      .from('businesses')
      .select('outreach_paused')
      .eq('id', ctx.businessId)
      .single();

    if (biz?.outreach_paused) {
      // Re-schedule with 1h delay so it keeps checking until unpaused
      const qstashToken = process.env.QSTASH_TOKEN;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
      const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
      if (qstashToken) {
        await fetch(`${qstashBase}/v2/publish/${appUrl}/api/assistants/trigger/resume`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '3600s',
            'Upstash-Retries': '0',
          },
          body: JSON.stringify({ actions, ctx, scheduledAt: scheduledAt || new Date().toISOString() }),
        });
      }
      console.log(`[resume] Outreach paused for ${ctx.businessId} — re-queued in 1h`);
      return NextResponse.json({ ok: true, paused: true, reason: 'outreach_paused', requeued: '1h' });
    }

    // ── Auto-cancel if customer replied since this was scheduled ──
    if (scheduledAt && ctx.phone) {
      const phoneNorm = ctx.phone.replace(/^\+/, '');
      const phoneWithPlus = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      const supabase = getSupabase();

      // Check 1: Did the customer reply via WhatsApp/SMS?
      const { count: replyCount } = await supabase
        .from('chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', ctx.businessId)
        .eq('phone', phoneNorm)
        .eq('role', 'user')
        .gt('created_at', scheduledAt);

      if (replyCount && replyCount > 0) {
        console.log(`[resume] Customer ${ctx.phone} replied since ${scheduledAt} — aborting ${actions.length} remaining actions`);
        return NextResponse.json({ ok: true, cancelled: true, reason: 'customer_replied' });
      }

      // Check 2: Did a voice call connect successfully since scheduling?
      // (i.e. outcome is NOT no_answer/failed — they picked up)
      const { data: recentCall } = await supabase
        .from('quote_leads')
        .select('call_outcome, updated_at')
        .eq('business_id', ctx.businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneNorm}`)
        .gt('updated_at', scheduledAt)
        .not('call_outcome', 'in', '("no_answer","failed")')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentCall) {
        console.log(`[resume] Customer ${ctx.phone} had a successful call (outcome=${recentCall.call_outcome}) since ${scheduledAt} — aborting ${actions.length} remaining actions`);
        return NextResponse.json({ ok: true, cancelled: true, reason: 'call_connected' });
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
