// src/app/copilot/pricing/page.tsx
// Server entry: resolves the viewer's plan so the page can be sent to anyone —
// signed out it reads as a landing page, signed in it upgrades in place.
import type { Metadata } from 'next';
import { currentProfileId } from '@/lib/copilot/session';
import { billingConfigured, effectivePlan, isPlanKey } from '@/lib/copilot/plans';
import { getProfile } from '@/lib/copilot/store';
import PricingClient, { type PricingState } from './PricingClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Pricing' },
  description: 'Real matches, drafted openers and a funnel that measures what came back. Free to start.',
};

export default async function PricingPage() {
  const state: PricingState = { signedIn: false, currentPlan: null, lapsed: false, checkoutReady: billingConfigured() };
  const pid = await currentProfileId();
  if (pid) {
    try {
      const profile = await getProfile(pid);
      if (profile) {
        state.signedIn = true;
        state.currentPlan = isPlanKey(profile.plan) ? profile.plan : 'free';
        // Paid on the row but free in practice: the subscription lapsed.
        state.lapsed = state.currentPlan !== 'free' && effectivePlan(profile).key === 'free';
      }
    } catch (err) {
      console.error('[copilot] pricing profile load failed', err);
    }
  }
  return <PricingClient state={state} />;
}
