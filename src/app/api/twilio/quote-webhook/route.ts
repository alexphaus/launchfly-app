// src/app/api/twilio/quote-webhook/route.ts
// ─── Twilio WhatsApp Webhook: Handles incoming replies for quote negotiation ───
// Configure this URL in Twilio Console → WhatsApp Sandbox / Number → Webhook URL.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { sendWhatsApp } from '@/lib/quote-followup/whatsapp';
import { negotiate } from '@/lib/quote-followup/openai';
import { createDepositLink } from '@/lib/quote-followup/stripe-link';
import type { QuoteLead, ChatMessage, TwilioWhatsAppInbound } from '@/lib/quote-followup/types';

export const dynamic = 'force-dynamic';

// Twilio sends form-urlencoded bodies
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const inbound: TwilioWhatsAppInbound = {
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string,
      MessageSid: formData.get('MessageSid') as string,
      ProfileName: (formData.get('ProfileName') as string) ?? undefined,
    };

    if (!inbound.From || !inbound.Body) {
      return twimlResponse(''); // empty TwiML — Twilio expects XML
    }

    // Strip "whatsapp:" prefix to get the plain phone number
    const phone = inbound.From.replace('whatsapp:', '');

    const supabase = getSupabase();

    // ── Find the lead by phone ───────────────────────────────────────────
    const { data: lead } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('phone', phone)
      .in('status', ['WhatsApp_Nurture', 'Called'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lead) {
      // No active lead for this phone — ignore or send generic reply
      return twimlResponse(
        "Hi! We don't have an active quote on file for this number. " +
          'Please reach out to your contractor directly.'
      );
    }

    const typedLead = lead as QuoteLead;

    // If lead was in Called status but replying via WhatsApp, promote to nurture
    if (typedLead.status === 'Called') {
      await supabase
        .from('quote_leads')
        .update({ status: 'WhatsApp_Nurture' })
        .eq('id', typedLead.id);
    }

    // ── Load chat history ────────────────────────────────────────────────
    const { data: historyRows } = await supabase
      .from('quote_chat_history')
      .select('*')
      .eq('lead_id', typedLead.id)
      .order('created_at', { ascending: true })
      .limit(30);

    const history = (historyRows ?? []) as ChatMessage[];

    // ── Save the user's message ──────────────────────────────────────────
    await supabase.from('quote_chat_history').insert({
      lead_id: typedLead.id,
      role: 'user',
      content: inbound.Body,
    });

    // ── Load business context for dynamic prompt ─────────────────────────
    let contractorName: string | undefined;
    let businessName: string | undefined;
    let niche: string | undefined;
    let ownerPhone: string | undefined;
    const leadCurrency = typedLead.currency || 'USD';

    if (typedLead.business_id) {
      const supabaseForBiz = getSupabase();
      const { data: biz } = await supabaseForBiz
        .from('businesses')
        .select('name, whatsapp_number, phone_number, business_data')
        .eq('id', typedLead.business_id)
        .single();
      if (biz) {
        businessName = biz.name;
        ownerPhone = biz.whatsapp_number || biz.phone_number;
        const cfg = (biz.business_data || {}) as Record<string, unknown>;
        contractorName = cfg.ownerName as string | undefined;
        niche = cfg.niche as string | undefined;
      }
    }

    // ── Run OpenAI negotiation ───────────────────────────────────────────
    const result = await negotiate({
      customerName: typedLead.name,
      quoteAmount: typedLead.quote_amount,
      jobType: typedLead.job_type,
      history,
      latestMessage: inbound.Body,
      contractorName,
      businessName,
      niche,
      currency: leadCurrency,
    });

    let replyText = result.reply;

    // ── Handle intents ───────────────────────────────────────────────────
    if (result.intent === 'deposit') {
      // Generate a fresh payment link if we don't already have one
      const depositLink =
        typedLead.stripe_payment_link ||
        (await createDepositLink({
          leadId: typedLead.id,
          customerName: typedLead.name,
          amountCents: Math.round(typedLead.quote_amount * 0.1 * 100),
          jobType: typedLead.job_type,
        }));

      replyText += `\n\nHere's your secure deposit link:\n${depositLink}`;

      await supabase
        .from('quote_leads')
        .update({
          status: 'Booked',
          stripe_payment_link: depositLink,
        })
        .eq('id', typedLead.id);
    } else if (result.intent === 'escalate') {
      // Notify contractor via WhatsApp
      if (ownerPhone) {
        try {
          const sym = leadCurrency === 'RM' ? 'RM' : '$';
          await sendWhatsApp(
            ownerPhone,
            `🚨 Quote Escalation!\n\n${typedLead.name} (${typedLead.phone}) wants to talk about their ${typedLead.job_type} quote (${sym}${typedLead.quote_amount.toLocaleString()}).\n\nPlease call them back ASAP.`
          );
        } catch (notifyErr) {
          console.warn('[quote-webhook] Contractor notification failed:', notifyErr);
        }
      }
      replyText += "\n\nI've flagged this — someone from the team will call you shortly.";
    } else if (result.intent === 'lost') {
      await supabase
        .from('quote_leads')
        .update({ status: 'Lost' })
        .eq('id', typedLead.id);
    }

    // ── Save assistant reply ─────────────────────────────────────────────
    await supabase.from('quote_chat_history').insert({
      lead_id: typedLead.id,
      role: 'assistant',
      content: replyText,
    });

    // ── Send WhatsApp reply ──────────────────────────────────────────────
    // We send via the API (not TwiML) so we have full control + delivery tracking.
    await sendWhatsApp(phone, replyText);

    // Return empty TwiML so Twilio doesn't send a duplicate message
    return twimlResponse('');
  } catch (err) {
    console.error('[twilio/quote-webhook] Error:', err);
    // Return 200 with empty TwiML to prevent Twilio retries on our error
    return twimlResponse('');
  }
}

// ── Utility: Twilio expects a TwiML XML response ────────────────────────
function twimlResponse(message: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
