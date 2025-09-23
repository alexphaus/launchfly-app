// Full content for new file
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Save, Palette, Type, Edit, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

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

const CustomizeWebsite = ({ session, business, onBack }) => {
  const [customTheme, setCustomTheme] = useState(business?.business_data?.theme || {});
  const [heroProps, setHeroProps] = useState(
    business?.business_data?.layout?.find(sec => sec.component === 'Hero')?.props || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const handleThemeChange = (field, value) => {
    setCustomTheme(prev => ({ ...prev, [field]: value }));
  };

  const handleHeroChange = (field, value) => {
    setHeroProps(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});

    try {
      // Prepare updated layout
      const updatedLayout = business.business_data.layout.map(sec => 
        sec.component === 'Hero' ? { ...sec, props: heroProps } : sec
      );

      const partialData = {
        theme: customTheme,
        layout: updatedLayout
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
        throw new Error('Failed to update website customizations');
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
            Customize Website
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        {/* Theme Section */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginBottom: '24px', boxShadow: theme.shadows.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Palette size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>Theme</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Primary Color</label>
              <input
                type="color"
                value={customTheme.colors?.primary || '#007BFF'}
                onChange={(e) => handleThemeChange('colors', { ...customTheme.colors, primary: e.target.value })}
                style={{ width: '100%', height: '40px', border: `2px solid ${theme.colors.borderLight}`, borderRadius: '8px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Secondary Color</label>
              <input
                type="color"
                value={customTheme.colors?.secondary || '#00B8D9'}
                onChange={(e) => handleThemeChange('colors', { ...customTheme.colors, secondary: e.target.value })}
                style={{ width: '100%', height: '40px', border: `2px solid ${theme.colors.borderLight}`, borderRadius: '8px' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Font</label>
              <select
                value={customTheme.font || 'Inter'}
                onChange={(e) => handleThemeChange('font', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              >
                <option>Inter</option>
                <option>Roboto</option>
                <option>Poppins</option>
                <option>Open Sans</option>
              </select>
            </div>
          </div>
        </div>

        {/* Marketing Copy Section */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginBottom: '24px', boxShadow: theme.shadows.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Edit size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>Marketing Copy</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Hero Title</label>
              <input
                value={heroProps.title || ''}
                onChange={(e) => handleHeroChange('title', e.target.value)}
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
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Hero Subtitle</label>
              <textarea
                value={heroProps.subtitle || ''}
                onChange={(e) => handleHeroChange('subtitle', e.target.value)}
                rows={3}
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
              <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Button Text</label>
              <input
                value={heroProps.buttonText || ''}
                onChange={(e) => handleHeroChange('buttonText', e.target.value)}
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

        {/* Save Button */}
        <div style={{ 
          position: 'sticky',
          bottom: 0,
          background: theme.colors.bgLight,
          padding: '16px 24px',
          margin: '0 -24px'
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
            {isSaving ? (
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            ) : saveSuccess ? (
              <CheckCircle size={20} />
            ) : (
              <Save size={20} />
            )}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
          
          {errors.global && (
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.error, 
              marginTop: '8px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <AlertCircle size={16} />
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

export default CustomizeWebsite;
