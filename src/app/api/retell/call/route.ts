// src/app/api/retell/call/route.ts
// ─── Retell AI: Initiate outbound voice call for a lead ───

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import type { QuoteLead, RetellCreateCallPayload } from '@/lib/quote-followup/types';

export const dynamic = 'force-dynamic';

const RETELL_API_BASE = 'https://api.retellai.com';

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = (await req.json()) as { lead_id?: string };
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const retellApiKey = process.env.RETELL_API_KEY;
    const retellAgentId = process.env.RETELL_AGENT_ID;
    const retellFromNumber = process.env.RETELL_FROM_NUMBER; // E.164

    if (!retellApiKey || !retellAgentId || !retellFromNumber) {
      return NextResponse.json(
        { error: 'Missing RETELL_API_KEY, RETELL_AGENT_ID, or RETELL_FROM_NUMBER' },
        { status: 500 }
      );
    }

    const supabase = getSupabase();

    // ── Fetch lead ───────────────────────────────────────────────────────
    const { data: lead, error: fetchErr } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const typedLead = lead as QuoteLead;

    if (typedLead.status !== 'Open') {
      return NextResponse.json(
        { error: `Lead status is "${typedLead.status}", expected "Open"` },
        { status: 409 }
      );
    }

    // ── Build Retell payload ─────────────────────────────────────────────
    const payload: RetellCreateCallPayload = {
      from_number: retellFromNumber,
      to_number: typedLead.phone,
      agent_id: retellAgentId,
      retell_llm_dynamic_variables: {
        customer_name: typedLead.name,
        quote_amount: typedLead.quote_amount.toString(),
        job_type: typedLead.job_type,
        lead_id: typedLead.id,
      },
      metadata: {
        lead_id: typedLead.id,
        source: 'quote_followup',
      },
    };

    // ── Call Retell API ──────────────────────────────────────────────────
    const retellRes = await fetch(`${RETELL_API_BASE}/v2/create-phone-call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!retellRes.ok) {
      const errBody = await retellRes.text();
      console.error('[retell/call] Retell API error:', retellRes.status, errBody);
      return NextResponse.json(
        { error: 'Retell API error', status: retellRes.status, detail: errBody },
        { status: 502 }
      );
    }

    const retellData = (await retellRes.json()) as { call_id?: string };

    // ── Update lead status ───────────────────────────────────────────────
    // Set status → Called, record the Retell call ID, and schedule the
    // WhatsApp fallback window (e.g., 2 hours from now).
    const fallbackTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('quote_leads')
      .update({
        status: 'Called',
        retell_call_id: retellData.call_id ?? null,
        attempts: typedLead.attempts + 1,
        next_action_time: fallbackTime,
      })
      .eq('id', lead_id);

    return NextResponse.json({
      ok: true,
      call_id: retellData.call_id,
      next_action_time: fallbackTime,
    });
  } catch (err) {
    console.error('[retell/call] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
