'use client';

import React, { useContext } from 'react';

export default function NavBar({ 
  logoUrl, 
  logo = "🚀", 
  businessName = "Your Business", 
  links = [], 
  ctaText = "Get Started", 
  ctaLink = "#contact",
  showCart = false 
}) {
  // Try to get cart context if available (for e-commerce sites)
  let CartContext, cartContext;
  try {
    CartContext = require('./EcommerceComponents').CartContext;
    cartContext = useContext(CartContext);
  } catch (error) {
    // CartContext not available, that's fine for non-ecommerce sites
  }

  const CartIcon = () => {
    if (!cartContext) return null;
    
    const { getTotalItems, setIsCartOpen } = cartContext;
    const totalItems = getTotalItems();

    return (
      <button
        onClick={() => setIsCartOpen(true)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 1.5M7 13l-2.5 2.5m5.5 5a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {totalItems > 9 ? '9+' : totalItems}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav className="bg-white shadow-sm border-b" style={{ 
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
          <div className="hidden md:flex items-center space-x-6">
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
            
            {/* Shopping Cart Icon */}
            {showCart && <CartIcon />}
            
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
            {showCart && <CartIcon />}
            
            <button className="text-gray-700 hover:text-gray-900">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
