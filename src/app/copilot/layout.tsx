// src/app/copilot/layout.tsx
// Installable, mobile-first shell for the copilot vertical. Own manifest, own
// icons, own fonts. Body text inherits Inter from the root layout.
import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './copilot.css';

const archivo = Archivo({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--cp-font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { absolute: 'Copilot' },
  description: 'Your opportunity engine. Daily leverage plan, ranked matches, and the skills that unlock more of them.',
  manifest: '/copilot/manifest.webmanifest',
  icons: { icon: '/copilot/icon-192.png', apple: '/copilot/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Copilot' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FAF8F4',
};

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return <div className={`cp-root ${archivo.variable}`}>{children}</div>;
}
