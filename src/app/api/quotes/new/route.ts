// src/app/api/quotes/new/route.ts
// ─── Inbound Webhook: Receives a new quote and starts the 14-Day Revenue Recovery Sequence ───

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import type { NewQuotePayload, QuoteLead } from '@/lib/quote-followup/types';
import {
  SEQUENCE_STEPS,
  calculateNextActionTime,
  processSequenceStep,
  buildMessageContext,
  loadBusinessContext,
} from '@/lib/quote-followup/sequence';
import { sendWhatsApp } from '@/lib/quote-followup/whatsapp';

export const dynamic = 'force-dynamic';

// ── Validation ──────────────────────────────────────────────────────────
function validatePayload(body: unknown): body is NewQuotePayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === 'string' &&
    typeof b.phone === 'string' &&
    typeof b.quote_amount === 'number' &&
    typeof b.job_type === 'string'
  );
}

// ── POST handler ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (!validatePayload(body)) {
      return NextResponse.json(
        { error: 'Invalid payload. Required: name, phone, quote_amount, job_type' },
        { status: 400 }
      );
    }

    const { name, phone, quote_amount, job_type, contractor_id, business_id, email, currency } = body;
    const timezone = (body as unknown as Record<string, unknown>).timezone as string | undefined;

    // Normalise phone to E.164 (strip spaces/dashes)
    const normalisedPhone = phone.replace(/[\s\-()]/g, '');

    const supabase = getSupabase();

    // ── Duplicate guard ──────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('quote_leads')
      .select('id, status')
      .eq('phone', normalisedPhone)
      .eq('job_type', job_type)
      .not('status', 'in', '("Booked","Lost","Archived")')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { ok: true, duplicate: true, lead_id: existing.id, status: existing.status },
        { status: 200 }
      );
    }

    // ── Insert lead ──────────────────────────────────────────────────────
    // Step 0 fires within 60s, so next_action_time is set to Step 1's schedule
    const tz = timezone || 'America/New_York';
    const step1 = SEQUENCE_STEPS[1];
    const step1Time = calculateNextActionTime(step1, new Date(), tz);

    const { data: lead, error: insertError } = await supabase
      .from('quote_leads')
      .insert({
        name,
        phone: normalisedPhone,
        email: email ?? null,
        quote_amount,
        job_type,
        contractor_id: contractor_id ?? null,
        business_id: business_id ?? null,
        currency: currency ?? 'USD',
        timezone: tz,
        status: 'Open',
        sequence_step: 1,         // We fire step 0 right now; next pending step is 1
        sequence_paused: false,
        sequence_completed: false,
        next_action_time: step1Time.toISOString(),
        attempts: 1,              // Step 0 counts as attempt 1
        source: 'webhook',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[quotes/new] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save lead', detail: insertError.message }, { status: 500 });
    }

    const typedLead = lead as QuoteLead;

    // ── Fire Day 0 message IMMEDIATELY (within 60s of BCC) ───────────────
    // This is the micro-commitment: "Did it come through?"
    try {
      const biz = await loadBusinessContext(business_id ?? null);
      const msgCtx = buildMessageContext(typedLead, biz);
      const day0Msg = SEQUENCE_STEPS[0].buildMessage(msgCtx);
      await sendWhatsApp(normalisedPhone, day0Msg);

      // Save to chat history
      await supabase.from('quote_chat_history').insert({
        lead_id: typedLead.id,
        role: 'assistant',
        content: day0Msg,
      });

      console.log(`[quotes/new] Day 0 message sent to ${normalisedPhone}`);
    } catch (day0Err) {
      // Non-fatal — the cron will pick up Step 1 regardless
      console.warn('[quotes/new] Day 0 message failed (non-fatal):', day0Err);
    }

    // ── Schedule Step 1 via QStash (belt-and-suspenders) ─────────────────
    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

    if (qstashToken) {
      try {
        // Calculate delay until Step 1
        const delayMs = step1Time.getTime() - Date.now();
        const delaySeconds = Math.max(60, Math.round(delayMs / 1000));

        await fetch('https://qstash.upstash.io/v2/publish/' + encodeURIComponent(`${appUrl}/api/quotes/process`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': `${delaySeconds}s`,
            'Upstash-Retries': '3',
          },
          body: JSON.stringify({ lead_id: typedLead.id }),
        });
      } catch (qErr) {
        console.warn('[quotes/new] QStash schedule failed (non-fatal):', qErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        lead_id: typedLead.id,
        sequence: {
          day0_sent: true,
          next_step: 1,
          next_action_time: step1Time.toISOString(),
        },
        queue: qstashToken ? 'qstash' : 'cron',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[quotes/new] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
