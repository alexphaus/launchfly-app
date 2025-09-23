// Full content for new file
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Save, Building, Edit, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

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

const BusinessSettings = ({ session, business, onBack }) => {
  const [settings, setSettings] = useState({
    businessName: business?.business_data?.businessName || business?.name || '',
    tagline: business?.business_data?.tagline || '',
    ownerName: business?.owner_name || '',
    email: business?.email || business?.form_data?.email || '',
    subdomain: business?.subdomain || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [subdomainStatus, setSubdomainStatus] = useState({ checking: false, available: true, message: '' });

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const validateSubdomain = async (sub) => {
    if (!sub) {
        setSubdomainStatus({ checking: false, available: false, message: '' });
        return 'Subdomain is required';
    }
    if (!/^[a-z0-9-]{3,63}$/.test(sub)) {
        setSubdomainStatus({ checking: false, available: false, message: 'Invalid format.' });
        return 'Subdomain must be 3-63 lowercase letters, numbers, or hyphens';
    }
    if (sub.startsWith('-') || sub.endsWith('-')) {
        setSubdomainStatus({ checking: false, available: false, message: 'Cannot start/end with hyphen.' });
        return 'Subdomain cannot start or end with hyphen';
    }
    
    if (sub === business.subdomain) {
        setSubdomainStatus({ checking: false, available: true, message: 'This is your current subdomain.' });
        return null;
    }

    setSubdomainStatus({ checking: true, available: false, message: 'Checking availability...' });
    
    try {
      const response = await fetch(`/api/business/check-subdomain?subdomain=${encodeURIComponent(sub)}&businessId=${business.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to check subdomain');
      
      setSubdomainStatus({ 
        checking: false, 
        available: data.available, 
        message: data.available ? 'Available!' : 'Subdomain already taken'
      });
      
      return data.available ? null : 'Subdomain already taken';
    } catch (error) {
      setSubdomainStatus({ checking: false, available: false, message: 'Error checking availability' });
      return 'Error checking subdomain';
    }
  };

  const handleSave = async () => {
    if (!settings.businessName.trim()) {
      setErrors({ businessName: 'Business name is required' });
      return;
    }

    const subdomainError = await validateSubdomain(settings.subdomain);
    if (subdomainError) {
      setErrors({ subdomain: subdomainError });
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const partialData = {
        businessName: settings.businessName,
        tagline: settings.tagline
      };

      const response = await fetch('/api/business/update-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          partialData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // Also update top-level business fields if changed
      const businessUpdates = {};
      if (settings.ownerName !== business.owner_name) businessUpdates.owner_name = settings.ownerName;
      if (settings.email !== business.email) businessUpdates.email = settings.email;
      if (settings.subdomain !== business.subdomain) businessUpdates.subdomain = settings.subdomain.toLowerCase();

      if (Object.keys(businessUpdates).length > 0) {
        const updateResponse = await fetch('/api/business/update', { // Assume a general update endpoint, or adjust
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            updates: businessUpdates
          })
        });
        if (!updateResponse.ok) {
            const result = await updateResponse.json();
            throw new Error(result.error || 'Failed to update business details.');
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setErrors({ global: error.message || 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight,
      paddingBottom: '40px'
    }}>
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
          <button onClick={onBack} style={{
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
          }}>
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
            Business Settings
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: theme.shadows.lg, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Building size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>Business Details</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Business Name</label>
              <input
                value={settings.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${errors.businessName ? theme.colors.error : theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
              {errors.businessName && <p style={{ color: theme.colors.error, fontSize: '14px', marginTop: '4px' }}>{errors.businessName}</p>}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Tagline</label>
              <input
                value={settings.tagline}
                onChange={(e) => handleChange('tagline', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Subdomain</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={settings.subdomain}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    handleChange('subdomain', value);
                  }}
                  onBlur={(e) => validateSubdomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    paddingRight: '110px',
                    border: `2px solid ${errors.subdomain ? theme.colors.error : (subdomainStatus.available && settings.subdomain ? theme.colors.success : theme.colors.borderLight)}`,
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: theme.colors.textGray }}>
                  .launchfly.ai
                </span>
              </div>
              {subdomainStatus.checking ? (
                 <p style={{ fontSize: '14px', color: theme.colors.textGray, marginTop: '4px' }}>{subdomainStatus.message}</p>
              ) : subdomainStatus.message && (
                 <p style={{ fontSize: '14px', color: subdomainStatus.available ? theme.colors.success : theme.colors.error, marginTop: '4px' }}>{subdomainStatus.message}</p>
              )}
              {errors.subdomain && <p style={{ color: theme.colors.error, fontSize: '14px', marginTop: '4px' }}>{errors.subdomain}</p>}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Owner Name</label>
              <input
                value={settings.ownerName}
                onChange={(e) => handleChange('ownerName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Email</label>
              <input
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ 
          position: 'sticky',
          bottom: 0,
          background: theme.colors.bgLight,
          padding: '16px 24px',
          margin: '0 -24px 0 -24px'
        }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              width: '100%',
              background: saveSuccess ? theme.colors.success : theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : saveSuccess ? <CheckCircle size={20} /> : <Save size={20} />}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
          {errors.global && (
            <p style={{ color: theme.colors.error, fontSize: '14px', marginTop: '8px', textAlign: 'center' }}>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {errors.global}
            </p>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BusinessSettings;
