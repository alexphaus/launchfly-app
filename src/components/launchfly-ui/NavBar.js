// src/components/launchfly-ui/NavBar.js
'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import ShoppingCart from './ShoppingCart';

export default function NavBar({
  businessName = "Your Business",
  logo = "🚀",
  links = ['About', 'Services', 'Contact'],
  ctaText = "Chat with Us",
  ctaLink = "#contact",
  phoneNumber,
  whatsappNumber,
  isEcommerce = false
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Safe cart access for e-commerce functionality
  let getCartCount = () => 0;
  try {
    if (isEcommerce) {
      const cartContext = useCart();
      getCartCount = cartContext.getCartCount;
    }
  } catch (error) {
    // Cart provider not available, use default
    getCartCount = () => 0;
  }

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-2xl mr-3">{logo}</span>
              <span className="text-xl font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                {businessName}
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {links.map((link, index) => {
                // Support both string and object format
                const label = typeof link === 'string' ? link : link.label;
                const href = typeof link === 'string' ? `#${link.toLowerCase().replace(/\s+/g, '-')}` : link.href;
                return (
                  <a
                    key={index}
                    href={href}
                    className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Phone Number Display */}
              {phoneNumber && (
                <a href={`tel:${phoneNumber}`} className="hidden lg:flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-medium">{phoneNumber}</span>
                </a>
              )}

              {/* WhatsApp Chat Button */}
              {whatsappNumber && (
                <a
                  href={`https://api.whatsapp.com/send?phone=${String(whatsappNumber).replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 1C5.493 1 .161 6.335.161 11.893c0 2.095.547 4.14 1.588 5.944L.058 24l6.305-1.654a11.87 11.87 0 005.683 1.447h.005c6.553 0 11.89-5.335 11.89-11.893C23.942 6.335 18.57 1 12.032 1z" />
                  </svg>
                  Chat with Us
                </a>
              )}

              {/* Search (for e-commerce) */}
              {isEcommerce && (
                <button className="text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}

              {/* Cart Icon (for e-commerce) */}
              {isEcommerce && (
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="relative text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  {getCartCount() > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {getCartCount()}
                    </span>
                  )}
                </button>
              )}

              {/* CTA Button (fallback if no WhatsApp) */}
              {!whatsappNumber && (
                <a
                  href={ctaLink}
                  className="hidden md:inline-flex items-center px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105"
                  style={{
                    background: 'var(--primary, #3b82f6)',
                    boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.35)'
                  }}
                >
                  {ctaText}
                </a>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4">
              <div className="space-y-4">
                {links.map((link, index) => {
                  // Support both string and object format
                  const label = typeof link === 'string' ? link : link.label;
                  const href = typeof link === 'string' ? `#${link.toLowerCase().replace(/\s+/g, '-')}` : link.href;
                  return (
                    <a
                      key={index}
                      href={href}
                      className="block text-gray-600 hover:text-gray-900 transition-colors font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {label}
                    </a>
                  );
                })}
                <a
                  href={ctaLink}
                  className="block w-full text-center px-4 py-2 rounded-lg font-medium text-white transition-all"
                  style={{ background: 'var(--primary, #3b82f6)' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {ctaText}
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Shopping Cart Sidebar */}
      {isEcommerce && (
        <ShoppingCart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
        />
      )}
    </>
  );
}
