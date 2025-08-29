'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { analytics } from '@/lib/analytics';

const businessTemplates = [
  {
    id: 'ai-career',
    name: 'AI Career Accelerator',
    icon: '🎆',
    description: 'Premium resume & LinkedIn optimization service',
    revenue: '$4,850/mo',
    customers: '147 pre-qualified buyers'
  },
  {
    id: 'fitness-hub',
    name: 'Fitness Transformation Hub',
    icon: '💪',
    description: 'Personalized meal plans + workout programs',
    revenue: '$2,850/mo',
    customers: '94 ready clients'
  },
  {
    id: 'brand-studio',
    name: 'Brand Identity Studio',
    icon: '✨',
    description: 'Complete branding packages',
    revenue: '$4,200/mo',
    customers: '183 waiting clients'
  },
  {
    id: 'social-growth',
    name: 'Social Growth Engine',
    icon: '🚀',
    description: 'Full social media management',
    revenue: '$1,950/mo',
    customers: '76 interested buyers'
  },
  {
    id: 'b2b-revenue',
    name: 'B2B Revenue Machine',
    icon: '🎯',
    description: 'Done-for-you lead generation',
    revenue: '$5,600/mo',
    customers: '52 qualified leads'
  },
  {
    id: 'real-estate',
    name: 'Real Estate Visual Magic',
    icon: '🏰',
    description: 'Virtual staging + property enhancement',
    revenue: '$3,100/mo',
    customers: '108 realtors waiting'
  }
];

export default function QuickStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();
  
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(searchParams.get('template') || '');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
    plan: searchParams.get('plan') || 'starter'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Track onboarding start
    analytics.trackOnboarding({
      event: 'onboarding_started',
      properties: {
        template: searchParams.get('template') || undefined,
        plan: searchParams.get('plan') || 'starter'
      }
    });

    // If template is preselected, skip to step 2
    if (searchParams.get('template')) {
      setStep(2);
    }
  }, [searchParams]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    analytics.trackConversion({
      event: 'template_selected',
      properties: {
        template_id: templateId
      }
    });
  };

  const handleNext = async () => {
    setError('');
    
    if (step === 1) {
      if (!selectedTemplate) {
        setError('Please select a business template');
        return;
      }
      analytics.trackOnboarding({
        event: 'onboarding_step_completed',
        properties: { step: 1, template: selectedTemplate }
      });
      setStep(2);
    } else if (step === 2) {
      // Validate email and password
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      analytics.trackOnboarding({
        event: 'onboarding_step_completed',
        properties: { step: 2 }
      });
      setStep(3);
    } else if (step === 3) {
      // Create account and business
      await handleSubmit();
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
            onboarding_template: selectedTemplate,
            onboarding_plan: formData.plan
          }
        }
      });

      if (authError) throw authError;

      // Create business via API
      const response = await fetch('/api/generate-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: selectedTemplate,
          businessName: formData.businessName || getTemplateName(selectedTemplate),
          plan: formData.plan,
          userId: authData.user?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create business');
      }

      const business = await response.json();

      // Track successful completion
      analytics.trackOnboarding({
        event: 'onboarding_completed',
        properties: {
          template: selectedTemplate,
          plan: formData.plan
        }
      });
      
      analytics.trackConversion({
        event: 'account_created',
        properties: {
          plan: formData.plan
        }
      });

      analytics.trackConversion({
        event: 'business_created',
        properties: {
          template_id: selectedTemplate,
          plan: formData.plan
        }
      });

      // Show success and redirect
      setStep(4);
      setTimeout(() => {
        router.push(`/dashboard/${business.sessionId}`);
      }, 2000);

    } catch (err: any) {
      analytics.trackOnboarding({
        event: 'onboarding_abandoned',
        properties: {
          step: 3,
          error: err.message
        }
      });
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const getTemplateName = (templateId: string) => {
    return businessTemplates.find(t => t.id === templateId)?.name || 'My Business';
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
            <h1 className="onboarding-title">Choose Your Business Template</h1>
            <p className="onboarding-subtitle">
              Select a proven business model. Each comes with real customers ready to buy.
            </p>

            <div className="template-grid">
              {businessTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <div className="template-icon">{template.icon}</div>
                  <div className="template-name">{template.name}</div>
                  <div className="template-description">{template.description}</div>
                  <div className="template-revenue">{template.revenue} avg • {template.customers}</div>
                </div>
              ))}
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              className="onboarding-button"
              onClick={handleNext}
              disabled={!selectedTemplate}
            >
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <div className="step-indicator">
              <span>Step 2 of 3</span>
            </div>
            <h1 className="onboarding-title">Create Your Account</h1>
            <p className="onboarding-subtitle">
              Secure your business and get started in seconds.
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
              <button className="social-button" onClick={() => alert('GitHub login coming soon!')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
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

            {error && <div className="error-message">{error}</div>}

            <button 
              className="onboarding-button"
              onClick={handleNext}
              disabled={!formData.email || !formData.password}
            >
              Continue →
            </button>

            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <div className="step-indicator">
              <span>Step 3 of 3</span>
            </div>
            <h1 className="onboarding-title">Customize Your Business</h1>
            <p className="onboarding-subtitle">
              Give your business a unique name and we'll handle the rest.
            </p>

            <div className="form-group">
              <label className="form-label">Business Name (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder={getTemplateName(selectedTemplate)}
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Leave blank to use our suggested name
              </p>
            </div>

            <div style={{ 
              padding: '1.25rem', 
              background: 'rgba(99, 102, 241, 0.1)', 
              borderRadius: '12px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                What's Included:
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ marginBottom: '0.5rem' }}>✅ {businessTemplates.find(t => t.id === selectedTemplate)?.customers}</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ AI-powered automation</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ Complete business setup</li>
                <li style={{ marginBottom: '0.5rem' }}>✅ 48-hour sale guarantee</li>
                <li>✅ {formData.plan === 'starter' ? '20% profit share' : '90% profit retention'}</li>
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
                  Creating Your Business...
                </>
              ) : (
                `Launch My Business${formData.plan === 'professional' ? ' ($497)' : ' (Free)'} →`
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
            <h1 className="onboarding-title">Welcome to Launchfly! 🚀</h1>
            <p className="onboarding-subtitle">
              Your AI is setting up your business. You'll be redirected to your dashboard in a moment...
            </p>
            <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
          </div>
        )}
      </div>
    </>
  );
}
