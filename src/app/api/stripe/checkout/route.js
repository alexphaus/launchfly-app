// src/app/api/stripe/checkout/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper function to check if Connect account is ready for transfers
async function isConnectAccountReady(connectAccountId) {
  if (!connectAccountId) return false;
  
  try {
    const account = await stripe.accounts.retrieve(connectAccountId);
    return account.charges_enabled && account.payouts_enabled && account.details_submitted;
  } catch (error) {
    console.error('Error checking Connect account:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      productId, 
      productName, 
      productPrice, 
      productDescription,
      businessId,
      subdomain,
      customerEmail,
      customerName 
    } = body;

    console.log('Creating checkout session for:', { productName, productPrice, businessId });

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return new Response(
        JSON.stringify({ error: 'Business not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine application fee percent by plan
    const feeMap = { starter: 20, pro: 10, scale: 5 };
    const plan = (business.plan_tier || 'starter').toLowerCase();
    const feePercent = feeMap[plan] ?? 20;
    
    console.log('Business plan:', plan, 'Fee percent:', feePercent);
    console.log('Connect account ID:', business.stripe_connect_account_id);

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.round(productPrice * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/sites/${subdomain}`,
      customer_email: customerEmail,
      // Only add Connect features if account is verified and ready
      ...(await isConnectAccountReady(business.stripe_connect_account_id) ? {
        payment_intent_data: {
          application_fee_amount: Math.round((productPrice * feePercent / 100) * 100),
          transfer_data: {
            destination: business.stripe_connect_account_id,
          },
        },
        // Note: on_behalf_of is removed as it's not needed for Express accounts
      } : {}),
      metadata: {
        business_id: businessId,
        business_name: business.name,
        business_owner_email: business.form_data?.email || '',
        subdomain: subdomain,
        product_id: productId,
        product_name: productName,
        customer_name: customerName || '',
      },
    });

    console.log('Checkout session created:', session.id);

    return Response.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error.message,
        type: error.type 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
