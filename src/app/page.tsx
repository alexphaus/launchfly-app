'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { trackCTAClick } from '../lib/onboarding-analytics';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [liveUsers, setLiveUsers] = useState(73);

  // Generate session ID
  const [sessionId] = useState(() => 
    `session_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Navigation functions
  const handleGetStarted = (plan = 'growth', location = 'unknown') => {
    trackCTAClick('get_started', location, undefined, plan);
    router.push(`/templates`); // Direct to templates/wizard
  };

  useEffect(() => {
    setIsLoading(false);
    document.body.classList.add('loaded');
    
    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setHeaderScrolled(window.scrollY > 10);
      }, 10);
    };

    // Dynamic counters
    const usersInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 5) - 2;
      setLiveUsers(prev => Math.max(60, Math.min(120, prev + change)));
    }, 8000);

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(usersInterval);
    };
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => {
      const newState = !prev;
      document.body.style.overflow = newState ? 'hidden' : '';
      return newState;
    });
  }, []);

  if (isLoading) return null;
  
  return (
    <div className="launchfly-homepage-v2">
      {/* Header */}
      <header id="header" className={headerScrolled ? 'scrolled' : ''}>
        <nav className="container">
          <div className="logo">
            <span className="logo-icon">🚀</span>
            <span>Launchfly</span>
          </div>
          <div className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <button 
            className="nav-cta" 
            onClick={() => handleGetStarted('free', 'header_nav')}
          >
            <span className="pulse-dot"></span>
            Build My Funnel Free
          </button>
          <button 
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`} 
            onClick={toggleMobileMenu}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
      </header>

      <main>
        {/* Hero Section - Local Service Focused */}
        <section className="hero-v2">
          <div className="container">
            {/* Trust Badge */}
            <div className="hero-badge">
              <span className="badge-pulse"></span>
              <span className="badge-icon">🔧</span>
              <span><strong>New:</strong> Lead Generation for Local Businesses</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="hero-title">
              <span className="title-main">Get More Local Leads in</span><br />
              <span className="title-highlight">Under 5 Minutes</span><br />
              <span className="title-sub">Automated Quote Funnels for Local Businesses</span>
            </h1>
            
            {/* Subheadline - The Promise */}
            <p className="hero-subtitle">
              Stop losing customers to competitors. We build you a <strong>high-converting quote funnel</strong>, set up your email follow-ups, and get you ready to capture leads instantly. No tech skills required.
            </p>

            {/* CTA Buttons */}
            <div className="cta-group">
              <button 
                className="primary-cta"
                onClick={() => handleGetStarted('free', 'hero')}
              >
                <span>Generate My Funnel Now</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              <p className="cta-subtext">No credit card required • Free to generate</p>
            </div>

            {/* Stats Bar */}
            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-icon">📋</div>
                <strong>Checklist/Guide</strong>
                <span>Written & Designed</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">💻</div>
                <strong>Landing Page</strong>
                <span>High-Converting</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">📧</div>
                <strong>Email Sequence</strong>
                <span>5-Day Nurture</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">⚡</div>
                <strong>Instant</strong>
                <span>Ready in 30s</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="trust-indicators">
              <div className="avatar-stack">
                <Image src="https://i.pravatar.cc/40?img=12" alt="User" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=25" alt="User" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=33" alt="User" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=42" alt="User" width={40} height={40} unoptimized />
                <div className="more-users">+{liveUsers - 4}</div>
              </div>
              <div className="trust-text">
                <span className="live-indicator"></span>
                <span><strong>{liveUsers}</strong> local businesses building funnels right now</span>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem We Solve */}
        <section className="problem-section">
          <div className="container">
            <div className="problem-grid">
              <div className="problem-card">
                <span className="problem-icon">😫</span>
                <h3>Websites Don't Get Quotes</h3>
                <p>Your "brochure" website looks nice but doesn't get the phone to ring. Customers visit, get confused, and leave without contacting you.</p>
              </div>
              <div className="solution-card">
                <span className="solution-icon">🚀</span>
                <h3>Funnels Capture Leads</h3>
                <p>We build a dedicated page designed for one thing: getting their contact info. Offer a coupon, a checklist, or a free quote, and watch your leads double.</p>
              </div>
            </div>
          </div>
        </section>

        {/* What You Get */}
        <section className="differentiator-section" id="features">
          <div className="container">
            <div className="section-header">
              <div className="section-label">What You Get</div>
              <h2>A Complete Lead Generation System</h2>
              <p>We don't just give you a tool. We give you the finished assets.</p>
            </div>

            <div className="fulfillment-comparison">
              <div className="comparison-card new">
                <h3>1. The Lead Magnet (Asset)</h3>
                <p>A professional Checklist, Price Guide, or Coupon tailored to your business. Real value that makes homeowners want to give you their info.</p>
                <ul>
                  <li>✅ Custom written for your niche</li>
                  <li>✅ Professional layout & design</li>
                  <li>✅ High perceived value</li>
                </ul>
              </div>

              <div className="comparison-card new">
                <h3>2. The Landing Page</h3>
                <p>A clean, distraction-free page designed to do one thing: convert visitors into leads and phone calls.</p>
                <ul>
                  <li>✅ Mobile responsive</li>
                  <li>✅ Copywriting that converts</li>
                  <li>✅ Click-to-Call ready</li>
                </ul>
              </div>

              <div className="comparison-card new">
                <h3>3. The Email Sequence</h3>
                <p>A 5-day automated email series that delivers the asset, builds trust, and gets them to book an appointment.</p>
                <ul>
                  <li>✅ Day 1: Delivery & Welcome</li>
                  <li>✅ Day 2-4: Value & Trust Building</li>
                  <li>✅ Day 5: The "Book Now" Pitch</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-section" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Simple Process</div>
              <h2>From Idea to Leads in 3 Steps</h2>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-icon">🎯</div>
                <h3>Enter Your Business</h3>
                <p>Tell us what you do and where you are. Example: "I'm a roofer in Dallas looking for storm damage repairs."</p>
              </div>

              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-icon">🤖</div>
                <h3>AI Generates Everything</h3>
                <p>Our engine writes your guide, builds your page, and drafts your emails. It takes about 30 seconds.</p>
              </div>

              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-icon">🚀</div>
                <h3>Launch & Collect Leads</h3>
                <p>Get your link, share it on Facebook or your truck wrap, and watch the leads roll in. We handle the delivery.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="pricing-section" id="pricing">
          <div className="container">
            <div className="section-header">
              <div className="section-label">🚀 SEA Launch Special</div>
              <h2>Launch Your Lead System</h2>
              <p style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: '600', marginTop: '0.5rem' }}>
                Keep 100% of Your Profits — No Monthly Fees, No Revenue Share
              </p>
            </div>

            <div className="pricing-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: '1000px', margin: '0 auto' }}>
              {/* Tier 1: Asset Download - $19 */}
              <div className="pricing-card">
                <div className="plan-name">Asset Download</div>
                <div className="plan-price">
                  <span className="price-amount">$19</span>
                </div>
                <div className="plan-tagline">The essential file only</div>
                
                <ul className="plan-features">
                  <li>✓ Custom PDF Guide</li>
                  <li>✓ Commercial License</li>
                  <li>✓ Instant Download</li>
                  <li style={{ color: '#9ca3af' }}>✗ No hosting</li>
                  <li style={{ color: '#9ca3af' }}>✗ No landing page</li>
                  <li style={{ color: '#9ca3af' }}>✗ No email scripts</li>
                </ul>

                <button className="plan-cta secondary" onClick={() => handleGetStarted('asset', 'pricing')}>
                  Download Only — $19
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>
                  ₱1,100 • ฿650 • RM85
                </p>
              </div>

              {/* Tier 2: Launch Pack - $49 (BEST VALUE) */}
              <div className="pricing-card popular">
                <div className="popular-badge">🏆 BEST VALUE</div>
                <div className="plan-name">Launch Pack</div>
                <div className="plan-price">
                  <span className="price-amount">$49</span>
                  <span className="price-period" style={{ textDecoration: 'line-through', color: '#9ca3af', marginLeft: '0.5rem' }}>$197</span>
                </div>
                <div className="plan-tagline">Full funnel • AI-built • 1 year hosting</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Custom PDF Guide</strong></li>
                  <li>✓ <strong>Lead Capture Website</strong> (1 year free)</li>
                  <li>✓ <strong>5-Day Email Sequence</strong></li>
                  <li>✓ <strong>Lead Dashboard</strong></li>
                  <li>✓ <strong>Unlimited Leads</strong></li>
                  <li style={{ color: '#10b981', fontWeight: '600' }}>✓ No Monthly Fees</li>
                  <li style={{ color: '#10b981', fontWeight: '600' }}>✓ You Keep 100%</li>
                </ul>

                <button className="plan-cta primary" onClick={() => handleGetStarted('pro', 'pricing')}>
                  Get Launch Pack — $49
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>
                  ₱2,800 • ฿1,700 • RM220
                </p>
              </div>

              {/* Tier 3: White-Glove Service - $99 */}
              <div className="pricing-card">
                <div className="plan-name">White-Glove Service</div>
                <div className="plan-price">
                  <span className="price-amount">$99</span>
                </div>
                <div className="plan-tagline">Hands-off setup by our team</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Everything in Launch Pack</strong></li>
                  <li>✓ <strong>15-min Strategy Call</strong></li>
                  <li>✓ <strong>We Set Up Your Links</strong> (FB/WhatsApp)</li>
                  <li>✓ <strong>Custom Copy Review</strong></li>
                  <li>✓ <strong>Local Slang/Pricing Check</strong></li>
                  <li style={{ color: '#f59e0b', fontWeight: '600' }}>⭐ Priority Support</li>
                </ul>

                <button className="plan-cta secondary" onClick={() => handleGetStarted('vip', 'pricing')} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderColor: 'transparent' }}>
                  Go White-Glove — $99
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>
                  ₱5,500 • ฿3,400 • RM440
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta-section">
          <div className="container">
            <div className="final-cta-content">
              <h2>Ready to Get More Leads?</h2>
              <p>One-time payment. No monthly fees. No revenue share. You keep 100%.</p>
              
              <button className="primary-cta large" onClick={() => handleGetStarted('pro', 'final_cta')}>
                <span>Get My Lead System — $49</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
                Or try the free preview first →
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-icon">🚀</span>
                <span>Launchfly</span>
              </div>
              <p>The AI Lead Magnet Generator for Local Businesses.</p>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <a href="#how-it-works">How It Works</a>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
              </div>
              
              <div className="footer-column">
                <h4>Legal</h4>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2025 Launchfly AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

