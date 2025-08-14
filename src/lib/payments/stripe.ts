// src/lib/payments/stripe.ts
import Stripe from 'stripe';

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });
}

export async function createCheckout({ priceId, successUrl, cancelUrl, metadata }:
  { priceId: string; successUrl: string; cancelUrl: string; metadata: Record<string, string> }) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata
  });
  return session;
}


