import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { productId, businessId, productName, price, businessSubdomain } = await request.json();
    
    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    if (businessError || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get business owner's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', business.user_id)
      .single();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: `Purchase from ${business.name}`,
              metadata: {
                businessId: businessId,
                productId: productId,
                businessSubdomain: businessSubdomain
              }
            },
            unit_amount: Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/sites/${businessSubdomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/sites/${businessSubdomain}`,
      metadata: {
        businessId: businessId,
        productId: productId,
        businessSubdomain: businessSubdomain,
        businessOwnerEmail: profile?.email,
        businessOwnerName: profile?.full_name,
        businessUserId: business.user_id
      },
      // Collect customer email for receipts
      customer_email: null,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'ES', 'FR', 'DE', 'IT', 'NL']
      }
    });

    return Response.json({ 
      checkoutUrl: session.url,
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('Checkout session error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
