import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { productId, businessId, customerEmail, customerName, subdomain } = await request.json();
    
    // Get business data to fetch product details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Find the specific product from business data
    const businessData = business.business_data;
    const product = businessData?.products?.find(p => p.id === productId);
    
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Convert price to cents (Stripe expects amount in cents)
    const unitAmount = Math.round(parseFloat(product.price.replace(/[^0-9.-]+/g, '')) * 100);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description,
              images: product.image ? [product.image] : [],
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&business=${subdomain}`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`,
      customer_email: customerEmail,
      metadata: {
        businessId: businessId,
        productId: productId,
        customerName: customerName || '',
        subdomain: subdomain
      },
    });
    
    return Response.json({ 
      sessionId: session.id,
      url: session.url 
    });
    
  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' }, 
      { status: 500 }
    );
  }
}
