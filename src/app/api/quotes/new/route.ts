// src/app/api/quotes/new/route.ts
// ─── Inbound Webhook: Receives a new quote and schedules 48h follow-up ───

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import type { NewQuotePayload, QuoteLead } from '@/lib/quote-followup/types';

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

    // Normalise phone to E.164 (strip spaces/dashes)
    const normalisedPhone = phone.replace(/[\s\-()]/g, '');

    const supabase = getSupabase();

    // ── Duplicate guard ──────────────────────────────────────────────────
    // The DB unique index (phone, job_type) WHERE status NOT IN ('Booked','Lost')
    // will reject true duplicates. We also check here to return a friendly message.
    const { data: existing } = await supabase
      .from('quote_leads')
      .select('id, status')
      .eq('phone', normalisedPhone)
      .eq('job_type', job_type)
      .not('status', 'in', '("Booked","Lost")')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { ok: true, duplicate: true, lead_id: existing.id, status: existing.status },
        { status: 200 }
      );
    }

    // ── Insert lead ──────────────────────────────────────────────────────
    const nextActionTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

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
        status: 'Open',
        next_action_time: nextActionTime,
        attempts: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[quotes/new] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save lead', detail: insertError.message }, { status: 500 });
    }

    // ── Schedule 48-hour follow-up via QStash (optional) ─────────────────
    // If QSTASH_TOKEN is configured, publish a delayed message so we don't
    // rely solely on the cron sweep.  This gives us belt-and-suspenders.
    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

    if (qstashToken) {
      try {
        await fetch('https://qstash.upstash.io/v2/publish/' + encodeURIComponent(`${appUrl}/api/quotes/process`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '48h',
            'Upstash-Retries': '3',
          },
          body: JSON.stringify({ lead_id: (lead as QuoteLead).id }),
        });
      } catch (qErr) {
        // Non-fatal — the cron sweep will catch it
        console.warn('[quotes/new] QStash schedule failed (non-fatal):', qErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        lead_id: (lead as QuoteLead).id,
        next_action_time: nextActionTime,
        queue: qstashToken ? 'qstash' : 'cron',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[quotes/new] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
