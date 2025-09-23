// src/components/CustomizeWebsitePage.js
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Palette, Type, Layout, Globe, Eye, Save, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

const colorPresets = [
  { name: 'Ocean Blue', primary: '#007BFF', secondary: '#0056b3', gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)' },
  { name: 'Forest Green', primary: '#28a745', secondary: '#1e7e34', gradient: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' },
  { name: 'Royal Purple', primary: '#6f42c1', secondary: '#5a32a3', gradient: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)' },
  { name: 'Sunset Orange', primary: '#fd7e14', secondary: '#e8590c', gradient: 'linear-gradient(135deg, #fd7e14 0%, #dc3545 100%)' },
  { name: 'Deep Teal', primary: '#20c997', secondary: '#17a2b8', gradient: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)' },
  { name: 'Elegant Gray', primary: '#6c757d', secondary: '#495057', gradient: 'linear-gradient(135deg, #6c757d 0%, #343a40 100%)' }
];

const fontOptions = [
  { name: 'Inter', value: 'Inter', description: 'Modern and clean' },
  { name: 'Roboto', value: 'Roboto', description: 'Professional and readable' },
  { name: 'Poppins', value: 'Poppins', description: 'Friendly and approachable' },
  { name: 'Playfair Display', value: 'Playfair Display', description: 'Elegant and sophisticated' },
  { name: 'Montserrat', value: 'Montserrat', description: 'Bold and modern' },
  { name: 'Open Sans', value: 'Open Sans', description: 'Versatile and neutral' }
];

const CustomizeWebsitePage = ({ session, business, onBack }) => {
  const [activeTab, setActiveTab] = useState('theme');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

  // Theme state
  const [themeData, setThemeData] = useState({
    colors: {
      primary: '#007BFF',
      secondary: '#0056b3',
      textDark: '#1A2B48',
      textGray: '#5A6982',
      borderColor: '#E4E7EB'
    },
    font: 'Inter',
    gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)'
  });

  // Content state
  const [contentData, setContentData] = useState({
    businessName: '',
    tagline: '',
    description: '',
    logo: '',
    heroTitle: '',
    heroSubtitle: '',
    heroCtaText: '',
    aboutTitle: '',
    aboutContent: '',
    contactEmail: '',
    contactPhone: '',
    socialLinks: {
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: ''
    }
  });

  // Layout state
  const [layoutData, setLayoutData] = useState({
    showHero: true,
    showFeatures: true,
    showTestimonials: true,
    showProducts: true,
    showAbout: true,
    showContact: true,
    headerStyle: 'modern',
    footerStyle: 'simple'
  });

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = () => {
    if (business?.business_data) {
      const data = business.business_data;
      
      // Load theme
      if (data.theme) {
        setThemeData(prev => ({
          ...prev,
          ...data.theme
        }));
      }

      // Load content
      setContentData(prev => ({
        ...prev,
        businessName: data.businessName || data.name || '',
        tagline: data.tagline || '',
        description: data.description || '',
        logo: data.logo || '',
        heroTitle: data.heroTitle || data.tagline || '',
        heroSubtitle: data.heroSubtitle || '',
        heroCtaText: data.heroCtaText || 'Get Started',
        aboutTitle: data.aboutTitle || 'About Us',
        aboutContent: data.aboutContent || '',
        contactEmail: data.contactEmail || data.form_data?.email || '',
        contactPhone: data.contactPhone || data.phone_number || '',
        socialLinks: {
          ...prev.socialLinks,
          ...(data.socialLinks || {})
        }
      }));

      // Load layout preferences
      if (data.layoutPreferences) {
        setLayoutData(prev => ({
          ...prev,
          ...data.layoutPreferences
        }));
      }
    }
  };

  const handleThemeChange = (field, value) => {
    setThemeData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleColorChange = (colorField, value) => {
    setThemeData(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorField]: value
      }
    }));
  };

  const applyColorPreset = (preset) => {
    setThemeData(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        primary: preset.primary,
        secondary: preset.secondary
      },
      gradient: preset.gradient
    }));
  };

  const handleContentChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setContentData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setContentData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleLayoutChange = (field, value) => {
    setLayoutData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors({});

    try {
      const updateData = {
        theme: themeData,
        ...contentData,
        layoutPreferences: layoutData,
        socialLinks: contentData.socialLinks
      };

      const response = await fetch(`/api/business/${business.id}/customize`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      setSuccess('Website customization saved successfully!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Save error:', error);
      setErrors({ save: error.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const previewWebsite = () => {
    if (business?.subdomain) {
      window.open(`https://${business.subdomain}.launchfly.app`, '_blank');
    }
  };

  const tabs = [
    { id: 'theme', label: 'Theme & Colors', icon: Palette },
    { id: 'content', label: 'Content', icon: Type },
    { id: 'layout', label: 'Layout', icon: Layout }
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
              <Globe size={24} color={theme.colors.primary} />
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                Customize Website
              </h1>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={previewWebsite}
              style={{
                background: 'none',
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textGray,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.target.style.borderColor = theme.colors.primary;
                e.target.style.color = theme.colors.primary;
              }}
              onMouseLeave={e => {
                e.target.style.borderColor = theme.colors.borderLight;
                e.target.style.color = theme.colors.textGray;
              }}
            >
              <Eye size={16} />
              Preview
            </button>
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
            {activeTab === 'theme' && (
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
                  Theme & Colors
                </h2>
                <p style={{
                  fontSize: '16px',
                  color: theme.colors.textGray,
                  marginBottom: '32px'
                }}>
                  Customize your website's visual appearance with colors and fonts
                </p>

                {/* Color Presets */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Color Presets
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px'
                  }}>
                    {colorPresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => applyColorPreset(preset)}
                        style={{
                          background: 'white',
                          border: `2px solid ${themeData.colors.primary === preset.primary ? theme.colors.primary : theme.colors.borderLight}`,
                          borderRadius: '12px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => {
                          if (themeData.colors.primary !== preset.primary) {
                            e.target.style.borderColor = theme.colors.textGray;
                          }
                        }}
                        onMouseLeave={e => {
                          if (themeData.colors.primary !== preset.primary) {
                            e.target.style.borderColor = theme.colors.borderLight;
                          }
                        }}
                      >
                        <div style={{
                          width: '100%',
                          height: '32px',
                          background: preset.gradient,
                          borderRadius: '6px',
                          marginBottom: '12px'
                        }} />
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: theme.colors.textDark,
                          marginBottom: '4px'
                        }}>
                          {preset.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: theme.colors.textGray
                        }}>
                          {preset.primary}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Colors */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Custom Colors
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '8px'
                      }}>
                        Primary Color
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={themeData.colors.primary}
                          onChange={(e) => handleColorChange('primary', e.target.value)}
                          style={{
                            width: '48px',
                            height: '48px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={themeData.colors.primary}
                          onChange={(e) => handleColorChange('primary', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            border: `1px solid ${theme.colors.borderLight}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '8px'
                      }}>
                        Secondary Color
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={themeData.colors.secondary}
                          onChange={(e) => handleColorChange('secondary', e.target.value)}
                          style={{
                            width: '48px',
                            height: '48px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={themeData.colors.secondary}
                          onChange={(e) => handleColorChange('secondary', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            border: `1px solid ${theme.colors.borderLight}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Selection */}
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Typography
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px'
                  }}>
                    {fontOptions.map((font, index) => (
                      <button
                        key={index}
                        onClick={() => handleThemeChange('font', font.value)}
                        style={{
                          background: 'white',
                          border: `2px solid ${themeData.font === font.value ? theme.colors.primary : theme.colors.borderLight}`,
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => {
                          if (themeData.font !== font.value) {
                            e.target.style.borderColor = theme.colors.textGray;
                          }
                        }}
                        onMouseLeave={e => {
                          if (themeData.font !== font.value) {
                            e.target.style.borderColor = theme.colors.borderLight;
                          }
                        }}
                      >
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: theme.colors.textDark,
                          marginBottom: '8px',
                          fontFamily: font.value
                        }}>
                          {font.name}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: theme.colors.textGray,
                          fontFamily: font.value
                        }}>
                          {font.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
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
                  Website Content
                </h2>
                <p style={{
                  fontSize: '16px',
                  color: theme.colors.textGray,
                  marginBottom: '32px'
                }}>
                  Edit your website's text content, headlines, and contact information
                </p>

                {/* Basic Information */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Basic Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={contentData.businessName}
                        onChange={(e) => handleContentChange('businessName', e.target.value)}
                        placeholder="Your Business Name"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Logo (Emoji or URL)
                      </label>
                      <input
                        type="text"
                        value={contentData.logo}
                        onChange={(e) => handleContentChange('logo', e.target.value)}
                        placeholder="🚀 or https://example.com/logo.png"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none'
                        }}
                      />
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
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={contentData.tagline}
                      onChange={(e) => handleContentChange('tagline', e.target.value)}
                      placeholder="A compelling tagline that describes your business"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Hero Section */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Hero Section
                  </h3>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      Hero Title
                    </label>
                    <input
                      type="text"
                      value={contentData.heroTitle}
                      onChange={(e) => handleContentChange('heroTitle', e.target.value)}
                      placeholder="Transform Your Vision Into Reality"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      Hero Subtitle
                    </label>
                    <textarea
                      value={contentData.heroSubtitle}
                      onChange={(e) => handleContentChange('heroSubtitle', e.target.value)}
                      placeholder="A compelling subtitle that explains what you do"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      marginBottom: '6px'
                    }}>
                      Call-to-Action Button Text
                    </label>
                    <input
                      type="text"
                      value={contentData.heroCtaText}
                      onChange={(e) => handleContentChange('heroCtaText', e.target.value)}
                      placeholder="Get Started Today"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `1px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Contact Information
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={contentData.contactEmail}
                        onChange={(e) => handleContentChange('contactEmail', e.target.value)}
                        placeholder="contact@yourbusiness.com"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '6px'
                      }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={contentData.contactPhone}
                        onChange={(e) => handleContentChange('contactPhone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'layout' && (
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
                  Page Layout
                </h2>
                <p style={{
                  fontSize: '16px',
                  color: theme.colors.textGray,
                  marginBottom: '32px'
                }}>
                  Configure which sections appear on your website and their layout
                </p>

                {/* Section Toggles */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Website Sections
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {[
                      { key: 'showHero', label: 'Hero Section', description: 'Main banner with title and call-to-action' },
                      { key: 'showFeatures', label: 'Features Section', description: 'Highlight key features or benefits' },
                      { key: 'showTestimonials', label: 'Testimonials', description: 'Customer reviews and feedback' },
                      { key: 'showProducts', label: 'Products/Services', description: 'Your product or service offerings' },
                      { key: 'showAbout', label: 'About Section', description: 'Information about your business' },
                      { key: 'showContact', label: 'Contact Section', description: 'Contact form and information' }
                    ].map((section) => (
                      <div
                        key={section.key}
                        style={{
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '12px',
                          padding: '20px',
                          background: layoutData[section.key] ? '#f0f9ff' : 'white'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: theme.colors.textDark,
                            margin: 0
                          }}>
                            {section.label}
                          </h4>
                          <label style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '48px',
                            height: '24px'
                          }}>
                            <input
                              type="checkbox"
                              checked={layoutData[section.key]}
                              onChange={(e) => handleLayoutChange(section.key, e.target.checked)}
                              style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                              position: 'absolute',
                              cursor: 'pointer',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: layoutData[section.key] ? theme.colors.primary : '#ccc',
                              borderRadius: '24px',
                              transition: '0.3s'
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '18px',
                                width: '18px',
                                left: layoutData[section.key] ? '26px' : '3px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                transition: '0.3s'
                              }} />
                            </span>
                          </label>
                        </div>
                        <p style={{
                          fontSize: '14px',
                          color: theme.colors.textGray,
                          margin: 0
                        }}>
                          {section.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Style Options */}
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: theme.colors.textDark,
                    marginBottom: '16px'
                  }}>
                    Style Options
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '8px'
                      }}>
                        Header Style
                      </label>
                      <select
                        value={layoutData.headerStyle}
                        onChange={(e) => handleLayoutChange('headerStyle', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none',
                          background: 'white'
                        }}
                      >
                        <option value="modern">Modern</option>
                        <option value="classic">Classic</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: theme.colors.textDark,
                        marginBottom: '8px'
                      }}>
                        Footer Style
                      </label>
                      <select
                        value={layoutData.footerStyle}
                        onChange={(e) => handleLayoutChange('footerStyle', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          outline: 'none',
                          background: 'white'
                        }}
                      >
                        <option value="simple">Simple</option>
                        <option value="detailed">Detailed</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                  </div>
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

export default CustomizeWebsitePage;
