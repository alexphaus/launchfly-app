// src/lib/copilot/plans.ts
// What each plan costs and what it allows. Pure data plus pure functions, so
// the pricing page, the enforcement path and the tests all read the same source.
//
// Every limit here maps to a real cost:
//   matchesPerMonth — scraping credits (Apify Google Maps), the dominant cost
//   briefsPerDay    — model tokens for the daily brief
// Nothing is metered that does not cost anything to serve. Sending is free
// because on the default plan the user sends from their own WhatsApp or mail
// app; the server only writes the draft.

export type PlanKey = 'free' | 'pro' | 'operator';
export type BillingPeriod = 'monthly' | 'yearly';
/** Mirrors Stripe's subscription status. Only the first two entitle. */
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

export interface PlanLimits {
  /** Sourced matches this profile may receive per calendar month. */
  matchesPerMonth: number;
  /** Agent briefs per day. The daily cron always gets one; this caps manual re-runs. */
  briefsPerDay: number;
  /** Target segments the supply adapters will search. Each one is a separate scrape. */
  segments: number;
  /** Send directly from a verified address instead of handing over a mailto link.
   *  Entitlement only for now — no route sets send_mode, so nothing can turn it
   *  on. Deliberately absent from the pricing copy until that exists. */
  emailApi: boolean;
  /** Automatic day-3 follow-up drafts on sent messages with no reply. */
  followUps: boolean;
}

export interface Plan {
  key: PlanKey;
  name: string;
  /** One line, on the card, under the name. */
  tagline: string;
  /** Minor units are pointless here — these are whole currency units per month. */
  price: Record<BillingPeriod, number>;
  limits: PlanLimits;
  /** Rendered as the card's list. The first entry should be the reason to pick it. */
  features: string[];
  /** Shown on exactly one plan. */
  recommended?: boolean;
}

/** Yearly is priced at ten months: two free, which is the usual and legible discount. */
const yearly = (monthly: number) => monthly * 10;

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    name: 'Free',
    tagline: 'The whole engine, a small amount of supply.',
    price: { monthly: 0, yearly: 0 },
    limits: { matchesPerMonth: 25, briefsPerDay: 1, segments: 2, emailApi: false, followUps: false },
    features: [
      '25 real matches a month',
      'Daily brief and leverage plan',
      'Drafted openers you approve and send yourself',
      'Funnel, bottleneck and outcome tracking',
      'Two target segments',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    tagline: 'Enough supply to actually fill a pipeline.',
    price: { monthly: 29, yearly: yearly(29) },
    limits: { matchesPerMonth: 400, briefsPerDay: 3, segments: 5, emailApi: true, followUps: true },
    recommended: true,
    features: [
      '400 real matches a month',
      'Find new matches on demand, three briefs a day',
      'Automatic day-3 follow-ups on silence',
      'Five target segments',
      'Push nudges when something needs you',
    ],
  },
  operator: {
    key: 'operator',
    name: 'Operator',
    tagline: 'For running several offers or a small team of one.',
    price: { monthly: 79, yearly: yearly(79) },
    limits: { matchesPerMonth: 2000, briefsPerDay: 10, segments: 12, emailApi: true, followUps: true },
    features: [
      '2,000 real matches a month',
      'Twelve target segments across areas',
      'Ten briefs a day',
      'Everything in Pro',
      'Direct line for support and new adapters',
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'pro', 'operator'];
export const FREE_PLAN = PLANS.free;

/** Display currency. Stripe decides what is actually charged; this only labels it. */
export const CURRENCY = process.env.NEXT_PUBLIC_COPILOT_CURRENCY || '$';

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && v in PLANS;
}

/**
 * The plan whose limits actually apply.
 * A lapsed subscription falls back to free limits rather than locking the
 * account: the user keeps their data, their history and their funnel, and only
 * new supply stops. Nothing here deletes or hides what they already earned.
 */
export function effectivePlan(profile: { plan?: string | null; plan_status?: string | null }): Plan {
  const key = isPlanKey(profile.plan) ? profile.plan : 'free';
  const status = profile.plan_status ?? 'active';
  if (key === 'free') return PLANS.free;
  return status === 'active' || status === 'trialing' ? PLANS[key] : PLANS.free;
}

export function limitsFor(profile: { plan?: string | null; plan_status?: string | null }): PlanLimits {
  return effectivePlan(profile).limits;
}

/** Env var holding the Stripe price id for one plan and period. */
export function priceEnvKey(key: PlanKey, period: BillingPeriod): string {
  return `STRIPE_PRICE_COPILOT_${key.toUpperCase()}_${period.toUpperCase()}`;
}

export function priceIdFor(key: PlanKey, period: BillingPeriod): string | null {
  return process.env[priceEnvKey(key, period)] || null;
}

/** True when a checkout could actually complete. The UI hides upgrades otherwise.
 *  Lives here rather than in billing.ts so read paths never load the Stripe SDK. */
export function billingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!priceIdFor('pro', 'monthly');
}

/** Yearly framed per month, which is how people compare it to the monthly price. */
export function monthlyEquivalent(plan: Plan, period: BillingPeriod): number {
  return period === 'yearly' ? Math.round((plan.price.yearly / 12) * 100) / 100 : plan.price.monthly;
}

export function savingsPercent(plan: Plan): number {
  const full = plan.price.monthly * 12;
  if (!full) return 0;
  return Math.round(((full - plan.price.yearly) / full) * 100);
}

/** How many of a metered allowance are left. Never negative. */
export function remaining(limit: number, used: number): number {
  return Math.max(0, limit - Math.max(0, used));
}
