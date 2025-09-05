// src/app/layout.tsx
import type { Metadata } from "next";
import "../globals.css";
import { Inter } from 'next/font/google';
import Script from 'next/script';

const inter = Inter({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: "Launchfly - Guaranteed Customers in 48 Hours | AI-Powered Business",
  description: "Get paying customers in 48 hours with AI. Launch a profitable business in 30 minutes. $1,000 guaranteed or we pay you $100. No skills or experience needed.",
  viewport: "width=device-width, initial-scale=1.0",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>"
  }
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
      </body>
    </html>
  );
}
