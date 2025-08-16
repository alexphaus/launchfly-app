// src/components/launchfly-ui/NavBar.js
'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import ShoppingCart from './ShoppingCart';

export default function NavBar({ 
  businessName = "Your Business",
  logo = "🚀",
  links = ['Home', 'About', 'Products', 'Contact'],
  ctaText = "Get Started",
  ctaLink = "#contact",
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
              {links.map((link, index) => (
                <a
                  key={index}
                  href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
                >
                  {link}
                </a>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
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

              {/* CTA Button */}
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
                {links.map((link, index) => (
                  <a
                    key={index}
                    href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                    className="block text-gray-600 hover:text-gray-900 transition-colors font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link}
                  </a>
                ))}
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
