'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './onboarding.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Account Setup
    fullName: '',
    email: '',
    password: '',
    phone: '',
    
    // Step 2: Business Customization
    businessName: '',
    targetAudience: '',
    pricePoint: 'recommended',
    customPrice: '',
    
    // Step 3: Payment
    paymentMethod: 'card',
    promoCode: '',
    agreedToTerms: false
  });

  // Form validation errors
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    // Get selected business from sessionStorage
    const businessData = sessionStorage.getItem('selectedBusiness');
    if (businessData) {
      setSelectedBusiness(JSON.parse(businessData));
    } else {
      // Redirect back to marketplace if no business selected
      router.push('/marketplace');
    }
  }, [router]);

  const validateStep = (step: number) => {
    const newErrors: any = {};

    if (step === 1) {
      if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    }

    if (step === 2) {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!formData.targetAudience.trim()) newErrors.targetAudience = 'Target audience is required';
      if (formData.pricePoint === 'custom' && !formData.customPrice) {
        newErrors.customPrice = 'Please enter a custom price';
      }
    }

    if (step === 3) {
      if (!formData.agreedToTerms) newErrors.agreedToTerms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    // Simulate API call to create account and business
    setTimeout(() => {
      // Store user data (in real app, this would be handled by auth)
      localStorage.setItem('user', JSON.stringify({
        name: formData.fullName,
        email: formData.email,
        businessId: selectedBusiness?.id,
        businessName: formData.businessName
      }));
      
      // Clear session storage
      sessionStorage.removeItem('selectedBusiness');
      
      // Redirect to dashboard
      router.push('/dashboard');
    }, 2000);
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: undefined }));
    }
  };

  if (!selectedBusiness) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const getPriceRecommendation = () => {
    switch (selectedBusiness?.id) {
      case 'ai-resume-writer': return '$97';
      case 'fitness-meal-plans': return '$67';
      case 'logo-design-service': return '$147';
      case 'social-media-manager': return '$297/mo';
      case 'b2b-lead-generation': return '$497';
      case 'virtual-staging': return '$97';
      default: return '$97';
    }
  };

  return (
    <div className="onboarding-container">
      {/* Header */}
      <header className="onboarding-header">
        <div className="container">
          <Link href="/" className="logo">
            <span className="gradient-text">Launchfly</span>
          </Link>
          <div className="progress-indicator">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
            <span className="progress-text">Step {currentStep} of 3</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="onboarding-content">
        <div className="container">
          <div className="onboarding-wrapper">
            {/* Left side - Form */}
            <div className="form-section">
              {currentStep === 1 && (
                <div className="step-content">
                  <h1>Create Your Account</h1>
                  <p className="step-description">
                    Let's get you set up with your new {selectedBusiness.name} business
                  </p>

                  <form onSubmit={(e) => e.preventDefault()}>
                    <div className="form-group">
                      <label htmlFor="fullName">Full Name</label>
                      <input
                        type="text"
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => updateFormData('fullName', e.target.value)}
                        placeholder="John Doe"
                        className={errors.fullName ? 'error' : ''}
                      />
                      {errors.fullName && <span className="error-message">{errors.fullName}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        value={formData.email}
                        onChange={(e) => updateFormData('email', e.target.value)}
                        placeholder="john@example.com"
                        className={errors.email ? 'error' : ''}
                      />
                      {errors.email && <span className="error-message">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="password">Password</label>
                      <input
                        type="password"
                        id="password"
                        value={formData.password}
                        onChange={(e) => updateFormData('password', e.target.value)}
                        placeholder="At least 8 characters"
                        className={errors.password ? 'error' : ''}
                      />
                      {errors.password && <span className="error-message">{errors.password}</span>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className={errors.phone ? 'error' : ''}
                      />
                      {errors.phone && <span className="error-message">{errors.phone}</span>}
                      <p className="field-note">We'll text you when you make your first sale!</p>
                    </div>
                  </form>
                </div>
              )}

              {currentStep === 2 && (
                <div className="step-content">
                  <h1>Customize Your Business</h1>
                  <p className="step-description">
                    Make the {selectedBusiness.name} uniquely yours
                  </p>

                  <form onSubmit={(e) => e.preventDefault()}>
                    <div className="form-group">
                      <label htmlFor="businessName">Your Business Name</label>
                      <input
                        type="text"
                        id="businessName"
                        value={formData.businessName}
                        onChange={(e) => updateFormData('businessName', e.target.value)}
                        placeholder={`e.g., ${selectedBusiness.name} Pro`}
                        className={errors.businessName ? 'error' : ''}
                      />
                      {errors.businessName && <span className="error-message">{errors.businessName}</span>}
                      <p className="field-note">This is what your customers will see</p>
                    </div>

                    <div className="form-group">
                      <label htmlFor="targetAudience">Target Audience</label>
                      <textarea
                        id="targetAudience"
                        value={formData.targetAudience}
                        onChange={(e) => updateFormData('targetAudience', e.target.value)}
                        placeholder="e.g., Tech professionals, Remote workers, Recent graduates"
                        className={errors.targetAudience ? 'error' : ''}
                        rows={3}
                      />
                      {errors.targetAudience && <span className="error-message">{errors.targetAudience}</span>}
                      <p className="field-note">We'll optimize your marketing for this audience</p>
                    </div>

                    <div className="form-group">
                      <label>Pricing Strategy</label>
                      <div className="price-options">
                        <label className="price-option">
                          <input
                            type="radio"
                            name="pricePoint"
                            value="recommended"
                            checked={formData.pricePoint === 'recommended'}
                            onChange={(e) => updateFormData('pricePoint', e.target.value)}
                          />
                          <div className="option-content">
                            <span className="option-title">Recommended Price</span>
                            <span className="option-value">{getPriceRecommendation()}</span>
                            <span className="option-note">Optimized for conversions</span>
                          </div>
                        </label>

                        <label className="price-option">
                          <input
                            type="radio"
                            name="pricePoint"
                            value="premium"
                            checked={formData.pricePoint === 'premium'}
                            onChange={(e) => updateFormData('pricePoint', e.target.value)}
                          />
                          <div className="option-content">
                            <span className="option-title">Premium Price</span>
                            <span className="option-value">+30% Higher</span>
                            <span className="option-note">Position as luxury</span>
                          </div>
                        </label>

                        <label className="price-option">
                          <input
                            type="radio"
                            name="pricePoint"
                            value="custom"
                            checked={formData.pricePoint === 'custom'}
                            onChange={(e) => updateFormData('pricePoint', e.target.value)}
                          />
                          <div className="option-content">
                            <span className="option-title">Custom Price</span>
                            <input
                              type="text"
                              placeholder="$"
                              value={formData.customPrice}
                              onChange={(e) => updateFormData('customPrice', e.target.value)}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateFormData('pricePoint', 'custom');
                              }}
                              className={errors.customPrice ? 'error' : ''}
                            />
                          </div>
                        </label>
                      </div>
                      {errors.customPrice && <span className="error-message">{errors.customPrice}</span>}
                    </div>
                  </form>
                </div>
              )}

              {currentStep === 3 && (
                <div className="step-content">
                  <h1>Complete Your Purchase</h1>
                  <p className="step-description">
                    Secure your {selectedBusiness.name} and start making money
                  </p>

                  <form onSubmit={(e) => e.preventDefault()}>
                    {/* Order Summary */}
                    <div className="order-summary">
                      <h3>Order Summary</h3>
                      <div className="summary-item">
                        <span>{selectedBusiness.name}</span>
                        <span>{selectedBusiness.price}</span>
                      </div>
                      <div className="summary-item">
                        <span>Setup & Training</span>
                        <span>FREE</span>
                      </div>
                      <div className="summary-item">
                        <span>90-Day Support</span>
                        <span>Included</span>
                      </div>
                      <div className="summary-divider"></div>
                      <div className="summary-item total">
                        <span>Total Due Today</span>
                        <span>{selectedBusiness.price}</span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="form-group">
                      <label>Payment Method</label>
                      <div className="payment-options">
                        <label className="payment-option">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="card"
                            checked={formData.paymentMethod === 'card'}
                            onChange={(e) => updateFormData('paymentMethod', e.target.value)}
                          />
                          <span>Credit/Debit Card</span>
                        </label>
                        <label className="payment-option">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="paypal"
                            checked={formData.paymentMethod === 'paypal'}
                            onChange={(e) => updateFormData('paymentMethod', e.target.value)}
                          />
                          <span>PayPal</span>
                        </label>
                      </div>
                    </div>

                    {/* Promo Code */}
                    <div className="form-group">
                      <label htmlFor="promoCode">Promo Code (Optional)</label>
                      <div className="promo-input">
                        <input
                          type="text"
                          id="promoCode"
                          value={formData.promoCode}
                          onChange={(e) => updateFormData('promoCode', e.target.value)}
                          placeholder="Enter code"
                        />
                        <button type="button" className="apply-btn">Apply</button>
                      </div>
                    </div>

                    {/* Terms Agreement */}
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.agreedToTerms}
                          onChange={(e) => updateFormData('agreedToTerms', e.target.checked)}
                        />
                        <span>
                          I agree to the <a href="/terms" target="_blank">Terms of Service</a> and understand 
                          that my business comes with a 30-day money-back guarantee
                        </span>
                      </label>
                      {errors.agreedToTerms && <span className="error-message">{errors.agreedToTerms}</span>}
                    </div>

                    {/* Trust Badges */}
                    <div className="trust-badges">
                      <div className="badge">
                        <span className="badge-icon">🔒</span>
                        <span>Secure Checkout</span>
                      </div>
                      <div className="badge">
                        <span className="badge-icon">💰</span>
                        <span>Money Back Guarantee</span>
                      </div>
                      <div className="badge">
                        <span className="badge-icon">⚡</span>
                        <span>Instant Access</span>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="form-navigation">
                {currentStep > 1 && (
                  <button 
                    className="btn-secondary" 
                    onClick={handleBack}
                    disabled={isLoading}
                  >
                    Back
                  </button>
                )}
                <button 
                  className="btn-primary" 
                  onClick={handleNext}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="loading-text">Processing...</span>
                  ) : currentStep === 3 ? (
                    'Complete Purchase'
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </div>

            {/* Right side - Business Preview */}
            <div className="preview-section">
              <div className="business-preview-card">
                <h3>{selectedBusiness.name}</h3>
                <p className="tagline">{selectedBusiness.tagline}</p>
                
                <div className="preview-stats">
                  <div className="stat">
                    <strong>{selectedBusiness.monthlyRevenue}</strong>
                    <span>Monthly Revenue</span>
                  </div>
                  <div className="stat">
                    <strong>{selectedBusiness.customerCount}</strong>
                    <span>Ready Customers</span>
                  </div>
                </div>

                <div className="guarantees-preview">
                  <h4>Your Guarantees:</h4>
                  {selectedBusiness.guarantees?.map((guarantee: string, idx: number) => (
                    <div key={idx} className="guarantee-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {guarantee}
                    </div>
                  ))}
                </div>

                <div className="support-info">
                  <h4>Need Help?</h4>
                  <p>Our team is standing by</p>
                  <a href="mailto:support@launchfly.ai" className="support-link">
                    support@launchfly.ai
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
