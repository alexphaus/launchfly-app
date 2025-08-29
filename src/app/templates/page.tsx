'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BusinessTemplate {
  name: string;
  icon: string;
  description: string;
  avgRevenue: string;
  firstSale: string;
  successRate: string;
  customers: number;
  category: string;
  difficulty: string;
  featured?: boolean;
}

const BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
  'ai-career': {
    name: 'AI Career Accelerator',
    icon: '🎆',
    description: 'Premium resume & LinkedIn optimization service. Charges $197-497 per client with 80% profit margins.',
    avgRevenue: '$4,850/mo',
    firstSale: '16 hours',
    successRate: '96%',
    customers: 147,
    category: 'Professional Services',
    difficulty: 'Beginner',
    featured: true
  },
  'fitness': {
    name: 'Fitness Transformation Hub',
    icon: '💪',
    description: 'Personalized meal plans + workout programs. Subscription model earning $47-97/month per client.',
    avgRevenue: '$2,850/mo',
    firstSale: '24 hours',
    successRate: '88%',
    customers: 94,
    category: 'Health & Fitness',
    difficulty: 'Beginner'
  },
  'branding': {
    name: 'Brand Identity Studio',
    icon: '✨',
    description: 'Complete branding packages (logo, colors, fonts). Charges $297-997 with 48-hour delivery.',
    avgRevenue: '$4,200/mo',
    firstSale: '12 hours',
    successRate: '95%',
    customers: 183,
    category: 'Creative Services',
    difficulty: 'Intermediate'
  },
  'social': {
    name: 'Social Growth Engine',
    icon: '🚀',
    description: 'Full social media management + growth hacking. Recurring $297-497/month per client.',
    avgRevenue: '$1,950/mo',
    firstSale: '36 hours',
    successRate: '84%',
    customers: 76,
    category: 'Marketing',
    difficulty: 'Intermediate'
  },
  'b2b': {
    name: 'B2B Revenue Machine',
    icon: '🎯',
    description: 'Done-for-you lead generation for B2B companies. Premium service at $2K-5K/month per client.',
    avgRevenue: '$5,600/mo',
    firstSale: '48 hours',
    successRate: '78%',
    customers: 52,
    category: 'B2B Services',
    difficulty: 'Advanced'
  },
  'realestate': {
    name: 'Real Estate Visual Magic',
    icon: '🏰',
    description: 'Virtual staging + property enhancement. Charges $97-297 per property with same-day delivery.',
    avgRevenue: '$3,100/mo',
    firstSale: '20 hours',
    successRate: '90%',
    customers: 108,
    category: 'Real Estate',
    difficulty: 'Beginner'
  }
};

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');

  const categories = ['All', ...new Set(Object.values(BUSINESS_TEMPLATES).map(t => t.category))];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const filteredTemplates = Object.entries(BUSINESS_TEMPLATES).filter(([key, template]) => {
    const categoryMatch = selectedCategory === 'All' || template.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'All' || template.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const handleSelectTemplate = (templateKey: string) => {
    router.push(`/onboarding/quick-start?template=${templateKey}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style jsx global>{`
        .templates-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .templates-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .templates-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 1rem;
        }

        .templates-subtitle {
          font-size: 1.125rem;
          color: #6b7280;
          max-width: 600px;
          margin: 0 auto 2rem;
          line-height: 1.6;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          margin-bottom: 2rem;
          transition: color 0.2s ease;
        }

        .back-link:hover {
          color: #764ba2;
        }

        .filters {
          display: flex;
          gap: 2rem;
          justify-content: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-label {
          font-weight: 600;
          color: #374151;
          font-size: 0.9rem;
        }

        .filter-select {
          padding: 0.5rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          font-size: 0.9rem;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }

        .filter-select:focus {
          outline: none;
          border-color: #667eea;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .template-card {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          border: 2px solid transparent;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .template-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
          border-color: #667eea;
        }

        .template-card.featured {
          border-color: #f59e0b;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        }

        .template-card.featured::before {
          content: '⭐ TRENDING';
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #f59e0b;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .template-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .template-icon {
          font-size: 3rem;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .template-info h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 0.25rem 0;
        }

        .template-tags {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .template-tag {
          background: #e5e7eb;
          color: #374151;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .template-tag.difficulty-beginner { background: #dcfce7; color: #166534; }
        .template-tag.difficulty-intermediate { background: #fef3c7; color: #92400e; }
        .template-tag.difficulty-advanced { background: #fecaca; color: #991b1b; }

        .template-description {
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .template-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-weight: 700;
          color: #1a1a1a;
          font-size: 1.1rem;
        }

        .stat-label {
          display: block;
          color: #6b7280;
          font-size: 0.8rem;
          margin-top: 0.25rem;
        }

        .customer-pool {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .customer-pool-text {
          color: #1e40af;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .template-cta {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 1rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .template-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        .custom-option {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          margin-top: 2rem;
        }

        .custom-option h3 {
          font-size: 1.5rem;
          margin: 0 0 1rem 0;
        }

        .custom-option p {
          margin: 0 0 1.5rem 0;
          opacity: 0.9;
        }

        .custom-cta {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 0.875rem 2rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }

        .custom-cta:hover {
          background: rgba(255, 255, 255, 0.3);
          color: white;
          border-color: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 768px) {
          .templates-container {
            padding: 1rem;
          }
          
          .templates-grid {
            grid-template-columns: 1fr;
          }
          
          .filters {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>

      <div className="templates-container">
        <Link href="/" className="back-link">
          ← Back to Home
        </Link>

        <div className="templates-header">
          <h1 className="templates-title">Choose Your Business Template</h1>
          <p className="templates-subtitle">
            Each template comes with proven customers, automated systems, and everything you need to start earning immediately.
          </p>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select 
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Difficulty</label>
            <select 
              className="filter-select"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
            >
              {difficulties.map(difficulty => (
                <option key={difficulty} value={difficulty}>{difficulty}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="templates-grid">
          {filteredTemplates.map(([key, template]) => (
            <div 
              key={key} 
              className={`template-card ${template.featured ? 'featured' : ''}`}
              onClick={() => handleSelectTemplate(key)}
            >
              <div className="template-header">
                <span className="template-icon">{template.icon}</span>
                <div className="template-info">
                  <h3>{template.name}</h3>
                </div>
              </div>

              <div className="template-tags">
                <span className="template-tag">{template.category}</span>
                <span className={`template-tag difficulty-${template.difficulty.toLowerCase()}`}>
                  {template.difficulty}
                </span>
              </div>

              <p className="template-description">{template.description}</p>

              <div className="template-stats">
                <div className="stat-item">
                  <span className="stat-value">{template.avgRevenue}</span>
                  <span className="stat-label">Avg Revenue</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{template.firstSale}</span>
                  <span className="stat-label">First Sale</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{template.successRate}</span>
                  <span className="stat-label">Success Rate</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{template.customers}</span>
                  <span className="stat-label">Ready Customers</span>
                </div>
              </div>

              <div className="customer-pool">
                <div className="customer-pool-text">
                  <span>👥</span>
                  <span>Includes <strong>{template.customers} pre-qualified customers</strong></span>
                </div>
              </div>

              <button className="template-cta">
                Get This Business →
              </button>
            </div>
          ))}
        </div>

        <div className="custom-option">
          <h3>💡 Have Your Own Idea?</h3>
          <p>Tell us your vision and we'll build a custom AI-powered business around it. Same guarantees, same results.</p>
          <Link href="/onboarding/custom" className="custom-cta">
            Build Custom Business
          </Link>
        </div>
      </div>
    </div>
  );
}
