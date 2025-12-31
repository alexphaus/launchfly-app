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
  businessId,
  // NEW: WhatsApp integration props
  whatsappNumber,
  whatsappMessage = "Hi! I just downloaded your guide and I'd like to schedule a free inspection.",
  // NEW: Urgency/scarcity props
  urgencyText,
  limitedSlots,
  couponCode
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleCapture = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      console.log('🚀 Submitting lead:', { email, phone, businessId });
      const res = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          formData: { email, phone }
        })
      });

      const data = await res.json();
      console.log('📩 Capture response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setStatus('success');
      setEmail('');
      setPhone('');
    } catch (err) {
      console.error('❌ Lead capture error:', err);
      setStatus('error');
    }
  };

  // Generate WhatsApp link with prefilled message
  const getWhatsAppLink = () => {
    if (!whatsappNumber) return null;
    // Coerce to string in case it's passed as a number
    const cleanNumber = String(whatsappNumber).replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(whatsappMessage);
    // Use api.whatsapp.com instead of wa.me to avoid ISP blocking issues
    return `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedMessage}`;
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
              <p className="text-xl text-slate-200 mb-6 leading-relaxed max-w-xl font-light">
                {subtitle}
              </p>

              {/* Urgency/Scarcity Banner */}
              {(urgencyText || limitedSlots) && (
                <div className="mb-6 p-3 bg-amber-500/20 border border-amber-400/40 rounded-lg backdrop-blur-sm">
                  <p className="text-amber-100 text-sm font-medium flex items-center gap-2">
                    <span className="text-lg">⏰</span>
                    {urgencyText || `Only ${limitedSlots} slots left this week!`}
                  </p>
                </div>
              )}

              {/* Coupon Code Badge */}
              {couponCode && (
                <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-400/40 rounded-lg backdrop-blur-sm">
                  <span className="text-green-300 text-sm">🎁 Use code</span>
                  <span className="font-bold text-green-100 bg-green-600/30 px-2 py-0.5 rounded">{couponCode}</span>
                  <span className="text-green-300 text-sm">for 15% off!</span>
                </div>
              )}

              {/* Trust Indicators */}
              <div className="flex items-center gap-4 text-slate-300 text-sm border-t border-white/10 pt-6">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full bg-slate-200 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-slate-600">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p>Join <strong>500+</strong> local homeowners who trust us.</p>
              </div>

              {/* WhatsApp CTA Button */}
              {getWhatsAppLink() && (
                <div className="mt-6">
                  <a
                    href={getWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Chat on WhatsApp
                  </a>
                  <p className="text-slate-400 text-xs mt-2">Get instant answers to your questions</p>
                </div>
              )}
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

                  <div className="space-y-3">
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      type="tel"
                      placeholder="Phone (Optional - for faster service)"
                      className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 transition-all"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
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
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
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
