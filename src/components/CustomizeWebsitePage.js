// src/components/CustomizeWebsitePage.js
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Eye, Palette, Type, Layout, AlertCircle, X, Sparkles } from 'lucide-react';

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

const ColorPicker = ({ label, value, onChange, presets = [] }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
      {label}
    </label>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '40px',
          height: '40px',
          border: `2px solid ${theme.colors.borderLight}`,
          borderRadius: '8px',
          cursor: 'pointer',
          background: 'none'
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '10px 12px',
          border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '6px',
          fontSize: '14px',
          fontFamily: 'monospace'
        }}
        placeholder="#000000"
      />
    </div>
    {presets.length > 0 && (
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {presets.map((preset, index) => (
          <button
            key={index}
            onClick={() => onChange(preset)}
            style={{
              width: '24px',
              height: '24px',
              background: preset,
              border: `2px solid ${value === preset ? theme.colors.primary : theme.colors.borderLight}`,
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title={preset}
          />
        ))}
      </div>
    )}
  </div>
);

const FontSelector = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `1px solid ${theme.colors.borderLight}`,
        borderRadius: '6px',
        fontSize: '14px',
        background: 'white',
        fontFamily: value
      }}
    >
      {options.map(option => (
        <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const PreviewCard = ({ websiteData }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    boxShadow: theme.shadows.md,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.borderLight}`
  }}>
    {/* Preview Header */}
    <div style={{
      background: websiteData.theme?.gradient || 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
      padding: '40px 24px',
      color: 'white',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{websiteData.logo}</div>
      <h1 style={{ 
        fontSize: '32px', 
        fontWeight: '700', 
        margin: '0 0 12px 0',
        fontFamily: websiteData.theme?.font || 'Inter, system-ui, sans-serif'
      }}>
        {websiteData.businessName}
      </h1>
      <p style={{ 
        fontSize: '18px', 
        opacity: 0.9, 
        margin: 0,
        fontFamily: websiteData.theme?.font || 'Inter, system-ui, sans-serif'
      }}>
        {websiteData.tagline}
      </p>
    </div>
    
    {/* Preview Content */}
    <div style={{ padding: '24px' }}>
      <div style={{ 
        color: websiteData.theme?.colors?.text || theme.colors.textDark,
        fontFamily: websiteData.theme?.font || 'Inter, system-ui, sans-serif'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          marginBottom: '12px',
          color: websiteData.theme?.colors?.primary || theme.colors.primary
        }}>
          About Us
        </h2>
        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.6', 
          color: websiteData.theme?.colors?.textLight || theme.colors.textGray,
          marginBottom: '20px'
        }}>
          {websiteData.description}
        </p>
        
        <button style={{
          background: websiteData.theme?.colors?.primary || theme.colors.primary,
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: '600',
          fontFamily: websiteData.theme?.font || 'Inter, system-ui, sans-serif'
        }}>
          Get Started
        </button>
      </div>
    </div>
  </div>
);

const CustomizeWebsitePage = ({ business, onBack }) => {
  const [websiteData, setWebsiteData] = useState({
    businessName: '',
    tagline: '',
    description: '',
    logo: '🚀',
    theme: {
      colors: {
        primary: '#007BFF',
        secondary: '#00B8D9',
        accent: '#28a745',
        text: '#1A2B48',
        textLight: '#5A6982'
      },
      gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
      font: 'Inter, system-ui, sans-serif'
    },
    hero: {
      title: '',
      subtitle: '',
      description: '',
      ctaText: 'Get Started',
      backgroundType: 'gradient'
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('colors');

  const colorPresets = [
    '#007BFF', '#6f42c1', '#e83e8c', '#dc3545', '#fd7e14',
    '#ffc107', '#28a745', '#20c997', '#17a2b8', '#6c757d'
  ];

  const fontOptions = [
    { label: 'Inter (Modern)', value: 'Inter, system-ui, sans-serif' },
    { label: 'Helvetica (Classic)', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Georgia (Elegant)', value: 'Georgia, serif' },
    { label: 'Roboto (Clean)', value: 'Roboto, sans-serif' },
    { label: 'Playfair (Luxury)', value: 'Playfair Display, serif' },
    { label: 'Montserrat (Bold)', value: 'Montserrat, sans-serif' },
    { label: 'Source Sans (Professional)', value: 'Source Sans Pro, sans-serif' }
  ];

  useEffect(() => {
    fetchWebsiteData();
  }, [business?.id]);

  const fetchWebsiteData = async () => {
    if (!business?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/website?businessId=${business.id}`);
      const data = await response.json();
      
      if (data.success) {
        setWebsiteData(data.websiteData);
      } else {
        setError('Failed to fetch website data');
      }
    } catch (err) {
      console.error('Error fetching website data:', err);
      setError('Failed to fetch website data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/business/manage/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          websiteData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Show success feedback
        const originalButtonText = 'Save Changes';
        setSaving(false);
        // Could add success toast here
      } else {
        setError(data.error || 'Failed to save changes');
        setSaving(false);
      }
    } catch (err) {
      console.error('Error saving website data:', err);
      setError('Failed to save changes');
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (business?.subdomain) {
      window.open(`https://app.launchfly.ai/sites/${business.subdomain}`, '_blank');
    }
  };

  const updateThemeColor = (colorKey, value) => {
    setWebsiteData(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        colors: {
          ...prev.theme.colors,
          [colorKey]: value
        },
        gradient: colorKey === 'primary' ? 
          `linear-gradient(135deg, ${value} 0%, ${prev.theme.colors.secondary} 100%)` :
          colorKey === 'secondary' ?
          `linear-gradient(135deg, ${prev.theme.colors.primary} 0%, ${value} 100%)` :
          prev.theme.gradient
      }
    }));
  };

  const updateFont = (font) => {
    setWebsiteData(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        font
      }
    }));
  };

  const updateContent = (field, value) => {
    setWebsiteData(prev => ({
      ...prev,
      [field]: value,
      hero: {
        ...prev.hero,
        title: field === 'businessName' ? value : prev.hero.title,
        subtitle: field === 'tagline' ? value : prev.hero.subtitle,
        description: field === 'description' ? value : prev.hero.description
      }
    }));
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
          <Palette size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          Loading website data...
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
        maxWidth: '1200px',
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
              Customize Website
            </h1>
            <p style={{ fontSize: '16px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
              Change colors, fonts, and marketing copy
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
            <button
              onClick={handlePreview}
              style={{
                padding: '12px 20px',
                background: 'white',
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: '8px',
                color: theme.colors.textDark,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              <Eye size={16} />
              Preview Live Site
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
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
              {saving ? <Sparkles size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Error Message */}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
          {/* Customization Panel */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: theme.shadows.md,
            overflow: 'hidden'
          }}>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              borderBottom: `1px solid ${theme.colors.borderLight}` 
            }}>
              {[
                { id: 'content', label: 'Content', icon: <Layout size={16} /> },
                { id: 'colors', label: 'Colors', icon: <Palette size={16} /> },
                { id: 'typography', label: 'Typography', icon: <Type size={16} /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: activeTab === tab.id ? theme.colors.bgLight : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: activeTab === tab.id ? theme.colors.primary : theme.colors.textGray,
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '24px' }}>
              {activeTab === 'content' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '20px' }}>
                    Website Content
                  </h3>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={websiteData.businessName}
                      onChange={(e) => updateContent('businessName', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="Your Business Name"
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={websiteData.tagline}
                      onChange={(e) => updateContent('tagline', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="Your compelling tagline"
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                      Description
                    </label>
                    <textarea
                      value={websiteData.description}
                      onChange={(e) => updateContent('description', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        minHeight: '100px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                      placeholder="Describe what your business does and how it helps customers"
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                      Logo Emoji
                    </label>
                    <input
                      type="text"
                      value={websiteData.logo}
                      onChange={(e) => updateContent('logo', e.target.value)}
                      style={{
                        width: '80px',
                        padding: '12px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '24px',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                      placeholder="🚀"
                      maxLength="2"
                    />
                    <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
                      Choose an emoji that represents your business
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'colors' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '20px' }}>
                    Color Scheme
                  </h3>
                  
                  <ColorPicker
                    label="Primary Color"
                    value={websiteData.theme.colors.primary}
                    onChange={(value) => updateThemeColor('primary', value)}
                    presets={colorPresets}
                  />
                  
                  <ColorPicker
                    label="Secondary Color"
                    value={websiteData.theme.colors.secondary}
                    onChange={(value) => updateThemeColor('secondary', value)}
                    presets={colorPresets}
                  />
                  
                  <ColorPicker
                    label="Accent Color"
                    value={websiteData.theme.colors.accent}
                    onChange={(value) => updateThemeColor('accent', value)}
                    presets={colorPresets}
                  />
                  
                  <ColorPicker
                    label="Text Color"
                    value={websiteData.theme.colors.text}
                    onChange={(value) => updateThemeColor('text', value)}
                    presets={['#1A2B48', '#2D3748', '#1A202C', '#2A4A5B']}
                  />
                  
                  <ColorPicker
                    label="Light Text Color"
                    value={websiteData.theme.colors.textLight}
                    onChange={(value) => updateThemeColor('textLight', value)}
                    presets={['#5A6982', '#718096', '#A0AEC0', '#CBD5E0']}
                  />
                </div>
              )}

              {activeTab === 'typography' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '20px' }}>
                    Typography
                  </h3>
                  
                  <FontSelector
                    label="Font Family"
                    value={websiteData.theme.font}
                    onChange={updateFont}
                    options={fontOptions}
                  />
                  
                  <div style={{
                    background: theme.colors.bgLight,
                    padding: '20px',
                    borderRadius: '8px',
                    marginTop: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '24px', 
                      fontWeight: '700', 
                      margin: '0 0 12px 0',
                      fontFamily: websiteData.theme.font,
                      color: theme.colors.textDark
                    }}>
                      Font Preview
                    </h4>
                    <p style={{ 
                      fontSize: '16px', 
                      margin: '0 0 12px 0',
                      fontFamily: websiteData.theme.font,
                      color: theme.colors.textGray
                    }}>
                      This is how your website text will look with the selected font family. 
                      The quick brown fox jumps over the lazy dog.
                    </p>
                    <p style={{ 
                      fontSize: '14px', 
                      margin: 0,
                      fontFamily: websiteData.theme.font,
                      color: theme.colors.textGray,
                      fontWeight: '600'
                    }}>
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ • 1234567890
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '16px' }}>
              Live Preview
            </h3>
            <PreviewCard websiteData={websiteData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizeWebsitePage;
