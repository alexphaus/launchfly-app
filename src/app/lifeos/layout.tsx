// src/app/lifeos/layout.tsx
// The calm shell. Same app, same session, same data — the only difference from
// /copilot is the theme flag on the root and the display face it loads.
//
// Kept as a second front door on purpose: two personas want the same three tabs
// to feel like different products, and the only way to know which one gets
// opened daily is to have both installed.
import type { Metadata, Viewport } from 'next';
import { Sora } from 'next/font/google';
import '../copilot/copilot.css';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--cp-font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { absolute: 'Life OS' },
  description: 'Real businesses that fit what you sell, an opener drafted for each, and what the market in front of you keeps asking for.',
  manifest: '/lifeos/manifest.webmanifest',
  icons: { icon: '/lifeos/icon-192.png', apple: '/lifeos/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Life OS' },
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

export default function LifeosLayout({ children }: { children: React.ReactNode }) {
  return <div className={`cp-root ${sora.variable}`} data-theme="soft">{children}</div>;
}
