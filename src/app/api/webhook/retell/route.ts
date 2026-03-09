// src/app/api/webhook/retell/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Retell Post-Call Webhook
//
// Receives the call-ended callback from Retell AI, updates the lead record,
// and fires `call_completed` through the automation engine.
//
// Configure in Retell dashboard → Agent Settings → Post-Call Webhook URL:
//   https://app.launchfly.ai/api/webhook/retell
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fireEvent } from '@/lib/automations/executor';

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

    // Retell sends: call_id, call_status, metadata, transcript, call_analysis, etc.
    const callId = body.call_id as string;
    const callStatus = body.call_status as string; // ended, error
    const metadata = (body.metadata || {}) as Record<string, unknown>;
    const leadId = (metadata.lead_id as string) || '';
    const analysis = (body.call_analysis || {}) as Record<string, unknown>;
    const sentiment = (analysis.user_sentiment as string) || 'unknown';
    const summary = (analysis.call_summary as string) || '';

    console.log(`[retell/webhook] Call ${callId} status=${callStatus} lead=${leadId} sentiment=${sentiment}`);

    if (!leadId) {
      console.warn('[retell/webhook] No lead_id in metadata — skipping');
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = getSupabase();

    // ── Update lead with call outcome ──
    const outcome = deriveOutcome(callStatus, sentiment, summary);

    const { data: lead } = await supabase
      .from('quote_leads')
      .update({
        call_outcome: outcome,
        status: outcome === 'interested' ? 'WhatsApp_Nurture' : 'Called',
      })
      .eq('id', leadId)
      .select('business_id, phone, name')
      .single();

    if (!lead) {
      console.warn(`[retell/webhook] Lead ${leadId} not found`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    // ── Fire call_completed event ──
    await fireEvent({
      businessId: lead.business_id,
      event: 'call_completed',
      phone: lead.phone,
      customerName: lead.name,
      metadata: {
        call_id: callId,
        outcome,
        sentiment,
        summary,
        lead_id: leadId,
      },
    });

    console.log(`[retell/webhook] Fired call_completed for ${lead.phone} outcome=${outcome}`);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error('[retell/webhook] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Derive a simple outcome from Retell's analysis ──

function deriveOutcome(callStatus: string, sentiment: string, summary: string): string {
  if (callStatus === 'error') return 'failed';

  const lowerSummary = summary.toLowerCase();

  // Positive signals — prospect agreed to see demo
  if (
    sentiment === 'positive' ||
    lowerSummary.includes('agreed') ||
    lowerSummary.includes('interested') ||
    lowerSummary.includes('send') ||
    lowerSummary.includes('demo') ||
    lowerSummary.includes('sure') ||
    lowerSummary.includes('yes')
  ) {
    return 'interested';
  }

  // Negative signals
  if (
    sentiment === 'negative' ||
    lowerSummary.includes('not interested') ||
    lowerSummary.includes('don\'t call') ||
    lowerSummary.includes('remove')
  ) {
    return 'not_interested';
  }

  // No answer / voicemail
  if (
    lowerSummary.includes('voicemail') ||
    lowerSummary.includes('no answer') ||
    lowerSummary.includes('didn\'t pick up')
  ) {
    return 'no_answer';
  }

  return 'unknown';
}

// ── Health check ──

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Retell post-call webhook — fires call_completed event',
  });
}
