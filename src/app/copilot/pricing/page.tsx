// src/app/copilot/pricing/page.tsx
// The bold pricing page. /lifeos/pricing renders the same entry in the calm shell.
import type { Metadata } from 'next';
import PricingEntry from '../_components/PricingEntry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Pricing' },
  description: 'Real matches, drafted openers and a funnel that measures what came back. Free to start.',
};

export default function CopilotPricingPage() {
  return <PricingEntry />;
}
