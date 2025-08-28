'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import './marketplace.css';

// Proven business templates based on the breakthrough implementation
const provenBusinesses = [
  {
    id: 'ai-resume-writer',
    name: 'AI Resume Writer',
    tagline: 'Professional resumes that get interviews',
    monthlyRevenue: '$3,400',
    timeToFirstSale: '18 hours',
    successRate: '92%',
    customerCount: '127 pre-warmed leads',
    description: 'Help job seekers land their dream jobs with AI-powered resume optimization',
    features: [
      'AI-powered resume analysis & rewriting',
      'ATS optimization guaranteed',
      'Industry-specific templates',
      'Cover letter generation'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 3,
    category: 'Professional Services',
    image: '/marketplace/ai-resume-writer.jpg'
  },
  {
    id: 'fitness-meal-plans',
    name: 'Fitness Transformation Hub',
    tagline: 'Custom meal plans that transform bodies',
    monthlyRevenue: '$2,800',
    timeToFirstSale: '24 hours',
    successRate: '88%',
    customerCount: '94 fitness enthusiasts',
    description: 'Deliver personalized nutrition plans that help clients achieve their fitness goals',
    features: [
      'AI meal plan generation',
      'Macro tracking & optimization',
      'Shopping lists & recipes',
      'Progress tracking dashboard'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 5,
    category: 'Health & Wellness',
    image: '/marketplace/fitness-meal-plans.jpg'
  },
  {
    id: 'logo-design-service',
    name: 'Brand Identity Studio',
    tagline: 'Premium logos in 24 hours',
    monthlyRevenue: '$4,200',
    timeToFirstSale: '12 hours',
    successRate: '95%',
    customerCount: '183 businesses waiting',
    description: 'Create stunning brand identities for businesses ready to level up',
    features: [
      'AI-assisted logo generation',
      'Unlimited revisions',
      'Full brand kit delivery',
      'Commercial rights included'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 2,
    category: 'Creative Services',
    image: '/marketplace/logo-design.jpg'
  },
  {
    id: 'social-media-manager',
    name: 'Social Growth Engine',
    tagline: 'Viral content that converts',
    monthlyRevenue: '$3,100',
    timeToFirstSale: '36 hours',
    successRate: '86%',
    customerCount: '156 brands ready',
    description: 'Manage social media for businesses hungry for growth',
    features: [
      'AI content generation',
      'Multi-platform scheduling',
      'Engagement automation',
      'Analytics & reporting'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 4,
    category: 'Marketing Services',
    image: '/marketplace/social-media.jpg'
  },
  {
    id: 'b2b-lead-generation',
    name: 'B2B Revenue Machine',
    tagline: 'Qualified leads on autopilot',
    monthlyRevenue: '$5,600',
    timeToFirstSale: '48 hours',
    successRate: '90%',
    customerCount: '200+ decision makers',
    description: 'Generate high-quality B2B leads for companies ready to scale',
    features: [
      'AI lead qualification',
      'Automated outreach sequences',
      'CRM integration',
      'Appointment setting'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$697',
    originalPrice: '$1,497',
    spotsLeft: 1,
    category: 'Business Services',
    image: '/marketplace/b2b-leads.jpg'
  },
  {
    id: 'virtual-staging',
    name: 'Real Estate Visual Magic',
    tagline: 'Stage homes in minutes, not months',
    monthlyRevenue: '$3,900',
    timeToFirstSale: '24 hours',
    successRate: '93%',
    customerCount: '142 agents & brokers',
    description: 'Transform empty properties into stunning, sale-ready homes',
    features: [
      'AI virtual staging',
      '48-hour turnaround',
      'Photorealistic quality',
      'Unlimited styles'
    ],
    guarantees: [
      'First sale within 48 hours or $100 cash',
      '$1,000 revenue in 60 days or we work free'
    ],
    price: '$497',
    originalPrice: '$997',
    spotsLeft: 6,
    category: 'Real Estate',
    image: '/marketplace/virtual-staging.jpg'
  }
];

export default function MarketplacePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['All', 'Professional Services', 'Health & Wellness', 'Creative Services', 'Marketing Services', 'Business Services', 'Real Estate'];

  const filteredBusinesses = provenBusinesses.filter(business => {
    const matchesCategory = selectedCategory === 'All' || business.category === selectedCategory;
    const matchesSearch = business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         business.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         business.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleBusinessSelect = (businessId: string) => {
    setIsLoading(true);
    router.push(`/marketplace/${businessId}`);
  };

  return (
    <div className="marketplace-container">
      {/* Header */}
      <header className="marketplace-header">
        <div className="container">
          <Link href="/" className="logo">
            <span className="gradient-text">Launchfly</span>
          </Link>
          <nav>
            <Link href="/">Home</Link>
            <Link href="/how-it-works">How It Works</Link>
            <Link href="/success-stories">Success Stories</Link>
            <Link href="/login" className="nav-cta">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="marketplace-hero">
        <div className="container">
          <h1>Buy a <span className="gradient-text">Proven Online Business</span> That's Already Making Money</h1>
          <p className="hero-subtitle">Skip the startup phase. Get instant access to customers, revenue, and guaranteed results.</p>
          
          <div className="hero-stats">
            <div className="stat">
              <h3>$2.4M+</h3>
              <p>Total Revenue Generated</p>
            </div>
            <div className="stat">
              <h3>18 hrs</h3>
              <p>Avg. Time to First Sale</p>
            </div>
            <div className="stat">
              <h3>92%</h3>
              <p>Success Rate</p>
            </div>
            <div className="stat">
              <h3>487</h3>
              <p>Happy Business Owners</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="marketplace-filters">
        <div className="container">
          <div className="filters-wrapper">
            <div className="category-filters">
              {categories.map(category => (
                <button
                  key={category}
                  className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search businesses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Business Grid */}
      <section className="marketplace-grid">
        <div className="container">
          <div className="businesses-grid">
            {filteredBusinesses.map(business => (
              <div key={business.id} className="business-card">
                {business.spotsLeft <= 3 && (
                  <div className="urgency-badge">Only {business.spotsLeft} spots left!</div>
                )}
                
                <div className="business-image">
                  <div className="placeholder-image">
                    <span>{business.name}</span>
                  </div>
                </div>

                <div className="business-content">
                  <div className="business-header">
                    <h3>{business.name}</h3>
                    <span className="category-tag">{business.category}</span>
                  </div>
                  
                  <p className="business-tagline">{business.tagline}</p>
                  
                  <div className="business-stats">
                    <div className="stat-item">
                      <strong>{business.monthlyRevenue}</strong>
                      <span>/month avg</span>
                    </div>
                    <div className="stat-item">
                      <strong>{business.timeToFirstSale}</strong>
                      <span>first sale</span>
                    </div>
                    <div className="stat-item">
                      <strong>{business.successRate}</strong>
                      <span>success</span>
                    </div>
                  </div>

                  <div className="customer-count">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="9" cy="7" r="4" strokeWidth="2"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {business.customerCount}
                  </div>

                  <div className="business-guarantees">
                    {business.guarantees.map((guarantee, idx) => (
                      <div key={idx} className="guarantee-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {guarantee}
                      </div>
                    ))}
                  </div>

                  <div className="business-footer">
                    <div className="pricing">
                      <span className="original-price">{business.originalPrice}</span>
                      <span className="price">{business.price}</span>
                      <span className="price-note">one-time</span>
                    </div>
                    <button
                      className="select-business-btn"
                      onClick={() => handleBusinessSelect(business.id)}
                      disabled={isLoading}
                    >
                      Get This Business
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="marketplace-trust">
        <div className="container">
          <h2>Our <span className="gradient-text">Iron-Clad Guarantees</span></h2>
          <div className="guarantees-grid">
            <div className="guarantee-card">
              <div className="guarantee-icon">💰</div>
              <h3>First Sale in 48 Hours</h3>
              <p>Make your first sale within 48 hours or we pay you $100 cash. No questions asked.</p>
            </div>
            <div className="guarantee-card">
              <div className="guarantee-icon">📈</div>
              <h3>$1,000 in 60 Days</h3>
              <p>Reach $1,000 in revenue within 60 days or we work for free until you get there.</p>
            </div>
            <div className="guarantee-card">
              <div className="guarantee-icon">🛡️</div>
              <h3>30-Day Money Back</h3>
              <p>Not satisfied? Get a full refund within 30 days. We only succeed when you do.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="marketplace-cta">
        <div className="container">
          <h2>Ready to Start Making Money Today?</h2>
          <p>Join 487+ entrepreneurs who skipped the startup struggle and went straight to profit</p>
          <button className="cta-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Browse Businesses
          </button>
        </div>
      </section>
    </div>
  );
}
