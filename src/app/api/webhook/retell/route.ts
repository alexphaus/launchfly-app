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

    // Retell v2 webhook wraps payload in { event, call: {...} }
    // Also handle legacy flat format just in case
    const event = body.event as string | undefined;
    const call = (body.call || body) as Record<string, unknown>;

    // Only process call_analyzed (has full sentiment/summary data).
    // Retell fires BOTH call_ended AND call_analyzed per call — processing both
    // causes every automation to double-fire.
    if (event && event !== 'call_analyzed') {
      console.log(`[retell/webhook] Ignoring event: ${event} (only processing call_analyzed)`);
      return NextResponse.json({ ok: true, skipped: true, reason: `event=${event}` });
    }

    const callId = call.call_id as string;
    const callStatus = (call.call_status as string) || 'ended';
    const disconnectionReason = (call.disconnection_reason as string) || '';
    const metadata = (call.metadata || {}) as Record<string, unknown>;
    const leadId = (metadata.lead_id as string) || '';
    const analysis = (call.call_analysis || {}) as Record<string, unknown>;
    const sentiment = (analysis.user_sentiment as string) || 'unknown';
    const summary = (analysis.call_summary as string) || '';

    console.log(`[retell/webhook] event=${event || 'flat'} call=${callId} status=${callStatus} disconnect=${disconnectionReason} lead=${leadId} sentiment=${sentiment}`);

    if (!leadId) {
      console.warn('[retell/webhook] No lead_id in metadata — skipping');
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = getSupabase();

    // ── Update lead with call outcome ──
    const outcome = deriveOutcome(callStatus, sentiment, summary, disconnectionReason);

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

    // ── Check if customer has an active WhatsApp conversation ──
    // If not, default to SMS since they haven't messaged us on WhatsApp
    const phoneNorm = lead.phone.replace(/^\+/, '');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentWhatsApp } = await supabase
      .from('chat_history')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', lead.business_id)
      .eq('phone', phoneNorm)
      .eq('role', 'user')
      .gt('created_at', twentyFourHoursAgo);

    const channel = (recentWhatsApp && recentWhatsApp > 0) ? 'whatsapp' : 'sms';
    console.log(`[retell/webhook] Channel for ${lead.phone}: ${channel} (${recentWhatsApp || 0} recent msgs)`);

    // ── Save call summary to chat_history so AI follow-ups have context ──
    if (summary.trim()) {
      const callNote = outcome === 'no_answer'
        ? `[System: AI voice call attempted — no answer. Disconnection: ${disconnectionReason}]`
        : `[System: AI voice call completed — outcome: ${outcome}, sentiment: ${sentiment}. Summary: ${summary}]`;
      await supabase.from('chat_history').insert({
        phone: phoneNorm,
        business_id: lead.business_id,
        role: 'assistant',
        content: callNote,
      });
      console.log(`[retell/webhook] Saved call summary to chat_history for ${lead.phone}`);
    }

    // ── Check if this was a retry call from an automation sequence ──
    // Only block call_completed for no_answer/failed — these are the outcomes that
    // cause infinite loops (no_answer → rule triggers another call → no_answer → ...).
    // If the prospect actually picked up (interested/not_interested/unknown), still fire
    // call_completed so the appropriate follow-up rules trigger.
    const isRetry = metadata.is_retry === true || metadata.is_retry === 'true';
    if (isRetry && (outcome === 'no_answer' || outcome === 'failed')) {
      console.log(`[retell/webhook] Retry call for ${lead.phone} — outcome=${outcome}, skipping call_completed to prevent loop`);
      return NextResponse.json({ ok: true, outcome, isRetry: true });
    }
    if (isRetry) {
      console.log(`[retell/webhook] Retry call for ${lead.phone} — outcome=${outcome}, prospect answered → firing call_completed`);
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
        channel,
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

function deriveOutcome(callStatus: string, sentiment: string, summary: string, disconnectionReason: string): string {
  if (callStatus === 'error') return 'failed';

  const lowerSummary = summary.toLowerCase();
  const lowerDisconnect = disconnectionReason.toLowerCase();

  // No answer — Retell disconnection reasons for unanswered calls
  if (
    lowerDisconnect.includes('no_answer') ||
    lowerDisconnect.includes('dial_no_answer') ||
    lowerDisconnect.includes('busy') ||
    lowerDisconnect.includes('dial_busy') ||
    lowerDisconnect.includes('no_pickup') ||
    lowerDisconnect.includes('machine') ||
    lowerSummary.includes('voicemail') ||
    lowerSummary.includes('no answer') ||
    lowerSummary.includes('didn\'t pick up')
  ) {
    return 'no_answer';
  }

  // If there's no summary at all (empty call — nobody picked up)
  if (!summary.trim()) {
    return 'no_answer';
  }

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

  return 'unknown';
}

// ── Health check ──

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Retell post-call webhook — fires call_completed event',
  });
}
