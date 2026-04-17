// src/app/api/assistants/trigger/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// External Webhook Trigger Endpoint
// ═══════════════════════════════════════════════════════════════════════════
//
// POST /api/assistants/trigger?businessId=xxx
//
// Any external tool (Zapier, Make, Typeform, Stripe, etc.) can POST here
// to fire an event through the automation rules engine.
//
// Body: { event?, phone?, name?, message?, amount?, metadata? }
// If no event is specified, defaults to "external_webhook".

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fireEvent } from '@/lib/automations/executor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Apify scrapes can take 60-120s

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId query param required' }, { status: 400 });
    }

    const body = await req.json();

    const ctx = {
      businessId,
      event: body.event || 'external_webhook',
      ruleId: body.ruleId as string | undefined,
      phone: body.phone as string | undefined,
      customerName: body.name || body.customer_name,
      message: body.message,
      amount: body.amount ? Number(body.amount) : undefined,
      metadata: body.metadata || {},
    };

    console.log(`[trigger] External webhook for ${businessId}: event=${ctx.event}`);

    // ── user_inactive: check if customer replied since this was scheduled ──
    if (ctx.event === 'user_inactive' && ctx.phone && ctx.metadata?.scheduledAt) {
      const supabase = getSupabase();
      const phoneNorm = ctx.phone.replace(/^\+/, '');
      const { count } = await supabase
        .from('chat_history')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('phone', phoneNorm)
        .eq('role', 'user')
        .gt('created_at', ctx.metadata.scheduledAt as string);

      if (count && count > 0) {
        console.log(`[trigger] user_inactive cancelled — ${ctx.phone} replied since ${ctx.metadata.scheduledAt}`);
        return NextResponse.json({ ok: true, cancelled: true, reason: 'customer_replied' });
      }
    }

    const result = await fireEvent(ctx);

    console.log(`[trigger] ${ctx.event} for ${businessId}: fired=${result.fired}, results=${JSON.stringify(result.results).substring(0, 200)}`);

    return NextResponse.json({
      ok: true,
      event: ctx.event,
      rules_fired: result.fired,
      actions: result.results,
    });
  } catch (err) {
    console.error('[trigger] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
