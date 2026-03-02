// src/app/api/quotes/process/route.ts
// ─── Cron / QStash handler: processes leads whose next_action_time has passed ───
// Wire this up as a Vercel Cron (every 15 min) OR as a QStash callback target.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import type { QuoteLead } from '@/lib/quote-followup/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow up to 60 s on Vercel Pro

// ── POST: Called by QStash with { lead_id } ─────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lead_id?: string };
    if (!body.lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: lead, error } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('id', body.lead_id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const result = await processLead(lead as QuoteLead);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[quotes/process] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET: Called by Vercel Cron — sweeps all overdue leads ───────────────
export async function GET(req: NextRequest) {
  // Optional: verify Vercel cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data: leads, error } = await supabase
      .from('quote_leads')
      .select('*')
      .in('status', ['Open', 'Called'])
      .lte('next_action_time', now)
      .order('next_action_time', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[quotes/process] DB error:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const results: Array<{ id: string; action: string }> = [];
    for (const lead of (leads ?? []) as QuoteLead[]) {
      const result = await processLead(lead);
      results.push({ id: lead.id, ...result });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error('[quotes/process] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Core routing logic ──────────────────────────────────────────────────
async function processLead(lead: QuoteLead): Promise<{ action: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

  if (lead.status === 'Open') {
    // Trigger voice call via internal Retell route
    try {
      const res = await fetch(`${appUrl}/api/retell/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      if (!res.ok) throw new Error(`Retell call route returned ${res.status}`);
      return { action: 'retell_call_initiated' };
    } catch (err) {
      console.error('[process] Failed to initiate Retell call for', lead.id, err);
      return { action: 'retell_call_failed' };
    }
  }

  if (lead.status === 'Called') {
    // Call was attempted but no booking — transition to WhatsApp
    try {
      const res = await fetch(`${appUrl}/api/retell/fallback-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      if (!res.ok) throw new Error(`Fallback route returned ${res.status}`);
      return { action: 'whatsapp_fallback_sent' };
    } catch (err) {
      console.error('[process] Fallback WhatsApp failed for', lead.id, err);
      return { action: 'whatsapp_fallback_failed' };
    }
  }

  return { action: 'no_action' };
}
