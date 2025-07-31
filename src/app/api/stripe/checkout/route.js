import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { productId, businessId, amount, productName, productDescription } = await request.json();
    
    // Get business details for success URL
    const { data: business } = await supabase
      .from('businesses')
      .select('subdomain, name')
      .eq('id', businessId)
      .single();

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Stripe checkout session
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
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}&business_id=${businessId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${business.subdomain}`,
      metadata: {
        businessId,
        productId,
        productName,
        businessName: business.name,
        businessSubdomain: business.subdomain
      }
    });

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
