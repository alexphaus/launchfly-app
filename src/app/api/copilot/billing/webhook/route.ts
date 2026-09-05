// src/app/api/copilot/billing/webhook/route.ts
// Stripe's view of the truth about who is paying. Its own endpoint and its own
// signing secret, separate from /api/webhook/stripe which serves the wider
// Launchfly product.
//
// Two rules this handler obeys:
//   1. Nothing is trusted without a valid signature over the RAW body.
//   2. Every event is claimed by id first, so Stripe's retries are no-ops.

import { getStripe } from '@/lib/payments/stripe';
import {
  applySubscription, claimEvent, profileIdForSubscription, type SubscriptionShape,
} from '@/lib/copilot/billing';
import { copilotDb } from '@/lib/copilot/db';
import { logEvent } from '@/lib/copilot/store';

export const runtime = 'nodejs';
// Stripe needs the unparsed body to verify the signature.
export const dynamic = 'force-dynamic';

const RELEVANT = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]);

export async function POST(req: Request) {
  const secret = process.env.COPILOT_STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[copilot/billing] COPILOT_STRIPE_WEBHOOK_SECRET missing');
    return new Response('Billing webhook not configured', { status: 503 });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    // A bad signature is either a misconfigured secret or someone guessing.
    console.error('[copilot/billing] signature verification failed', e instanceof Error ? e.message : e);
    return new Response('Invalid signature', { status: 400 });
  }

  if (!RELEVANT.has(event.type)) return Response.json({ received: true, ignored: event.type });

  try {
    const sub = await resolveSubscription(event);
    const profileId = sub ? await profileIdForSubscription(sub) : null;

    // Claim before acting. A replay stops here.
    const fresh = await claimEvent(event.id, event.type, profileId, { type: event.type, subscription: sub?.id ?? null });
    if (!fresh) return Response.json({ received: true, duplicate: true });

    if (!sub || !profileId) {
      console.warn(`[copilot/billing] ${event.type} had no resolvable profile`);
      return Response.json({ received: true, unmatched: true });
    }

    if (event.type === 'invoice.payment_failed') {
      // Stripe sends the subscription update separately; this only records the
      // signal so support can see why a plan lapsed.
      await copilotDb().from('copilot_profiles').update({ plan_status: 'past_due' }).eq('id', profileId);
    } else {
      await applySubscription(profileId, sub);
    }
    await logEvent(profileId, 'billing_event', { type: event.type, status: sub.status });
    return Response.json({ received: true });
  } catch (e) {
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    console.error('[copilot/billing] handler failed', e);
    return new Response('Handler error', { status: 500 });
  }
}

/**
 * Every event we care about resolves to one subscription. Checkout completion
 * carries only an id, so it is fetched — the session alone does not say whether
 * the first invoice actually cleared.
 */
async function resolveSubscription(event: { type: string; data: { object: unknown } }): Promise<SubscriptionShape | null> {
  const stripe = getStripe();
  const obj = event.data.object as Record<string, unknown>;

  if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_failed') {
    const id = typeof obj.subscription === 'string' ? obj.subscription : null;
    if (!id) return null;
    return (await stripe.subscriptions.retrieve(id)) as unknown as SubscriptionShape;
  }
  return obj as unknown as SubscriptionShape;
}

/** Health check, so a misconfigured endpoint is obvious without sending an event. */
export function GET() {
  return Response.json({
    status: 'copilot billing webhook',
    configured: { secret: !!process.env.COPILOT_STRIPE_WEBHOOK_SECRET, stripe: !!process.env.STRIPE_SECRET_KEY },
  });
}
