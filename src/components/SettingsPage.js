// src/components/SettingsPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, CreditCard, CheckCircle, AlertCircle, Loader2, User, Mail, Shield, Bell } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
    orange: '#f59e0b',
    error: '#dc3545',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
    xl: '0 24px 32px rgba(26, 43, 72, 0.12)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
  }
};

const SettingsPage = ({ session, business, onBack, onPhoneUpdate, onBankUpdate }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [bankSuccess, setBankSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  // Get current setup status
  const setupStatus = {
    phone: business?.phone_number || business?.contact_phone || false,
    bank: business?.bank_connected || business?.bank_account || !!business?.stripe_connect_account_id || false
  };

  // Initialize phone number from business data
  useEffect(() => {
    if (setupStatus.phone) {
      setPhoneNumber(setupStatus.phone);
    }
  }, [setupStatus.phone]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setErrors({ phone: 'Phone number is required' });
      return;
    }

    // Basic phone validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      setErrors({ phone: 'Please enter a valid phone number' });
      return;
    }

    setIsPhoneLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/phone/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          phoneNumber: phoneNumber.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update phone number');
      }

      setPhoneSuccess(true);
      setTimeout(() => setPhoneSuccess(false), 3000);
      
      // Call parent callback to refresh data
      if (onPhoneUpdate) {
        onPhoneUpdate(phoneNumber.trim());
      }

    } catch (error) {
      console.error('Phone update error:', error);
      setErrors({ phone: error.message || 'Failed to update phone number' });
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const handleBankSetup = async () => {
    setIsBankLoading(true);
    setErrors({});

    try {
      const email = business?.form_data?.email || business?.email || business?.owner_email;
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessId: business.id, 
          email 
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start bank account setup');
      }

      // Redirect to Stripe Connect onboarding
      window.location.href = data.url;

    } catch (error) {
      console.error('Bank setup error:', error);
      setErrors({ bank: error.message || 'Failed to start bank account setup' });
    } finally {
      setIsBankLoading(false);
    }
  };

  // Get user info for profile section
  const formData = business?.form_data || {};
  const userName = formData.name || formData.full_name || business?.owner_name || 'User';
  const userEmail = formData.email || business?.email || business?.owner_email;
  const userPlan = business?.plan || formData.plan || 'starter';

  const planDisplayMap = {
    'starter': 'Starter',
    'pro': 'Pro', 
    'professional': 'Pro',
    'scale': 'Scale',
    'enterprise': 'Enterprise'
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight,
      paddingBottom: '40px'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
        padding: '20px 0',
        marginBottom: '32px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: theme.colors.textGray,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
            onMouseLeave={e => e.target.style.background = 'none'}
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          
          <div style={{ 
            height: '24px', 
            width: '1px', 
            background: theme.colors.borderLight 
          }} />
          
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: theme.colors.textDark,
            margin: 0
          }}>
            Settings
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>

        {/* Profile Section */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <User size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
              Profile
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                background: theme.gradients.primary,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: '700'
              }}
            >
              {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '4px' }}>
                {userName}
              </h3>
              <p style={{ fontSize: '16px', color: theme.colors.textGray, marginBottom: '8px' }}>
                {userEmail}
              </p>
              <span 
                style={{
                  fontSize: '14px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  background: theme.colors.primary,
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                {planDisplayMap[userPlan] || 'Starter'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Setup Section */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Shield size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
              Quick Setup
            </h2>
          </div>

          {/* Phone Number Setup */}
          <div style={{
            padding: '20px',
            border: `2px solid ${setupStatus.phone ? theme.colors.success : theme.colors.borderLight}`,
            borderRadius: '12px',
            marginBottom: '16px',
            background: setupStatus.phone ? '#f0f9ff' : 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Phone size={20} color={setupStatus.phone ? theme.colors.success : theme.colors.textGray} />
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                Phone Number
              </h3>
              {setupStatus.phone && <CheckCircle size={20} color={theme.colors.success} />}
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.textGray, 
              marginBottom: '16px' 
            }}>
              Get instant SMS alerts for sales and visitor activity
            </p>

            <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${errors.phone ? theme.colors.error : theme.colors.borderLight}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = theme.colors.primary}
                  onBlur={e => e.target.style.borderColor = errors.phone ? theme.colors.error : theme.colors.borderLight}
                />
                {errors.phone && (
                  <p style={{ 
                    fontSize: '14px', 
                    color: theme.colors.error, 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={16} />
                    {errors.phone}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isPhoneLoading}
                style={{
                  background: phoneSuccess ? theme.colors.success : theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isPhoneLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  opacity: isPhoneLoading ? 0.6 : 1
                }}
              >
                {isPhoneLoading ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : phoneSuccess ? (
                  <CheckCircle size={16} />
                ) : null}
                {isPhoneLoading ? 'Saving...' : phoneSuccess ? 'Saved!' : setupStatus.phone ? 'Update' : 'Save'}
              </button>
            </form>
          </div>

          {/* Bank Account Setup */}
          <div style={{
            padding: '20px',
            border: `2px solid ${setupStatus.bank ? theme.colors.success : theme.colors.borderLight}`,
            borderRadius: '12px',
            background: setupStatus.bank ? '#f0f9ff' : 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <CreditCard size={20} color={setupStatus.bank ? theme.colors.success : theme.colors.textGray} />
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                Bank Account
              </h3>
              {setupStatus.bank && <CheckCircle size={20} color={theme.colors.success} />}
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.textGray, 
              marginBottom: '16px' 
            }}>
              Connect your bank account to receive payments instantly
            </p>

            {setupStatus.bank ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(40, 167, 69, 0.1)',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.success}`
              }}>
                <CheckCircle size={20} color={theme.colors.success} />
                <span style={{ color: theme.colors.success, fontWeight: '600' }}>
                  Bank account connected
                </span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleBankSetup}
                  disabled={isBankLoading}
                  style={{
                    background: theme.colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isBankLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    opacity: isBankLoading ? 0.6 : 1
                  }}
                  onMouseEnter={e => !isBankLoading && (e.target.style.background = theme.colors.primaryDark)}
                  onMouseLeave={e => !isBankLoading && (e.target.style.background = theme.colors.primary)}
                >
                  {isBankLoading ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CreditCard size={16} />
                  )}
                  {isBankLoading ? 'Setting up...' : 'Connect Bank Account'}
                </button>
                {errors.bank && (
                  <p style={{ 
                    fontSize: '14px', 
                    color: theme.colors.error, 
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={16} />
                    {errors.bank}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Bell size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
              Notifications
            </h2>
          </div>

          <div style={{
            padding: '16px',
            background: theme.colors.bgLight,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.borderLight}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Mail size={18} color={theme.colors.textGray} />
              <span style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.textDark }}>
                Email Notifications
              </span>
            </div>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, marginLeft: '30px' }}>
              You'll receive email updates about sales, visitor activity, and AI progress at {userEmail}
            </p>
          </div>

          {setupStatus.phone && (
            <div style={{
              padding: '16px',
              background: theme.colors.bgLight,
              borderRadius: '12px',
              border: `1px solid ${theme.colors.borderLight}`,
              marginTop: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Phone size={18} color={theme.colors.textGray} />
                <span style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.textDark }}>
                  SMS Notifications
                </span>
              </div>
              <p style={{ fontSize: '14px', color: theme.colors.textGray, marginLeft: '30px' }}>
                You'll receive instant SMS alerts for sales and important updates at {setupStatus.phone}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;
