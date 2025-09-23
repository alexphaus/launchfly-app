// src/components/CustomizeWebsitePage.js
'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Palette, Type, Image as ImageIcon } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
  },
};

const CustomizeWebsitePage = ({ business }) => {
  const [websiteData, setWebsiteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      fetchWebsiteData();
    }
  }, [business]);

  const fetchWebsiteData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/website?businessId=${business.id}`);
      const data = await response.json();
      if (data.success) {
        setWebsiteData(data.websiteData);
      }
    } catch (error) {
      console.error('Error fetching website data:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWebsiteData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleThemeColorChange = (colorName, value) => {
    setWebsiteData(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        colors: {
          ...prev.theme.colors,
          [colorName]: value,
        }
      }
    }));
  };

  const handleHeroChange = (e) => {
    const { name, value } = e.target;
    setWebsiteData(prev => ({
        ...prev,
        hero: {
            ...prev.hero,
            [name]: value,
        }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/business/manage/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, websiteData }),
      });
      const result = await response.json();
      if (result.success) {
        alert('Website updated successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving website data:', error);
      alert('An error occurred while saving.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading website data...</div>;
  }

  if (!websiteData) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Could not load website data.</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '24px auto', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: theme.colors.textDark }}>Customize Website</h1>
        <button onClick={handleSave} disabled={saving} style={{...buttonStyle, background: theme.colors.primary, color: 'white'}}>
            {saving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={20}/>}
            {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <section style={{marginTop: '32px'}}>
        <h2 style={sectionTitleStyle}><ImageIcon size={20} /> Branding</h2>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Business Name</label>
          <input type="text" name="businessName" value={websiteData.businessName} onChange={handleInputChange} style={inputStyle} />
        </div>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Logo (Emoji or URL)</label>
          <input type="text" name="logo" value={websiteData.logo} onChange={handleInputChange} style={inputStyle} />
        </div>
      </section>

      <section style={{marginTop: '32px'}}>
        <h2 style={sectionTitleStyle}><Type size={20} /> Content</h2>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Headline / Tagline</label>
          <input type="text" name="title" value={websiteData.hero.title} onChange={handleHeroChange} style={inputStyle} />
        </div>
        <div style={inputGroupStyle}>
            <label style={labelStyle}>Sub-headline</label>
            <textarea name="subtitle" value={websiteData.hero.subtitle} onChange={handleHeroChange} style={{...inputStyle, minHeight: '80px'}} />
        </div>
      </section>

      <section style={{marginTop: '32px'}}>
        <h2 style={sectionTitleStyle}><Palette size={20} /> Appearance</h2>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Primary Color</label>
          <input type="color" value={websiteData.theme.colors.primary} onChange={e => handleThemeColorChange('primary', e.target.value)} style={{...inputStyle, height: '40px'}} />
        </div>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Secondary Color</label>
          <input type="color" value={websiteData.theme.colors.secondary} onChange={e => handleThemeColorChange('secondary', e.target.value)} style={{...inputStyle, height: '40px'}} />
        </div>
        <div style={inputGroupStyle}>
            <label style={labelStyle}>Font</label>
            <select name="font" value={websiteData.theme.font.split(',')[0].replace(/'/g, '')} onChange={e => setWebsiteData(prev => ({...prev, theme: {...prev.theme, font: e.target.value}}))} style={inputStyle}>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Lato">Lato</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Oswald">Oswald</option>
            </select>
        </div>
      </section>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: `1px solid ${theme.colors.borderLight}`,
  fontSize: '16px',
};

const buttonStyle = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const sectionTitleStyle = {
    fontSize: '20px',
    fontWeight: '600',
    color: theme.colors.textDark,
    borderBottom: `2px solid ${theme.colors.borderLight}`,
    paddingBottom: '8px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
}

const inputGroupStyle = {
    marginBottom: '16px'
}

const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: theme.colors.textGray
}

export default CustomizeWebsitePage;
