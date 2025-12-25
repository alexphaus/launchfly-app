import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICES = {
  'asset': {
    amount: 1900, // $19.00
    name: 'Launchfly Asset Download',
    description: 'PDF Guide + Commercial License'
  },
  'pro': { // Launch Pack
    amount: 9700, // $97.00
    name: 'Launchfly Launch Pack',
    description: 'Full Funnel + 1 Year Hosting + Email Sequence'
  },
  'vip': { // White Glove
    amount: 29700, // $297.00
    name: 'Launchfly White-Glove Service',
    description: 'Done-For-You Setup + Priority Support + Monthly Coaching'
  },
  'agency': { // Agency License
    amount: 99700, // $997.00
    name: 'Launchfly Agency License',
    description: '10 Client Licenses + White-Label + Sales Kit'
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, email, returnUrl } = body;

    const priceConfig = PRICES[plan as keyof typeof PRICES];

    if (!priceConfig) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    console.log(`Creating checkout session for ${plan}:`, { email });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: priceConfig.name,
              description: priceConfig.description,
              images: ['https://launchfly.com/logo.png'], 
            },
            unit_amount: priceConfig.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/onboarding/quick-start?session_id={CHECKOUT_SESSION_ID}&payment=success&plan=${plan}`,
      cancel_url: returnUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/`,
      customer_email: email, // Optional: pre-fill if we have it
      metadata: {
        plan: plan,
        product_type: 'one_time_purchase'
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' }, 
      { status: 500 }
    );
  }
}
