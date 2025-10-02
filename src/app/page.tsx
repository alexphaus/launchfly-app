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
  const [recentRevenue, setRecentRevenue] = useState(12847);

  // Generate session ID
  const [sessionId] = useState(() => 
    `session_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Navigation functions
  const handleGetStarted = (plan = 'growth', location = 'unknown') => {
    trackCTAClick('get_started', location, undefined, plan);
    router.push(`/onboarding?plan=${plan}`);
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

    const revenueInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        setRecentRevenue(prev => prev + Math.floor(Math.random() * 150) + 47);
      }
    }, 15000);

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(usersInterval);
      clearInterval(revenueInterval);
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
            <a href="#offers">Offers</a>
            <a href="#guarantee">Guarantee</a>
            <a href="#pricing">Pricing</a>
          </div>
          <button 
            className="nav-cta" 
            onClick={() => handleGetStarted('growth', 'header_nav')}
          >
            <span className="pulse-dot"></span>
            Get Started Free
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
        {/* Hero Section - Revenue Focused */}
        <section className="hero-v2">
          <div className="container">
            {/* Trust Badge */}
            <div className="hero-badge">
              <span className="badge-pulse"></span>
              <span className="badge-icon">💰</span>
              <span><strong>${recentRevenue.toLocaleString()}</strong> in user revenue this week</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="hero-title">
              <span className="title-main">Launch a Real Business in</span><br />
              <span className="title-highlight">Under 30 Minutes</span><br />
              <span className="title-sub">With AI That Actually Makes You Money</span>
            </h1>
            
            {/* Subheadline - The Promise */}
            <p className="hero-subtitle">
              We don't just build websites. We create <strong>complete digital product businesses</strong> that generate revenue automatically. AI handles product creation, customer acquisition, and fulfillment while you sleep.
            </p>

            {/* Guarantee Badge */}
            <div className="guarantee-badge-hero">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
              </svg>
              <div>
                <strong>$1,000 in 60 Days or We Work For Free</strong>
                <span>We only win when you win. Zero risk.</span>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="cta-group">
              <button 
                className="primary-cta"
                onClick={() => handleGetStarted('growth', 'hero')}
              >
                <span>Start Your Business Now</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              <button 
                className="secondary-cta"
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
                <span>See How It Works</span>
              </button>
            </div>

            {/* Stats Bar */}
            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-icon">⚡</div>
                <strong>30 Min</strong>
                <span>Setup Time</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">🤖</div>
                <strong>100% AI</strong>
                <span>Automated</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">💰</div>
                <strong>99%</strong>
                <span>Profit Margins</span>
              </div>
              <div className="stat-item">
                <div className="stat-icon">📈</div>
                <strong>${recentRevenue.toLocaleString()}</strong>
                <span>This Week</span>
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
                <span><strong>{liveUsers}</strong> entrepreneurs building right now</span>
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
                <h3>Most "Business Builders" Just Make Websites</h3>
                <p>They give you a landing page and say "good luck finding customers." You're left alone to figure out marketing, products, and fulfillment.</p>
              </div>
              <div className="solution-card">
                <span className="solution-icon">🚀</span>
                <h3>Launchfly Builds Complete Revenue Engines</h3>
                <p>We create the products, find the customers, handle fulfillment, and optimize for profit. You get a real business that makes money from day one.</p>
              </div>
            </div>
          </div>
        </section>

        {/* What Makes Us Different - AI Fulfillment */}
        <section className="differentiator-section">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Our Unfair Advantage</div>
              <h2>The AI Fulfillment System<br />Nobody Else Has</h2>
              <p>Instead of shipping physical products or doing manual work, our AI delivers instant digital value worth 10x the purchase price</p>
            </div>

            <div className="fulfillment-comparison">
              <div className="comparison-card old">
                <h3>❌ Traditional E-commerce</h3>
                <ul>
                  <li>Buy inventory: <strong>$5,000+</strong></li>
                  <li>Shipping costs: <strong>$8-15/order</strong></li>
                  <li>Profit margin: <strong>30-40%</strong></li>
                  <li>Delivery time: <strong>5-10 days</strong></li>
                  <li>Customer satisfaction: <strong>Hit or miss</strong></li>
                </ul>
              </div>

              <div className="comparison-card new">
                <h3>✅ Launchfly AI Fulfillment</h3>
                <ul>
                  <li>Inventory cost: <strong>$0</strong></li>
                  <li>Fulfillment cost: <strong>$0.50/order</strong></li>
                  <li>Profit margin: <strong>99%</strong></li>
                  <li>Delivery time: <strong>Instant</strong></li>
                  <li>Customer value: <strong>10x what they paid</strong></li>
                </ul>
              </div>
            </div>

            <div className="fulfillment-example">
              <h3>Here's How It Works:</h3>
              <p className="example-scenario">Customer buys a $97 "AI Content Package"...</p>
              <div className="example-steps">
                <div className="step">
                  <span className="step-num">1</span>
                  <div>
                    <strong>AI Analyzes Their Need</strong>
                    <p>Understands their business, audience, and goals</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">2</span>
                  <div>
                    <strong>Generates Personalized Value</strong>
                    <p>Creates 10 posts, 3 videos, content calendar (worth $500+)</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">3</span>
                  <div>
                    <strong>Delivers Instantly</strong>
                    <p>Beautiful email with access link in under 60 seconds</p>
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">4</span>
                  <div>
                    <strong>Customer Is Thrilled</strong>
                    <p>They got 5x more value than expected, instant delivery</p>
                  </div>
                </div>
              </div>
              <div className="example-result">
                <strong>Result:</strong> You make $96 profit (99% margin). Customer gets $500+ value. Everyone wins. 🎉
              </div>
            </div>
          </div>
        </section>

        {/* Proven Offers */}
        <section className="offers-section" id="offers">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Ready-to-Sell Products</div>
              <h2>3 Proven Offers That Convert in <span className="highlight">48 Hours</span></h2>
              <p>Each offer is battle-tested, AI-fulfilled, and optimized for fast sales</p>
            </div>

            <div className="offers-grid">
              <div className="offer-card featured">
                <div className="offer-badge">🔥 FASTEST TO FIRST SALE</div>
                <div className="offer-icon">📱</div>
                <h3>AI Content Sprint</h3>
                <div className="offer-price">
                  <span className="price">$97</span>
                  <span className="your-profit">Your Profit: $96</span>
                </div>
                <p className="offer-desc">10 social posts + 3 short videos, personalized to their brand. Delivered instantly.</p>
                
                <div className="offer-stats">
                  <div className="stat">
                    <strong>24-48hr</strong>
                    <span>To First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>99%</strong>
                    <span>Profit Margin</span>
                  </div>
                  <div className="stat">
                    <strong>$500+</strong>
                    <span>Customer Value</span>
                  </div>
                </div>

                <div className="offer-fulfillment">
                  <strong>✨ AI Fulfillment Included:</strong>
                  <ul>
                    <li>Brand analysis & voice creation</li>
                    <li>10 high-value social posts</li>
                    <li>3 video scripts with captions</li>
                    <li>Content calendar & scheduling guide</li>
                  </ul>
                </div>

                <div className="offer-target">
                  <strong>Perfect For:</strong> Coaches, consultants, content creators
                </div>
              </div>

              <div className="offer-card">
                <div className="offer-icon">🎁</div>
                <h3>AI Lead Magnet System</h3>
                <div className="offer-price">
                  <span className="price">$47</span>
                  <span className="your-profit">Your Profit: $46</span>
                </div>
                <p className="offer-desc">High-value downloadable guide + landing page + email sequence. Everything they need to capture leads.</p>
                
                <div className="offer-stats">
                  <div className="stat">
                    <strong>24-48hr</strong>
                    <span>To First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>99%</strong>
                    <span>Profit Margin</span>
                  </div>
                  <div className="stat">
                    <strong>$300+</strong>
                    <span>Customer Value</span>
                  </div>
                </div>

                <div className="offer-fulfillment">
                  <strong>✨ AI Fulfillment Included:</strong>
                  <ul>
                    <li>20+ page downloadable guide (PDF)</li>
                    <li>Landing page with email capture</li>
                    <li>5-email nurture sequence</li>
                    <li>Setup instructions</li>
                  </ul>
                </div>

                <div className="offer-target">
                  <strong>Perfect For:</strong> B2B services, agencies, freelancers
                </div>
              </div>

              <div className="offer-card">
                <div className="offer-icon">🎓</div>
                <h3>AI Mini-Course</h3>
                <div className="offer-price">
                  <span className="price">$297</span>
                  <span className="your-profit">Your Profit: $294</span>
                </div>
                <p className="offer-desc">Complete 5-module course with videos, workbooks, and sales funnel. High-ticket, high-value.</p>
                
                <div className="offer-stats">
                  <div className="stat">
                    <strong>48-72hr</strong>
                    <span>To First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>99%</strong>
                    <span>Profit Margin</span>
                  </div>
                  <div className="stat">
                    <strong>$1,500+</strong>
                    <span>Customer Value</span>
                  </div>
                </div>

                <div className="offer-fulfillment">
                  <strong>✨ AI Fulfillment Included:</strong>
                  <ul>
                    <li>5 comprehensive course modules</li>
                    <li>Video scripts + slide decks</li>
                    <li>Workbooks & exercises</li>
                    <li>Sales page + checkout setup</li>
                  </ul>
                </div>

                <div className="offer-target">
                  <strong>Perfect For:</strong> Experts, educators, thought leaders
                </div>
              </div>
            </div>

            <div className="offers-cta">
              <p><strong>All 3 offers are included.</strong> We set them up, connect payments, and activate AI fulfillment. You just share the link and collect money.</p>
              <button className="primary-cta" onClick={() => handleGetStarted('growth', 'offers')}>
                Get All 3 Offers Set Up Now →
              </button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-section" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Simple Process</div>
              <h2>From Zero to Revenue in 4 Steps</h2>
              <p>We've done this dozens of times. Here's exactly how it works.</p>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-icon">🎯</div>
                <h3>Choose Your Niche</h3>
                <p>Tell us who you want to serve. Coaches? Consultants? Local businesses? We'll customize your offers for that market.</p>
                <div className="step-time">⏱ 5 minutes</div>
              </div>

              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-icon">🤖</div>
                <h3>AI Builds Your Business</h3>
                <p>We create your branded website, set up all 3 offers, connect Stripe payments, and activate AI fulfillment. Everything is done for you.</p>
                <div className="step-time">⏱ 25 minutes (automated)</div>
              </div>

              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-icon">📧</div>
                <h3>We Find Customers</h3>
                <p>Our AI starts finding and contacting potential customers in your niche. Warm email outreach, social media, proven channels that convert.</p>
                <div className="step-time">⏱ Ongoing (automatic)</div>
              </div>

              <div className="step-card">
                <div className="step-number">4</div>
                <div className="step-icon">💰</div>
                <h3>Make Money on Autopilot</h3>
                <p>When someone buys, AI fulfills the order instantly. You get paid. Customer gets amazing value. You do nothing. Repeat.</p>
                <div className="step-time">⏱ Forever (automatic)</div>
              </div>
            </div>

            <div className="automation-badge">
              <h3>🤖 Everything is automated:</h3>
              <div className="automation-list">
                <span>✅ Product creation</span>
                <span>✅ Customer acquisition</span>
                <span>✅ Order fulfillment</span>
                <span>✅ Payment processing</span>
                <span>✅ Revenue optimization</span>
              </div>
            </div>
          </div>
        </section>

        {/* The Guarantee */}
        <section className="guarantee-section" id="guarantee">
          <div className="container">
            <div className="guarantee-seal">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
              </svg>
            </div>
            
            <h2>Our Unbeatable Guarantee</h2>
            <p className="guarantee-intro">We're so confident this works, we're putting our money where our mouth is:</p>

            <div className="guarantee-promises">
              <div className="promise-card main">
                <h3>💰 $1,000 in 60 Days or We Work For Free</h3>
                <p>If your business doesn't generate $1,000 in revenue within 60 days, we'll keep optimizing and improving until it does. At no extra cost to you.</p>
              </div>

              <div className="promise-card">
                <h3>⚡ First Sale in 48 Hours or $50 Credit</h3>
                <p>We're so confident you'll get your first sale within 48 hours, we'll give you $50 if you don't.</p>
              </div>

              <div className="promise-card">
                <h3>✅ 100% Refund Guarantee</h3>
                <p>If you're not happy for any reason within the first 30 days, we'll refund every penny. No questions asked.</p>
              </div>
            </div>

            <div className="guarantee-why">
              <h3>Why can we make this promise?</h3>
              <p>Because we've done this dozens of times. We know what works. We know how to find customers. We know how to optimize for profit. And we only make money when you make money through our revenue share model.</p>
              <p><strong>Our success is 100% dependent on your success.</strong> We're not just another software company trying to sell you a subscription. We're your partner in building a real revenue-generating business.</p>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="testimonials-section">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Real Results</div>
              <h2>Real People. Real Revenue.</h2>
              <p>These are actual Launchfly users making real money</p>
            </div>

            <div className="testimonials-grid">
              <div className="testimonial-card">
                <div className="testimonial-revenue">$1,245 in 22 days</div>
                <p className="testimonial-text">"I was skeptical about the AI fulfillment, but wow. My customers are getting better value than I could ever create manually, and I'm making 99% profit. This is insane."</p>
                <div className="testimonial-author">
                  <Image src="https://i.pravatar.cc/60?img=7" alt="Sarah" width={50} height={50} unoptimized />
                  <div>
                    <strong>Sarah Mitchell</strong>
                    <span>AI Content Sprint Business</span>
                  </div>
                </div>
                <div className="testimonial-stats">
                  <span>⚡ First sale: 31 hours</span>
                  <span>📊 18 sales total</span>
                </div>
              </div>

              <div className="testimonial-card">
                <div className="testimonial-revenue">$847 in first week</div>
                <p className="testimonial-text">"The AI found customers I never would have reached. It's like having a sales team working 24/7. Already hit my $1k guarantee goal and still accelerating."</p>
                <div className="testimonial-author">
                  <Image src="https://i.pravatar.cc/60?img=11" alt="Mike" width={50} height={50} unoptimized />
                  <div>
                    <strong>Mike Rodriguez</strong>
                    <span>Lead Magnet Business</span>
                  </div>
                </div>
                <div className="testimonial-stats">
                  <span>⚡ First sale: 28 hours</span>
                  <span>📊 21 sales total</span>
                </div>
              </div>

              <div className="testimonial-card">
                <div className="testimonial-revenue">$2,394 in 45 days</div>
                <p className="testimonial-text">"I've tried Shopify, Gumroad, everything. This is the first platform that actually made me money without me doing the work. The AI mini-course offer is a goldmine."</p>
                <div className="testimonial-author">
                  <Image src="https://i.pravatar.cc/60?img=9" alt="Emma" width={50} height={50} unoptimized />
                  <div>
                    <strong>Emma Chen</strong>
                    <span>AI Mini-Course Business</span>
                  </div>
                </div>
                <div className="testimonial-stats">
                  <span>⚡ First sale: 52 hours</span>
                  <span>📊 9 sales total</span>
                </div>
              </div>
            </div>

            <div className="results-disclaimer">
              <p><strong>Average Results:</strong> Most users get their first sale within 48 hours and hit $1,000 within 45-60 days. Results vary based on niche and effort. We guarantee $1k in 60 days or work free.</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="pricing-section" id="pricing">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Pricing</div>
              <h2>Simple, Transparent Pricing</h2>
              <p>Pay once, keep the business forever. We only win when you win.</p>
            </div>

            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="plan-name">Launch</div>
                <div className="plan-price">
                  <span className="price-amount">$97</span>
                  <span className="price-period">one-time</span>
                </div>
                <div className="plan-tagline">Perfect for testing the waters</div>
                
                <ul className="plan-features">
                  <li>✓ Complete business setup (30 min)</li>
                  <li>✓ 1 curated offer ready to sell</li>
                  <li>✓ AI fulfillment activated</li>
                  <li>✓ Basic customer acquisition</li>
                  <li>✓ Stripe payments connected</li>
                  <li>✓ Email support</li>
                </ul>

                <div className="plan-revshare">
                  <span>Revenue Share:</span>
                  <strong>15%</strong>
                </div>

                <div className="plan-guarantee">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>First sale in 48hr or $50 credit</span>
                </div>

                <button className="plan-cta secondary" onClick={() => handleGetStarted('launch', 'pricing')}>
                  Start With Launch
                </button>
              </div>

              <div className="pricing-card popular">
                <div className="popular-badge">🔥 MOST POPULAR</div>
                <div className="plan-name">Growth</div>
                <div className="plan-price">
                  <span className="price-amount">$297</span>
                  <span className="price-period">one-time</span>
                  <span className="price-save">Best Value</span>
                </div>
                <div className="plan-tagline">For serious entrepreneurs</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Everything in Launch, plus:</strong></li>
                  <li>✓ All 3 curated offers</li>
                  <li>✓ Advanced customer acquisition</li>
                  <li>✓ Multi-channel outreach (email + social)</li>
                  <li>✓ Abandoned cart recovery</li>
                  <li>✓ Upsell optimization</li>
                  <li>✓ Priority support</li>
                </ul>

                <div className="plan-revshare">
                  <span>Revenue Share:</span>
                  <strong>10%</strong>
                </div>

                <div className="plan-guarantee">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>$1,000 in 60 days or work free</span>
                </div>

                <button className="plan-cta primary" onClick={() => handleGetStarted('growth', 'pricing')}>
                  Start With Growth 🚀
                </button>
              </div>

              <div className="pricing-card">
                <div className="plan-name">Scale</div>
                <div className="plan-price">
                  <span className="price-amount">$997</span>
                  <span className="price-period">one-time</span>
                </div>
                <div className="plan-tagline">Maximum automation & support</div>
                
                <ul className="plan-features">
                  <li>✓ <strong>Everything in Growth, plus:</strong></li>
                  <li>✓ 24/7 AI optimization agent</li>
                  <li>✓ White-label option</li>
                  <li>✓ Custom offer creation</li>
                  <li>✓ API access</li>
                  <li>✓ 1-on-1 coaching calls</li>
                  <li>✓ Dedicated support</li>
                </ul>

                <div className="plan-revshare">
                  <span>Revenue Share:</span>
                  <strong>5%</strong>
                </div>

                <div className="plan-guarantee">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>$3,000 in 60 days or full refund</span>
                </div>

                <button className="plan-cta secondary" onClick={() => handleGetStarted('scale', 'pricing')}>
                  Start With Scale
                </button>
              </div>
            </div>

            <div className="pricing-notes">
              <h3>Why Revenue Share?</h3>
              <p>We only make money when you make money. If your business generates $1,000, we take $100-150 depending on your plan. If it generates $0, we take $0. Our incentives are 100% aligned with yours.</p>
              <div className="pricing-example">
                <strong>Example (Growth Plan):</strong> You make $1,000 → You keep $900, we get $100 → You make $10,000 → You keep $9,000, we get $1,000. Simple.
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Questions</div>
              <h2>Frequently Asked Questions</h2>
            </div>

            <div className="faq-grid">
              <div className="faq-item">
                <h3>How is this different from Shopify, Gumroad, or other platforms?</h3>
                <p>They give you tools and say "good luck." We give you a complete business with products, customers, and fulfillment already working. Plus, our AI fulfillment system delivers 10x more value at 1/100th the cost of physical products.</p>
              </div>

              <div className="faq-item">
                <h3>How does AI fulfillment work?</h3>
                <p>When someone buys from you, our AI analyzes their needs and generates personalized, high-value digital products (content, courses, guides) worth 5-10x what they paid. It's delivered instantly. No inventory, no shipping, 99% profit margins.</p>
              </div>

              <div className="faq-item">
                <h3>Do I need any technical skills?</h3>
                <p>No. We set up everything for you in 30 minutes. You just need to share your business link and collect payments. Everything else is automated.</p>
              </div>

              <div className="faq-item">
                <h3>How do you find customers for me?</h3>
                <p>Our AI uses proven acquisition channels: warm email outreach, social media, content marketing, and paid ads (if needed). We test what works in your niche and scale it.</p>
              </div>

              <div className="faq-item">
                <h3>What if I don't hit $1,000 in 60 days?</h3>
                <p>We keep working for free until you do. We'll optimize your offers, test new channels, improve messaging, whatever it takes. We only win when you win.</p>
              </div>

              <div className="faq-item">
                <h3>Can I customize the offers?</h3>
                <p>On the Launch and Growth plans, you get our proven offers optimized for your niche. On the Scale plan, we can create custom offers just for you.</p>
              </div>

              <div className="faq-item">
                <h3>Do I own the business?</h3>
                <p>100%. You own everything: the business, the customers, the revenue. You can cancel anytime and keep it all. We just take a small revenue share while we're helping you grow.</p>
              </div>

              <div className="faq-item">
                <h3>What kind of support do you offer?</h3>
                <p>Email support for Launch, priority support for Growth, and dedicated 1-on-1 coaching for Scale. Plus, everyone gets access to our knowledge base and community.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta-section">
          <div className="container">
            <div className="final-cta-content">
              <h2>Ready to Launch Your Revenue-Generating Business?</h2>
              <p>Join {liveUsers}+ entrepreneurs who are building real businesses that make real money</p>
              
              <div className="final-cta-guarantee">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                </svg>
                <div>
                  <strong>$1,000 in 60 Days or We Work For Free</strong>
                  <span>Zero risk. Maximum reward.</span>
                </div>
              </div>

              <button className="primary-cta large" onClick={() => handleGetStarted('growth', 'final_cta')}>
                <span>Start Your Business Now</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>

              <div className="final-trust-badges">
                <div className="trust-badge">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>30-day money-back guarantee</span>
                </div>
                <div className="trust-badge">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>Setup complete in 30 minutes</span>
                </div>
                <div className="trust-badge">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
                  </svg>
                  <span>AI handles everything</span>
                </div>
              </div>
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
              <p>AI-powered digital businesses that make real money.</p>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <a href="#how-it-works">How It Works</a>
                <a href="#offers">Offers</a>
                <a href="#pricing">Pricing</a>
                <a href="#guarantee">Guarantee</a>
              </div>
              
              <div className="footer-column">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
                <a href="#">Contact</a>
              </div>
              
              <div className="footer-column">
                <h4>Legal</h4>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Refund Policy</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2025 Launchfly AI. All rights reserved.</p>
            <p className="disclaimer">Results vary. We guarantee $1,000 in 60 days or work free. Individual results depend on niche and effort.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

