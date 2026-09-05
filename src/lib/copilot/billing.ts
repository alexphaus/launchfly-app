// src/lib/copilot/billing.ts
// Stripe subscriptions for the copilot. Deliberately thin: Checkout and the
// Billing Portal are hosted by Stripe, so no card data ever reaches this server
// and there is no payment UI to maintain.
//
// This is a SEPARATE Stripe integration from /api/webhook/stripe, which serves
// the wider Launchfly product. It has its own endpoint, its own signing secret
// and its own tables, so neither can corrupt the other's state.

import { getStripe } from '@/lib/payments/stripe';
import { copilotDb } from './db';
import { isPlanKey, priceIdFor, type BillingPeriod, type PlanKey, type PlanStatus } from './plans';
import type { Profile } from './types';

export { billingConfigured } from './plans';

function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/**
 * Find or create this profile's Stripe customer. The id is stored on the
 * profile so a returning subscriber never gets a second customer record.
 */
export async function ensureCustomer(profile: Profile): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: profile.email ?? undefined,
    name: profile.name,
    // The profile id is the join key everywhere below. Without it a webhook
    // arriving before the checkout redirect has nothing to attach to.
    metadata: { copilot_profile_id: profile.id },
  });
  await copilotDb().from('copilot_profiles').update({ stripe_customer_id: customer.id }).eq('id', profile.id);
  return customer.id;
}

export async function createCheckoutSession(
  profile: Profile,
  plan: Exclude<PlanKey, 'free'>,
  period: BillingPeriod,
): Promise<string> {
  const price = priceIdFor(plan, period);
  if (!price) throw new Error(`No Stripe price configured for ${plan} ${period}`);
  const customer = await ensureCustomer(profile);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    // Both the session and the subscription carry the profile id: the session
    // for the completion event, the subscription for every renewal after it.
    metadata: { copilot_profile_id: profile.id, plan },
    subscription_data: { metadata: { copilot_profile_id: profile.id, plan } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/copilot?upgraded=${plan}`,
    cancel_url: `${appUrl()}/copilot/pricing?cancelled=1`,
  });
  if (!session.url) throw new Error('Stripe returned no checkout url');
  return session.url;
}

/** Stripe-hosted page for changing card, switching plan or cancelling. */
export async function createPortalSession(profile: Profile): Promise<string> {
  if (!profile.stripe_customer_id) throw new Error('No subscription to manage');
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl()}/copilot`,
  });
  return session.url;
}

/** Stripe status → the narrower set stored on the profile. */
function normalizeStatus(s: string): PlanStatus {
  switch (s) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'incomplete':
    case 'incomplete_expired': return 'incomplete';
    default: return 'canceled';       // canceled, paused, anything Stripe adds later
  }
}

export interface SubscriptionShape {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  metadata?: Record<string, string> | null;
  items?: { data: Array<{ price?: { id?: string; metadata?: Record<string, string> | null } | null }> } | null;
}

/**
 * Which plan a subscription grants. The subscription's own metadata wins; the
 * price id is the fallback, so a plan bought before metadata existed — or
 * switched inside the Billing Portal, which does not copy metadata — still
 * resolves correctly.
 */
export function planFromSubscription(sub: SubscriptionShape): PlanKey | null {
  const tagged = sub.metadata?.plan ?? sub.items?.data?.[0]?.price?.metadata?.plan;
  if (isPlanKey(tagged)) return tagged;
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  for (const key of ['pro', 'operator'] as const) {
    for (const period of ['monthly', 'yearly'] as const) {
      if (priceIdFor(key, period) === priceId) return key;
    }
  }
  return null;
}

/** Resolve the profile a Stripe object belongs to, by metadata then by customer. */
export async function profileIdForSubscription(sub: SubscriptionShape): Promise<string | null> {
  const tagged = sub.metadata?.copilot_profile_id;
  if (tagged) return tagged;
  const { data } = await copilotDb().from('copilot_profiles').select('id').eq('stripe_customer_id', sub.customer).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Write a subscription's current state onto the profile. Idempotent by
 * construction: it sets absolute values rather than applying a delta, so a
 * replayed webhook lands on exactly the same row.
 */
export async function applySubscription(profileId: string, sub: SubscriptionShape): Promise<void> {
  const status = normalizeStatus(sub.status);
  const plan = planFromSubscription(sub);
  // A cancelled or unresolvable subscription drops the profile back to free.
  // The row keeps its history; only the entitlement changes.
  const entitled = status === 'active' || status === 'trialing';
  await copilotDb().from('copilot_profiles').update({
    plan: entitled && plan ? plan : 'free',
    plan_status: status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    plan_renews_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    plan_cancels_at_period_end: !!sub.cancel_at_period_end,
  }).eq('id', profileId);
}

/** Record an event id so a Stripe retry is a no-op. Returns false if already seen. */
export async function claimEvent(id: string, type: string, profileId: string | null, payload: Record<string, unknown>): Promise<boolean> {
  const { error } = await copilotDb().from('copilot_billing_events').insert({ id, type, profile_id: profileId, payload });
  if (!error) return true;
  // 23505 = unique violation: this exact event was handled already.
  if ((error as { code?: string }).code === '23505') return false;
  throw error;
}
