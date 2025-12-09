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
  const handleGetStarted = async (plan = 'growth', location = 'unknown') => {
    trackCTAClick('get_started', location, undefined, plan);
    
    if ((location === 'pricing' || location === 'final_cta') && plan !== 'free') {
      try {
        const response = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            returnUrl: window.location.href
          })
        });
        
        if (response.ok) {
          const { url } = await response.json();
          window.location.href = url;
          return;
        }
      } catch (error) {
        console.error('Checkout error:', error);
      }
    }
    
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
              <span className="title-main">The "Done-For-You" Lead System</span><br />
              <span className="title-highlight">That Fills Your Calendar</span><br />
              <span className="title-sub">Automated Quote Funnels for Local Businesses</span>
            </h1>
            
            {/* Subheadline - The Promise */}
            <p className="hero-subtitle">
              Most websites are just digital business cards. We build you a <strong>complete lead generation machine</strong>: The Guide, The Landing Page, and The Email Follow-up. Ready in 60 seconds.
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
                <span className="problem-icon">📉</span>
                <h3>Most Websites Fail</h3>
                <p>They look nice, but they don't ask for the sale. 96% of visitors leave without contacting you because they aren't ready to book <em>right now</em>.</p>
              </div>
              <div className="solution-card">
                <span className="solution-icon">📈</span>
                <h3>Funnels Print Money</h3>
                <p>We give visitors a reason to share their info (a free guide or quote). Then we automatically follow up until they book. It's like having a 24/7 sales rep.</p>
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

            <div className="pricing-grid">
              {/* Tier 1: The Foot in the Door - $97 */}
              <div className="pricing-card popular">
                <div className="popular-badge">🔥 POPULAR</div>
                <div className="plan-name">The "Neighborhood Authority" System</div>
                <div className="plan-price">
                  <span className="price-amount">$97</span>
                  <span className="price-period" style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 'normal' }}>one-time</span>
                </div>
                <div className="plan-tagline">Everything you need to capture leads</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Custom "City-Specific" PDF Guide</strong></li>
                  <li>✓ <strong>High-Converting Landing Page</strong></li>
                  <li>✓ <strong>5-Day Automated Email Sequence</strong></li>
                  <li>✓ <strong>Lead Command Center Dashboard</strong></li>
                  <li>✓ <strong>Unlimited Leads</strong></li>
                  <li style={{ color: '#10b981', fontWeight: '600' }}>✓ No Monthly Fees</li>
                  <li style={{ color: '#10b981', fontWeight: '600' }}>✓ You Keep 100% Profit</li>
                </ul>

                <button className="plan-cta primary" onClick={() => handleGetStarted('pro', 'pricing')}>
                  Get My System — $97
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>
                  30-day money-back guarantee.
                </p>
              </div>

              {/* Tier 2: The Goal - $297 + $29/mo */}
              <div className="pricing-card">
                <div className="plan-name">Done-For-You Growth</div>
                <div className="plan-price">
                  <span className="price-amount">$297</span>
                  <span className="price-period" style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 'normal' }}>setup + $29/mo</span>
                </div>
                <div className="plan-tagline">We manage the tech, you close the deals</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Everything in the $97 Plan</strong></li>
                  <li>✓ <strong>Google Business Profile Optimization</strong></li>
                  <li>✓ <strong>Instant SMS Lead Alerts</strong> (Speed-to-Lead)</li>
                  <li>✓ <strong>Premium Hosting & Domain Connection</strong></li>
                  <li>✓ <strong>Monthly Content Updates</strong></li>
                  <li style={{ color: '#f59e0b', fontWeight: '600' }}>⭐ We Handle Everything</li>
                </ul>

                <button className="plan-cta secondary" onClick={() => handleGetStarted('vip', 'pricing')} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderColor: 'transparent' }}>
                  Apply for Growth Plan
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>
                  Limited spots available per week.
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

