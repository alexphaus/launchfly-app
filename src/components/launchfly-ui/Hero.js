// src/components/launchfly-ui/Hero.js
'use client';
import { useState } from 'react';

export default function Hero({ 
  title = "Transform Your Vision Into Reality", 
  subtitle = "Professional solutions tailored to your unique needs", 
  ctaText = "Get Started Today", 
  ctaLink = "#contact",
  secondaryCtaText = "Learn More",
  secondaryCtaLink = "#about",
  backgroundImage,
  backgroundOverlay,
  showEmailCapture = false,
  businessId
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleCapture = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    try {
      const res = await fetch('/api/lead-magnet/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, businessId })
      });
      
      if (!res.ok) throw new Error('Failed to subscribe');
      
      setStatus('success');
      setEmail('');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  // Enhanced gradient overlays based on business type
  const getDefaultOverlay = () => {
    if (backgroundImage) {
      return backgroundOverlay || 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)';
    }
    return 'var(--gradient-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%))';
  };

  const backgroundStyle = {
    background: backgroundImage 
      ? `${getDefaultOverlay()}, url(${backgroundImage})`
      : getDefaultOverlay(),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <section 
      id="hero"
      className="relative py-20 lg:py-28 overflow-hidden min-h-[85vh] flex items-center"
      style={backgroundStyle}
    >
      {/* Static Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20"></div>
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {showEmailCapture ? (
          // --- LEAD MAGNET LAYOUT (Split Screen) ---
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-100 text-sm font-semibold mb-8 backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                Free Expert Guide
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-sm tracking-tight">
                {title}
              </h1>
              <p className="text-xl text-slate-200 mb-8 leading-relaxed max-w-xl font-light">
                {subtitle}
              </p>
              
              {/* Trust Indicators */}
              <div className="flex items-center gap-4 text-slate-300 text-sm border-t border-white/10 pt-6">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full bg-slate-200 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-slate-600">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p>Join <strong>500+</strong> local homeowners who trust us.</p>
              </div>
            </div>

            {/* Right: Visual + Form */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl transform hover:scale-[1.01] transition-transform duration-300 border border-slate-200/50">
              {/* CSS Mockup of the Guide */}
              <div className="flex justify-center mb-8 -mt-16">
                <div className="relative w-48 h-64 bg-slate-50 rounded-lg shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] flex flex-col items-center p-6 text-center border border-slate-200 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                  {/* Binder/Clip effect */}
                  <div className="absolute -top-3 w-16 h-6 bg-slate-800 rounded-sm shadow-sm z-10"></div>
                  
                  <div className="w-full h-full border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center bg-white p-4">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-relaxed">
                      {title.length > 25 ? 'Expert Checklist' : title}
                    </h3>
                    <div className="mt-4 w-12 h-1 bg-blue-600 rounded-full"></div>
                    <div className="mt-2 w-8 h-1 bg-slate-200 rounded-full"></div>
                  </div>
                  
                  {/* Page curl effect */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl from-slate-300 to-transparent opacity-20 rounded-tl-lg"></div>
                </div>
              </div>

              {/* Form */}
              {status === 'success' ? (
                <div className="text-center py-8 bg-green-50 rounded-xl border border-green-100">
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="text-xl font-bold text-green-900 mb-2">Check Your Inbox!</h3>
                  <p className="text-green-700 text-sm">We've sent the guide to {email}.</p>
                </div>
              ) : (
                <form onSubmit={handleCapture} className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Where should we send it?</h3>
                    <p className="text-sm text-slate-500">Enter your email to get instant access.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-blue-600/20 flex justify-center items-center"
                  >
                    {status === 'loading' ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    ) : (
                      <span className="mr-2">Download Now</span>
                    )} 
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-4 flex items-center justify-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                    100% Secure. No spam, ever.
                  </p>
                </form>
              )}
            </div>
          </div>
        ) : (
          // --- STANDARD HERO LAYOUT ---
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="drop-shadow-lg">
                {title}
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/95 mb-10 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
              {subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href={ctaLink}
                className="group px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 text-white shadow-2xl relative overflow-hidden"
                style={{ 
                  background: 'var(--primary, #3b82f6)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <span className="relative z-10">{ctaText}</span>
              </a>
              
              {secondaryCtaText && (
                <a
                  href={secondaryCtaLink}
                  className="group px-8 py-4 rounded-full font-semibold text-lg border-2 border-white/80 text-white hover:bg-white/10 hover:border-white transition-all duration-300 backdrop-blur-sm"
                >
                  <span className="group-hover:text-white transition-colors duration-300">
                    {secondaryCtaText}
                  </span>
                </a>
              )}
            </div>

            <div className="mt-12 flex justify-center items-center space-x-8 text-white/70">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-400 text-lg">★★★★★</span>
                <span className="text-sm font-medium">Trusted by thousands</span>
              </div>
              <div className="text-sm">•</div>
              <div className="text-sm font-medium">Professional results guaranteed</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
