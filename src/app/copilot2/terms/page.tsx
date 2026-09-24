// src/app/copilot2/terms/page.tsx
// The terms page inside /copilot2. Content is shared; only the shell differs.
import type { Metadata } from 'next';
import LegalDoc from '../../copilot/_components/LegalDoc';

// Per request, for the same reason as the privacy page beside it.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Terms of use' },
  description: 'What the app does, what you are responsible for, and what it does not promise.',
};

export default function Page() {
  return <LegalDoc doc="terms" shell="/copilot2" />;
}
