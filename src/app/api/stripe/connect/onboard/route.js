// src/app/api/stripe/connect/onboard/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY is not configured');
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const { businessId, email, refreshUrl, returnUrl } = await request.json();

    if (!businessId || !email) {
      return Response.json({ error: 'Business ID and email are required' }, { status: 400 });
    }

    console.log('🏦 Starting Stripe Connect Express onboarding for business:', businessId);
    console.log('📧 Email:', email);

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    let connectAccountId = business.stripe_connect_account_id;

    // Create Connect account if it doesn't exist
    if (!connectAccountId) {
      console.log('📝 Creating new Stripe Connect Express account');
      
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email: email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual', // Most users are individuals
          metadata: {
            business_id: businessId,
            business_name: business.name || 'Launchfly Business',
            launchfly_user: 'true'
          }
        });

        connectAccountId = account.id;
        console.log('✅ Created Connect account:', connectAccountId);
      } catch (accountError) {
        console.error('❌ Failed to create Connect account:', accountError);
        return Response.json({ 
          error: 'Failed to create Connect account', 
          details: accountError.message 
        }, { status: 500 });
      }

      // Save the Connect account ID
      await supabase
        .from('businesses')
        .update({ stripe_connect_account_id: connectAccountId })
        .eq('id', businessId);

      console.log('✅ Created Connect account:', connectAccountId);
    }

    // Create Account Link for onboarding
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://app.launchfly.ai' 
      : 'http://localhost:3000';

    console.log('🔗 Creating account link for:', connectAccountId);
    console.log('🔄 Refresh URL:', refreshUrl || `${baseUrl}/dashboard/${business.session_id}/settings?connect=refresh`);
    console.log('↩️ Return URL:', returnUrl || `${baseUrl}/dashboard/${business.session_id}/settings?connect=success`);

    try {
      const accountLink = await stripe.accountLinks.create({
        account: connectAccountId,
        refresh_url: refreshUrl || `${baseUrl}/dashboard/${business.session_id}/settings?connect=refresh`,
        return_url: returnUrl || `${baseUrl}/dashboard/${business.session_id}/settings?connect=success`,
        type: 'account_onboarding',
      });

      console.log('✅ Account link created successfully');
      return Response.json({
        success: true,
        onboarding_url: accountLink.url,
        connect_account_id: connectAccountId,
        message: 'Connect onboarding link created successfully'
      });

    } catch (linkError) {
      console.error('❌ Failed to create account link:', linkError);
      return Response.json({ 
        error: 'Failed to create onboarding link', 
        details: linkError.message,
        connect_account_id: connectAccountId
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Connect onboarding error:', error);
    return Response.json({ 
      error: 'Failed to create onboarding link', 
      details: error.message 
    }, { status: 500 });
  }
}