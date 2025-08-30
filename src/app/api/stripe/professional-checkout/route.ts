// src/app/api/stripe/professional-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email,
      name,
      template,
      businessName,
      subdomain,
      returnUrl
    } = body;

    console.log('Creating Professional plan checkout session:', { email, template });

    // Create the checkout session for Professional plan
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Launchfly Professional Plan',
              description: 'Lifetime access to Launchfly Professional - Build unlimited businesses, keep 90% of profits',
              images: ['https://launchfly.com/logo.png'], // Update with actual logo
            },
            unit_amount: 49700, // $497.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/onboarding/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=professional&template=${encodeURIComponent(template || '')}&businessName=${encodeURIComponent(businessName || '')}&subdomain=${encodeURIComponent(subdomain || '')}`,
      cancel_url: returnUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/onboarding?plan=professional`,
      customer_email: email,
      billing_address_collection: 'required',
      metadata: {
        plan: 'professional',
        user_email: email,
        user_name: name,
        template: template || '',
        business_name: businessName || '',
        subdomain: subdomain || '',
        product_type: 'platform_subscription'
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect tax ID if needed
      tax_id_collection: {
        enabled: true,
      },
    });

    console.log('Professional plan checkout session created:', session.id);

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Professional plan checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' }, 
      { status: 500 }
    );
  }
}
