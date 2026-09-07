// src/app/copilot/_components/PricingEntry.tsx
// Server entry: resolves the viewer's plan so the page can be sent to anyone —
// signed out it reads as a landing page, signed in it upgrades in place.
// Shared by /copilot/pricing and /lifeos/pricing, which differ only in theme.
import { currentProfileId } from '@/lib/copilot/session';
import { billingConfigured, effectivePlan, isPlanKey } from '@/lib/copilot/plans';
import { getProfile } from '@/lib/copilot/store';
import PricingClient, { type PricingState } from '../pricing/PricingClient';

export default async function PricingEntry() {
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
