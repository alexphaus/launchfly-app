// src/lib/quote-followup/stripe-link.ts
// ─── Generate a Stripe Payment Link for the deposit ───

import Stripe from 'stripe';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(key);
}

/**
 * Create a one-time Stripe Payment Link for a deposit.
 * Returns the URL the customer can click.
 */
export async function createDepositLink(opts: {
  leadId: string;
  customerName: string;
  amountCents: number; // deposit amount in cents
  jobType: string;
  currency?: string;   // ISO currency code, default 'usd'
}): Promise<string> {
  const stripe = getStripeClient();

  // Map display currencies to Stripe ISO codes
  const currencyMap: Record<string, string> = { RM: 'myr', USD: 'usd', SGD: 'sgd', AUD: 'aud', GBP: 'gbp', PHP: 'php' };
  const stripeCurrency = currencyMap[(opts.currency || 'USD').toUpperCase()] || 'usd';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: stripeCurrency,
          unit_amount: opts.amountCents,
          product_data: {
            name: `Deposit — ${opts.jobType}`,
            description: `Deposit for ${opts.customerName}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      lead_id: opts.leadId,
      source: 'quote_followup',
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai'}/deposit/success?lead=${opts.leadId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai'}/deposit/cancel?lead=${opts.leadId}`,
  });

  return session.url ?? '';
}
