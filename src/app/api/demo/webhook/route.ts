// src/app/api/demo/webhook/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Demo Webhook — Twilio WhatsApp inbound handler for demo interactions
// ═══════════════════════════════════════════════════════════════════════════
//
// This receives button taps and text replies from contractors going
// through the interactive demo. Routes to the flow engine.
//
// Set your Twilio WhatsApp number's webhook to:
//   POST https://app.launchfly.ai/api/demo/webhook
//
// NOTE: If you're already using /api/webhook/twilio/v2/route.ts as the
// main webhook, you can add demo routing there instead. This standalone
// route is for a dedicated demo WhatsApp number.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}
import { handleDemoReply } from '@/lib/demo/flow';
import type { DemoSession } from '@/lib/demo/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Twilio sends form-encoded data
    const body = formData.get('Body')?.toString() || '';
    const from = formData.get('From')?.toString() || '';      // "whatsapp:+15125551234"
    const buttonPayload = formData.get('ButtonPayload')?.toString(); // Quick reply payload

    // Extract phone from WhatsApp format
    const phone = from.replace('whatsapp:', '').trim();

    if (!phone) {
      return twimlEmpty();
    }

    const supabase = getSupabase();

    // ── Find the active demo session for this phone ──────────────────────
    const { data: session } = await supabase
      .from('demo_sessions')
      .select('*')
      .eq('phone', phone)
      .not('step', 'in', '("completed","timeout")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      // No active demo — could be a regular message. Return empty TwiML.
      return twimlEmpty();
    }

    const typedSession = session as DemoSession;

    // Use button payload if available, otherwise the message body
    const message = buttonPayload || body;

    // ── Route through the flow engine ────────────────────────────────────
    const newStep = await handleDemoReply(typedSession, message);

    // ── Update session state ─────────────────────────────────────────────
    const update: Record<string, unknown> = {
      step: newStep,
      updated_at: new Date().toISOString(),
    };

    if (newStep === 'completed') {
      update.completed_at = new Date().toISOString();
      update.outcome = 'converted';
    }

    await supabase
      .from('demo_sessions')
      .update(update)
      .eq('id', typedSession.id);

    console.log(`[demo/webhook] ${phone}: ${typedSession.step} → ${newStep} (msg: "${message.substring(0, 50)}")`);

    // Return empty TwiML — we send messages via API, not via TwiML response
    return twimlEmpty();
  } catch (err) {
    console.error('[demo/webhook] Error:', err);
    return twimlEmpty();
  }
}

// ── Utility ──────────────────────────────────────────────────────────────

function twimlEmpty(): NextResponse {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } },
  );
}
