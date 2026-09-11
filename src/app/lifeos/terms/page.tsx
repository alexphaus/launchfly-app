// src/app/lifeos/terms/page.tsx
// The terms page in the calm shell. Content is shared; only the theme differs.
import type { Metadata } from 'next';
import LegalDoc from '../../copilot/_components/LegalDoc';

export const metadata: Metadata = {
  title: { absolute: 'Life OS — Terms of use' },
  description: 'What the app does, what you are responsible for, and what it does not promise.',
};

export default function Page() {
  return <LegalDoc doc="terms" shell="/lifeos" />;
}
