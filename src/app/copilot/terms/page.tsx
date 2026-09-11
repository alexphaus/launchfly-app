// src/app/copilot/terms/page.tsx
// The terms page in the bold shell. Content is shared; only the theme differs.
import type { Metadata } from 'next';
import LegalDoc from '../_components/LegalDoc';

// Rendered per request, like every other page in this app. Prerendering these
// at build time bought nothing — the content is static but the operator name and
// contact address come from env, so a static page bakes them in and needs a
// rebuild to change one — and it added prerender work to the build stage that
// runs out of memory on the deploy box.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Copilot — Terms of use' },
  description: 'What the app does, what you are responsible for, and what it does not promise.',
};

export default function Page() {
  return <LegalDoc doc="terms" shell="/copilot" />;
}
