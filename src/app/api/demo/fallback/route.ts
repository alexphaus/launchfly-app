// src/app/api/demo/fallback/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Demo Fallback — 10-minute no-reply nudge
// ═══════════════════════════════════════════════════════════════════════════
//
// Called by QStash 10 minutes after Step 1 is sent.
// If the contractor hasn't tapped "Start Demo" yet, sends a nudge.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { sendFallback } from '@/lib/demo/flow';
import type { DemoSession } from '@/lib/demo/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { session_id } = (await req.json()) as { session_id?: string };

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: session } = await supabase
      .from('demo_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const typedSession = session as DemoSession;

    // Only send fallback if they're still on step 1 (haven't engaged)
    if (typedSession.step !== 'step1_sent') {
      return NextResponse.json({
        ok: true,
        action: 'skipped',
        reason: `Session already at ${typedSession.step}`,
      });
    }

    // Don't send fallback twice
    if (typedSession.fallback_sent) {
      return NextResponse.json({
        ok: true,
        action: 'skipped',
        reason: 'Fallback already sent',
      });
    }

    // Send the nudge
    await sendFallback(typedSession);

    // Mark fallback as sent
    await supabase
      .from('demo_sessions')
      .update({
        fallback_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    console.log(`[demo/fallback] Nudge sent for session ${session_id}`);

    return NextResponse.json({ ok: true, action: 'fallback_sent' });
  } catch (err) {
    console.error('[demo/fallback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
