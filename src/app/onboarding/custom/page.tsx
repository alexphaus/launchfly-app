'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CustomBusinessOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  
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
    plan: 'professional' // Custom businesses default to professional
  });

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
      if (!formData.businessIdea) newErrors.businessIdea = 'Business idea is required';
      if (!formData.targetAudience) newErrors.targetAudience = 'Target audience is required';
      if (!formData.skills) newErrors.skills = 'Skills/interests are required';
    }

    if (step === 4) {
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
          niche: formData.businessIdea,
          skills: formData.skills,
          availability: formData.timeCommitment,
          subdomain: formData.subdomain,
          budget: formData.budget,
          plan: formData.plan,
          businessName: formData.businessName,
          customIdea: formData.businessIdea,
          targetAudience: formData.targetAudience,
          aiAnalysis: aiAnalysis
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
          <div className="progress-step completed"></div>
          <div className="progress-step active"></div>
        </div>
      </div>

      <div className="onboarding-content">
        <h1 className="onboarding-title">Launch Your Business</h1>
        <p className="onboarding-subtitle">
          Final step - set up your business details and launch
        </p>

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
              <input
                type="text"
                className={`form-input ${errors.subdomain ? 'error' : ''}`}
                value={formData.subdomain}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                }))}
                placeholder="your-business"
                style={{ flex: 1 }}
              />
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>.launchfly.com</span>
            </div>
            {errors.subdomain && <div className="form-error">{errors.subdomain}</div>}
          </div>

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
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </>
  );
}
