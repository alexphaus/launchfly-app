import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const { productId, businessId, subdomain } = await request.json();

  if (!productId || !businessId || !subdomain) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Fetch business and product data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, user_id, business_data')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      throw new Error('Business not found');
    }

    const products = business.business_data?.products || [];
    const product = products.find(p => p.id === productId);

    if (!product) {
      throw new Error('Product not found');
    }

    // 2. Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: parseFloat(product.price.replace('$', '')) * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/sites/${subdomain}/product/${productId}`,
      metadata: {
        businessId: business.id,
        productId: product.id,
        productName: product.name,
        userId: business.user_id,
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
