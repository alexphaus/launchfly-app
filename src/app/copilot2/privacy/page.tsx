// src/app/copilot2/privacy/page.tsx
// The privacy page inside /copilot2. Content is shared; only the shell differs.
import type { Metadata } from 'next';
import LegalDoc from '../../copilot/_components/LegalDoc';

// Per request, like every other page here: the operator name and contact come
// from env, and a prerendered page would bake them in until the next rebuild.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Privacy' },
  description: 'What this app holds about you, who else sees it, and how to delete all of it.',
};

export default function Page() {
  return <LegalDoc doc="privacy" shell="/copilot2" />;
}
