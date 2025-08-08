// src/app/api/stripe/connect/route.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/stripe/connect
// Payload: { businessId, email }
export async function POST(request) {
  if (!stripe) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  try {
    const { businessId, email } = await request.json();
    if (!businessId || !email) {
      return Response.json({ error: 'Missing businessId or email' }, { status: 400 });
    }

    // Get or create Connect account
    const { data: biz } = await supabase.from('businesses').select('id, stripe_connect_account_id').eq('id', businessId).single();
    let accountId = biz?.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email,
        business_type: 'individual'
      });
      accountId = account.id;
      await supabase.from('businesses').update({ stripe_connect_account_id: accountId }).eq('id', businessId);
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${businessId}?connect=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${businessId}?connect=return`,
      type: 'account_onboarding',
    });

    return Response.json({ url: accountLink.url, accountId });
  } catch (error) {
    console.error('Connect onboarding error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
