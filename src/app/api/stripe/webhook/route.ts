// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/payments/stripe';
import { emit, Event } from '@/lib/events';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const eventId = event.id;
  const { data: existing } = await supabase
    .from('idempotency')
    .select('id')
    .eq('key', eventId)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, duplicate: true });
  await supabase.from('idempotency').insert({ key: eventId, created_at: new Date().toISOString() });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session: any = event.data.object;
      const businessId = session.metadata?.business_id;
      if (!businessId) break;
      const amount = (session.amount_total || 0) / 100;
      await supabase.from('sales').insert({
        business_id: businessId,
        stripe_session_id: session.id,
        amount,
        currency: session.currency || 'usd',
        customer_email: session.customer_details?.email || null,
        customer_name: session.customer_details?.name || null
      });

      const { data: biz } = await supabase
        .from('businesses')
        .select('total_revenue, first_sale_date')
        .eq('id', businessId)
        .single();
      const newTotal = (biz?.total_revenue || 0) + amount;
      const updates: any = { total_revenue: newTotal, last_sale_date: new Date().toISOString() };
      if (!biz?.first_sale_date) updates.first_sale_date = new Date().toISOString();
      await supabase.from('businesses').update(updates).eq('id', businessId);

      await emit(Event.PaymentSucceeded, { businessId, amount, stripeId: session.id });
      if (newTotal >= 1000) await emit(Event.MilestoneHit, { businessId, milestone: '1k_revenue', total: newTotal });
      break;
    }
  }

  return NextResponse.json({ received: true });
}


