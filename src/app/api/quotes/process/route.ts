// src/app/api/quotes/process/route.ts
// ─── Cron / QStash handler: executes sequence steps for leads whose next_action_time has passed ───
// Wire as Vercel Cron (every 15 min) AND/OR QStash callback target.
//
// The 14-Day Revenue Recovery Sequence:
//   Step 0 (Day 0)  → fired inline by quotes/new (within 60s)
//   Steps 1-6       → fired by this cron/QStash handler

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import type { QuoteLead } from '@/lib/quote-followup/types';
import { processSequenceStep } from '@/lib/quote-followup/sequence';

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

    const result = await processSequenceStep(lead as QuoteLead);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[quotes/process] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET: Called by Vercel Cron — sweeps all leads with overdue next_action_time ──
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

    // Fetch leads that:
    // 1. Have a next_action_time in the past
    // 2. Are NOT paused (OR their paused_until has expired)
    // 3. Have NOT completed the sequence
    // 4. Are not in a terminal status
    const { data: leads, error } = await supabase
      .from('quote_leads')
      .select('*')
      .lte('next_action_time', now)
      .eq('sequence_completed', false)
      .eq('sequence_paused', false)
      .not('status', 'in', '("Booked","Lost","Archived")')
      .order('next_action_time', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[quotes/process] DB error:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    // Also check for snoozed leads whose paused_until has expired
    const { data: snoozedLeads } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('sequence_paused', true)
      .lte('paused_until', now)
      .not('status', 'in', '("Booked","Lost","Archived")')
      .limit(10);

    const allLeads = [...(leads ?? []), ...(snoozedLeads ?? [])] as QuoteLead[];

    const results: Array<{ id: string; action: string; step?: number }> = [];
    for (const lead of allLeads) {
      try {
        const result = await processSequenceStep(lead);
        results.push({ id: lead.id, ...result });
      } catch (stepErr) {
        console.error(`[quotes/process] Error processing lead ${lead.id}:`, stepErr);
        results.push({ id: lead.id, action: 'error' });
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error('[quotes/process] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
