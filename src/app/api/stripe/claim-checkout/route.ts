// src/app/api/stripe/claim-checkout/route.ts
// Creates a Stripe checkout session for claiming a prospect funnel
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, email, plan = 'pro' } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    // Launch Pack pricing (test: $1)
    const priceConfig = {
      amount: 9700, // $1.00 for testing
      name: 'Launchfly Launch Pack',
      description: 'Full Lead Capture Funnel + 1 Year Hosting + Email Delivery'
    };

    console.log(`Creating claim checkout for business: ${businessId}`, { email });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.launchfly.ai';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: priceConfig.name,
              description: priceConfig.description,
            },
            unit_amount: priceConfig.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/claim/${businessId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/claim/${businessId}`,
      customer_email: email || undefined,
      metadata: {
        businessId: businessId,
        plan: plan,
        source: 'claim-prospect',
        product_type: 'funnel_claim'
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Claim checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' }, 
      { status: 500 }
    );
  }
}
