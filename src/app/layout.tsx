// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: {
    default: "Launchfly - Command Center",
    template: "%s | Launchfly",
  },
  description: "The WhatsApp OS for Service Professionals. Manage leads, bookings, and payments.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>",
  },
  manifest: '/manifest.json', // Next.js generates this from manifest.ts
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Launchfly",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // App-like feel, prevents zooming
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Script
          src="https://tally.so/widgets/embed.js"
          strategy="lazyOnload"
        />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                  console.log('SW registered');
                }, function(err) {
                  console.log('SW failed: ', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
