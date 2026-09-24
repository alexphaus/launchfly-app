// src/app/copilot2/layout.tsx
// The four-tab shell: Today, Matches, Work, You. Same session, same database and
// the same routes as /copilot and /lifeos — a second layout over one app, not a
// second app. Calm theme, because that is the shell its owner actually opens.
//
// Kept beside the original rather than replacing it: the only honest way to know
// whether four tabs beat two is to live with both, and a redesign shipped over
// the top of the thing it replaces cannot be compared with it.
import type { Metadata, Viewport } from 'next';
import { Sora } from 'next/font/google';
import '../copilot/copilot.css';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--cp-font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { absolute: 'Copilot' },
  description: 'Today’s call with the work already done, the matches found overnight, the business you are building, and the honest numbers on how it is going.',
  manifest: '/copilot2/manifest.webmanifest',
  icons: { icon: '/lifeos/icon-192.png', apple: '/lifeos/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Copilot' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#EEF1F7',
};

export default function Copilot2Layout({ children }: { children: React.ReactNode }) {
  return <div className={`cp-root ${sora.variable}`} data-theme="soft">{children}</div>;
}
