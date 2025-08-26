'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState(12);
  const [liveUsers, setLiveUsers] = useState(89);
  const [recentSuccess, setRecentSuccess] = useState(142);
  const [countdown, setCountdown] = useState({ days: 2, hours: 14, minutes: 32 });

  // Generate session ID
  const [sessionId] = useState(() => 
    `session_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Tally popup function
  const openTallyPopup = (plan = 'Default') => {
    if (typeof window !== 'undefined' && window.Tally) {
      window.Tally.openPopup('mOqz1Y', {
        layout: 'modal',
        width: 700,
        hideTitle: true,
        hiddenFields: {
          sessionID: sessionId,
          plan: plan,
          source: 'hybrid-main'
        }
      });
    }
  };

  useEffect(() => {
    // Header scroll effect
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 10);
    };

    // FAQ functionality
    const handleFaqClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const faqQuestion = target.closest('.faq-question');
      if (faqQuestion) {
        const faqItem = faqQuestion.closest('.faq-item');
        if (faqItem) {
          const wasActive = faqItem.classList.contains('active');
          document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));
          if (!wasActive) {
            faqItem.classList.add('active');
          }
        }
      }
    };

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    // Dynamic counters
    const spotsInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setSpotsLeft(prev => Math.max(3, prev - 1));
      }
    }, 45000);

    const usersInterval = setInterval(() => {
      const change = Math.floor(Math.random() * 7) - 3;
      setLiveUsers(prev => Math.max(50, Math.min(150, prev + change)));
    }, 8000);

    const successInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        setRecentSuccess(prev => prev + Math.floor(Math.random() * 3) + 1);
      }
    }, 30000);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      future.setHours(23, 59, 59);
      
      const now = new Date();
      const diff = future.getTime() - now.getTime();
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setCountdown({ days, hours, minutes });
    }, 60000);

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleFaqClick);

    // Observe elements for animations
    const elementsToObserve = document.querySelectorAll('.timeline-item, .testimonial-card, .pricing-card, .guarantee-item, .faq-item');
    elementsToObserve.forEach(el => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleFaqClick);
      clearInterval(spotsInterval);
      clearInterval(usersInterval);
      clearInterval(successInterval);
      clearInterval(countdownInterval);
      observer.disconnect();
    };
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    document.body.classList.toggle('menu-open', !mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    document.body.classList.remove('menu-open');
  };

  return (
    <>
      {/* Header */}
      <header id="header" className={headerScrolled ? 'scrolled' : ''}>
        <nav className="container">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span>Launch<span style={{ color: 'var(--secondary)' }}>fly</span></span>
          </div>
          <div className="nav-links">
            <a href="#proven-businesses">Browse Businesses</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#proof">Success Stories</a>
            <a href="#pricing">Pricing</a>
            <a href="#guarantee">Guarantee</a>
          </div>
          <div className="nav-cta-container">
            <a href="#" className="nav-cta" onClick={(e) => { e.preventDefault(); openTallyPopup(); }}>
              <span className="pulse-dot"></span>
              Get Customers Now →
            </a>
          </div>
          <button 
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`} 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
        <div className={`mobile-nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          <a href="#proven-businesses" className="mobile-nav-link" onClick={closeMobileMenu}>Browse Businesses</a>
          <a href="#how-it-works" className="mobile-nav-link" onClick={closeMobileMenu}>How It Works</a>
          <a href="#proof" className="mobile-nav-link" onClick={closeMobileMenu}>Success Stories</a>
          <a href="#pricing" className="mobile-nav-link" onClick={closeMobileMenu}>Pricing</a>
          <a href="#guarantee" className="mobile-nav-link" onClick={closeMobileMenu}>Guarantee</a>
          <a href="#" className="mobile-nav-cta" onClick={(e) => { e.preventDefault(); openTallyPopup(); }}>Get Started Now</a>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="container hero-content">
            <div className="hero-badge floating">
              <span className="badge-pulse"></span>
              <span className="badge-icon">💰</span>
              <span><strong>{recentSuccess}</strong> entrepreneurs started earning this week</span>
            </div>
            
            <h1 className="hero-title">
              <span className="title-line-1">Stop Building. Start Earning.</span><br />
              <span className="gradient-text animated-gradient">Get a Pre-Built Business Making $1K-$10K/Month</span>
            </h1>
            
            <p className="subtitle">Skip the startup struggle. We hand you a <strong>proven business model</strong> complete with <strong>50-200 paying customers</strong>, automated systems, and everything you need to start earning immediately. <span className="highlight-text">Zero experience required.</span></p>
            
            <div className="cta-group">
              <a href="#proven-businesses" className="primary-cta glass-effect">
                <span className="cta-shine"></span>
                <span>Claim Your Business Now</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </a>
              <a href="#custom-business" className="secondary-cta glass-secondary">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                <span>Create Custom Business</span>
              </a>
            </div>

            <div className="hero-stats glass-stats">
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">⏱</div>
                <strong>12-24hrs</strong>
                <span>First Sale</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">📈</div>
                <strong>$3,247</strong>
                <span>Avg Monthly</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">✨</div>
                <strong>94%</strong>
                <span>Success Rate</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">👥</div>
                <strong>100+</strong>
                <span>Ready Buyers</span>
              </div>
            </div>

            <div className="trust-indicators glass-trust">
              <div className="avatar-stack">
                <Image src="https://i.pravatar.cc/40?img=12" alt="User" className="trust-avatar" width={40} height={40} />
                <Image src="https://i.pravatar.cc/40?img=25" alt="User" className="trust-avatar" width={40} height={40} />
                <Image src="https://i.pravatar.cc/40?img=33" alt="User" className="trust-avatar" width={40} height={40} />
                <Image src="https://i.pravatar.cc/40?img=42" alt="User" className="trust-avatar" width={40} height={40} />
                <Image src="https://i.pravatar.cc/40?img=68" alt="User" className="trust-avatar" width={40} height={40} />
                <div className="more-users">+{liveUsers - 5}</div>
              </div>
              <div className="trust-text">
                <span className="live-indicator pulse"></span>
                <span className="trust-message"><strong>{liveUsers}</strong> entrepreneurs actively earning right now</span>
              </div>
            </div>
          </div>
        </section>

        {/* Proven Businesses Section */}
        <section className="proven-businesses" id="proven-businesses">
          <div className="container">
            <div className="section-header">
              <div className="section-label pulse-label">🔥 Hot Opportunities</div>
              <h2 className="section-title">Pick Your <span className="gradient-text">Money-Making Machine</span></h2>
              <p className="section-subtitle">Each business is <strong>pre-tested</strong>, <strong>pre-optimized</strong>, and comes with <strong>real customers ready to pay</strong>. Just pick one and start earning.</p>
            </div>
            
            <div className="business-cards-grid">
              <div className="business-card featured glass-card">
                <div className="business-badge gradient-badge">🆕 TRENDING NOW</div>
                <div className="business-icon floating-icon">🎆</div>
                <h3>AI Career Accelerator</h3>
                <p className="business-description">Premium resume & LinkedIn optimization service. Charges $197-497 per client with 80% profit margins.</p>
                <div className="business-stats glass-stats-mini">
                  <div className="stat">
                    <strong>$4,850/mo</strong>
                    <span>Avg Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>16 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>96%</strong>
                    <span>Success</span>
                  </div>
                </div>
                <div className="customer-pool glow-box">
                  <span className="pool-icon animated-bounce">🎉</span>
                  <span>You get <strong>147 pre-qualified buyers</strong> ready to purchase immediately</span>
                </div>
                <a href="#" className="business-cta primary" onClick={(e) => { e.preventDefault(); openTallyPopup('AI Resume Writer'); }}>
                  Get This Business →
                </a>
              </div>

              <div className="business-card glass-card hover-lift">
                <div className="business-icon floating-icon">💪</div>
                <h3>Fitness Transformation Hub</h3>
                <p className="business-description">Personalized meal plans + workout programs. Subscription model earning $47-97/month per client.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>$2,850/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>24 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>88%</strong>
                    <span>Success Rate</span>
                  </div>
                </div>
                <div className="customer-pool">
                  <span className="pool-icon">👥</span>
                  <span>Includes a list of <strong>94 clients who need this service now</strong></span>
                </div>
                <a href="#" className="business-cta" onClick={(e) => { e.preventDefault(); openTallyPopup('Fitness Meal Plans'); }}>
                  Get This Business →
                </a>
              </div>

              <div className="business-card glass-card hover-lift">
                <div className="business-icon floating-icon">✨</div>
                <h3>Brand Identity Studio</h3>
                <p className="business-description">Complete branding packages (logo, colors, fonts). Charges $297-997 with 48-hour delivery.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>$4,200/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>12 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>95%</strong>
                    <span>Success Rate</span>
                  </div>
                </div>
                <div className="customer-pool">
                  <span className="pool-icon">👥</span>
                  <span>Includes a list of <strong>183 clients who need this service now</strong></span>
                </div>
                <a href="#" className="business-cta" onClick={(e) => { e.preventDefault(); openTallyPopup('Logo Design Service'); }}>
                  Get This Business →
                </a>
              </div>

              <div className="business-card glass-card hover-lift">
                <div className="business-icon floating-icon">🚀</div>
                <h3>Social Growth Engine</h3>
                <p className="business-description">Full social media management + growth hacking. Recurring $297-497/month per client.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>$1,950/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>36 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>84%</strong>
                    <span>Success Rate</span>
                  </div>
                </div>
                <div className="customer-pool">
                  <span className="pool-icon">👥</span>
                  <span>Includes a list of <strong>76 clients who need this service now</strong></span>
                </div>
                <a href="#" className="business-cta" onClick={(e) => { e.preventDefault(); openTallyPopup('Social Media Manager'); }}>
                  Get This Business →
                </a>
              </div>

              <div className="business-card glass-card hover-lift">
                <div className="business-icon floating-icon">🎯</div>
                <h3>B2B Revenue Machine</h3>
                <p className="business-description">Done-for-you lead generation for B2B companies. Premium service at $2K-5K/month per client.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>$5,600/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>48 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>78%</strong>
                    <span>Success Rate</span>
                  </div>
                </div>
                <div className="customer-pool">
                  <span className="pool-icon">👥</span>
                  <span>Includes a list of <strong>52 clients who need this service now</strong></span>
                </div>
                <a href="#" className="business-cta" onClick={(e) => { e.preventDefault(); openTallyPopup('B2B Lead Generation'); }}>
                  Get This Business →
                </a>
              </div>

              <div className="business-card glass-card hover-lift">
                <div className="business-icon floating-icon">🏰</div>
                <h3>Real Estate Visual Magic</h3>
                <p className="business-description">Virtual staging + property enhancement. Charges $97-297 per property with same-day delivery.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>$3,100/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>20 hours</strong>
                    <span>First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>90%</strong>
                    <span>Success Rate</span>
                  </div>
                </div>
                <div className="customer-pool">
                  <span className="pool-icon">👥</span>
                  <span>Includes a list of <strong>108 clients who need this service now</strong></span>
                </div>
                <a href="#" className="business-cta" onClick={(e) => { e.preventDefault(); openTallyPopup('Virtual Staging'); }}>
                  Get This Business →
                </a>
              </div>
            </div>

            <div className="custom-business-option glass-card" id="custom-business">
              <div className="custom-business-content">
                <div className="custom-icon">💡</div>
                <h3>Got Your Own Million-Dollar Idea?</h3>
                <p>Tell us your vision and we'll build a <strong>custom AI-powered business</strong> around it. Same guarantees, same results.</p>
                
                <div className="idea-input-container">
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="Describe your business idea in a few words..."
                      className="idea-input"
                      maxLength={100}
                    />
                    <button 
                      className="idea-submit-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const idea = input?.value || 'Custom Business';
                        openTallyPopup(`Custom: ${idea}`);
                      }}
                    >
                      <span>Build My Idea</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                  <div className="idea-examples">
                    <span className="examples-label">💭 Ideas:</span>
                    <button className="example-tag" onClick={(e) => {
                      const input = document.querySelector('.idea-input') as HTMLInputElement;
                      if (input) input.value = 'Pet grooming service';
                    }}>Pet grooming service</button>
                    <button className="example-tag" onClick={(e) => {
                      const input = document.querySelector('.idea-input') as HTMLInputElement;
                      if (input) input.value = 'Online tutoring platform';
                    }}>Online tutoring</button>
                    <button className="example-tag" onClick={(e) => {
                      const input = document.querySelector('.idea-input') as HTMLInputElement;
                      if (input) input.value = 'Local delivery service';
                    }}>Local delivery</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="problem-solution">
          <div className="container">
            <div className="section-header">
              <div className="section-label">The Breakthrough</div>
              <h2 className="section-title">Why Buying a Proven Business Changes Everything</h2>
              <p className="section-subtitle">Skip years of trial and error. Start with what already works.</p>
            </div>
            
            <div className="comparison-grid">
              <div className="comparison-card problem">
                <div className="card-icon">❌</div>
                <h3>Starting From Scratch</h3>
                <ul>
                  <li>Starting with zero customers and zero income</li>
                  <li>Wasting months hoping your idea works</li>
                  <li>Facing the 95% failure rate for new businesses</li>
                  <li>Burn through savings</li>
                  <li>Learn expensive lessons</li>
                </ul>
              </div>
              
              <div className="comparison-card solution">
                <div className="card-icon">✅</div>
                <h3>Buying Proven Business</h3>
                <ul>
                  <li>50-200 customers ready to buy</li>
                  <li>Proven model already profitable</li>
                  <li>92% success rate guaranteed</li>
                  <li>Revenue from day one</li>
                  <li>AI handles everything</li>
                </ul>
              </div>
            </div>
            
            <div className="difference-banner">
              <p><strong>The Magic:</strong> You're not gambling on a new idea. You're buying into a proven system with real customers waiting.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-it-works" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <div className="section-label">How It Works</div>
              <h2 className="section-title">Your Business Live in 30 Minutes</h2>
              <p className="section-subtitle">Choose proven business → Get customers → Make money. It's that simple.</p>
            </div>
            
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-marker">1</div>
                <div className="timeline-content">
                  <div className="timeline-time">5 minutes</div>
                  <h3>Choose Your Business</h3>
                  <p>Browse our proven businesses or describe your own idea. Each proven business comes with verified revenue data and customer pools.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">2</div>
                <div className="timeline-content">
                  <div className="timeline-time">15 minutes</div>
                  <h3>AI Clones & Customizes</h3>
                  <p>Our AI instantly creates your version with custom branding, optimized pricing, and personalized sales copy. Everything's ready to sell.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">3</div>
                <div className="timeline-content">
                  <div className="timeline-time">Immediately</div>
                  <h3>Customers Transferred</h3>
                  <p>50-200 pre-qualified customers are assigned to your business. These are real people who've already shown interest in your service.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">4</div>
                <div className="timeline-content">
                  <div className="timeline-time">24-48 hours</div>
                  <h3>First Sale Guaranteed</h3>
                  <p>AI reaches out to your customer pool with personalized offers. Your first sale typically happens within 24 hours or we pay you $100.</p>
                </div>
              </div>
            </div>

            {/* AI Automation Showcase */}
            <div className="automation-showcase">
              <h3>Your 24/7 AI Business Manager Does Everything:</h3>
              <div className="automation-grid">
                <div className="automation-item">
                  <span className="item-icon">🔍</span>
                  <span>Finds Ideal Customers</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">📧</span>
                  <span>Sends Personalized Outreach</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">💬</span>
                  <span>Handles All Conversations</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">💳</span>
                  <span>Processes Payments</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">📊</span>
                  <span>Optimizes Pricing</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">🎯</span>
                  <span>Runs Ad Campaigns</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">📈</span>
                  <span>Scales Revenue</span>
                </div>
                <div className="automation-item">
                  <span className="item-icon">🔄</span>
                  <span>A/B Tests Everything</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="proof-section" id="proof">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Real Results</div>
              <h2 className="section-title">Real People. <span className="gradient-text">Real Income.</span> Real Fast.</h2>
              <p className="section-subtitle">Join thousands who went from <strong>zero experience</strong> to <strong>consistent revenue</strong> in weeks, not years.</p>
            </div>
            
            <div className="testimonial-grid">
              <div className="testimonial-card featured">
                <div className="testimonial-header">
                  <Image src="https://i.pravatar.cc/60?img=7" alt="Sarah M." className="testimonial-avatar" width={60} height={60} />
                  <div>
                    <h4>Sarah Mitchell</h4>
                    <p>Former Teacher</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;I thought it was too good to be true... then <strong>36 hours later</strong> I made my first $97. Now I'm pulling <strong>$4,200/month on autopilot</strong>. The AI handles everything - I just check my bank account.&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>$4,200/mo</strong>
                    <span>Passive Income</span>
                  </div>
                  <div className="stat">
                    <strong>36 hours</strong>
                    <span>To First Sale</span>
                  </div>
                  <div className="stat">
                    <strong>0 hours</strong>
                    <span>Weekly Work</span>
                  </div>
                </div>
              </div>
              
              <div className="testimonial-card">
                <div className="testimonial-header">
                  <Image src="https://i.pravatar.cc/60?img=11" alt="David R." className="testimonial-avatar" width={60} height={60} />
                  <div>
                    <h4>David Rodriguez</h4>
                    <p>Marketing Manager</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;Every other platform just gives you tools. Launchfly gave me <strong>actual paying customers</strong>. Made my first sale in 24 hours, now I'm at <strong>$2,800/month</strong> working zero hours.&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>$2,800/mo</strong>
                    <span>Average Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>24 hours</strong>
                    <span>To First Sale</span>
                  </div>
                </div>
              </div>
              
              <div className="testimonial-card">
                <div className="testimonial-header">
                  <Image src="https://i.pravatar.cc/60?img=9" alt="Emma K." className="testimonial-avatar" width={60} height={60} />
                  <div>
                    <h4>Emma Kim</h4>
                    <p>Stay-at-Home Mom</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;The AI found a profitable niche I never would have thought of. Now I literally <strong>check once a week</strong> to see my profits growing. This is what <strong>true passive income</strong> looks like!&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>$1,850/mo</strong>
                    <span>Pure Profit</span>
                  </div>
                  <div className="stat">
                    <strong>30 min</strong>
                    <span>Total Setup</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="results-banner glass-banner">
              <div className="result-stat">
                <span className="result-icon">💵</span>
                <div>
                  <strong>$2,347</strong>
                  <span>Avg First 60 Days</span>
                </div>
              </div>
              <div className="result-divider"></div>
              <div className="result-stat">
                <span className="result-icon">🚀</span>
                <div>
                  <strong>87%</strong>
                  <span>Hit $1K Month One</span>
                </div>
              </div>
              <div className="result-divider"></div>
              <div className="result-stat">
                <span className="result-icon">⏰</span>
                <div>
                  <strong>&lt; 30 min</strong>
                  <span>Total Setup Time</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="pricing" id="pricing">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Simple Pricing</div>
              <h2 className="section-title">Start Making Money <span className="gradient-text">Before You Pay a Dime</span></h2>
              <p className="section-subtitle">We're so confident, we let you <strong>earn first, pay later</strong>. No credit card. No risk. Just profits.</p>
            </div>
            
            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="plan-header">
                  <h3>Starter</h3>
                  <p className="plan-tagline">Test with zero risk</p>
                </div>
                <div className="price-display">
                  <span className="price-currency">$</span>
                  <span className="price-number">0</span>
                  <span className="price-period">to start</span>
                </div>
                <div className="revenue-share glass-pill">Only 20% of profits</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span>Any proven business template</li>
                  <li><span className="feature-icon">✓</span>50-100 customers included</li>
                  <li><span className="feature-icon">✓</span>AI automation suite</li>
                  <li><span className="feature-icon">✓</span>48-hour sale guarantee</li>
                  <li><span className="feature-icon">✓</span>$1,000 revenue guarantee</li>
                  <li><span className="feature-icon">✓</span>Community support</li>
                </ul>
                <a href="#" className="plan-cta secondary" onClick={(e) => { e.preventDefault(); openTallyPopup('Starter'); }}>Start Free</a>
              </div>
              
              <div className="pricing-card popular">
                <div className="popular-badge">BEST VALUE</div>
                <div className="plan-header">
                  <h3>Professional</h3>
                  <p className="plan-tagline">Maximum profit potential</p>
                </div>
                <div className="price-display">
                  <span className="price-currency">$</span>
                  <span className="price-number">497</span>
                  <span className="price-period">lifetime access</span>
                </div>
                <div className="revenue-share glass-pill premium">Keep 90% of profits</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span><strong>Everything in Starter, plus:</strong></li>
                  <li><span className="feature-icon">✓</span>100-200 customers included</li>
                  <li><span className="feature-icon">✓</span>Priority customer allocation</li>
                  <li><span className="feature-icon">✓</span>Advanced AI optimization</li>
                  <li><span className="feature-icon">✓</span>Weekly strategy calls</li>
                  <li><span className="feature-icon">✓</span>Custom business option</li>
                </ul>
                <a href="#" className="plan-cta primary" onClick={(e) => { e.preventDefault(); openTallyPopup('Professional'); }}>Get Started Now</a>
              </div>
              
              <div className="pricing-card">
                <div className="plan-header">
                  <h3>Scale</h3>
                  <p className="plan-tagline">Multiple businesses</p>
                </div>
                <div className="price-display">
                  <span className="price-currency">$</span>
                  <span className="price-number">1,997</span>
                  <span className="price-period">one-time</span>
                </div>
                <div className="revenue-share">Only 5% revenue share</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span><strong>Everything in Professional, plus:</strong></li>
                  <li><span className="feature-icon">✓</span>Launch up to 5 businesses</li>
                  <li><span className="feature-icon">✓</span>200+ customers per business</li>
                  <li><span className="feature-icon">✓</span>White-label options</li>
                  <li><span className="feature-icon">✓</span>1-on-1 coaching</li>
                  <li><span className="feature-icon">✓</span>Custom integrations</li>
                </ul>
                <a href="#" className="plan-cta secondary" onClick={(e) => { e.preventDefault(); openTallyPopup('Scale'); }}>Contact Us</a>
              </div>
            </div>
            
            <div className="pricing-guarantee glass-guarantee">
              <div className="guarantee-icon">🔒</div>
              <div>
                <p><strong>You Own Everything:</strong> Your business, your customers, your revenue. Cancel anytime and keep it all.</p>
                <p className="guarantee-subtext">No hidden fees. No contracts. No BS.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Guarantee Section */}
        <section className="guarantee-section" id="guarantee">
          <div className="container">
            <div className="guarantee-wrapper">
              <div className="guarantee-header">
                <div className="guarantee-seal">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                  </svg>
                </div>
                <h2>Our Triple-Lock Guarantee</h2>
                <p>We&apos;re so confident in our system, we guarantee your success three ways:</p>
              </div>
              
              <div className="guarantee-grid">
                <div className="guarantee-item">
                  <div className="guarantee-number">1</div>
                  <h3>48-Hour Customer Guarantee</h3>
                  <p>Get your first paying customer within 48 hours or we pay you $100 cash. No questions asked.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">2</div>
                  <h3>$1,000 Revenue Guarantee</h3>
                  <p>Make at least $1,000 in your first 60 days or we work free until you do. That&apos;s our promise.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">3</div>
                  <h3>Zero Work Guarantee</h3>
                  <p>After the 30-minute setup, if you have to do any work to maintain your business, we refund everything.</p>
                </div>
              </div>
              
              <div className="guarantee-footer">
                <p><strong>Why can we guarantee this?</strong> Because our AI system works. 73% of users hit $1k in their first month. We only succeed when you do.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq" id="faq">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Questions Answered</div>
              <h2 className="section-title">Everything You Need to Know</h2>
            </div>
            
            <div className="faq-grid">
              <div className="faq-item">
                <button className="faq-question">
                  <span>Do I really not have to do any work?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>After the initial 30-minute setup, you literally do nothing. The AI finds customers, talks to them, sells to them, and handles everything. You just check your dashboard weekly to see your profits. We built this for people who want truly passive income.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>How can you guarantee customers in 48 hours?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Our AI doesn&apos;t just build a website and hope. It actively hunts for customers using proven methods: targeted outreach, paid ads, content marketing, and more. It&apos;s running 24/7 across multiple channels to find and convert buyers. We&apos;ve done this successfully 4,127+ times.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What makes this different from ChatGPT or other AI tools?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>ChatGPT writes copy. We deliver customers. Our AI doesn&apos;t just create content—it runs your entire business: finding leads, nurturing them, closing sales, processing payments, optimizing prices, scaling campaigns. It&apos;s the difference between a tool and a complete automated business system.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What if I have no skills or experience?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Perfect! 67% of our successful users had zero online business experience. The AI handles everything technical. You don&apos;t need to know marketing, sales, coding, or anything else. If you can answer 5 simple questions about your interests, you can have a profitable business.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>Is the $1,000 guarantee real? What&apos;s the catch?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>100% real, no catch. If you don&apos;t make $1,000 in 60 days, we keep working for free until you do. If you don&apos;t get a customer in 48 hours, we send you $100. We can guarantee this because our system works—and we only make money when you do.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>This seems too good to be true. What's the catch?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>There's no catch. We build and test dozens of online businesses internally. We find the customers, prove the business can make money, and then package it for a new owner. You get to skip all the risk and failure of the startup phase. We only make money when we successfully sell a profitable business, so it's in our interest to make sure you succeed from day one.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>Can I really start for $0?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Yes! Our Starter plan is completely free to begin. We only take a small percentage of revenue you actually make. No upfront costs, no credit card required to start, no hidden fees. We believe in our system so much that we only profit when you do.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Urgency Section */}
        <section className="urgency-section">
          <div className="container">
            <div className="urgency-wrapper">
              <div className="urgency-icon">⚡</div>
              <div className="urgency-content">
                <h3>Limited Capacity This Week</h3>
                <p>We can only properly support 50 new businesses per week to maintain our guarantee.</p>
                <div className="spots-counter">
                  <span className="spots-number" style={{ color: spotsLeft <= 5 ? '#ef4444' : undefined }}>{spotsLeft}</span>
                  <span className="spots-text">spots remaining</span>
                </div>
              </div>
              <div className="urgency-timer">
                <p>Next price increase in:</p>
                <div className="timer">
                  <span className="timer-unit"><span>{countdown.days}</span> days</span>
                  <span className="timer-unit"><span>{countdown.hours}</span> hrs</span>
                  <span className="timer-unit"><span>{countdown.minutes}</span> min</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta">
          <div className="container final-cta-content">
            <h2>Your Profitable Business is One Click Away</h2>
            <p>Join 4,127+ people already making passive income with AI. Set up once, profit forever.</p>
            
            <a href="#" className="primary-cta large" onClick={(e) => { e.preventDefault(); openTallyPopup(); }}>
              <span>Get My First Customer Now →</span>
            </a>
            
            <div className="final-trust">
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                </svg>
                <span>Start free, pay from profits</span>
              </div>
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                </svg>
                <span>Triple money-back guarantee</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <div className="container footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-icon">🚀</span>
                Launchfly
              </div>
              <p>AI-powered businesses that actually make money.</p>
              <div className="footer-social">
                <a href="#" aria-label="Twitter">𝕏</a>
                <a href="#" aria-label="LinkedIn">in</a>
                <a href="#" aria-label="YouTube">▶</a>
              </div>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <a href="#how-it-works">How It Works</a>
                <a href="#pricing">Pricing</a>
                <a href="#proof">Success Stories</a>
                <a href="#guarantee">Guarantee</a>
              </div>
              
              <div className="footer-column">
                <h4>Support</h4>
                <a href="#">Help Center</a>
                <a href="#">Contact Us</a>
                <a href="#">System Status</a>
                <a href="#">API Docs</a>
              </div>
              
              <div className="footer-column">
                <h4>Company</h4>
                <a href="#">About Us</a>
                <a href="#">Careers</a>
                <a href="#">Partners</a>
                <a href="#">Blog</a>
              </div>
              
              <div className="footer-column">
                <h4>Legal</h4>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Cookie Policy</a>
                <a href="#">Refund Policy</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2025 Launchfly AI. All rights reserved.</p>
            <p className="footer-disclaimer">Results not typical. Individual results vary based on effort and market conditions.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

// Declare global Tally interface for TypeScript
declare global {
  interface Window {
    Tally: {
      openPopup: (formId: string, options: any) => void;
    };
  }
}
