// src/app/api/retell/callback/route.ts
// ─── Retell AI post-call webhook ───
// Retell sends a POST here when the call ends. We use it to detect
// unanswered calls / voicemail, then send a missed-call text (Day 4 follow-up).
// The sequence engine manages the overall flow — this handler only handles
// the immediate post-call behavior.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { sendWhatsApp } from '@/lib/quote-followup/whatsapp';
import type { QuoteLead } from '@/lib/quote-followup/types';
import { SEQUENCE_STEPS, buildMessageContext, loadBusinessContext } from '@/lib/quote-followup/sequence';

export const dynamic = 'force-dynamic';

interface RetellCallbackPayload {
  call_id: string;
  call_status: string;          // "ended", "no-answer", "busy", "failed", etc.
  disconnection_reason?: string;
  custom_analysis_data?: Record<string, unknown>;
  metadata?: { lead_id?: string };
  transcript?: string;
  call_analysis?: {
    call_successful?: boolean;
    custom_analysis_data?: {
      send_whatsapp?: boolean;
      customer_interested?: boolean;
      [key: string]: unknown;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RetellCallbackPayload;
    const leadId = body.metadata?.lead_id;

    if (!leadId) {
      console.warn('[retell/callback] No lead_id in metadata');
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = getSupabase();
    const { data: lead } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const typedLead = lead as QuoteLead;

    // Determine outcome
    const unanswered = ['no-answer', 'busy', 'failed', 'machine_detected'].includes(body.call_status);
    const voicemail = body.call_status === 'machine_detected' || body.disconnection_reason === 'voicemail';
    const agentTriggered = body.call_analysis?.custom_analysis_data?.send_whatsapp === true;
    const customerInterested = body.call_analysis?.custom_analysis_data?.customer_interested === true;

    const callOutcome = unanswered ? body.call_status : (agentTriggered ? 'agent_triggered_whatsapp' : body.call_status);

    // ── If ANSWERED and customer is interested → alert contractor ─────────
    if (!unanswered && customerInterested) {
      const biz = await loadBusinessContext(typedLead.business_id);
      if (biz?.ownerPhone) {
        const cur = typedLead.currency || 'USD';
        const sym = cur === 'RM' ? 'RM' : '$';
        try {
          await sendWhatsApp(
            biz.ownerPhone,
            `🔥 HOT LEAD from AI Call!\n\n${typedLead.name} (${typedLead.phone}) sounds interested in the ${typedLead.job_type} quote (${sym}${typedLead.quote_amount.toLocaleString()}).\n\n⚡ Follow up NOW while they're warm!`
          );
        } catch { /* non-fatal */ }
      }

      await supabase.from('quote_leads').update({
        call_outcome: callOutcome,
        sequence_paused: true,       // Pause sequence — prospect engaged
        last_reply_at: new Date().toISOString(),
        status: 'WhatsApp_Nurture',
      }).eq('id', leadId);

      return NextResponse.json({ ok: true, action: 'hot_lead_alert_sent' });
    }

    // ── If unanswered/voicemail → send missed-call text (2 min delay simulated) ──
    if (unanswered || agentTriggered) {
      // Load business context for personalized message
      const biz = await loadBusinessContext(typedLead.business_id);
      const msgCtx = buildMessageContext(typedLead, biz);

      // Use the Day 4 (step 3) missed-call text template
      const voiceStep = SEQUENCE_STEPS[3]; // Step 3 = Day 4 Retell Voice
      const missedCallMsg = voiceStep.buildMessage(msgCtx);

      // Send the missed-call text immediately (in production, could add 2-min delay via QStash)
      try {
        await sendWhatsApp(typedLead.phone, missedCallMsg);
      } catch (smsErr) {
        console.error('[retell/callback] Missed-call text failed:', smsErr);
      }

      // Save to chat history
      await supabase.from('quote_chat_history').insert({
        lead_id: typedLead.id,
        role: 'assistant',
        content: missedCallMsg,
      });

      // Update lead — do NOT transition to WhatsApp_Nurture immediately.
      // The sequence engine will continue to the next step (Day 7) on schedule.
      await supabase.from('quote_leads').update({
        call_outcome: callOutcome + (voicemail ? '_voicemail' : ''),
      }).eq('id', leadId);

      return NextResponse.json({ ok: true, action: 'missed_call_text_sent', voicemail });
    }

    // ── Call was answered / normal end — just record outcome ─────────────
    await supabase
      .from('quote_leads')
      .update({ call_outcome: callOutcome })
      .eq('id', leadId);

    return NextResponse.json({ ok: true, action: 'outcome_recorded', call_outcome: callOutcome });
  } catch (err) {
    console.error('[retell/callback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
