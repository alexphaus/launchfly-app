// app/api/stripe/checkout/route.js
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
    const { productId, businessId, productName, price, businessSubdomain } = await request.json();
    
    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    // Handle mock businesses (for development/testing)
    let businessData = business;
    let isTestBusiness = false;
    
    if (businessError || !business) {
      // Check if this is a mock business
      if (businessId && businessId.startsWith('mock-')) {
        console.log('Using mock business data for checkout');
        businessData = {
          id: businessId,
          name: businessSubdomain || 'Test Business',
          subdomain: businessSubdomain,
          user_id: 'mock-user-id'
        };
        isTestBusiness = true;
      } else {
        return new Response(JSON.stringify({ error: 'Business not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Get business owner's profile
    let profile = null;
    if (!isTestBusiness) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', businessData.user_id)
        .single();
      profile = profileData;
    } else {
      // Mock profile for test businesses
      profile = {
        email: 'test@example.com',
        full_name: 'Test Business Owner'
      };
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
              description: `Purchase from ${businessData.name}`,
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
        businessUserId: businessData.user_id
      },
      // Remove customer_email field since we don't have a customer email
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