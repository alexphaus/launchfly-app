// src/app/api/retell/callback/route.ts
// ─── Retell AI post-call webhook ───
// Retell sends a POST here when the call ends. We use it to detect
// unanswered calls or agent-triggered custom functions, then transition
// the lead to WhatsApp nurture.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { sendWhatsApp } from '@/lib/quote-followup/whatsapp';
import { createDepositLink } from '@/lib/quote-followup/stripe-link';
import type { QuoteLead } from '@/lib/quote-followup/types';

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
    const agentTriggered = body.call_analysis?.custom_analysis_data?.send_whatsapp === true;

    const callOutcome = unanswered ? body.call_status : (agentTriggered ? 'agent_triggered_whatsapp' : body.call_status);

    // ── If unanswered or agent triggered WhatsApp, transition ────────────
    if (unanswered || agentTriggered) {
      // Build WhatsApp intro message
      const depositLink = await createDepositLink({
        leadId: typedLead.id,
        customerName: typedLead.name,
        amountCents: Math.round(typedLead.quote_amount * 0.1 * 100), // 10% deposit
        jobType: typedLead.job_type,
      });

      const cur = typedLead.currency || 'USD';
      const sym = cur === 'RM' ? 'RM' : '$';

      const msg = [
        `Hi ${typedLead.name}! 👋`,
        ``,
        `This is a follow-up on your ${typedLead.job_type} quote for ${sym}${typedLead.quote_amount.toLocaleString()}.`,
        unanswered
          ? `We tried to reach you by phone but couldn't get through.`
          : `Our team wanted to make sure you have everything you need.`,
        ``,
        `If you're ready to lock in your spot, here's a secure link to place your deposit:`,
        depositLink,
        ``,
        `Have questions? Just reply here and we'll help! 🏡`,
      ].join('\n');

      await sendWhatsApp(typedLead.phone, msg);

      await supabase
        .from('quote_leads')
        .update({
          status: 'WhatsApp_Nurture',
          call_outcome: callOutcome,
          stripe_payment_link: depositLink,
          next_action_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', leadId);

      return NextResponse.json({ ok: true, action: 'transitioned_to_whatsapp' });
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
