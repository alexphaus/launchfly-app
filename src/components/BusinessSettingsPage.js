// src/components/BusinessSettingsPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Settings, Briefcase, Phone } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
  },
};

const BusinessSettingsPage = ({ business }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      fetchSettings();
    }
  }, [business]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/settings?businessId=${business.id}`);
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/business/manage/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, settings }),
      });
      const result = await response.json();
      if (result.success) {
        alert('Settings updated successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred while saving.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading settings...</div>;
  }

  if (!settings) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Could not load settings.</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '24px auto', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: theme.colors.textDark }}>Business Settings</h1>
            <button onClick={handleSave} disabled={saving} style={{...buttonStyle, background: theme.colors.primary, color: 'white'}}>
                {saving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={20}/>}
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>

        <section style={{marginTop: '32px'}}>
            <h2 style={sectionTitleStyle}><Briefcase size={20} /> Business Information</h2>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Business Name</label>
                <input type="text" name="businessName" value={settings.businessName} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Subdomain</label>
                <div style={{display: 'flex', alignItems: 'center'}}>
                    <input type="text" name="subdomain" value={settings.subdomain} onChange={handleInputChange} style={{...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0}} />
                    <span style={{padding: '10px', background: theme.colors.bgLight, border: `1px solid ${theme.colors.borderLight}`, borderLeft: 'none', borderRadius: '0 8px 8px 0'}}>.launchfly.ai</span>
                </div>
            </div>
             <div style={inputGroupStyle}>
                <label style={labelStyle}>Industry</label>
                <input type="text" name="industry" value={settings.industry} onChange={handleInputChange} style={inputStyle} />
            </div>
        </section>

        <section style={{marginTop: '32px'}}>
            <h2 style={sectionTitleStyle}><Phone size={20} /> Contact Details</h2>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Contact Email</label>
                <input type="email" name="email" value={settings.email} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Phone Number</label>
                <input type="tel" name="phone" value={settings.phone} onChange={handleInputChange} style={inputStyle} />
            </div>
        </section>

        <section style={{marginTop: '32px'}}>
            <h2 style={sectionTitleStyle}><Settings size={20} /> AI Settings</h2>
            <div style={checkboxGroupStyle}>
                <input type="checkbox" id="aiAgentEnabled" name="aiAgentEnabled" checked={settings.aiAgentEnabled} onChange={handleInputChange} style={checkboxStyle}/>
                <label htmlFor="aiAgentEnabled" style={labelStyle}>Enable AI Agent</label>
            </div>
            <div style={checkboxGroupStyle}>
                <input type="checkbox" id="autoFulfillment" name="autoFulfillment" checked={settings.autoFulfillment} onChange={handleInputChange} style={checkboxStyle}/>
                <label htmlFor="autoFulfillment" style={labelStyle}>Enable Automatic Fulfillment</label>
            </div>
            <div style={checkboxGroupStyle}>
                <input type="checkbox" id="autoMarketing" name="autoMarketing" checked={settings.autoMarketing} onChange={handleInputChange} style={checkboxStyle}/>
                <label htmlFor="autoMarketing" style={labelStyle}>Enable Automatic Marketing</label>
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

const checkboxGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px'
}

const checkboxStyle = {
    marginRight: '10px',
    width: '18px',
    height: '18px'
}

const labelStyle = {
    fontWeight: '600',
    color: theme.colors.textGray
}

export default BusinessSettingsPage;
