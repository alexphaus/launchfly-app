// src/components/BusinessSettingsPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Globe, Shield, AlertTriangle, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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
    warning: '#ffc107',
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
    warning: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
  }
};

const BusinessSettingsPage = ({ session, business, onBack }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    description: '',
    industry: '',
    ownerName: '',
    ownerEmail: '',
    customDomain: '',
    seoTitle: '',
    seoDescription: ''
  });

  useEffect(() => {
    if (business) {
      const businessFormData = business.form_data || {};
      const businessData = business.business_data || {};
      
      setFormData({
        name: business.name || businessData.businessName || '',
        subdomain: business.subdomain || '',
        description: businessData.description || businessFormData.description || '',
        industry: businessData.industry || businessFormData.industry || '',
        ownerName: businessFormData.name || businessFormData.full_name || '',
        ownerEmail: businessFormData.email || business.owner_email || '',
        customDomain: businessData.customDomain || '',
        seoTitle: businessData.seoTitle || business.name || '',
        seoDescription: businessData.seoDescription || businessData.tagline || ''
      });
    }
  }, [business]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Business name is required';
    if (!formData.subdomain.trim()) newErrors.subdomain = 'Subdomain is required';
    if (!formData.ownerEmail.trim()) newErrors.ownerEmail = 'Email is required';
    return newErrors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const response = await fetch(`/api/business/${business.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Save error:', error);
      setErrors({ save: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'domain', label: 'Domain', icon: Globe },
    { id: 'advanced', label: 'Advanced', icon: Shield }
  ];

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
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Settings size={24} color={theme.colors.primary} />
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                Business Settings
              </h1>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? theme.colors.textGray : theme.gradients.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Success Message */}
      {success && (
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto 24px',
          padding: '0 24px'
        }}>
          <div style={{
            background: '#d4edda',
            border: `1px solid ${theme.colors.success}`,
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={18} color={theme.colors.success} />
            <span style={{ color: theme.colors.success, fontWeight: '600' }}>{success}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          {/* Sidebar Navigation */}
          <div style={{ width: '240px' }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '8px',
              boxShadow: theme.shadows.lg,
              position: 'sticky',
              top: '120px'
            }}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      border: 'none',
                      borderRadius: '8px',
                      background: isActive ? theme.colors.primary : 'none',
                      color: isActive ? 'white' : theme.colors.textDark,
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginBottom: '4px'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.target.style.background = theme.colors.bgLight;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.target.style.background = 'none';
                      }
                    }}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div style={{ flex: 1 }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: theme.shadows.lg
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: theme.colors.textDark,
                marginBottom: '8px'
              }}>
                {activeTab === 'general' && 'General Settings'}
                {activeTab === 'domain' && 'Domain Settings'}
                {activeTab === 'advanced' && 'Advanced Settings'}
              </h2>
              <p style={{
                fontSize: '16px',
                color: theme.colors.textGray,
                marginBottom: '32px'
              }}>
                {activeTab === 'general' && 'Basic information about your business'}
                {activeTab === 'domain' && 'Configure your website domain'}
                {activeTab === 'advanced' && 'SEO and advanced configuration'}
              </p>

              {activeTab === 'general' && (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Business Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Your Business Name"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `2px solid ${errors.name ? theme.colors.error : theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.target.style.borderColor = theme.colors.primary}
                        onBlur={e => e.target.style.borderColor = errors.name ? theme.colors.error : theme.colors.borderLight}
                      />
                      {errors.name && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: theme.colors.error, 
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertCircle size={14} />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Subdomain *
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={formData.subdomain}
                          onChange={(e) => handleChange('subdomain', e.target.value.toLowerCase())}
                          placeholder="yourbusiness"
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            border: `2px solid ${errors.subdomain ? theme.colors.error : theme.colors.borderLight}`,
                            borderRadius: '8px 0 0 8px',
                            fontSize: '16px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={e => e.target.style.borderColor = theme.colors.primary}
                          onBlur={e => e.target.style.borderColor = errors.subdomain ? theme.colors.error : theme.colors.borderLight}
                        />
                        <span style={{
                          padding: '12px 16px',
                          background: theme.colors.bgLight,
                          border: `2px solid ${errors.subdomain ? theme.colors.error : theme.colors.borderLight}`,
                          borderLeft: 'none',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '16px',
                          color: theme.colors.textGray
                        }}>
                          .launchfly.app
                        </span>
                      </div>
                      {errors.subdomain && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: theme.colors.error, 
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertCircle size={14} />
                          {errors.subdomain}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Describe what your business does..."
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                      onFocus={e => e.target.style.borderColor = theme.colors.primary}
                      onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Industry
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => handleChange('industry', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `2px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select Industry</option>
                        <option value="technology">Technology</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="finance">Finance</option>
                        <option value="education">Education</option>
                        <option value="retail">Retail</option>
                        <option value="consulting">Consulting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Owner Email *
                      </label>
                      <input
                        type="email"
                        value={formData.ownerEmail}
                        onChange={(e) => handleChange('ownerEmail', e.target.value)}
                        placeholder="owner@business.com"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `2px solid ${errors.ownerEmail ? theme.colors.error : theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.target.style.borderColor = theme.colors.primary}
                        onBlur={e => e.target.style.borderColor = errors.ownerEmail ? theme.colors.error : theme.colors.borderLight}
                      />
                      {errors.ownerEmail && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: theme.colors.error, 
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertCircle size={14} />
                          {errors.ownerEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'domain' && (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      Custom Domain
                    </label>
                    <input
                      type="text"
                      value={formData.customDomain}
                      onChange={(e) => handleChange('customDomain', e.target.value)}
                      placeholder="www.yourbusiness.com"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={e => e.target.style.borderColor = theme.colors.primary}
                      onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                    />
                    <p style={{
                      fontSize: '12px',
                      color: theme.colors.textGray,
                      marginTop: '6px'
                    }}>
                      Enter your custom domain. You'll need to update DNS settings to point to our servers.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      SEO Title
                    </label>
                    <input
                      type="text"
                      value={formData.seoTitle}
                      onChange={(e) => handleChange('seoTitle', e.target.value)}
                      placeholder="Your Business - Professional Services"
                      maxLength={60}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={e => e.target.style.borderColor = theme.colors.primary}
                      onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                    />
                    <p style={{
                      fontSize: '12px',
                      color: theme.colors.textGray,
                      marginTop: '4px'
                    }}>
                      {formData.seoTitle.length}/60 characters
                    </p>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      SEO Description
                    </label>
                    <textarea
                      value={formData.seoDescription}
                      onChange={(e) => handleChange('seoDescription', e.target.value)}
                      placeholder="A brief description of your business for search engines"
                      maxLength={160}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                      onFocus={e => e.target.style.borderColor = theme.colors.primary}
                      onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                    />
                    <p style={{
                      fontSize: '12px',
                      color: theme.colors.textGray,
                      marginTop: '4px'
                    }}>
                      {formData.seoDescription.length}/160 characters
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errors.save && (
                <div style={{
                  background: '#f8d7da',
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={18} color={theme.colors.error} />
                  <span style={{ color: theme.colors.error, fontSize: '14px' }}>{errors.save}</span>
                </div>
              )}
            </div>
          </div>
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

export default BusinessSettingsPage;