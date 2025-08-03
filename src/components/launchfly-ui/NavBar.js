'use client';

import { useState } from 'react';
import MiniCart from './MiniCart';
import { useCart } from './CartProvider';

export default function NavBar({ 
  logoUrl, 
  logo = "🚀", 
  businessName = "Your Business", 
  links = [], 
  ctaText = "Get Started", 
  ctaLink = "#contact",
  showCart = false 
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Only use cart if CartProvider is available and showCart is true
  let cart = null;
  try {
    cart = showCart ? useCart() : null;
  } catch (error) {
    // CartProvider not available, cart will remain null
  }

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ 
      borderColor: 'var(--border-color, #e5e7eb)',
      color: 'var(--text-dark, #1f2937)'
    }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-8 w-8" />
            ) : (
              <span className="text-2xl">{logo}</span>
            )}
            <span className="font-bold text-xl" style={{ color: 'var(--primary, #3b82f6)' }}>
              {businessName}
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {links.map((link, index) => (
              <a
                key={index}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-gray-700 hover:text-gray-900 transition-colors font-medium"
                style={{ 
                  color: 'var(--text-gray, #6b7280)',
                  '--hover-color': 'var(--text-dark, #1f2937)'
                }}
              >
                {link}
              </a>
            ))}
            
            {/* Cart Icon */}
            {showCart && cart && (
              <MiniCart
                cartItems={cart.cart.items}
                onRemoveItem={cart.removeItem}
                onUpdateQuantity={cart.updateQuantity}
              />
            )}
            
            <a
              href={ctaLink}
              className="px-6 py-2 rounded-full font-semibold text-white transition-all hover:scale-105"
              style={{ 
                background: 'var(--primary, #3b82f6)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {ctaText}
            </a>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile Cart Icon */}
            {showCart && cart && (
              <MiniCart
                cartItems={cart.cart.items}
                onRemoveItem={cart.removeItem}
                onUpdateQuantity={cart.updateQuantity}
              />
            )}
            
            <button 
              className="text-gray-700 hover:text-gray-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {links.map((link, index) => (
                <a
                  key={index}
                  href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block px-3 py-2 text-gray-700 hover:text-gray-900 font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link}
                </a>
              ))}
              <a
                href={ctaLink}
                className="block mx-3 mt-4 px-6 py-2 rounded-full font-semibold text-white text-center transition-all"
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
  );
}
