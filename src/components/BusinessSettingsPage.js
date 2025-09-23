// src/components/BusinessSettingsPage.js
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Settings, User, Globe, Bell, Shield, CreditCard, AlertCircle, X, CheckCircle, ExternalLink } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const SettingsSection = ({ title, description, icon, children }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    boxShadow: theme.shadows.md,
    overflow: 'hidden',
    marginBottom: '24px'
  }}>
    <div style={{
      padding: '20px',
      borderBottom: `1px solid ${theme.colors.borderLight}`,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        background: theme.colors.bgLight,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.primary
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, margin: 0 }}>
          {title}
        </h3>
        <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: '2px 0 0 0' }}>
          {description}
        </p>
      </div>
    </div>
    <div style={{ padding: '20px' }}>
      {children}
    </div>
  </div>
);

const FormField = ({ label, type = 'text', value, onChange, placeholder, error, disabled = false, helper, options }) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
      {label}
    </label>
    {type === 'select' ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px',
          border: `1px solid ${error ? theme.colors.danger : theme.colors.borderLight}`,
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          background: disabled ? theme.colors.bgLight : 'white',
          color: disabled ? theme.colors.textGray : theme.colors.textDark
        }}
      >
        {options?.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : type === 'textarea' ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px',
          border: `1px solid ${error ? theme.colors.danger : theme.colors.borderLight}`,
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          minHeight: '80px',
          resize: 'vertical',
          fontFamily: 'inherit',
          background: disabled ? theme.colors.bgLight : 'white',
          color: disabled ? theme.colors.textGray : theme.colors.textDark
        }}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px',
          border: `1px solid ${error ? theme.colors.danger : theme.colors.borderLight}`,
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          background: disabled ? theme.colors.bgLight : 'white',
          color: disabled ? theme.colors.textGray : theme.colors.textDark
        }}
      />
    )}
    {error && (
      <p style={{ fontSize: '12px', color: theme.colors.danger, margin: '4px 0 0 0' }}>
        {error}
      </p>
    )}
    {helper && (
      <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
        {helper}
      </p>
    )}
  </div>
);

const ToggleSwitch = ({ label, value, onChange, disabled = false, description }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
      <div>
        <label style={{ fontSize: '14px', fontWeight: '600', color: theme.colors.textDark }}>
          {label}
        </label>
        {description && (
          <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: '2px 0 0 0' }}>
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        style={{
          width: '48px',
          height: '24px',
          borderRadius: '12px',
          border: 'none',
          background: value ? theme.colors.primary : theme.colors.borderLight,
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '2px',
          left: value ? '26px' : '2px',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </button>
    </div>
  </div>
);

const BusinessSettingsPage = ({ business, onBack }) => {
  const [settings, setSettings] = useState({
    businessName: '',
    subdomain: '',
    description: '',
    industry: '',
    email: '',
    phone: '',
    website: '',
    businessType: 'service',
    targetAudience: '',
    valueProposition: '',
    timezone: 'America/New_York',
    currency: 'USD',
    language: 'en',
    stripeConnected: false,
    bankConnected: false,
    emailNotifications: true,
    smsNotifications: false,
    webhookUrl: '',
    customDomain: '',
    googleAnalytics: '',
    facebookPixel: '',
    aiAgentEnabled: true,
    autoFulfillment: true,
    autoMarketing: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

  const timezoneOptions = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' }
  ];

  const currencyOptions = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' },
    { value: 'JPY', label: 'Japanese Yen (¥)' }
  ];

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' }
  ];

  const businessTypeOptions = [
    { value: 'service', label: 'Service Business' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'saas', label: 'Software (SaaS)' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'agency', label: 'Agency' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchSettings();
  }, [business?.id]);

  const fetchSettings = async () => {
    if (!business?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/settings?businessId=${business.id}`);
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
      } else {
        setError('Failed to fetch business settings');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to fetch business settings');
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = () => {
    const newErrors = {};
    
    if (!settings.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    
    if (!settings.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(settings.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (settings.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(settings.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (settings.webhookUrl && !/^https?:\/\/.+/.test(settings.webhookUrl)) {
      newErrors.webhookUrl = 'Please enter a valid URL starting with http:// or https://';
    }
    
    if (settings.customDomain && !/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(settings.customDomain)) {
      newErrors.customDomain = 'Please enter a valid domain name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/business/manage/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          settings
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessId: business.id, 
          email: settings.email 
        })
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to start Stripe Connect setup');
      }
    } catch (err) {
      console.error('Error connecting Stripe:', err);
      setError('Failed to connect payment processor');
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.colors.bgLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: theme.colors.textGray }}>
          <Settings size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          Loading business settings...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.colors.bgLight,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px',
              background: 'white',
              border: `1px solid ${theme.colors.borderLight}`,
              borderRadius: '8px',
              cursor: 'pointer',
              color: theme.colors.textGray,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
            onMouseLeave={e => e.target.style.background = 'white'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              Business Settings
            </h1>
            <p style={{ fontSize: '16px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
              Update your business name and other details
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              background: saving ? theme.colors.textGray : theme.colors.primary,
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div style={{
            background: '#fee',
            border: `1px solid ${theme.colors.danger}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.danger
          }}>
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: theme.colors.danger,
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div style={{
            background: '#e7f5e7',
            border: `1px solid ${theme.colors.success}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.success
          }}>
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* Basic Information */}
        <SettingsSection
          title="Basic Information"
          description="Core details about your business"
          icon={<User size={20} />}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <FormField
              label="Business Name"
              value={settings.businessName}
              onChange={(value) => updateSetting('businessName', value)}
              placeholder="Your Business Name"
              error={errors.businessName}
            />
            <FormField
              label="Industry"
              value={settings.industry}
              onChange={(value) => updateSetting('industry', value)}
              placeholder="e.g., Marketing, Healthcare, Finance"
            />
          </div>
          
          <FormField
            label="Business Description"
            type="textarea"
            value={settings.description}
            onChange={(value) => updateSetting('description', value)}
            placeholder="Describe what your business does and how it helps customers"
          />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <FormField
              label="Business Type"
              type="select"
              value={settings.businessType}
              onChange={(value) => updateSetting('businessType', value)}
              options={businessTypeOptions}
            />
            <FormField
              label="Subdomain"
              value={settings.subdomain}
              onChange={(value) => updateSetting('subdomain', value)}
              placeholder="your-business"
              helper="Your website will be available at your-business.launchfly.ai"
              disabled={true}
            />
          </div>
        </SettingsSection>

        {/* Contact Information */}
        <SettingsSection
          title="Contact Information"
          description="How customers can reach you"
          icon={<Globe size={20} />}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <FormField
              label="Email Address"
              type="email"
              value={settings.email}
              onChange={(value) => updateSetting('email', value)}
              placeholder="contact@yourbusiness.com"
              error={errors.email}
            />
            <FormField
              label="Phone Number"
              type="tel"
              value={settings.phone}
              onChange={(value) => updateSetting('phone', value)}
              placeholder="+1 (555) 123-4567"
              error={errors.phone}
            />
          </div>
          
          <FormField
            label="Website URL"
            type="url"
            value={settings.website}
            onChange={(value) => updateSetting('website', value)}
            placeholder="https://yourbusiness.com"
            helper="Your main website (optional)"
          />
        </SettingsSection>

        {/* Regional Settings */}
        <SettingsSection
          title="Regional Settings"
          description="Timezone, currency, and language preferences"
          icon={<Globe size={20} />}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <FormField
              label="Timezone"
              type="select"
              value={settings.timezone}
              onChange={(value) => updateSetting('timezone', value)}
              options={timezoneOptions}
            />
            <FormField
              label="Currency"
              type="select"
              value={settings.currency}
              onChange={(value) => updateSetting('currency', value)}
              options={currencyOptions}
            />
            <FormField
              label="Language"
              type="select"
              value={settings.language}
              onChange={(value) => updateSetting('language', value)}
              options={languageOptions}
            />
          </div>
        </SettingsSection>

        {/* Payment Settings */}
        <SettingsSection
          title="Payment Settings"
          description="Configure how you receive payments"
          icon={<CreditCard size={20} />}
        >
          <div style={{
            padding: '16px',
            background: settings.stripeConnected ? '#e7f5e7' : theme.colors.bgLight,
            borderRadius: '8px',
            border: `1px solid ${settings.stripeConnected ? theme.colors.success : theme.colors.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.textDark, margin: '0 0 4px 0' }}>
                Payment Processing
              </h4>
              <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>
                {settings.stripeConnected 
                  ? 'Your Stripe account is connected and ready to receive payments'
                  : 'Connect your bank account to receive payments directly'
                }
              </p>
            </div>
            {settings.stripeConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.colors.success }}>
                <CheckCircle size={20} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Connected</span>
              </div>
            ) : (
              <button
                onClick={handleConnectStripe}
                style={{
                  padding: '8px 16px',
                  background: theme.colors.primary,
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Connect Bank
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </SettingsSection>

        {/* Notification Settings */}
        <SettingsSection
          title="Notifications"
          description="Choose how you want to be notified about your business"
          icon={<Bell size={20} />}
        >
          <ToggleSwitch
            label="Email Notifications"
            description="Receive email alerts for sales, new customers, and important updates"
            value={settings.emailNotifications}
            onChange={(value) => updateSetting('emailNotifications', value)}
          />
          
          <ToggleSwitch
            label="SMS Notifications"
            description="Get text messages for urgent alerts (requires phone number)"
            value={settings.smsNotifications}
            onChange={(value) => updateSetting('smsNotifications', value)}
            disabled={!settings.phone}
          />
          
          <FormField
            label="Webhook URL"
            type="url"
            value={settings.webhookUrl}
            onChange={(value) => updateSetting('webhookUrl', value)}
            placeholder="https://your-app.com/webhook"
            helper="Optional: Receive real-time data updates at this URL"
            error={errors.webhookUrl}
          />
        </SettingsSection>

        {/* AI & Automation Settings */}
        <SettingsSection
          title="AI & Automation"
          description="Configure your AI assistant and automated processes"
          icon={<Shield size={20} />}
        >
          <ToggleSwitch
            label="AI Agent Enabled"
            description="Allow AI to actively work on growing your business"
            value={settings.aiAgentEnabled}
            onChange={(value) => updateSetting('aiAgentEnabled', value)}
          />
          
          <ToggleSwitch
            label="Auto Fulfillment"
            description="Automatically fulfill orders and deliver products/services"
            value={settings.autoFulfillment}
            onChange={(value) => updateSetting('autoFulfillment', value)}
          />
          
          <ToggleSwitch
            label="Auto Marketing"
            description="Let AI handle marketing campaigns and customer acquisition"
            value={settings.autoMarketing}
            onChange={(value) => updateSetting('autoMarketing', value)}
          />
        </SettingsSection>
      </div>
    </div>
  );
};

export default BusinessSettingsPage;
