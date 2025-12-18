// src/components/launchfly-ui/StickyCallButton.js
'use client';

import { useState, useEffect } from 'react';

export default function StickyCallButton({ 
  phone = '',
  text = 'Call Now',
  subtext = 'Available 24/7',
  variant = 'default', // 'default' | 'emergency' | 'minimal'
  showOnMobileOnly = false
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past hero (approximately 400px)
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!phone) return null;

  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  // Emergency variant - red, very prominent
  if (variant === 'emergency') {
    return (
      <>
        {/* Desktop - Sticky header bar */}
        <div 
          className={`fixed top-0 left-0 right-0 bg-red-600 z-50 transition-transform duration-300 ${
            isVisible ? 'translate-y-0' : '-translate-y-full'
          } ${showOnMobileOnly ? 'md:hidden' : ''}`}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="text-white">
              <span className="font-bold">🚨 Need Help Fast?</span>
              <span className="ml-2 text-red-100">{subtext}</span>
            </div>
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center gap-2 bg-white text-red-600 px-6 py-2 rounded-full font-bold hover:bg-red-50 transition-colors shadow-lg"
            >
              <span className="text-xl">📞</span>
              {text}
            </a>
          </div>
        </div>

        {/* Mobile - Bottom fixed button */}
        <div className={`fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent z-50 md:hidden ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        } transition-transform duration-300`}>
          <a
            href={`tel:${cleanPhone}`}
            className="flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-2xl animate-pulse"
          >
            <span className="text-2xl">📞</span>
            {text} - {phone}
          </a>
        </div>
      </>
    );
  }

  // Minimal variant - just a floating button
  if (variant === 'minimal') {
    return (
      <a
        href={`tel:${cleanPhone}`}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } ${showOnMobileOnly ? 'md:hidden' : ''}`}
        style={{ backgroundColor: 'var(--primary, #3b82f6)' }}
      >
        <span className="text-3xl">📞</span>
      </a>
    );
  }

  // Default variant
  return (
    <>
      {/* Desktop - Right side floating */}
      <div 
        className={`fixed right-6 bottom-6 z-50 hidden md:block transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        } ${showOnMobileOnly ? 'md:hidden' : ''}`}
      >
        <a
          href={`tel:${cleanPhone}`}
          className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 border-2"
          style={{ borderColor: 'var(--primary, #3b82f6)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary, #3b82f6)' }}>
            <span className="text-2xl">📞</span>
          </div>
          <div>
            <div className="font-bold text-gray-900">{text}</div>
            <div className="text-sm text-gray-500">{phone}</div>
          </div>
        </a>
      </div>

      {/* Mobile - Bottom bar */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50 md:hidden transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <a
          href={`tel:${cleanPhone}`}
          className="flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-white shadow-lg"
          style={{ backgroundColor: 'var(--primary, #3b82f6)' }}
        >
          <span className="text-xl">📞</span>
          {text}
        </a>
      </div>
    </>
  );
}
