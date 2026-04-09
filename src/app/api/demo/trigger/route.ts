// src/app/api/demo/trigger/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Demo Trigger — Called by Retell's `send_demo_webhook` custom tool
// ═══════════════════════════════════════════════════════════════════════════
//
// When the Retell voice agent gets permission to text a demo,
// it calls this endpoint via a custom tool function. This:
//   1. Creates a demo_sessions row
//   2. Sends Step 1 (the "tap to start" message)
//   3. Schedules a 10-min fallback via QStash
//
// Retell custom tool payload:
//   { "user_number": "+15125551234", "businessId": "optional-uuid", "ownerName": "Marcus", "businessName": "Summit Roofing" }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}
import { sendStep1 } from '@/lib/demo/flow';
import type { DemoSession } from '@/lib/demo/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      user_number?: string;
      ownerName?: string;
      businessName?: string;
      businessId?: string;
    };

    const phone = body.user_number?.replace(/[\s\-()]/g, '');
    const ownerName = body.ownerName || 'there';
    const businessName = body.businessName || null;
    const businessId = body.businessId || null;

    if (!phone) {
      return NextResponse.json({ error: 'user_number is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // ── Duplicate guard: don't re-trigger an active demo ─────────────────
    const { data: existing } = await supabase
      .from('demo_sessions')
      .select('id, step')
      .eq('phone', phone)
      .not('step', 'in', '("completed","timeout")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        session_id: existing.id,
        current_step: existing.step,
      });
    }

    // ── Create demo session ──────────────────────────────────────────────
    const { data: session, error: insertErr } = await supabase
      .from('demo_sessions')
      .insert({
        phone,
        owner_name: ownerName,
        business_name: businessName,
        business_id: businessId,
        step: 'step1_sent',
        outcome: 'in_progress',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[demo/trigger] Insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to create session', detail: insertErr.message }, { status: 500 });
    }

    const typedSession = session as DemoSession;

    // ── Send Step 1: "Tap to start demo" ─────────────────────────────────
    try {
      await sendStep1(typedSession);
      console.log(`[demo/trigger] Step 1 sent to ${phone} (session: ${typedSession.id})`);
    } catch (sendErr) {
      console.error('[demo/trigger] Step 1 send failed:', sendErr);
      return NextResponse.json({ error: 'Failed to send demo message', detail: String(sendErr) }, { status: 502 });
    }

    // ── Schedule 10-min fallback via QStash ──────────────────────────────
    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

    if (qstashToken) {
      try {
        await fetch(
          'https://qstash.upstash.io/v2/publish/' +
          encodeURIComponent(`${appUrl}/api/demo/fallback`),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Delay': '600s', // 10 minutes
              'Upstash-Retries': '2',
            },
            body: JSON.stringify({ session_id: typedSession.id }),
          },
        );
      } catch (qErr) {
        console.warn('[demo/trigger] QStash fallback schedule failed (non-fatal):', qErr);
      }
    }

    return NextResponse.json({
      ok: true,
      session_id: typedSession.id,
      step: 'step1_sent',
      fallback_scheduled: !!qstashToken,
    }, { status: 201 });
  } catch (err) {
    console.error('[demo/trigger] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
