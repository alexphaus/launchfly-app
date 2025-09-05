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
  // Removed fake urgency states

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

    // Removed dynamic counters for trust

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
      // Cleanup removed
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
              Start Free
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
            <div className="hero-badge">
              <span className="badge-icon">New</span>
              <span>AI-Powered Business Automation</span>
            </div>
            
            <h1 className="hero-title">
              <span className="gradient-text">Meet Your AI Cofounder</span>
            </h1>
            
            <p className="subtitle">Launch a validated service business in days. AI handles lead generation, follow-ups, and operations—so you can focus on strategic decisions and delivery.</p>
            
            <div className="cta-group">
              <a 
                href="/onboarding" 
                className="primary-cta"
                onClick={(e) => {
                  e.preventDefault();
                  handleGetStarted('starter', 'hero');
                }}
              >
                <span>Start Free</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </a>
              <a 
                href="/templates" 
                className="secondary-cta"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/templates');
                }}
              >
                <span>Browse Templates</span>
              </a>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <strong>Lead Gen</strong>
                <span>Automated</span>
              </div>
              <div className="stat-item">
                <strong>Follow-ups</strong>
                <span>AI-Powered</span>
              </div>
              <div className="stat-item">
                <strong>Operations</strong>
                <span>Streamlined</span>
              </div>
              <div className="stat-item">
                <strong>Support</strong>
                <span>24/7 Available</span>
              </div>
            </div>

            <div className="trust-indicators">
              <p className="trust-text">Built with leading LLM APIs • Methodology available</p>
            </div>
          </div>
        </section>

        {/* Business Templates Section */}
        <section className="proven-businesses" id="proven-businesses">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Business Templates</div>
              <h2 className="section-title">Choose Your <span className="gradient-text">Service Business Model</span></h2>
              <p className="section-subtitle">Select from validated business templates with <strong>proven demand</strong>. Each includes automation tools and lead generation strategies.</p>
            </div>
            
            <div className="business-cards-grid">
              <div className="business-card featured">
                <div className="business-badge">Popular</div>
                <h3>Career Services</h3>
                <p className="business-description">Resume optimization and LinkedIn profile enhancement service with AI-powered tools.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>High Demand</strong>
                    <span>Service Type</span>
                  </div>
                  <div className="stat">
                    <strong>B2C</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>Scalable</strong>
                    <span>Model</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: AI copywriting tools, client CRM, automated scheduling</p>
                </div>
                <button 
                  className="business-cta primary" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('ai-career'); 
                  }}
                  aria-label="Select Career Services template"
                >
                  Select Template →
                </button>
              </div>

              <div className="business-card">
                <h3>Fitness Coaching</h3>
                <p className="business-description">Personalized fitness plans and nutrition guidance delivered through automated systems.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>Subscription</strong>
                    <span>Revenue Model</span>
                  </div>
                  <div className="stat">
                    <strong>B2C</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>Recurring</strong>
                    <span>Income Type</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: Client portal, meal plan generator, progress tracking</p>
                </div>
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('fitness'); 
                  }}
                  aria-label="Select Fitness Coaching template"
                >
                  Select Template →
                </button>
              </div>

              <div className="business-card">
                <h3>Brand Design Services</h3>
                <p className="business-description">Complete branding packages including logo design, color palettes, and brand guidelines.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>Project-Based</strong>
                    <span>Revenue Model</span>
                  </div>
                  <div className="stat">
                    <strong>B2B</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>One-Time</strong>
                    <span>Payment</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: Design templates, client portal, revision management</p>
                </div>
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('branding'); 
                  }}
                  aria-label="Select Brand Design template"
                >
                  Select Template →
                </button>
              </div>

              <div className="business-card">
                <h3>Social Media Management</h3>
                <p className="business-description">Comprehensive social media services including content creation and community management.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>Retainer</strong>
                    <span>Revenue Model</span>
                  </div>
                  <div className="stat">
                    <strong>B2B</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>Monthly</strong>
                    <span>Billing</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: Content calendar, scheduling tools, analytics dashboard</p>
                </div>
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('social'); 
                  }}
                  aria-label="Select Social Media template"
                >
                  Select Template →
                </button>
              </div>

              <div className="business-card">
                <h3>B2B Lead Generation</h3>
                <p className="business-description">Targeted lead generation services for B2B companies using AI-powered outreach.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>Performance</strong>
                    <span>Pricing Model</span>
                  </div>
                  <div className="stat">
                    <strong>B2B</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>Results-Based</strong>
                    <span>Billing</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: Lead database, email automation, CRM integration</p>
                </div>
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('b2b'); 
                  }}
                  aria-label="Select B2B Lead Gen template"
                >
                  Select Template →
                </button>
              </div>

              <div className="business-card">
                <h3>Real Estate Services</h3>
                <p className="business-description">Virtual staging and property photography enhancement for real estate professionals.</p>
                <div className="business-stats">
                  <div className="stat">
                    <strong>Per-Project</strong>
                    <span>Pricing Model</span>
                  </div>
                  <div className="stat">
                    <strong>B2B</strong>
                    <span>Market</span>
                  </div>
                  <div className="stat">
                    <strong>Fast Delivery</strong>
                    <span>Service</span>
                  </div>
                </div>
                <div className="business-features">
                  <p>Includes: AI editing tools, client portal, bulk processing</p>
                </div>
                <button 
                  className="business-cta" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleSelectTemplate('realestate'); 
                  }}
                  aria-label="Select Real Estate template"
                >
                  Select Template →
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

            <div className="custom-business-option" id="custom-business">
              <div className="custom-business-content">
                <h3>Have a Specific Business Idea?</h3>
                <p>Share your service business concept and we’ll help you validate and automate it with AI tools.</p>
                
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
                    <span className="examples-label">Examples:</span>
                    <button className="example-tag" onClick={() => {
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
              <div className="section-label">How We Help</div>
              <h2 className="section-title">Traditional vs <span className="gradient-text">AI-Powered Approach</span></h2>
              <p className="section-subtitle">See how AI automation transforms the way you build and run a service business.</p>
            </div>
            
            <div className="transformation-container glass-effect">
              <div className="pathway old-way">
                <div className="pathway-header">
                  <h3>Traditional Approach</h3>
                  <div className="pathway-tag">Manual Process</div>
                </div>
                <ul className="pathway-list">
                  <li>
                    <p><strong>Manual Outreach</strong><br/>Spend hours finding and contacting potential clients.</p>
                  </li>
                  <li>
                    <p><strong>Time-Intensive Setup</strong><br/>Weeks to months building systems and processes.</p>
                  </li>
                  <li>
                    <p><strong>Trial and Error</strong><br/>Test different approaches to find what works.</p>
                  </li>
                  <li>
                    <p><strong>Limited Scale</strong><br/>Growth limited by your available time.</p>
                  </li>
                </ul>
              </div>

              <div className="transformation-divider">
                <div className="vs-circle">VS</div>
                <div className="pathway-line"></div>
              </div>

              <div className="pathway new-way">
                <div className="pathway-header">
                  <h3>With AI Cofounder</h3>
                  <div className="pathway-tag tag-success">Automated Process</div>
                </div>
                <ul className="pathway-list">
                  <li>
                    <p><strong>Automated Lead Generation</strong><br/>AI finds and qualifies leads from approved sources.</p>
                  </li>
                  <li>
                    <p><strong>Quick Launch</strong><br/>Get operational in days with pre-built systems.</p>
                  </li>
                  <li>
                    <p><strong>Data-Driven Optimization</strong><br/>AI continuously improves based on results.</p>
                  </li>
                  <li>
                    <p><strong>Scalable by Design</strong><br/>Handle more clients without more work.</p>
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
              <div className="section-label">How It Works</div>
              <h2 className="section-title">Launch Your Business in 3 Steps</h2>
              <p className="section-subtitle">From idea to operational business with AI-powered automation.</p>
            </div>
            
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-marker">1</div>
                <div className="timeline-content">
                  <h3>Pick a Template or Share Your Idea</h3>
                  <p>Select from validated business templates or describe your service concept. We’ll help you assess market demand and viability.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">2</div>
                <div className="timeline-content">
                  <h3>AI Configures Your Systems</h3>
                  <p>Your AI cofounder sets up automated funnels, outreach sequences, and client management tools tailored to your business model.</p>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-marker">3</div>
                <div className="timeline-content">
                  <h3>Start Engaging Leads</h3>
                  <p>Begin outreach to potential clients using AI-powered tools. Iterate based on response data and AI suggestions to optimize conversion.</p>
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
                <h3>What Your AI Cofounder Handles</h3>
              </div>
              <div className="automation-network">
                <div className="central-hub">
                  <div className="hub-logo">
                    <span>AI Cofounder</span>
                  </div>
                </div>

                <div className="automation-groups">
                  <div className="automation-group group-top">
                    <h4 className="group-label">LEAD GENERATION</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-1">
                        <div className="node-content" data-label="Lead Qualification">
                          <span className="node-label">Lead Qualification</span>
                        </div>
                      </div>
                      <div className="automation-node node-2">
                        <div className="node-content" data-label="Personalized Outreach">
                          <span className="node-label">Personalized Outreach</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-right">
                    <h4 className="group-label">GROWTH</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-3">
                        <div className="node-content" data-label="Performance Tracking">
                          <span className="node-label">Performance Tracking</span>
                        </div>
                      </div>
                      <div className="automation-node node-4">
                        <div className="node-content" data-label="Campaign Management">
                          <span className="node-label">Campaign Management</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-bottom">
                    <h4 className="group-label">OPTIMIZATION</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-5">
                        <div className="node-content" data-label="Price Optimization">
                          <span className="node-label">Price Optimization</span>
                        </div>
                      </div>
                      <div className="automation-node node-6">
                        <div className="node-content" data-label="A/B Testing">
                          <span className="node-label">A/B Testing</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="automation-group group-left">
                    <h4 className="group-label">SALES</h4>
                    <div className="group-nodes">
                      <div className="automation-node node-7">
                        <div className="node-content" data-label="Follow-up Automation">
                          <span className="node-label">Follow-up Automation</span>
                        </div>
                      </div>
                      <div className="automation-node node-8">
                        <div className="node-content" data-label="Payment Processing">
                          <span className="node-label">Payment Processing</span>
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
              <div className="section-label">Success Stories</div>
              <h2 className="section-title">Customer <span className="gradient-text">Success Stories</span></h2>
              <p className="section-subtitle">Real results from entrepreneurs using our AI-powered business platform.</p>
            </div>
            
            <div className="testimonial-placeholder">
              <div className="placeholder-content">
                <h3>Coming Soon</h3>
                <p>We're currently collecting feedback from our early adopters. Check back soon for real customer success stories and case studies.</p>
                <p className="placeholder-cta">Want to be featured? <a href="/onboarding">Start your business today</a></p>
              </div>
            </div>
            
            <div className="methodology-link">
              <p><a href="#methodology">View our methodology</a> for tracking and reporting customer results.</p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="pricing" id="pricing">
          <div className="container">
            <div className="section-header">
              <div className="section-label">Pricing</div>
              <h2 className="section-title">Simple, <span className="gradient-text">Transparent Pricing</span></h2>
              <p className="section-subtitle">Choose the plan that fits your business goals. Start free or unlock more features.</p>
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
                <div className="revenue-share">20% revenue share</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span>Access to starter templates</li>
                  <li><span className="feature-icon">✓</span>Basic lead generation tools</li>
                  <li><span className="feature-icon">✓</span>AI automation basics</li>
                  <li><span className="feature-icon">✓</span>Email support</li>
                  <li><span className="feature-icon">✓</span>Community access</li>
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
                  <div className="revenue-share premium">10% revenue share</div>
                  <ul className="plan-features">
                    <li><span className="feature-icon">✓</span><strong>Everything in Starter, plus:</strong></li>
                    <li><span className="feature-icon">✓</span>All premium templates</li>
                    <li><span className="feature-icon">✓</span>Custom business builder</li>
                    <li><span className="feature-icon">✓</span>Advanced lead generation</li>
                    <li><span className="feature-icon">✓</span>Priority support</li>
                    <li><span className="feature-icon">✓</span>AI optimization tools</li>
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
                <div className="revenue-share">5% revenue share</div>
                <ul className="plan-features">
                  <li><span className="feature-icon">✓</span><strong>Everything in Professional, plus:</strong></li>
                  <li><span className="feature-icon">✓</span>Multiple business licenses</li>
                  <li><span className="feature-icon">✓</span>Enterprise lead sources</li>
                  <li><span className="feature-icon">✓</span>White-label options</li>
                  <li><span className="feature-icon">✓</span>Dedicated account manager</li>
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
            
            <div className="pricing-guarantee">
              <div>
                <p><strong>Full Ownership:</strong> You own your business, customer relationships, and all generated content.</p>
                <p className="guarantee-subtext">No hidden fees. Monthly billing. Cancel anytime.</p>
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
                <h2>Our Commitment to You</h2>
                <p>We stand behind our platform with clear, milestone-based assurances:</p>
              </div>
              
              <div className="guarantee-grid">
                <div className="guarantee-item">
                  <div className="guarantee-number">1</div>
                  <h3>30-Day Trial Period</h3>
                  <p>Full access to test the platform. If it's not right for you, cancel within 30 days for a full refund.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">2</div>
                  <h3>Dedicated Support</h3>
                  <p>Get help when you need it with priority support and comprehensive documentation.</p>
                </div>
                
                <div className="guarantee-item">
                  <div className="guarantee-number">3</div>
                  <h3>Continuous Improvement</h3>
                  <p>Regular platform updates and new features based on user feedback and market trends.</p>
                </div>
              </div>
              
              <div className="guarantee-footer">
                <p><strong>Our Success Metric:</strong> We measure success by sustainable business growth, not quick wins. We're here for the long term.</p>
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
                  <span>How automated is the business?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Our AI handles repetitive tasks like lead qualification, follow-ups, and initial outreach. You'll need to handle strategic decisions, custom client requests, and service delivery. The goal is to free up your time for high-value activities.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>How does lead generation work?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Our AI uses multiple approved channels including email outreach, content marketing, and social media engagement. We focus on quality over quantity, targeting prospects who match your ideal customer profile. Results vary based on niche and market conditions.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>What makes this different from other AI tools?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>We provide a complete business system, not just content generation. Our platform includes lead generation tools, CRM integration, automated follow-ups, and business templates. It's designed specifically for service businesses, with workflows optimized for conversion.</p>
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
                  <span>What kind of results can I expect?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>Results vary significantly based on your niche, effort, and market conditions. While some users see quick success, building a sustainable business typically takes consistent effort over several months. We provide the tools and support, but success depends on execution.</p>
                </div>
              </div>
              
              <div className="faq-item">
                <button className="faq-question">
                  <span>How does the business model work?</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>We provide validated business templates, AI automation tools, and lead generation systems. You handle service delivery and customer relationships. Our revenue share model means we only profit when you do, aligning our incentives with your success.</p>
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

        {/* Service Quality Notice */}
        <section className="urgency-section">
          <div className="container">
            <div className="urgency-wrapper">
              <div className="urgency-content">
                <h3>Quality-First Approach</h3>
                <p>We limit new onboarding each week to ensure every customer receives dedicated support and the best possible experience.</p>
                <a href="/onboarding" className="quality-cta">Check Current Availability</a>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta">
          <div className="container final-cta-content">
            <h2>Ready to Launch Your AI-Powered Business?</h2>
            <p>Join entrepreneurs who are building sustainable service businesses with AI automation.</p>
            
            <button 
              className="primary-cta large" 
              onClick={(e) => { 
                e.preventDefault(); 
                handleGetStarted('starter', 'final_cta'); 
              }}
              aria-label="Start getting customers with Launchfly"
            >
              <span>Start Free →</span>
            </button>
            
            <div className="final-trust">
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span>Free to start</span>
              </div>
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                </svg>
                <span>Revenue sharing model</span>
              </div>
              <div className="trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                </svg>
                <span>30-day trial period</span>
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
                <span className="logo-icon">L</span>
                Launchfly
              </div>
              <p>Your AI cofounder for building service businesses.</p>
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


