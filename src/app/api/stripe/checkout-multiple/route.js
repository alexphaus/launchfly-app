// src/app/api/stripe/checkout-multiple/route.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
      items,
      businessId,
      subdomain,
      customerEmail,
      customerName,
      customerAddress
    } = body;

    console.log('Creating multi-item checkout session for:', { items: items.length, businessId });

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
    const feePercent = feeMap[business.plan] || 15;
    
    // Calculate total amount and application fee
    const totalAmount = items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
    const applicationFeeAmount = Math.round((totalAmount * feePercent / 100) * 100);

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.productName,
          description: item.productDescription || 'Product from ' + business.name,
        },
        unit_amount: Math.round(item.productPrice * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/sites/${subdomain}/checkout`,
      customer_email: customerEmail,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL']
      },
      
      // Connect account and application fee (only if account is verified and ready)
      ...(await isConnectAccountReady(business.stripe_connect_account_id) ? {
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
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
        customer_name: customerName || '',
        items_count: items.length.toString(),
        item_names: items.map(item => item.productName).join(', '),
      },
    });

    console.log('Multi-item checkout session created:', session.id);

    return Response.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Stripe multi-item checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
