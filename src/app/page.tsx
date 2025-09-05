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
  const [spotsLeft, setSpotsLeft] = useState(12);
  const [liveUsers, setLiveUsers] = useState(89);
  const [recentSuccess, setRecentSuccess] = useState(142);
  const [countdown, setCountdown] = useState({ days: 2, hours: 14, minutes: 32 });

  // Generate session ID
  const [sessionId] = useState(() => 
    `session_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Navigation functions for new onboarding flow
  const handleGetStarted = (plan = 'starter', location = 'unknown') => {
    trackCTAClick('get_started', location, undefined, plan);
    router.push(`/onboarding?plan=${plan}`);
  };

  const handleSelectTemplate = (template: string, location = 'business_cards') => {
    trackCTAClick('select_template', location, template);
    router.push(`/onboarding?template=${encodeURIComponent(template)}`);
  };

  const handleCustomBusiness = (idea = '', location = 'custom_section') => {
    trackCTAClick('custom_business', location, undefined, undefined);
    if (idea) {
      router.push(`/onboarding/custom?idea=${encodeURIComponent(idea)}`);
    } else {
      router.push('/onboarding/custom');
    }
  };

  useEffect(() => {
    // Mark page as loaded
    setIsLoading(false);
    document.body.classList.add('loaded');
    
    // Header scroll effect with debounce
    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setHeaderScrolled(window.scrollY > 10);
      }, 10);
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

    // Intersection Observer for animations with better performance
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Unobserve after animation to improve performance
          observer.unobserve(entry.target);
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

    // Observe elements for animations with delay
    setTimeout(() => {
      const elementsToObserve = document.querySelectorAll('.timeline-item, .testimonial-card, .pricing-card, .guarantee-item, .faq-item, .business-card');
      elementsToObserve.forEach((el, index) => {
        // Add staggered animation delay
        (el as HTMLElement).style.setProperty('--card-index', index.toString());
        observer.observe(el);
      });
    }, 100);

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

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => {
      const newState = !prev;
      document.body.classList.toggle('menu-open', newState);
      // Prevent body scroll when menu is open
      document.body.style.overflow = newState ? 'hidden' : '';
      return newState;
    });
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
  }, []);
  
  // Handle escape key for mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        closeMobileMenu();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen, closeMobileMenu]);

  // Show loading state briefly
  if (isLoading) {
    return null;
  }
  
  return (
    <div className="launchfly-homepage">
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
            <button 
              className="nav-cta" 
              onClick={(e) => { 
                e.preventDefault(); 
                handleGetStarted('starter', 'header_nav'); 
              }}
              aria-label="Get started with Launchfly"
            >
              <span className="pulse-dot" aria-hidden="true"></span>
              Start free
            </button>
          </div>
          <button 
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`} 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </nav>
        <div className={`mobile-nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          <a href="#proven-businesses" className="mobile-nav-link" onClick={closeMobileMenu}>Browse Businesses</a>
          <a href="#how-it-works" className="mobile-nav-link" onClick={closeMobileMenu}>How It Works</a>
          <a href="#proof" className="mobile-nav-link" onClick={closeMobileMenu}>Success Stories</a>
          <a href="#pricing" className="mobile-nav-link" onClick={closeMobileMenu}>Pricing</a>
          <a href="#guarantee" className="mobile-nav-link" onClick={closeMobileMenu}>Guarantee</a>
          <button 
            className="mobile-nav-cta" 
            onClick={(e) => { 
              e.preventDefault(); 
              closeMobileMenu();
              handleGetStarted(); 
            }}
          >
            Get Started Now
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="container hero-content">
            <div className="hero-badge floating">
              <span className="badge-pulse"></span>
              <span className="badge-icon">🤖</span>
              <span><strong>{recentSuccess}</strong> businesses launched this week</span>
            </div>
            
            <h1 className="hero-title">
              <span className="title-line-1">Meet your AI Cofounder</span><br />
              <span className="gradient-text animated-gradient">Launch a validated service business in days</span>
            </h1>
            
            <p className="subtitle">Launch faster with an AI cofounder. It configures your funnel, outreach, and automations—so you can focus on decisions and delivery.</p>
            
            <div className="cta-group">
              <a 
                href="/templates" 
                className="primary-cta"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/templates');
                }}
              >
                <span className="cta-shine" aria-hidden="true"></span>
                <span>Browse Business Templates</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </a>
              <a 
                href="#custom-business" 
                className="secondary-cta glass-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById('custom-business');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                <span>Create Custom Business</span>
              </a>
            </div>

            <div className="hero-stats glass-stats">
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">⏱</div>
                <strong>Fast</strong>
                <span>Setup</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">📈</div>
                <strong>Automated</strong>
                <span>Outreach</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">✨</div>
                <strong>Guided</strong>
                <span>Playbooks</span>
              </div>
              <div className="stat-item pulse-on-hover">
                <div className="stat-icon">👥</div>
                <strong>Lead</strong>
                <span>Inbox</span>
              </div>
            </div>

            <div className="trust-indicators glass-trust">
              <div className="avatar-stack">
                <Image 
                  src="https://i.pravatar.cc/40?img=12" 
                  alt="User" 
                  className="trust-avatar" 
                  width={40} 
                  height={40}
                  loading="eager"
                  unoptimized
                />
                <Image src="https://i.pravatar.cc/40?img=25" alt="User" className="trust-avatar" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=33" alt="User" className="trust-avatar" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=42" alt="User" className="trust-avatar" width={40} height={40} unoptimized />
                <Image src="https://i.pravatar.cc/40?img=68" alt="User" className="trust-avatar" width={40} height={40} unoptimized />
                <div className="more-users">+{liveUsers - 5}</div>
              </div>
              <div className="trust-text">
                <span className="live-indicator pulse"></span>
                <span className="trust-message"><strong>{liveUsers}</strong> entrepreneurs active right now</span>
              </div>
            </div>
          </div>
        </section>

        {/* Proven Businesses Section */}
        <section className="proven-businesses" id="proven-businesses">
          <div className="container">
            <div className="section-header">
              <div className="section-label pulse-label">Templates</div>
              <h2 className="section-title">Choose a <span className="gradient-text">validated template</span></h2>
              <p className="section-subtitle">Each template includes a conversion‑ready funnel and automations. Customize and go live fast.</p>
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
                <button 
                  className="business-cta primary" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('ai-career'); 
                  }}
                  aria-label="Get AI Career Accelerator business"
                >
                  Get This Business →
                </button>
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
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('fitness'); 
                  }}
                  aria-label="Get Fitness Transformation Hub business"
                >
                  Get This Business →
                </button>
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
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('branding'); 
                  }}
                  aria-label="Get Brand Identity Studio business"
                >
                  Get This Business →
                </button>
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
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('social'); 
                  }}
                  aria-label="Get Social Growth Engine business"
                >
                  Get This Business →
                </button>
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
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('b2b'); 
                  }}
                  aria-label="Get B2B Revenue Machine business"
                >
                  Get This Business →
                </button>
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
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('realestate'); 
                  }}
                  aria-label="Get Real Estate Visual Magic business"
                >
                  Get This Business →
                </button>
              </div>
            </div>

            <div className="browse-all-templates">
              <button 
                className="browse-templates-link primary-cta"
                onClick={(e) => { 
                  e.preventDefault(); 
                  router.push('/templates');
                }}
                aria-label="Browse all business templates"
              >
                <span className="cta-shine"></span>
                Browse All Templates →
              </button>
            </div>

            <div className="custom-business-option glass-card" id="custom-business">
              <div className="custom-business-content">
                <div className="custom-icon">💡</div>
                <h3>Have your own idea?</h3>
                <p>Tell us your vision and we’ll configure a <strong>custom AI‑powered operating system</strong> around it.</p>
                
                <div className="idea-input-container">
                  <div className="input-group">
                    <textarea 
                      placeholder="Describe your business idea in a few words..."
                      className="idea-input"
                      maxLength={200}
                      rows={3}
                      aria-label="Enter your business idea"
                    />
                    <button 
                      className="idea-submit-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                        const idea = input?.value || '';
                        handleCustomBusiness(idea);
                      }}
                      aria-label="Build your custom business idea"
                    >
                      <span>Build My Idea</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                  <div className="idea-examples">
                    <span className="examples-label">💭 Ideas:</span>
                    <button className="example-tag"                       onClick={() => {
                        const input = document.querySelector('.idea-input') as HTMLInputElement;
                        if (input) {
                          input.value = 'Pet grooming service';
                          input.focus();
                        }
                    }}
                    aria-label="Use Pet grooming service as business idea"
                    >Pet grooming service</button>
                    <button className="example-tag" onClick={() => {
                      const input = document.querySelector('.idea-input') as HTMLInputElement;
                      if (input) {
                        input.value = 'Online tutoring platform';
                        input.focus();
                      }
                    }}
                    aria-label="Use Online tutoring platform as business idea"
                    >Online tutoring</button>
                    <button className="example-tag" onClick={() => {
                      const input = document.querySelector('.idea-input') as HTMLInputElement;
                      if (input) {
                        input.value = 'Local delivery service';
                        input.focus();
                      }
                    }}
                    aria-label="Use Local delivery service as business idea"
                    >Local delivery</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="problem-solution" id="problem-solution">
          <div className="container">
            <div className="section-header">
              <div className="section-label pulse-label">Manual vs AI‑assisted</div>
              <h2 className="section-title">Two paths. <span className="gradient-text">Choose AI‑assisted.</span></h2>
              <p className="section-subtitle">See how AI speeds up validation, outreach, and operations—without the usual guesswork.</p>
            </div>
            
            <div className="transformation-container glass-effect">
              <div className="pathway old-way">
                <div className="pathway-header">
                  <div className="pathway-icon-bg">
                    <span className="pathway-icon">😫</span>
                  </div>
                  <h3>Starting from scratch</h3>
                  <div className="pathway-tag tag-danger">The Hard Path</div>
                </div>
                <ul className="pathway-list">
                  <li>
                    <span className="list-icon">❌</span>
                    <p><strong>No customers at the start</strong><br/>Start from nothing and hope people care.</p>
                  </li>
                  <li>
                    <span className="list-icon">❌</span>
                    <p><strong>Months of Guesswork</strong><br/>Waste time and money on an unproven idea.</p>
                  </li>
                  <li>
                    <span className="list-icon">❌</span>
                    <p><strong>High failure risk</strong><br/>Hard to validate quickly without data.</p>
                  </li>
                  <li>
                    <span className="list-icon">❌</span>
                    <p><strong>Expensive Lessons</strong><br/>Burn through your savings to learn what works.</p>
                  </li>
                </ul>
              </div>

              <div className="transformation-divider">
                <div className="vs-circle">VS</div>
                <div className="pathway-line"></div>
              </div>

              <div className="pathway new-way">
                <div className="pathway-header">
                  <div className="pathway-icon-bg">
                    <span className="pathway-icon">😎</span>
                  </div>
                  <h3>Launch with AI assistance</h3>
                  <div className="pathway-tag tag-success">The Smart Path</div>
                </div>
                <ul className="pathway-list">
                  <li>
                    <span className="list-icon">✅</span>
                    <p><strong>Pre‑qualified lead lists</strong><br/>Reach relevant buyers from day one.</p>
                  </li>
                  <li>
                    <span className="list-icon">✅</span>
                    <p><strong>Validated model & playbooks</strong><br/>Start with funnels and offers that convert.</p>
                  </li>
                  <li>
                    <span className="list-icon">✅</span>
                    <p><strong>Clear milestones</strong><br/>Guidance and support if timelines slip.</p>
                  </li>
                  <li>
                    <span className="list-icon">✅</span>
                    <p><strong>Automation for routine tasks</strong><br/>AI handles outreach, follow‑ups, and ops.</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-it-works" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <div className="section-label">How it works</div>
              <h2 className="section-title">Go live fast with your AI cofounder</h2>
              <p className="section-subtitle">Pick a template → Configure your stack → Start engaging leads.</p>
            </div>
            
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-marker">1</div>
                <div className="timeline-content">
                  <div className="timeline-time">Step 1</div>
                  <h3>Pick a template or share your idea</h3>
                  <p>Browse templates or describe your idea. We’ll align on goals and niche fit.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">2</div>
                <div className="timeline-content">
                  <div className="timeline-time">Step 2</div>
                  <h3>AI configures your stack</h3>
                  <p>Branding, funnel, outreach sequences, CRM, and payments—ready to run.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">3</div>
                <div className="timeline-content">
                  <div className="timeline-time">Step 3</div>
                  <h3>Start engaging leads</h3>
                  <p>Your funnel and outreach begin working. Track conversations in one inbox.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">4</div>
                <div className="timeline-content">
                  <div className="timeline-time">Step 4</div>
                  <h3>Launch and iterate</h3>
                  <p>Review performance and let AI optimize pricing, offers, and campaigns over time.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Automation Showcase */}
        <section className="ai-automation-hub-section">
          <div className="ai-automation-hub">
            <div className="container">
              <div className="hub-header">
                <h3>What your AI cofounder handles</h3>
              </div>
              <div className="automation-network">
                <div className="central-hub">
                  <div className="hub-logo">
                    <span className="logo-icon">⚡</span>
                    <span>Launchfly AI</span>
                  </div>
                </div>

                <div className="automation-groups">
                  <div className="automation-group group-top">
                    <h4 className="group-label">LEAD GENERATION</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-1">
                        <div className="node-content" data-label="Finds Ideal Customers">
                          <span className="node-icon">🔍</span>
                          <span className="node-label">Finds Ideal Customers</span>
                        </div>
                      </div>
                      <div className="automation-node node-2">
                        <div className="node-content" data-label="Sends Outreach">
                          <span className="node-icon">📧</span>
                          <span className="node-label">Sends Outreach</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-right">
                    <h4 className="group-label">GROWTH</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-3">
                        <div className="node-content" data-label="Scales Revenue">
                          <span className="node-icon">📈</span>
                          <span className="node-label">Scales Revenue</span>
                        </div>
                      </div>
                      <div className="automation-node node-4">
                        <div className="node-content" data-label="Runs Ad Campaigns">
                          <span className="node-icon">🎯</span>
                          <span className="node-label">Runs Ad Campaigns</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-bottom">
                    <h4 className="group-label">OPTIMIZATION</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-5">
                        <div className="node-content" data-label="Optimizes Pricing">
                          <span className="node-icon">📊</span>
                          <span className="node-label">Optimizes Pricing</span>
                        </div>
                      </div>
                      <div className="automation-node node-6">
                        <div className="node-content" data-label="A/B Tests Everything">
                          <span className="node-icon">🔄</span>
                          <span className="node-label">A/B Tests Everything</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-left">
                    <h4 className="group-label">SALES</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-7">
                        <div className="node-content" data-label="Handles Conversations">
                          <span className="node-icon">💬</span>
                          <span className="node-label">Handles Conversations</span>
                        </div>
                      </div>
                      <div className="automation-node node-8">
                        <div className="node-content" data-label="Processes Payments">
                          <span className="node-icon">💳</span>
                          <span className="node-label">Processes Payments</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="proof-section" id="proof">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Real stories</div>
              <h2 className="section-title">Real founders. <span className="gradient-text">Real results.</span></h2>
              <p className="section-subtitle">How people launched faster with AI help. Individual outcomes vary based on niche and effort.</p>
            </div>
            
            <div className="testimonial-grid">
              <div className="testimonial-card featured">
                <div className="testimonial-header">
                  <Image 
                    src="https://i.pravatar.cc/60?img=7" 
                    alt="Sarah M." 
                    className="testimonial-avatar" 
                    width={60} 
                    height={60}
                    loading="lazy"
                    unoptimized
                  />
                  <div>
                    <h4>Sarah Mitchell</h4>
                    <p>Former Teacher</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;I launched far faster than I expected. The AI took care of outreach and follow‑ups so I could focus on approvals and delivery.&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>Faster launch</strong>
                    <span>From idea to live</span>
                  </div>
                  <div className="stat">
                    <strong>First leads</strong>
                    <span>Arrived quickly</span>
                  </div>
                  <div className="stat">
                    <strong>Light</strong>
                    <span>Weekly review</span>
                  </div>
                </div>
              </div>
              
              <div className="testimonial-card">
                <div className="testimonial-header">
                  <Image 
                    src="https://i.pravatar.cc/60?img=11" 
                    alt="David R." 
                    className="testimonial-avatar" 
                    width={60} 
                    height={60}
                    loading="lazy"
                    unoptimized
                  />
                  <div>
                    <h4>David Rodriguez</h4>
                    <p>Marketing Manager</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;Every other platform just gives you pieces. Launchfly connected everything and kept me on track with clear next steps.&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>Clarity</strong>
                    <span>End‑to‑end setup</span>
                  </div>
                  <div className="stat">
                    <strong>Momentum</strong>
                    <span>Faster first wins</span>
                  </div>
                </div>
              </div>
              
              <div className="testimonial-card">
                <div className="testimonial-header">
                  <Image 
                    src="https://i.pravatar.cc/60?img=9" 
                    alt="Emma K." 
                    className="testimonial-avatar" 
                    width={60} 
                    height={60}
                    loading="lazy"
                    unoptimized
                  />
                  <div>
                    <h4>Emma Kim</h4>
                    <p>Stay-at-Home Mom</p>
                    <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                  </div>
                </div>
                <p className="testimonial-text">&quot;The AI highlighted a niche I hadn’t considered and kept improving my offers with small, evidence‑based tweaks.&quot;</p>
                <div className="testimonial-stats">
                  <div className="stat">
                    <strong>Better fit</strong>
                    <span>Niche discovery</span>
                  </div>
                  <div className="stat">
                    <strong>Continuous</strong>
                    <span>Optimization</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="results-banner glass-banner">
              <div className="result-stat">
                <span className="result-icon">⚡</span>
                <div>
                  <strong>Fast setup</strong>
                  <span>Typical under a day</span>
                </div>
              </div>
              <div className="result-divider"></div>
              <div className="result-stat">
                <span className="result-icon">🔁</span>
                <div>
                  <strong>Automations</strong>
                  <span>Outreach & ops</span>
                </div>
              </div>
              <div className="result-divider"></div>
              <div className="result-stat">
                <span className="result-icon">🔒</span>
                <div>
                  <strong>Ownership</strong>
                  <span>You own assets</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="pricing" id="pricing">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Pricing</div>
              <h2 className="section-title">Simple pricing <span className="gradient-text">that scales with you</span></h2>
              <p className="section-subtitle">Start free. Upgrade when you’re ready.</p>
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
                <div className="revenue-share glass-pill">Flexible revenue share</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span>Access to starter templates</li>
                  <li><span className="feature-icon">✓</span>AI automation suite</li>
                  <li><span className="feature-icon">✓</span>Setup wizard</li>
                  <li><span className="feature-icon">✓</span>Community support</li>
                </ul>
                <button 
                className="plan-cta secondary" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  handleGetStarted('starter'); 
                }}
                aria-label="Start with Starter plan for free"
              >
                Start Free
              </button>
              </div>
              
              <div className="pricing-card popular">
                <div className="popular-badge">BEST VALUE</div>
                <div className="pricing-card-inner">
                  <div className="plan-header">
                    <h3>Professional</h3>
                    <p className="plan-tagline">Maximum profit potential</p>
                  </div>
                  <div className="price-display">
                    <span className="price-currency">$</span>
                    <span className="price-number">497</span>
                    <span className="price-period">lifetime access</span>
                  </div>
                  <div className="revenue-share glass-pill premium">Keep more of your profits</div>
                  <ul className="plan-features">
                    <li><span className="feature-icon">✓</span><strong>Everything in Starter, plus:</strong></li>
                    <li><span className="feature-icon">✓</span>Unlock all premium templates</li>
                    <li><span className="feature-icon">✓</span>Build a custom business with AI</li>
                    <li><span className="feature-icon">✓</span>Advanced automations & optimization</li>
                    <li><span className="feature-icon">✓</span>Priority support</li>
                  </ul>
                  <button 
                    className="plan-cta primary" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      handleGetStarted('professional'); 
                    }}
                    aria-label="Get started with Professional plan"
                  >
                    Get Started Now
                  </button>
                </div>
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
                <div className="revenue-share">Low revenue share</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span><strong>Everything in Professional, plus:</strong></li>
                  <li><span className="feature-icon">✓</span>Launch up to 5 businesses</li>
                  <li><span className="feature-icon">✓</span>Multi‑business management</li>
                  <li><span className="feature-icon">✓</span>White‑label options</li>
                  <li><span className="feature-icon">✓</span>1‑on‑1 coaching</li>
                  <li><span className="feature-icon">✓</span>Custom integrations</li>
                </ul>
                <button 
                  className="plan-cta secondary" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleGetStarted('scale'); 
                  }}
                  aria-label="Contact us about Scale plan"
                >
                  Contact Us
                </button>
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

        {/* Success Milestones Section */}
        <section className="guarantee-section" id="guarantee">
          <div className="container">
            <div className="guarantee-wrapper">
              <div className="guarantee-header">
                <div className="guarantee-seal">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                  </svg>
                </div>
                <h2>Clear Success Milestones</h2>
                <p>We align on milestones and support you to reach them. If timelines slip, we extend help and resources.</p>
              </div>
              
              <div className="guarantee-grid">
                <div className="guarantee-item">
                  <div className="guarantee-number">1</div>
                  <h3>Go‑live milestone</h3>
                  <p>Get your funnel, outreach, and payments live quickly with hands‑on guidance.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">2</div>
                  <h3>First‑lead milestone</h3>
                  <p>If first qualified leads take longer than expected, we add playbooks and extra support.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">3</div>
                  <h3>Optimization support</h3>
                  <p>We keep tuning pricing, offers, and campaigns with you as data comes in.</p>
                </div>
              </div>
              
              <div className="guarantee-footer">
                <p><strong>Why this works:</strong> We only succeed when your business is active and growing. Our incentives are aligned with yours.</p>
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
                  <span>How much work is required?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Expect a light weekly review cadence. The AI handles outreach, follow‑ups, and day‑to‑day ops. You review decisions, approve messaging, and handle delivery when needed.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>How fast will I see results?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Timing varies by niche and offer. Many users start engaging leads within days. If milestones take longer than expected, we extend support and provide additional playbooks.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What makes this different from ChatGPT or other AI tools?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>ChatGPT writes copy. We deliver an operating system: lead sourcing, personalized outreach, deal tracking, payments, pricing optimization, and campaign scaling—integrated end‑to‑end.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What if I have no skills or experience?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>You don’t need to know marketing or code. The AI configures the stack and suggests next steps. You’ll review key decisions and focus on your strengths.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What happens if milestones are delayed?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>We extend help. That can include additional playbooks, campaign reviews, and configuration support—at no extra cost.</p>
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
                  <p>Yes. Our Starter plan is free to begin. You can upgrade for advanced features when you’re ready.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capacity Section */}
        <section className="urgency-section">
          <div className="container">
            <div className="urgency-wrapper">
              <div className="urgency-icon">⚡</div>
              <div className="urgency-content">
                <h3>Limited onboarding each week</h3>
                <p>We open a limited number of onboarding slots each week to maintain quality.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta">
          <div className="container final-cta-content">
            <h2>Launch faster with your AI cofounder</h2>
            <p>Start free—see it build with you.</p>
            
            <button 
              className="primary-cta large" 
              onClick={(e) => { 
                e.preventDefault(); 
                handleGetStarted('starter', 'final_cta'); 
              }}
              aria-label="Start getting customers with Launchfly"
            >
              <span>Start free</span>
            </button>
            
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
                <span>Start free, upgrade when ready</span>
              </div>
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                </svg>
                <span>Clear success milestones</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer role="contentinfo">
        <div className="container footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-icon">🚀</span>
                Launchfly
              </div>
              <p>AI cofounder for your service business.</p>
                              <div className="footer-social">
                <a href="#" aria-label="Follow us on Twitter" rel="noopener noreferrer">𝕏</a>
                <a href="#" aria-label="Follow us on LinkedIn" rel="noopener noreferrer">in</a>
                <a href="#" aria-label="Subscribe on YouTube" rel="noopener noreferrer">▶</a>
              </div>
            </div>
            
            <div className="footer-links" role="navigation" aria-label="Footer navigation">
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
    </div>
  );
}


