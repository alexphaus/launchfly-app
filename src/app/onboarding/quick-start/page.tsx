'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { trackOnboardingStart, trackStepCompleted, trackValidationError, trackOnboardingCompleted } from '../../../lib/onboarding-analytics';
import PlanPreviewModal from '../../../components/PlanPreviewModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Niche templates configuration
const NICHE_TEMPLATES = {
  'executive-coaching': {
    name: 'Executive Coaching',
    icon: '👔',
    description: 'Leadership & Strategy',
    defaultTitle: 'The 5-Pillar Leadership Audit',
    defaultAudience: 'C-Suite Executives & VPs'
  },
  'fitness-coaching': {
    name: 'Fitness & Health',
    icon: '💪',
    description: 'Physical Transformation',
    defaultTitle: '15-Minute Morning Mobility Routine',
    defaultAudience: 'Busy Professionals'
  },
  'life-coaching': {
    name: 'Life & Mindset',
    icon: '🧘',
    description: 'Personal Growth',
    defaultTitle: '7 Days to Mental Clarity Journal',
    defaultAudience: 'Overwhelmed Achievers'
  },
  'business-coaching': {
    name: 'Business Growth',
    icon: '📈',
    description: 'Scaling & Operations',
    defaultTitle: 'The $1M Revenue Roadmap',
    defaultAudience: 'Small Business Owners'
  },
  'relationship-coaching': {
    name: 'Relationships',
    icon: '❤️',
    description: 'Connection & Communication',
    defaultTitle: '5 Scripts for Difficult Conversations',
    defaultAudience: 'Couples seeking connection'
  },
  'career-coaching': {
    name: 'Career Development',
    icon: '🚀',
    description: 'Career Advancement',
    defaultTitle: 'The Resume That Gets You Hired',
    defaultAudience: 'Ambitious Professionals'
  },
  'custom': {
    name: 'Custom Niche',
    icon: '✨',
    description: 'Your Unique Expertise',
    defaultTitle: 'The Ultimate Guide to [Topic]',
    defaultAudience: 'Your Ideal Clients'
  }
};

export default function QuickStartOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [subdomainStatus, setSubdomainStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    suggestion: string | null;
  }>({ checking: false, available: null, suggestion: null });
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    niche: searchParams.get('niche') || 'custom',
    plan: searchParams.get('plan') || 'starter',
    subdomain: '',
    
    // Funnel Specifics
    targetAudience: '',
    mainProblem: '',
    leadMagnetTitle: '',
    leadMagnetLanguage: 'English'
  });

  const selectedNiche = NICHE_TEMPLATES[formData.niche as keyof typeof NICHE_TEMPLATES] || NICHE_TEMPLATES['custom'];

  // Pre-fill defaults when niche changes
  useEffect(() => {
    if (selectedNiche && !formData.targetAudience && formData.niche !== 'custom') {
      setFormData(prev => ({
        ...prev,
        targetAudience: selectedNiche.defaultAudience,
        leadMagnetTitle: selectedNiche.defaultTitle
      }));
    }
  }, [selectedNiche, formData.niche]);

  // Track onboarding start and check for payment success
  useEffect(() => {
    trackOnboardingStart('quick-start', formData.niche, formData.plan);
    
    // Check if returning from successful payment
    const sessionId = searchParams.get('session_id');
    if (sessionId && searchParams.get('payment') === 'success') {
      setPaymentSessionId(sessionId);
      // Restore form data from URL params
      const subdomain = searchParams.get('subdomain');
      if (subdomain) {
        setFormData(prev => ({ ...prev, subdomain: decodeURIComponent(subdomain) }));
      }
      setCurrentStep(3); // Skip to final step after payment
    }
  }, [formData.niche, formData.plan, searchParams]);

  // Auto-generate subdomain based on niche/title
  useEffect(() => {
    if (selectedNiche && !formData.subdomain && formData.leadMagnetTitle) {
      // Try to make a subdomain from the title or niche
      const base = formData.leadMagnetTitle.split(' ').slice(0, 3).join('-');
      setFormData(prev => ({
        ...prev,
        subdomain: generateSubdomain(base)
      }));
    }
  }, [selectedNiche, formData.leadMagnetTitle]);

  const generateSubdomain = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) + '-' + Math.random().toString(36).substr(2, 4);
  };

  const checkSubdomainAvailability = async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus({ checking: false, available: null, suggestion: null });
      return;
    }

    setSubdomainStatus({ checking: true, available: null, suggestion: null });

    try {
      const response = await fetch(`/api/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
      const result = await response.json();

      if (response.ok) {
        setSubdomainStatus({
          checking: false,
          available: result.available,
          suggestion: result.suggestion
        });

        if (!result.available && result.error) {
          setErrors(prev => ({ ...prev, subdomain: result.error }));
        } else if (result.available) {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.subdomain;
            return newErrors;
          });
        }
      } else {
        setSubdomainStatus({ checking: false, available: null, suggestion: null });
      }
    } catch (error) {
      console.error('Error checking subdomain:', error);
      setSubdomainStatus({ checking: false, available: null, suggestion: null });
    }
  };

  // Debounced subdomain checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.subdomain) {
        checkSubdomainAvailability(formData.subdomain);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.subdomain]);

  const handleProceedToCheckout = async () => {
    setIsLoading(true);
    try {
      // Create checkout session
      const response = await fetch('/api/stripe/professional-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          niche: formData.niche,
          subdomain: formData.subdomain,
          returnUrl: window.location.href
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Save form data to localStorage before redirecting
      localStorage.setItem('launchfly_onboarding_data', JSON.stringify(formData));
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      setErrors({ submit: 'Failed to start checkout. Please try again.' });
      setIsLoading(false);
      setShowPlanPreview(false);
    }
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      
      if (!formData.name) newErrors.name = 'Name is required';
    }

    if (step === 2) {
      if (!formData.targetAudience) newErrors.targetAudience = 'Target audience is required';
      if (!formData.leadMagnetTitle) newErrors.leadMagnetTitle = 'Lead magnet title is required';
      if (!formData.subdomain) newErrors.subdomain = 'Subdomain is required';
    }

    // Track validation errors
    Object.entries(newErrors).forEach(([field, error]) => {
      trackValidationError(step, field, error);
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    
    // If moving from step 2 to step 3 with professional plan, show plan preview
    if (currentStep === 2 && formData.plan === 'professional' && !paymentSessionId) {
      setShowPlanPreview(true);
      return;
    }
    
    const stepNames = ['account_creation', 'funnel_details', 'review'];
    trackStepCompleted(currentStep, stepNames[currentStep - 1], {
      niche: formData.niche,
      plan: formData.plan
    });
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name
          }
        }
      });

      if (authError) throw authError;

      // Submit business creation request
      const response = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          niche: formData.niche,
          nicheName: selectedNiche.name,
          targetAudience: formData.targetAudience,
          mainProblem: formData.mainProblem,
          leadMagnetTitle: formData.leadMagnetTitle,
          leadMagnetLanguage: formData.leadMagnetLanguage,
          subdomain: formData.subdomain,
          plan: formData.plan,
          userId: authData.user?.id,
          paymentSessionId: paymentSessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create business');
      }

      const result = await response.json();
      
      // Track successful completion
      trackOnboardingCompleted({
        niche: formData.niche,
        plan: formData.plan,
        subdomain: formData.subdomain,
        sessionId: result.sessionId
      });
      
      // Redirect to dashboard with session ID
      router.push(`/dashboard/${result.sessionId}`);
      
    } catch (error) {
      console.error('Onboarding error:', error);
      setErrors({ submit: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding/quick-start?step=2&niche=${formData.niche}&plan=${formData.plan}`
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Social login error:', error);
      setErrors({ social: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <span className="onboarding-logo-icon">⚡</span>
          <span className="onboarding-logo-text">Launchfly</span>
        </div>
        <div className="onboarding-progress">
          <div className="progress-step active"></div>
          <div className="progress-step"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Create Your Account</h1>
        <p className="onboarding-subtitle">
          Start building your {selectedNiche.name} funnel in minutes.
        </p>

        <div style={{ 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          border: '1px solid rgba(59, 130, 246, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{selectedNiche.icon}</span>
            <h3 style={{ margin: 0, color: '#1e40af' }}>{selectedNiche.name}</h3>
          </div>
          <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem' }}>
            {selectedNiche.description}
          </p>
        </div>

        <div className="social-login">
          <button 
            className="social-btn" 
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>

        <div className="divider">
          <span>or sign up with email</span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className={`form-input ${errors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter your email"
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Create a password (6+ characters)"
            />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          {errors.social && <div className="form-error">{errors.social}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? <div className="loading-spinner"></div> : 'Continue'}
          </button>
        </form>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <span className="onboarding-logo-icon">⚡</span>
          <span className="onboarding-logo-text">Launchfly</span>
        </div>
        <div className="onboarding-progress">
          <div className="progress-step completed"></div>
          <div className="progress-step active"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Define Your Funnel</h1>
        <p className="onboarding-subtitle">
          Tell us about your ideal client so we can generate the perfect lead magnet.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
          
          <div className="form-group">
            <label className="form-label">Who is your ideal client?</label>
            <input
              type="text"
              className={`form-input ${errors.targetAudience ? 'error' : ''}`}
              value={formData.targetAudience}
              onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="e.g. Overwhelmed corporate executives"
            />
            {errors.targetAudience && <div className="form-error">{errors.targetAudience}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">What is the main problem you solve for them?</label>
            <input
              type="text"
              className={`form-input ${errors.mainProblem ? 'error' : ''}`}
              value={formData.mainProblem}
              onChange={(e) => setFormData(prev => ({ ...prev, mainProblem: e.target.value }))}
              placeholder="e.g. Lack of work-life balance and burnout"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lead Magnet Title (Free Guide)</label>
            <input
              type="text"
              className={`form-input ${errors.leadMagnetTitle ? 'error' : ''}`}
              value={formData.leadMagnetTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, leadMagnetTitle: e.target.value }))}
              placeholder="e.g. The 5-Step Burnout Recovery Plan"
            />
            {errors.leadMagnetTitle && <div className="form-error">{errors.leadMagnetTitle}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Content Language</label>
            <select 
              className="form-input"
              value={formData.leadMagnetLanguage}
              onChange={(e) => setFormData(prev => ({ ...prev, leadMagnetLanguage: e.target.value }))}
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Your Funnel URL</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className={`form-input ${errors.subdomain ? 'error' : subdomainStatus.available === false ? 'error' : subdomainStatus.available === true ? 'success' : ''}`}
                  value={formData.subdomain}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  }))}
                  placeholder="your-funnel-name"
                  style={{ 
                    paddingRight: subdomainStatus.checking || subdomainStatus.available !== null ? '2.5rem' : '1rem'
                  }}
                />
                {subdomainStatus.checking && (
                  <div style={{ 
                    position: 'absolute', 
                    right: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)'
                  }}>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                  </div>
                )}
                {!subdomainStatus.checking && subdomainStatus.available === true && (
                  <div style={{ 
                    position: 'absolute', 
                    right: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#10b981',
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </div>
                )}
                {!subdomainStatus.checking && subdomainStatus.available === false && (
                  <div style={{ 
                    position: 'absolute', 
                    right: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#ef4444',
                    fontWeight: 'bold'
                  }}>
                    ✗
                  </div>
                )}
              </div>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>.launchfly.com</span>
            </div>
            {errors.subdomain && <div className="form-error">{errors.subdomain}</div>}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleBack}
              style={{ flex: 1 }}
            >
              Back
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <div className="loading-spinner"></div> : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <span className="onboarding-logo-icon">⚡</span>
          <span className="onboarding-logo-text">Launchfly</span>
        </div>
        <div className="onboarding-progress">
          <div className="progress-step completed"></div>
          <div className="progress-step completed"></div>
          <div className="progress-step active"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Ready to Launch!</h1>
        <p className="onboarding-subtitle">
          Review your details before we generate your funnel.
        </p>

        <div style={{ 
          background: '#f8fafc', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1a1a1a' }}>Funnel Summary</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Niche:</span>
              <span style={{ fontWeight: '600' }}>{selectedNiche.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Target Audience:</span>
              <span style={{ fontWeight: '600' }}>{formData.targetAudience}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Lead Magnet:</span>
              <span style={{ fontWeight: '600' }}>{formData.leadMagnetTitle}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>URL:</span>
              <span style={{ fontWeight: '600' }}>{formData.subdomain}.launchfly.com</span>
            </div>
          </div>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          border: '1px solid rgba(34, 197, 94, 0.2)'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>✨</span> What happens next?
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#15803d' }}>
            <li>AI writes your PDF Guide ({formData.leadMagnetLanguage})</li>
            <li>AI builds your Landing Page</li>
            <li>AI writes your Email Follow-up Sequence</li>
            <li>Your funnel goes live instantly</li>
          </ul>
        </div>

        {formData.plan === 'professional' && !paymentSessionId && (
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            border: '1px solid rgba(251, 191, 36, 0.3)'
          }}>
            <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
              <strong>⚠️ Payment Required:</strong> Professional plan requires a one-time payment of $497 to proceed.
            </p>
          </div>
        )}
        
        {errors.submit && <div className="form-error" style={{ marginBottom: '1rem' }}>{errors.submit}</div>}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleBack}
            style={{ flex: 1 }}
          >
            Back
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            style={{ flex: 2 }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner"></div>
                Generating Funnel...
              </>
            ) : (
              <>
                🚀 Generate My Funnel
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      
      <PlanPreviewModal
        isOpen={showPlanPreview}
        onClose={() => setShowPlanPreview(false)}
        onConfirm={handleProceedToCheckout}
        selectedPlan="professional"
        businessName={formData.leadMagnetTitle}
        subdomain={formData.subdomain}
      />
    </>
  );
}
