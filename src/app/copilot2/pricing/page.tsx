// src/app/copilot2/pricing/page.tsx
// The same plans, priced the same, rendered inside /copilot2 so opening "Plans"
// does not drop somebody into the other layout mid-decision.
import type { Metadata } from 'next';
import PricingEntry from '../../copilot/_components/PricingEntry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Pricing' },
  description: 'Real matches, drafted openers and a funnel that measures what came back. Free to start.',
};

export default function Copilot2PricingPage() {
  return <PricingEntry />;
}
