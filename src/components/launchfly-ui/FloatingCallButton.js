// src/components/launchfly-ui/FloatingCallButton.js
'use client';

import { useState, useEffect } from 'react';

/**
 * Floating Call Now Button (Mobile-First)
 * 
 * Local services are urgent. Don't force visitors to download the PDF 
 * if they just want to call. This is a high-value conversion element.
 */
export default function FloatingCallButton({ 
  phone,
  whatsapp,
  businessName = 'Us',
  showOnDesktop = false,
  position = 'bottom-right' // 'bottom-right', 'bottom-left', 'bottom-center'
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    // Show button after user scrolls 200px (engaged visitor)
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    // Also show after 3 seconds for non-scrollers
    const timer = setTimeout(() => setIsVisible(true), 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  if (!phone && !whatsapp) return null;

  const cleanPhone = phone?.replace(/\D/g, '');
  const cleanWhatsapp = whatsapp?.replace(/\D/g, '') || cleanPhone;
  
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'left-4';
      case 'bottom-center':
        return 'left-1/2 -translate-x-1/2';
      default:
        return 'right-4';
    }
  };

  const whatsappLink = `https://api.whatsapp.com/send?phone=${cleanWhatsapp}&text=${encodeURIComponent(`Hi! I'm interested in learning more about your ${businessName} services.`)}`;

  return (
    <>
      {/* Main Floating Button */}
      <div 
        className={`fixed bottom-4 ${getPositionClasses()} z-50 transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        } ${showOnDesktop ? '' : 'md:hidden'}`}
      >
        {/* Options popup */}
        {showOptions && (
          <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 min-w-[200px] animate-fade-in">
            {phone && (
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors"
                onClick={() => setShowOptions(false)}
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Call Now</div>
                  <div className="text-xs text-slate-500">{phone}</div>
                </div>
              </a>
            )}
            {whatsapp && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 rounded-xl transition-colors"
                onClick={() => setShowOptions(false)}
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">WhatsApp</div>
                  <div className="text-xs text-slate-500">Chat with us</div>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Main Button - Direct call on mobile, show options if both available */}
        {phone && whatsapp ? (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-2 px-5 py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>Call Now</span>
            <svg className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <a
            href={phone ? `tel:${cleanPhone}` : whatsappLink}
            target={phone ? '_self' : '_blank'}
            rel={phone ? undefined : 'noopener noreferrer'}
            className="flex items-center gap-2 px-5 py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>Call Now</span>
          </a>
        )}
      </div>

      {/* Pulse animation for attention */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
