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
    
    console.log('🏪 Checkout API called with:', {
      productId,
      businessId,
      productName,
      price,
      businessSubdomain
    });
    
    // Check if this is a mock business (starts with 'mock-')
    if (businessId && businessId.startsWith('mock-')) {
      console.log('🎭 Mock business detected, creating demo checkout session');
      
      // For mock businesses, create a demo checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName,
                description: `Demo purchase from ${businessSubdomain}`,
                metadata: {
                  businessId: businessId,
                  productId: productId,
                  businessSubdomain: businessSubdomain,
                  isDemoMode: 'true'
                }
              },
              unit_amount: Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_URL}/sites/${businessSubdomain}/success?session_id={CHECKOUT_SESSION_ID}&demo=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}/sites/${businessSubdomain}`,
        metadata: {
          businessId: businessId,
          productId: productId,
          businessSubdomain: businessSubdomain,
          isDemoMode: 'true',
          businessOwnerEmail: 'demo@launchfly.ai',
          businessOwnerName: 'Demo User'
        },
        billing_address_collection: 'required'
      });

      console.log('✅ Demo checkout session created:', session.id);
      return Response.json({ 
        checkoutUrl: session.url,
        sessionId: session.id,
        isDemoMode: true
      });
    }
    
    // Get business details from database for real businesses
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    console.log('🔍 Business query result:', { business, businessError });
      
    if (businessError || !business) {
      console.log('❌ Business not found in database for ID:', businessId);
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
      // Remove problematic customer_email field
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
