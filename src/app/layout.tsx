import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Launchfly - Future-Proof Business Launch Platform",
  description: "Stop selling websites. Start selling success. We focus on what remains valuable when AI can generate perfect websites: guaranteeing your business success.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Optional: Add a top navigation bar */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <span className="text-2xl mr-2">🚀</span>
                <span className="text-xl font-bold text-gray-900">Launchfly</span>
              </div>
              <div className="flex items-center space-x-6">
                <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Home
                </a>
                <a href="/future-proof" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Future-Proof Approach
                </a>
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
