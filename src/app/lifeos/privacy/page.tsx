// src/app/lifeos/privacy/page.tsx
// The privacy page in the calm shell. Content is shared; only the theme differs.
import type { Metadata } from 'next';
import LegalDoc from '../../copilot/_components/LegalDoc';

export const metadata: Metadata = {
  title: { absolute: 'Life OS — Privacy' },
  description: 'What this app holds about you, who else sees it, and how to delete all of it.',
};

export default function Page() {
  return <LegalDoc doc="privacy" shell="/lifeos" />;
}
