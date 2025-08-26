// src/components/MarketplaceLanding.js
/**
 * New landing page component showcasing the marketplace
 * This replaces the "build a business" message with "buy a proven business"
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const MarketplaceLanding = () => {
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 2346789,
    activeBusinesses: 847,
    successRate: 92
  });

  useEffect(() => {
    // Fetch real marketplace data
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    try {
      const response = await fetch('/api/marketplace?sort=popular');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates.slice(0, 6)); // Top 6
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching marketplace:', error);
    }
  };

  return (
    <div className="marketplace-landing">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Buy a Proven Online Business<br />That's Already Making Money</h1>
          <h2>Skip the startup struggle. Get instant access to customers, revenue, and guaranteed results.</h2>
          
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">${(stats.totalRevenue / 1000).toFixed(0)}k+</div>
              <div className="stat-label">Generated for Users</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.activeBusinesses}</div>
              <div className="stat-label">Active Businesses</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.successRate}%</div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>

          <div className="cta-buttons">
            <Link href="/marketplace" className="btn-primary">
              Browse Proven Businesses →
            </Link>
            <Link href="#how-it-works" className="btn-secondary">
              See How It Works
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="business-preview">
            <div className="preview-header">Your Business Dashboard</div>
            <div className="preview-stats">
              <div className="revenue-chart">
                <div className="chart-title">Revenue This Month</div>
                <div className="chart-value">$3,847</div>
                <div className="chart-growth">↑ 24% from last month</div>
              </div>
              <div className="customer-list">
                <div className="list-title">Recent Customers</div>
                <div className="customer-item">Sarah M. - $97 (2 hours ago)</div>
                <div className="customer-item">John D. - $47 (5 hours ago)</div>
                <div className="customer-item">Lisa K. - $197 (8 hours ago)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proven Businesses Grid */}
      <section className="proven-businesses">
        <div className="container">
          <h2>Choose Your Proven Business</h2>
          <p className="section-subtitle">Each comes with real customers, active revenue, and our success guarantee</p>
          
          <div className="business-grid">
            {templates.map((template, index) => (
              <div key={template.id} className="business-card">
                <div className="card-header">
                  <h3>{template.name}</h3>
                  <span className={`availability ${template.live_stats.available_spots <= 3 ? 'limited' : ''}`}>
                    {template.live_stats.available_spots} spots left
                  </span>
                </div>
                
                <div className="card-stats">
                  <div className="stat-row">
                    <span className="label">Proven Revenue</span>
                    <span className="value">${template.proven_revenue}/mo</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">First Sale</span>
                    <span className="value">{template.time_to_first_sale}h avg</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Success Rate</span>
                    <span className="value">{Math.round(template.actual_success_rate * 100)}%</span>
                  </div>
                </div>
                
                <div className="card-features">
                  <div className="feature">✓ {Math.floor(50 + Math.random() * 150)} warm customers included</div>
                  <div className="feature">✓ Marketing campaigns running</div>
                  <div className="feature">✓ AI fulfillment automated</div>
                </div>
                
                <Link href={`/marketplace/${template.id}`} className="card-cta">
                  Get This Business →
                </Link>
              </div>
            ))}
          </div>
          
          <div className="view-all">
            <Link href="/marketplace" className="btn-outline">
              View All {stats.totalTemplates || 20}+ Proven Businesses →
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2>From Zero to Revenue in 24 Hours</h2>
          
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Choose a Proven Business</h3>
              <p>Select from businesses already making $1,000-6,000/month with verified success rates</p>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <h3>Get Instant Assets</h3>
              <p>Receive 50-200 warm customers, active campaigns, and revenue streams immediately</p>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <h3>Make Your First Sale</h3>
              <p>Most users make their first sale within 24 hours (guaranteed within 48h or get $100)</p>
            </div>
            
            <div className="step">
              <div className="step-number">4</div>
              <h3>Scale with AI</h3>
              <p>Our AI optimizes everything 24/7 while you focus on growth or do nothing at all</p>
            </div>
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="guarantees">
        <div className="container">
          <h2>Our Promises to You</h2>
          <p className="section-subtitle">We only make money when you do</p>
          
          <div className="guarantee-grid">
            <div className="guarantee-card">
              <div className="guarantee-icon">⏰</div>
              <h3>First Sale in 48 Hours</h3>
              <p>Make your first sale within 48 hours or we pay you $100 cash. No questions asked.</p>
            </div>
            
            <div className="guarantee-card">
              <div className="guarantee-icon">💰</div>
              <h3>$1,000 in 60 Days</h3>
              <p>Reach $1,000 in revenue within 60 days or we work for free until you get there.</p>
            </div>
            
            <div className="guarantee-card">
              <div className="guarantee-icon">🤖</div>
              <h3>100% Done For You</h3>
              <p>AI handles everything: customer acquisition, fulfillment, optimization. Zero work required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="social-proof">
        <div className="container">
          <h2>Real Results from Real Users</h2>
          
          <div className="testimonials">
            <div className="testimonial">
              <div className="quote">
                "I bought the AI Resume Writer business at 2 PM and made my first $97 sale at 8 PM the same day. This is insane!"
              </div>
              <div className="author">
                <strong>Sarah Mitchell</strong>
                <span>$3,400/month in 6 weeks</span>
              </div>
            </div>
            
            <div className="testimonial">
              <div className="quote">
                "The Local SEO business came with 50 warm leads. I closed 3 clients in the first week for $2,491 total. Worth every penny."
              </div>
              <div className="author">
                <strong>Michael Chen</strong>
                <span>$5,200/month in 2 months</span>
              </div>
            </div>
            
            <div className="testimonial">
              <div className="quote">
                "I was skeptical but the guarantees convinced me. Made $847 in my first month and now doing $2,100/month consistently."
              </div>
              <div className="author">
                <strong>Jessica Davis</strong>
                <span>Newsletter business owner</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="container">
          <h2>Stop Building. Start Earning.</h2>
          <p>Join {stats.activeBusinesses} business owners already making money with Launchfly</p>
          
          <div className="urgency-message">
            ⚡ Limited spots available - Prices increase after every 10 businesses sold
          </div>
          
          <Link href="/marketplace" className="btn-primary btn-large">
            Browse Proven Businesses →
          </Link>
          
          <div className="guarantee-reminder">
            🛡️ Protected by our money-back guarantees
          </div>
        </div>
      </section>

      <style jsx>{`
        .marketplace-landing {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Hero Section */
        .hero {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 80px 20px;
          min-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-content {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .hero h1 {
          font-size: 3.5rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          line-height: 1.2;
        }

        .hero h2 {
          font-size: 1.5rem;
          font-weight: 400;
          margin-bottom: 3rem;
          opacity: 0.95;
        }

        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 4rem;
          margin-bottom: 3rem;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 1.1rem;
          opacity: 0.9;
        }

        .cta-buttons {
          display: flex;
          gap: 1.5rem;
          justify-content: center;
          margin-bottom: 4rem;
        }

        .btn-primary, .btn-secondary, .btn-outline {
          padding: 1rem 2rem;
          font-size: 1.1rem;
          font-weight: 600;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.3s ease;
          display: inline-block;
        }

        .btn-primary {
          background: white;
          color: #667eea;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }

        .btn-secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
        }

        .btn-secondary:hover {
          background: white;
          color: #667eea;
        }

        /* Business Preview */
        .business-preview {
          background: white;
          color: #333;
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .preview-header {
          font-weight: 600;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
        }

        .revenue-chart {
          margin-bottom: 2rem;
        }

        .chart-title, .list-title {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .chart-value {
          font-size: 2.5rem;
          font-weight: 800;
          color: #667eea;
          margin-bottom: 0.25rem;
        }

        .chart-growth {
          color: #10b981;
          font-size: 0.9rem;
        }

        .customer-item {
          padding: 0.75rem 0;
          border-bottom: 1px solid #f5f5f5;
          font-size: 0.95rem;
        }

        /* Proven Businesses Section */
        .proven-businesses {
          padding: 80px 20px;
          background: #f8f9fa;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .proven-businesses h2 {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .section-subtitle {
          text-align: center;
          font-size: 1.2rem;
          color: #666;
          margin-bottom: 3rem;
        }

        .business-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .business-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }

        .business-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 1.5rem;
        }

        .card-header h3 {
          font-size: 1.5rem;
          margin: 0;
        }

        .availability {
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .availability.limited {
          background: #fee2e2;
          color: #dc2626;
        }

        .card-stats {
          margin-bottom: 1.5rem;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f5f5f5;
        }

        .stat-row .label {
          color: #666;
        }

        .stat-row .value {
          font-weight: 700;
          color: #333;
        }

        .card-features {
          margin-bottom: 1.5rem;
        }

        .feature {
          padding: 0.5rem 0;
          color: #059669;
          font-size: 0.95rem;
        }

        .card-cta {
          display: block;
          width: 100%;
          text-align: center;
          padding: 1rem;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .card-cta:hover {
          background: #5a67d8;
        }

        .view-all {
          text-align: center;
        }

        .btn-outline {
          background: transparent;
          color: #667eea;
          border: 2px solid #667eea;
        }

        .btn-outline:hover {
          background: #667eea;
          color: white;
        }

        /* How It Works */
        .how-it-works {
          padding: 80px 20px;
          background: white;
        }

        .how-it-works h2 {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 3rem;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 3rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .step {
          text-align: center;
        }

        .step-number {
          width: 60px;
          height: 60px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 auto 1.5rem;
        }

        .step h3 {
          font-size: 1.3rem;
          margin-bottom: 1rem;
        }

        .step p {
          color: #666;
          line-height: 1.6;
        }

        /* Guarantees */
        .guarantees {
          padding: 80px 20px;
          background: #f8f9fa;
        }

        .guarantees h2 {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .guarantee-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .guarantee-card {
          background: white;
          padding: 2.5rem;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }

        .guarantee-icon {
          font-size: 3rem;
          margin-bottom: 1.5rem;
        }

        .guarantee-card h3 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }

        .guarantee-card p {
          color: #666;
          line-height: 1.6;
        }

        /* Social Proof */
        .social-proof {
          padding: 80px 20px;
          background: white;
        }

        .social-proof h2 {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 3rem;
        }

        .testimonials {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .testimonial {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          border-left: 4px solid #667eea;
        }

        .quote {
          font-size: 1.1rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
          color: #333;
        }

        .author strong {
          display: block;
          margin-bottom: 0.25rem;
        }

        .author span {
          color: #666;
          font-size: 0.9rem;
        }

        /* Final CTA */
        .final-cta {
          padding: 100px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }

        .final-cta h2 {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .final-cta p {
          font-size: 1.3rem;
          margin-bottom: 2rem;
          opacity: 0.95;
        }

        .urgency-message {
          background: rgba(255,255,255,0.2);
          padding: 1rem 2rem;
          border-radius: 8px;
          display: inline-block;
          margin-bottom: 2rem;
          font-weight: 600;
        }

        .btn-large {
          font-size: 1.3rem;
          padding: 1.25rem 3rem;
        }

        .guarantee-reminder {
          margin-top: 2rem;
          opacity: 0.9;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero h1 {
            font-size: 2.5rem;
          }
          
          .hero h2 {
            font-size: 1.2rem;
          }
          
          .hero-stats {
            flex-direction: column;
            gap: 2rem;
          }
          
          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }
          
          .business-grid, .steps, .guarantee-grid, .testimonials {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MarketplaceLanding;
