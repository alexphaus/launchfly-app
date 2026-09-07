// src/app/lifeos/pricing/page.tsx
// The same plans, priced the same, rendered in the calm shell so opening
// "Plans" from /lifeos does not change the theme mid-decision.
import type { Metadata } from 'next';
import PricingEntry from '../../copilot/_components/PricingEntry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Life OS — Pricing' },
  description: 'Real matches, drafted openers and a funnel that measures what came back. Free to start.',
};

export default function LifeosPricingPage() {
  return <PricingEntry />;
}
