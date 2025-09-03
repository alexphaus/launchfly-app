// src/app/api/stripe/connect/onboard/route.js
// GET: Returns Stripe Connect onboarding link for a business

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripeConnectManager } from '@/lib/revenue-share/stripe-connect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (error || !business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const manager = getStripeConnectManager();
    let connectAccountId = business.stripe_connect_account_id;
    if (!connectAccountId) {
      const account = await manager.createConnectAccount(business, business?.form_data?.email || undefined);
      connectAccountId = account.id;
    }

    const url = await manager.createOnboardingLink(connectAccountId, businessId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Connect onboarding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


