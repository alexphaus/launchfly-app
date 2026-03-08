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
import { fireEvent } from '@/lib/automations/executor';

export const dynamic = 'force-dynamic';

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
      phone: body.phone as string | undefined,
      customerName: body.name || body.customer_name,
      message: body.message,
      amount: body.amount ? Number(body.amount) : undefined,
      metadata: body.metadata || {},
    };

    console.log(`[trigger] External webhook for ${businessId}: event=${ctx.event}`);

    const result = await fireEvent(ctx);

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
