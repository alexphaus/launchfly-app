// src/app/copilot/terms/page.tsx
// The terms page in the bold shell. Content is shared; only the theme differs.
import type { Metadata } from 'next';
import LegalDoc from '../_components/LegalDoc';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Terms of use' },
  description: 'What the app does, what you are responsible for, and what it does not promise.',
};

export default function Page() {
  return <LegalDoc doc="terms" shell="/copilot" />;
}
