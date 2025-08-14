// src/app/api/health.json/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(_req: NextRequest) {
  const { count: stripeEvents } = await supabase
    .from('idempotency')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data: inbound } = await supabase
    .from('email_replies')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    queues: {},
    lastStripe: stripeEvents || 0,
    lastInbound: inbound?.created_at || null
  });
}


