// src/app/api/businesses/outreach-pause/route.ts
// Toggle outreach_paused flag for a business.
// GET  → returns current state
// POST → toggles or sets { paused: true/false }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('businesses')
    .select('outreach_paused')
    .eq('id', businessId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paused: data?.outreach_paused ?? false });
}

export async function POST(req: NextRequest) {
  const { businessId, paused } = await req.json();
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

  const supabase = getSupabase();

  if (typeof paused === 'boolean') {
    // Explicit set
    const { error } = await supabase
      .from('businesses')
      .update({ outreach_paused: paused })
      .eq('id', businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, paused });
  }

  // Toggle: read current, flip it
  const { data } = await supabase
    .from('businesses')
    .select('outreach_paused')
    .eq('id', businessId)
    .single();

  const newState = !(data?.outreach_paused ?? false);
  const { error } = await supabase
    .from('businesses')
    .update({ outreach_paused: newState })
    .eq('id', businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paused: newState });
}
