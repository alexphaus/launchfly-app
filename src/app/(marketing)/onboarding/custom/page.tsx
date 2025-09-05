'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PlanPreviewModal from '../../../../components/PlanPreviewModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CustomBusinessOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0); // Start with plan selection
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
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
    businessIdea: searchParams.get('idea') || '',
    targetAudience: '',
    skills: '',
    budget: '',
    timeCommitment: '',
    businessName: '',
    subdomain: '',
    plan: '' // User will select plan in step 0
  });

  // Check for payment success on component mount
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId && searchParams.get('payment') === 'success') {
      setPaymentSessionId(sessionId);
      
      // Restore form data from localStorage
      const savedData = localStorage.getItem('launchfly_custom_onboarding_data');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setFormData(prev => ({ ...prev, ...parsedData }));
          localStorage.removeItem('launchfly_custom_onboarding_data'); // Clean up
        } catch (error) {
          console.error('Error restoring form data:', error);
        }
      }
      
      // Restore form data from URL params if available
      const businessName = searchParams.get('businessName');
      const subdomain = searchParams.get('subdomain');
      if (businessName) {
        setFormData(prev => ({ ...prev, businessName: decodeURIComponent(businessName) }));
      }
      if (subdomain) {
        setFormData(prev => ({ ...prev, subdomain: decodeURIComponent(subdomain) }));
      }
      
      setCurrentStep(5); // Skip to final step after payment
    }
  }, [searchParams]);

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
          template: 'custom',
          businessName: formData.businessName,
          subdomain: formData.subdomain,
          returnUrl: window.location.href
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Save form data to localStorage before redirecting
      localStorage.setItem('launchfly_custom_onboarding_data', JSON.stringify(formData));
      
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

    if (step === 0) {
      if (!formData.plan) newErrors.plan = 'Please select a plan';
    }

    if (step === 1) {
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      
      if (!formData.name) newErrors.name = 'Name is required';
    }

    if (step === 2) {
      if (!formData.businessIdea) newErrors.businessIdea = 'Business idea is required';
      if (!formData.targetAudience) newErrors.targetAudience = 'Target audience is required';
      if (!formData.skills) newErrors.skills = 'Skills/interests are required';
    }

    if (step === 5) {
      if (!formData.businessName) newErrors.businessName = 'Business name is required';
      if (!formData.subdomain) newErrors.subdomain = 'Subdomain is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 2) {
      // Trigger AI analysis
      setIsLoading(true);
      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Analyze this business idea and provide recommendations:
            
            Business Idea: ${formData.businessIdea}
            Target Audience: ${formData.targetAudience}
            Skills: ${formData.skills}
            Budget: ${formData.budget}
            Time Commitment: ${formData.timeCommitment}
            
            Please provide:
            1. Business viability score (1-10)
            2. Suggested business name
            3. Revenue model recommendations
            4. Key success factors
            5. Potential challenges
            6. Suggested pricing structure`,
            businessContext: 'idea-analysis'
          })
        });

        if (response.ok) {
          const analysis = await response.json();
          setAiAnalysis(analysis);
          
          // Auto-generate business name and subdomain from AI suggestion
          if (analysis.suggestedBusinessName) {
            const subdomain = analysis.suggestedBusinessName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 20) + '-' + Math.random().toString(36).substr(2, 4);
              
            setFormData(prev => ({
              ...prev,
              businessName: analysis.suggestedBusinessName,
              subdomain
            }));
          }
        }
      } catch (error) {
        console.error('AI analysis error:', error);
        // Continue without analysis
      } finally {
        setIsLoading(false);
      }
    }

    // If moving from step 4 to step 5 with professional plan, show plan preview
    if (currentStep === 4 && formData.plan === 'professional' && !paymentSessionId) {
      setShowPlanPreview(true);
      return;
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
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
          niche: formData.businessIdea,
          skills: formData.skills,
          availability: formData.timeCommitment,
          subdomain: formData.subdomain,
          budget: formData.budget,
          plan: formData.plan,
          businessName: formData.businessName,
          customIdea: formData.businessIdea,
          targetAudience: formData.targetAudience,
          aiAnalysis: aiAnalysis,
          userId: authData.user?.id,
          paymentSessionId: paymentSessionId // Include payment session ID for professional plan
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create business');
      }

      const result = await response.json();
      
      // Redirect to dashboard
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
          redirectTo: `${window.location.origin}/onboarding/custom?step=2&idea=${encodeURIComponent(formData.businessIdea)}`
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

  const renderStep0 = () => (
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
          <div className="progress-step"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Choose Your Plan</h1>
        <p className="onboarding-subtitle">
          Select the plan that best fits your business goals
        </p>

        {formData.businessIdea && (
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💡</span>
              <h3 style={{ margin: 0, color: '#92400e' }}>Your Business Idea</h3>
            </div>
            <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
              "{formData.businessIdea}"
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          {/* Starter Plan */}
          <div 
            className={`plan-card ${formData.plan === 'starter' ? 'selected' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, plan: 'starter' }))}
            style={{
              border: formData.plan === 'starter' ? '2px solid #667eea' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              cursor: 'pointer',
              background: formData.plan === 'starter' ? 'rgba(102, 126, 234, 0.05)' : 'white',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1a1a1a' }}>Starter</h3>
              <div style={{ 
                background: '#10b981', 
                color: 'white', 
                padding: '0.25rem 0.75rem', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: '600' 
              }}>
                FREE
              </div>
            </div>
            <p style={{ color: '#6b7280', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
              Perfect for testing your business idea
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#374151' }}>
              <li>20% revenue share</li>
              <li>Access to starter templates</li>
              <li>50-100 customers included</li>
              <li>Community support</li>
            </ul>
          </div>

          {/* Professional Plan */}
          <div 
            className={`plan-card ${formData.plan === 'professional' ? 'selected' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, plan: 'professional' }))}
            style={{
              border: formData.plan === 'professional' ? '2px solid #667eea' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              cursor: 'pointer',
              background: formData.plan === 'professional' ? 'rgba(102, 126, 234, 0.05)' : 'white',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <div style={{ 
              position: 'absolute', 
              top: '-10px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              background: '#667eea', 
              color: 'white', 
              padding: '0.25rem 1rem', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: '600' 
            }}>
              RECOMMENDED
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1a1a1a' }}>Professional</h3>
              <div style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white', 
                padding: '0.25rem 0.75rem', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: '600' 
              }}>
                $497 LIFETIME
              </div>
            </div>
            <p style={{ color: '#6b7280', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
              Maximum profit potential with premium features
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#374151' }}>
              <li><strong>Only 10% revenue share</strong></li>
              <li>Access to ALL premium templates</li>
              <li>100-200 customers included</li>
              <li>Priority customer allocation</li>
              <li>Advanced AI optimization</li>
              <li>Priority support</li>
            </ul>
          </div>
        </div>

        {errors.plan && <div className="form-error" style={{ marginBottom: '1rem' }}>{errors.plan}</div>}

        <button 
          className="btn btn-primary btn-full" 
          onClick={handleNext}
          disabled={!formData.plan}
        >
          Continue with {formData.plan ? (formData.plan === 'starter' ? 'Starter (Free)' : 'Professional') : 'Selected Plan'}
        </button>
      </div>
    </>
  );

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
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Create Your Account</h1>
        <p className="onboarding-subtitle">
          Let's turn your custom business idea into reality
        </p>

        {formData.businessIdea && (
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💡</span>
              <h3 style={{ margin: 0, color: '#92400e' }}>Your Business Idea</h3>
            </div>
            <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>
              "{formData.businessIdea}"
            </p>
          </div>
        )}

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
          <div className="progress-step"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Tell Us About Your Idea</h1>
        <p className="onboarding-subtitle">
          Help our AI understand your vision so we can build the perfect business for you
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
          <div className="form-group">
            <label className="form-label">Business Idea</label>
            <textarea
              className={`form-input ${errors.businessIdea ? 'error' : ''}`}
              value={formData.businessIdea}
              onChange={(e) => setFormData(prev => ({ ...prev, businessIdea: e.target.value }))}
              placeholder="Describe your business idea in detail..."
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
            {errors.businessIdea && <div className="form-error">{errors.businessIdea}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience</label>
            <input
              type="text"
              className={`form-input ${errors.targetAudience ? 'error' : ''}`}
              value={formData.targetAudience}
              onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="Who are your ideal customers?"
            />
            {errors.targetAudience && <div className="form-error">{errors.targetAudience}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Your Skills & Interests</label>
            <input
              type="text"
              className={`form-input ${errors.skills ? 'error' : ''}`}
              value={formData.skills}
              onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
              placeholder="What are you good at or passionate about?"
            />
            {errors.skills && <div className="form-error">{errors.skills}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Budget Range</label>
            <select
              className="form-input"
              value={formData.budget}
              onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
            >
              <option value="">Select budget range</option>
              <option value="low">$0 - $500</option>
              <option value="medium">$500 - $2,000</option>
              <option value="high">$2,000+</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Time Commitment</label>
            <select
              className="form-input"
              value={formData.timeCommitment}
              onChange={(e) => setFormData(prev => ({ ...prev, timeCommitment: e.target.value }))}
            >
              <option value="">Select time commitment</option>
              <option value="part-time">Part-time (5-10 hours/week)</option>
              <option value="full-time">Full-time (40+ hours/week)</option>
              <option value="passive">Passive (minimal involvement)</option>
            </select>
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
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  Analyzing...
                </>
              ) : (
                'Analyze My Idea'
              )}
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
          <div className="progress-step"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Review Your Details</h1>
        <p className="onboarding-subtitle">
          Let's review your business idea details before AI analysis
        </p>

        <div style={{ 
          background: '#f8fafc', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1a1a1a' }}>Business Summary</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Plan:</span>
              <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                {formData.plan}
                {formData.plan === 'professional' && (
                  <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>($497 lifetime)</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Business Idea:</span>
              <span style={{ fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>
                {formData.businessIdea}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Target Audience:</span>
              <span style={{ fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>
                {formData.targetAudience}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>Your Skills:</span>
              <span style={{ fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>
                {formData.skills}
              </span>
            </div>
          </div>
        </div>

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
            onClick={handleNext}
            style={{ flex: 2 }}
          >
            Analyze My Idea with AI
          </button>
        </div>
      </div>
    </>
  );

  const renderStep4 = () => (
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
          <div className="progress-step"></div>
          <div className="progress-step"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">AI Analysis Results</h1>
        <p className="onboarding-subtitle">
          Our AI has analyzed your business idea and created a custom plan
        </p>

        {aiAnalysis ? (
          <div style={{ 
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🤖</span>
              <h3 style={{ margin: 0, color: '#1e40af' }}>AI Business Analysis</h3>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {aiAnalysis.viabilityScore && (
                <div>
                  <strong style={{ color: '#1e40af' }}>Viability Score: </strong>
                  <span style={{ 
                    background: aiAnalysis.viabilityScore >= 7 ? '#dcfce7' : aiAnalysis.viabilityScore >= 5 ? '#fef3c7' : '#fecaca',
                    color: aiAnalysis.viabilityScore >= 7 ? '#166534' : aiAnalysis.viabilityScore >= 5 ? '#92400e' : '#991b1b',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontWeight: '600'
                  }}>
                    {aiAnalysis.viabilityScore}/10
                  </span>
                </div>
              )}
              
              {aiAnalysis.suggestedBusinessName && (
                <div>
                  <strong style={{ color: '#1e40af' }}>Suggested Name: </strong>
                  <span>{aiAnalysis.suggestedBusinessName}</span>
                </div>
              )}
              
              {aiAnalysis.revenueModel && (
                <div>
                  <strong style={{ color: '#1e40af' }}>Revenue Model: </strong>
                  <span>{aiAnalysis.revenueModel}</span>
                </div>
              )}
              
              {aiAnalysis.keySuccessFactors && (
                <div>
                  <strong style={{ color: '#1e40af' }}>Success Factors: </strong>
                  <span>{aiAnalysis.keySuccessFactors}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ 
            background: '#f8fafc', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280', margin: 0 }}>
              AI analysis is being prepared. Your business will be optimized based on your inputs.
            </p>
          </div>
        )}

        <button 
          className="btn btn-primary btn-full" 
          onClick={handleNext}
        >
          Continue to Setup
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleBack}
          >
            Back to Edit Details
          </button>
        </div>
      </div>
    </>
  );

  const renderStep5 = () => (
    <>
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <span className="onboarding-logo-icon">⚡</span>
          <span className="onboarding-logo-text">Launchfly</span>
        </div>
        <div className="onboarding-progress">
          <div className="progress-step completed"></div>
          <div className="progress-step completed"></div>
          <div className="progress-step completed"></div>
          <div className="progress-step completed"></div>
          <div className="progress-step active"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Launch Your Business</h1>
        <p className="onboarding-subtitle">
          Final step - set up your business details and launch
        </p>

        {paymentSessionId && (
          <div style={{ 
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <p style={{ margin: 0, color: '#15803d', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✅</span> <strong>Payment Confirmed!</strong> Your Professional plan is active.
            </p>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              type="text"
              className={`form-input ${errors.businessName ? 'error' : ''}`}
              value={formData.businessName}
              onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
              placeholder="Enter your business name"
            />
            {errors.businessName && <div className="form-error">{errors.businessName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Website Address</label>
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
                  placeholder="your-business"
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
            {!errors.subdomain && subdomainStatus.available === false && subdomainStatus.suggestion && (
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Try: <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, subdomain: subdomainStatus.suggestion! }))}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#667eea', 
                    textDecoration: 'underline', 
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit'
                  }}
                >
                  {subdomainStatus.suggestion}
                </button>
              </div>
            )}
            {!errors.subdomain && subdomainStatus.available === true && (
              <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.5rem' }}>
                ✓ Available! Your website will be {formData.subdomain}.launchfly.com
              </div>
            )}
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
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating Business...
                </>
              ) : (
                <>
                  🚀 Launch My Business
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );

  return (
    <>
      {currentStep === 0 && renderStep0()}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
      {currentStep === 5 && renderStep5()}
      
      <PlanPreviewModal
        isOpen={showPlanPreview}
        onClose={() => setShowPlanPreview(false)}
        onConfirm={handleProceedToCheckout}
        selectedPlan="professional"
        businessName={formData.businessName}
        subdomain={formData.subdomain}
      />
    </>
  );
}
