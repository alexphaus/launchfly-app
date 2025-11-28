// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"

// Use system font stack for reliability in all environments

export const metadata: Metadata = {
  title: "Launchfly - Guaranteed Customers in 48 Hours | AI-Powered Business",
  description: "Get paying customers in 48 hours with AI. Launch a profitable business in 30 minutes. $1,000 guaranteed or we pay you $100. No skills or experience needed.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>"
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif" }}>
        {children}
        <Script 
          src="https://tally.so/widgets/embed.js" 
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
