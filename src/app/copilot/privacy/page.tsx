// src/app/copilot/privacy/page.tsx
// The privacy page in the bold shell. Content is shared; only the theme differs.
import type { Metadata } from 'next';
import LegalDoc from '../_components/LegalDoc';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Privacy' },
  description: 'What this app holds about you, who else sees it, and how to delete all of it.',
};

export default function Page() {
  return <LegalDoc doc="privacy" shell="/copilot" />;
}
