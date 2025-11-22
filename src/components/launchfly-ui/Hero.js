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
              <div className="inline-block px-4 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-bold mb-6">
                🔥 Free Expert Guide
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
                {title}
              </h1>
              <p className="text-xl text-white/90 mb-8 leading-relaxed drop-shadow-md max-w-xl">
                {subtitle}
              </p>
              
              {/* Trust Indicators */}
              <div className="flex items-center gap-4 text-white/80 text-sm">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white/50"></div>
                  ))}
                </div>
                <p>Join <strong>500+</strong> others who downloaded this guide.</p>
              </div>
            </div>

            {/* Right: Visual + Form */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl transform hover:scale-[1.01] transition-transform duration-300">
              {/* CSS Mockup of the Guide */}
              <div className="flex justify-center mb-8">
                <div className="relative w-40 h-52 bg-white rounded-r-lg rounded-l-sm shadow-2xl flex flex-col items-center justify-center p-4 text-center border-l-8 border-gray-200 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 opacity-50"></div>
                  <div className="text-3xl mb-2">📄</div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    {title.length > 30 ? 'Expert Guide' : title}
                  </h3>
                  <div className="mt-4 w-16 h-1 bg-blue-500 rounded-full"></div>
                </div>
              </div>

              {/* Form */}
              {status === 'success' ? (
                <div className="text-center py-8 bg-green-500/20 rounded-xl border border-green-400/30">
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="text-xl font-bold text-white mb-2">Check Your Inbox!</h3>
                  <p className="text-white/90 text-sm">We've sent the guide to {email}.</p>
                </div>
              ) : (
                <form onSubmit={handleCapture} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-white text-sm font-medium ml-1">Where should we send it?</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter your best email address"
                      className="w-full px-5 py-4 rounded-xl border border-white/30 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder-gray-500 shadow-inner transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all text-lg shadow-lg transform hover:-translate-y-0.5 flex justify-center items-center"
                  >
                    {status === 'loading' ? (
                      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></span>
                    ) : '👋'} 
                    {status === 'loading' ? 'Sending...' : (ctaText || 'Get Instant Access')}
                  </button>
                  <p className="text-xs text-white/60 text-center mt-3">
                    🔒 100% Secure. Unsubscribe anytime.
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
