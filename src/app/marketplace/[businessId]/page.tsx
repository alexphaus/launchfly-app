'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import '../marketplace.css';
import './business-details.css';

// This would typically come from an API/database
const businessDatabase: { [key: string]: any } = {
  'ai-resume-writer': {
    id: 'ai-resume-writer',
    name: 'AI Resume Writer',
    tagline: 'Professional resumes that get interviews',
    monthlyRevenue: '$3,400',
    timeToFirstSale: '18 hours',
    successRate: '92%',
    customerCount: '127 pre-warmed leads',
    description: 'Help job seekers land their dream jobs with AI-powered resume optimization',
    longDescription: `Transform job seekers' careers with this proven AI-powered resume writing business. 
    
    You'll get everything you need to start generating revenue immediately, including pre-warmed leads who have already expressed interest in professional resume services.
    
    The AI technology handles the heavy lifting while you focus on customer acquisition and scaling. Most owners see their first sale within 18 hours of launch.`,
    features: [
      'AI-powered resume analysis & rewriting',
      'ATS optimization guaranteed',
      'Industry-specific templates',
      'Cover letter generation',
      'LinkedIn profile optimization',
      'Interview preparation guides'
    ],
    whatsIncluded: [
      {
        title: 'Pre-Warmed Customer List',
        description: '127 qualified leads who have shown interest in resume services',
        icon: '👥'
      },
      {
        title: 'AI Resume Engine',
        description: 'Proprietary AI system that creates ATS-optimized resumes in minutes',
        icon: '🤖'
      },
      {
        title: 'Marketing Materials',
        description: 'Landing pages, email templates, and ad creatives that convert',
        icon: '📱'
      },
      {
        title: 'Automation Systems',
        description: 'Order processing, delivery, and follow-up sequences on autopilot',
        icon: '⚡'
      },
      {
        title: '30-Day Launch Plan',
        description: 'Step-by-step roadmap to your first $1,000 in revenue',
        icon: '📈'
      },
      {
        title: 'Ongoing Support',
        description: '90 days of coaching and technical support included',
        icon: '🎯'
      }
    ],
    revenueBreakdown: {
      avgOrderValue: '$97',
      ordersPerMonth: '35',
      profit: '87%',
      growthRate: '+23% MoM'
    },
    testimonials: [
      {
        name: 'Sarah M.',
        revenue: '$4,200/mo',
        quote: 'Made my first sale 12 hours after launch. Now averaging $4,200/month with just 10 hours of work per week.',
        timeToProfit: '12 hours'
      },
      {
        name: 'David K.',
        revenue: '$3,800/mo',
        quote: 'The pre-warmed leads were gold. Converted 8 customers in my first week!',
        timeToProfit: '24 hours'
      }
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free',
      '30-day money-back guarantee'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 3,
    category: 'Professional Services'
  },
  // Add other businesses here with similar structure
  'fitness-meal-plans': {
    id: 'fitness-meal-plans',
    name: 'Fitness Transformation Hub',
    tagline: 'Custom meal plans that transform bodies',
    monthlyRevenue: '$2,800',
    timeToFirstSale: '24 hours',
    successRate: '88%',
    customerCount: '94 fitness enthusiasts',
    description: 'Deliver personalized nutrition plans that help clients achieve their fitness goals',
    longDescription: `Tap into the booming fitness industry with this proven meal planning business that's already generating consistent revenue.
    
    You'll receive a complete business system including 94 pre-qualified fitness enthusiasts who are actively looking for personalized nutrition guidance.
    
    The AI-powered meal planning engine creates custom plans in seconds, while you focus on client success and business growth.`,
    features: [
      'AI meal plan generation',
      'Macro tracking & optimization',
      'Shopping lists & recipes',
      'Progress tracking dashboard',
      'Mobile app for clients',
      'Supplement recommendations'
    ],
    whatsIncluded: [
      {
        title: 'Fitness Community',
        description: '94 active fitness enthusiasts ready for meal plans',
        icon: '💪'
      },
      {
        title: 'AI Nutrition Engine',
        description: 'Creates personalized meal plans based on goals and preferences',
        icon: '🥗'
      },
      {
        title: 'Recipe Database',
        description: '500+ healthy recipes with macros and instructions',
        icon: '📖'
      },
      {
        title: 'Client Portal',
        description: 'White-label platform for client management and delivery',
        icon: '💻'
      },
      {
        title: 'Marketing Funnels',
        description: 'Proven funnels that convert fitness enthusiasts into paying clients',
        icon: '🎯'
      },
      {
        title: 'Training & Support',
        description: 'Nutrition certification resources and ongoing support',
        icon: '📚'
      }
    ],
    revenueBreakdown: {
      avgOrderValue: '$67',
      ordersPerMonth: '42',
      profit: '91%',
      growthRate: '+18% MoM'
    },
    testimonials: [
      {
        name: 'Mike T.',
        revenue: '$3,200/mo',
        quote: 'The AI meal planner is incredible. Clients love the personalization and I love the automation.',
        timeToProfit: '36 hours'
      },
      {
        name: 'Jessica R.',
        revenue: '$2,600/mo',
        quote: 'Started with zero nutrition experience. Now helping 40+ clients transform their bodies.',
        timeToProfit: '48 hours'
      }
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free',
      '30-day money-back guarantee'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 5,
    category: 'Health & Wellness'
  }
};

export default function BusinessDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.businessId as string;
  
  const [business, setBusiness] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const businessData = businessDatabase[businessId];
      if (businessData) {
        setBusiness(businessData);
      }
      setIsLoading(false);
    }, 500);
  }, [businessId]);

  const handlePurchase = () => {
    setShowPurchaseModal(true);
  };

  const proceedToOnboarding = () => {
    // Store business selection in sessionStorage for onboarding
    sessionStorage.setItem('selectedBusiness', JSON.stringify(business));
    router.push('/onboarding');
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading business details...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="error-container">
        <h1>Business not found</h1>
        <Link href="/marketplace">Back to marketplace</Link>
      </div>
    );
  }

  return (
    <div className="business-details-container">
      {/* Header */}
      <header className="marketplace-header">
        <div className="container">
          <Link href="/" className="logo">
            <span className="gradient-text">Launchfly</span>
          </Link>
          <nav>
            <Link href="/marketplace">← Back to Marketplace</Link>
            <Link href="/login" className="nav-cta">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="business-hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              {business.spotsLeft <= 3 && (
                <div className="urgency-notice">
                  ⚡ Only {business.spotsLeft} spots remaining at this price
                </div>
              )}
              
              <h1>{business.name}</h1>
              <p className="tagline">{business.tagline}</p>
              
              <div className="hero-stats">
                <div className="stat">
                  <strong>{business.monthlyRevenue}</strong>
                  <span>Monthly Revenue</span>
                </div>
                <div className="stat">
                  <strong>{business.timeToFirstSale}</strong>
                  <span>Time to First Sale</span>
                </div>
                <div className="stat">
                  <strong>{business.successRate}</strong>
                  <span>Success Rate</span>
                </div>
              </div>

              <div className="hero-cta">
                <button className="purchase-btn" onClick={handlePurchase}>
                  Get This Business Now
                </button>
                <div className="price-info">
                  <span className="original-price">{business.originalPrice}</span>
                  <span className="price">{business.price}</span>
                  <span className="price-note">one-time investment</span>
                </div>
              </div>

              <div className="customer-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" strokeWidth="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {business.customerCount}
              </div>
            </div>

            <div className="hero-image">
              <div className="business-preview">
                <div className="preview-header">Live Business Preview</div>
                <div className="preview-content">
                  <div className="preview-stat">
                    <span className="label">Active Customers</span>
                    <span className="value">127</span>
                  </div>
                  <div className="preview-stat">
                    <span className="label">Last Sale</span>
                    <span className="value">2 hours ago</span>
                  </div>
                  <div className="preview-stat">
                    <span className="label">This Week</span>
                    <span className="value">$782</span>
                  </div>
                  <div className="preview-stat">
                    <span className="label">Avg Rating</span>
                    <span className="value">4.9 ⭐</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section className="tabs-section">
        <div className="container">
          <div className="tabs-nav">
            <button 
              className={`tab ${selectedTab === 'overview' ? 'active' : ''}`}
              onClick={() => setSelectedTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab ${selectedTab === 'included' ? 'active' : ''}`}
              onClick={() => setSelectedTab('included')}
            >
              What's Included
            </button>
            <button 
              className={`tab ${selectedTab === 'revenue' ? 'active' : ''}`}
              onClick={() => setSelectedTab('revenue')}
            >
              Revenue Details
            </button>
            <button 
              className={`tab ${selectedTab === 'testimonials' ? 'active' : ''}`}
              onClick={() => setSelectedTab('testimonials')}
            >
              Success Stories
            </button>
          </div>
        </div>
      </section>

      {/* Tab Content */}
      <section className="tab-content">
        <div className="container">
          {selectedTab === 'overview' && (
            <div className="overview-content">
              <div className="content-section">
                <h2>About This Business</h2>
                <p className="long-description">{business.longDescription}</p>
              </div>

              <div className="content-section">
                <h2>Key Features</h2>
                <div className="features-grid">
                  {business.features.map((feature: string, idx: number) => (
                    <div key={idx} className="feature-item">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="content-section">
                <h2>Our Guarantees</h2>
                <div className="guarantees-list">
                  {business.guarantees.map((guarantee: string, idx: number) => (
                    <div key={idx} className="guarantee-box">
                      <div className="guarantee-icon">🛡️</div>
                      <p>{guarantee}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'included' && (
            <div className="included-content">
              <h2>Everything You Get</h2>
              <div className="included-grid">
                {business.whatsIncluded.map((item: any, idx: number) => (
                  <div key={idx} className="included-item">
                    <div className="item-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'revenue' && (
            <div className="revenue-content">
              <h2>Revenue Breakdown</h2>
              <div className="revenue-stats">
                <div className="revenue-stat">
                  <h3>{business.revenueBreakdown.avgOrderValue}</h3>
                  <p>Average Order Value</p>
                </div>
                <div className="revenue-stat">
                  <h3>{business.revenueBreakdown.ordersPerMonth}</h3>
                  <p>Orders Per Month</p>
                </div>
                <div className="revenue-stat">
                  <h3>{business.revenueBreakdown.profit}</h3>
                  <p>Profit Margin</p>
                </div>
                <div className="revenue-stat">
                  <h3>{business.revenueBreakdown.growthRate}</h3>
                  <p>Monthly Growth</p>
                </div>
              </div>

              <div className="revenue-projection">
                <h3>Your Potential Earnings</h3>
                <div className="projection-timeline">
                  <div className="timeline-item">
                    <span className="period">Month 1</span>
                    <span className="amount">$800 - $1,200</span>
                  </div>
                  <div className="timeline-item">
                    <span className="period">Month 3</span>
                    <span className="amount">$2,000 - $3,000</span>
                  </div>
                  <div className="timeline-item">
                    <span className="period">Month 6</span>
                    <span className="amount">$4,000 - $6,000</span>
                  </div>
                  <div className="timeline-item highlight">
                    <span className="period">Month 12</span>
                    <span className="amount">$8,000 - $12,000</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'testimonials' && (
            <div className="testimonials-content">
              <h2>Real Success Stories</h2>
              <div className="testimonials-grid">
                {business.testimonials.map((testimonial: any, idx: number) => (
                  <div key={idx} className="testimonial-card">
                    <div className="testimonial-header">
                      <div className="testimonial-author">
                        <h4>{testimonial.name}</h4>
                        <span className="revenue">{testimonial.revenue}</span>
                      </div>
                      <div className="time-to-profit">
                        First sale: {testimonial.timeToProfit}
                      </div>
                    </div>
                    <p className="testimonial-quote">"{testimonial.quote}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bottom-cta">
        <div className="container">
          <h2>Ready to Start Your {business.name}?</h2>
          <p>Join hundreds of entrepreneurs already making money with this proven business model</p>
          <button className="purchase-btn large" onClick={handlePurchase}>
            Claim Your Business Now
          </button>
          <p className="spots-notice">Only {business.spotsLeft} spots remaining at this price</p>
        </div>
      </section>

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>×</button>
            
            <h2>Secure Your {business.name}</h2>
            
            <div className="modal-business-summary">
              <div className="summary-item">
                <span className="label">Business:</span>
                <span className="value">{business.name}</span>
              </div>
              <div className="summary-item">
                <span className="label">Monthly Revenue:</span>
                <span className="value">{business.monthlyRevenue}</span>
              </div>
              <div className="summary-item">
                <span className="label">Customers Included:</span>
                <span className="value">{business.customerCount}</span>
              </div>
            </div>

            <div className="modal-price">
              <span className="original">{business.originalPrice}</span>
              <span className="current">{business.price}</span>
              <span className="savings">Save $500 Today!</span>
            </div>

            <div className="modal-guarantees">
              <h3>Your Protection:</h3>
              {business.guarantees.map((guarantee: string, idx: number) => (
                <div key={idx} className="guarantee-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {guarantee}
                </div>
              ))}
            </div>

            <button className="modal-cta" onClick={proceedToOnboarding}>
              Continue to Setup →
            </button>
            
            <p className="modal-disclaimer">
              You'll create your account and customize your business in the next step
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
