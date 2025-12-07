// src/app/api/metrics/[businessId].json/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(_req: NextRequest, props: any) {
  const params = await props.params;
  const { businessId } = params;
  if (!businessId) return NextResponse.json({ error: 'Invalid businessId' }, { status: 400 });

  const { data: biz } = await supabase
    .from('businesses')
    .select('total_revenue, last_sale_date')
    .eq('id', businessId)
    .single();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sends24h } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', since);

  const { count: bounces } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('bounce', true)
    .gte('created_at', since);

  const { data: lastActivity } = await supabase
    .from('ai_activities')
    .select('created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const bounceRate = sends24h && sends24h > 0 ? (bounces || 0) / sends24h : 0;

  return NextResponse.json({
    revenue: biz?.total_revenue || 0,
    customers: null,
    lastActivity: lastActivity?.created_at || null,
    sends24h: sends24h || 0,
    bounceRate,
    nextAction: 'validate_offer'
  });
}


