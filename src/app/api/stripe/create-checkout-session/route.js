import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const {
      businessId,
      productId,
      productName,
      productPrice,
      productDescription,
      businessName,
      subdomain,
      returnUrl
    } = await request.json();

    // Validate required fields
    if (!businessId || !productName || !productPrice) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse price (remove currency symbols and convert to cents)
    const priceMatch = productPrice.match(/[\d,]+\.?\d*/);
    if (!priceMatch) {
      return Response.json({ error: 'Invalid price format' }, { status: 400 });
    }
    
    const priceInCents = Math.round(parseFloat(priceMatch[0].replace(/,/g, '')) * 100);

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
              metadata: {
                business_id: businessId,
                product_id: productId,
                business_name: businessName,
                subdomain: subdomain
              }
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      automatic_tax: { enabled: false },
      metadata: {
        business_id: businessId,
        product_id: productId,
        business_name: businessName,
        subdomain: subdomain
      }
    });

    return Response.json({ url: session.url });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
