'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { analytics } from '@/lib/analytics';

export default function CustomBusinessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessIdea: searchParams.get('idea') || '',
    businessName: '',
    targetAudience: '',
    priceRange: '',
    plan: 'professional' // Custom businesses are professional by default
  });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);

  const handleNext = async () => {
    setError('');
    
    if (step === 1) {
      if (!formData.businessIdea) {
        setError('Please describe your business idea');
        return;
      }
      // Analyze business idea with AI
      await analyzeBusinessIdea();
    } else if (step === 2) {
      if (!formData.businessName || !formData.targetAudience || !formData.priceRange) {
        setError('Please fill in all fields');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      await handleSubmit();
    }
  };

  const analyzeBusinessIdea = async () => {
    setAnalyzing(true);
    try {
      // Simulate AI analysis (in real app, this would call your AI API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setAiRecommendations({
        viability: 'High',
        estimatedRevenue: '$3,000-$8,000/mo',
        suggestedPrice: '$197-$497',
        targetMarket: 'Small business owners and entrepreneurs',
        competitionLevel: 'Moderate',
        successProbability: '85%'
      });
      
      setStep(2);
    } catch (err) {
      setError('Failed to analyze business idea. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            onboarding_type: 'custom',
            business_idea: formData.businessIdea
          }
        }
      });

      if (authError) throw authError;

      // Create custom business via API
      const response = await fetch('/api/generate-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'custom',
          businessIdea: formData.businessIdea,
          businessName: formData.businessName,
          targetAudience: formData.targetAudience,
          priceRange: formData.priceRange,
          plan: formData.plan,
          userId: authData.user?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create business');
      }

      const business = await response.json();

      // Show success and redirect
      setStep(4);
      setTimeout(() => {
        router.push(`/dashboard/${business.sessionId}`);
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push('/');
    }
  };

  return (
    <>
      {step < 4 && (
        <button className="back-button" onClick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </button>
      )}

      <div className="onboarding-card">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="onboarding-step">
            <div className="step-indicator">
              <span>Step 1 of 3</span>
            </div>
            <h1 className="onboarding-title">Describe Your Business Idea</h1>
            <p className="onboarding-subtitle">
              Tell us your vision and our AI will analyze its potential and build it for you.
            </p>

            <div className="form-group">
              <label className="form-label">Your Business Idea</label>
              <textarea
                className="form-input"
                style={{ minHeight: '120px', resize: 'vertical' }}
                placeholder="Example: I want to create a pet grooming service that offers mobile grooming for busy pet owners..."
                value={formData.businessIdea}
                onChange={(e) => setFormData({ ...formData, businessIdea: e.target.value })}
              />
            </div>

            <div style={{ 
              padding: '1rem', 
              background: 'rgba(99, 102, 241, 0.05)', 
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'white' }}>💡 Pro Tips:</strong>
              <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                <li>Be specific about what service you'll provide</li>
                <li>Mention your target customers</li>
                <li>Include any unique aspects of your idea</li>
              </ul>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              className="onboarding-button"
              onClick={handleNext}
              disabled={!formData.businessIdea || analyzing}
            >
              {analyzing ? (
                <>
                  <span className="loading-spinner" style={{ marginRight: '0.5rem' }}></span>
                  Analyzing Your Idea...
                </>
              ) : (
                'Analyze My Idea →'
              )}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <div className="step-indicator">
              <span>Step 2 of 3</span>
            </div>
            <h1 className="onboarding-title">AI Analysis Complete! ✨</h1>
            <p className="onboarding-subtitle">
              Great news! Your business idea has high potential. Let's customize it.
            </p>

            {aiRecommendations && (
              <div style={{ 
                padding: '1.25rem', 
                background: 'rgba(34, 197, 94, 0.1)', 
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#22c55e' }}>
                  🎯 AI Recommendations
                </h3>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div>📊 <strong>Viability:</strong> {aiRecommendations.viability}</div>
                  <div>💰 <strong>Revenue Potential:</strong> {aiRecommendations.estimatedRevenue}</div>
                  <div>🎯 <strong>Success Probability:</strong> {aiRecommendations.successProbability}</div>
                  <div>💵 <strong>Suggested Pricing:</strong> {aiRecommendations.suggestedPrice}</div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Your Awesome Business"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <input
                type="text"
                className="form-input"
                placeholder={aiRecommendations?.targetMarket || "Who are your ideal customers?"}
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price Range</label>
              <select
                className="form-input"
                value={formData.priceRange}
                onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
              >
                <option value="">Select price range</option>
                <option value="$47-$97">$47-$97 (Entry Level)</option>
                <option value="$97-$297">$97-$297 (Professional)</option>
                <option value="$297-$997">$297-$997 (Premium)</option>
                <option value="$997+">$997+ (Enterprise)</option>
              </select>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              className="onboarding-button"
              onClick={handleNext}
            >
              Continue →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <div className="step-indicator">
              <span>Step 3 of 3</span>
            </div>
            <h1 className="onboarding-title">Create Your Account</h1>
            <p className="onboarding-subtitle">
              Last step! Secure your custom AI-powered business.
            </p>

            <div className="social-login-buttons">
              <button className="social-button" onClick={() => alert('Google login coming soon!')}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="social-login-divider">or continue with email</div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Create a secure password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div style={{ 
              padding: '1.25rem', 
              background: 'rgba(236, 72, 153, 0.1)', 
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '1px solid rgba(236, 72, 153, 0.3)'
            }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#ec4899' }}>
                🎁 Custom Business Package ($497)
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' }}>
                <li style={{ marginBottom: '0.25rem' }}>✅ AI builds your entire business</li>
                <li style={{ marginBottom: '0.25rem' }}>✅ 100-200 targeted customers</li>
                <li style={{ marginBottom: '0.25rem' }}>✅ Custom branding & messaging</li>
                <li style={{ marginBottom: '0.25rem' }}>✅ Advanced AI optimization</li>
                <li>✅ Keep 90% of all profits</li>
              </ul>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              className="onboarding-button"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" style={{ marginRight: '0.5rem' }}></span>
                  Building Your Business...
                </>
              ) : (
                'Launch My Custom Business ($497) →'
              )}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step">
            <div className="success-checkmark">
              <svg viewBox="0 0 52 52">
                <circle className="circle" cx="26" cy="26" r="25" fill="none"/>
                <path className="check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke="#fff" strokeWidth="4"/>
              </svg>
            </div>
            <h1 className="onboarding-title">Your Business is Being Built! 🎉</h1>
            <p className="onboarding-subtitle">
              Our AI is creating your custom business. You'll be redirected to your dashboard in a moment...
            </p>
            <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
          </div>
        )}
      </div>
    </>
  );
}
