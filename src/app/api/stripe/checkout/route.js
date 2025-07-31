import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
      success_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${subdomain}`,
      customer_email: customerEmail,
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
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
