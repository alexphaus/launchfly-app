'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, Save, Eye } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB'
  },
  shadows: { lg: '0 12px 20px rgba(26, 43, 72, 0.1)' }
};

export default function CustomizeWebsitePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [business, setBusiness] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('session_id', params.sessionId)
        .single();
      if (error) throw error;
      const bd = data.business_data || {};
      bd.theme = bd.theme || { colors: { primary: '#3b82f6', secondary: '#1e40af', textDark: '#1f2937', textGray: '#6b7280' }, font: 'Inter', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' };
      setBusiness({ ...data, business_data: bd });
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const update = (path, value) => {
    setBusiness(prev => {
      const bd = { ...prev.business_data };
      // shallow paths only used here
      if (path === 'tagline') bd.tagline = value;
      if (path === 'businessName') bd.businessName = value;
      if (path.startsWith('theme.colors.')) {
        const key = path.replace('theme.colors.', '');
        bd.theme = bd.theme || { colors: {} };
        bd.theme.colors = { ...(bd.theme.colors || {}), [key]: value };
      }
      if (path === 'theme.font') {
        bd.theme = bd.theme || {};
        bd.theme.font = value;
      }
      return { ...prev, business_data: bd };
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ business_data: business.business_data, updated_at: new Date().toISOString() })
        .eq('id', business.id);
      if (error) throw error;
      alert('Website customization saved');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = useMemo(() => business?.subdomain ? `https://app.launchfly.ai/sites/${business.subdomain}` : null, [business?.subdomain]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.colors.bgLight }}>
        <div>
          <div style={{ width: '48px', height: '48px', border: '4px solid #E4E7EB', borderTop: '4px solid #007BFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: theme.colors.textGray }}>Loading customization...</p>
        </div>
      </div>
    );
  }

  const bd = business.business_data;
  const colors = bd.theme?.colors || {};

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bgLight, paddingBottom: '40px' }}>
      <header style={{ background: 'white', borderBottom: `1px solid ${theme.colors.borderLight}`, padding: '20px 0', marginBottom: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push(`/dashboard/${params.sessionId}`)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: theme.colors.textGray, cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', background: theme.colors.borderLight }} />
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: theme.colors.textDark, margin: 0 }}>Customize Website</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ background: 'white', border: `1px solid ${theme.colors.borderLight}`, padding: '10px 12px', borderRadius: '8px', color: theme.colors.textDark, textDecoration: 'none' }}>
                <Eye size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> Preview
              </a>
            )}
            <button disabled={saving} onClick={save} style={{ background: theme.colors.primary, color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Save size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>{error}</div>
        )}

        {/* Brand and Headline */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: theme.shadows.lg, marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.colors.textDark }}>Brand</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            <input value={bd.businessName || ''} onChange={(e) => update('businessName', e.target.value)} placeholder="Business name" style={{ padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            <input value={bd.tagline || ''} onChange={(e) => update('tagline', e.target.value)} placeholder="Headline / tagline" style={{ padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
          </div>
        </div>

        {/* Theme */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: theme.shadows.lg }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.colors.textDark }}>Theme</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: theme.colors.textGray, marginBottom: 4 }}>Primary Color</label>
              <input value={colors.primary || ''} onChange={(e) => update('theme.colors.primary', e.target.value)} placeholder="#3b82f6" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: theme.colors.textGray, marginBottom: 4 }}>Secondary Color</label>
              <input value={colors.secondary || ''} onChange={(e) => update('theme.colors.secondary', e.target.value)} placeholder="#1e40af" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: theme.colors.textGray, marginBottom: 4 }}>Text Dark</label>
              <input value={colors.textDark || ''} onChange={(e) => update('theme.colors.textDark', e.target.value)} placeholder="#1f2937" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: theme.colors.textGray, marginBottom: 4 }}>Text Gray</label>
              <input value={colors.textGray || ''} onChange={(e) => update('theme.colors.textGray', e.target.value)} placeholder="#6b7280" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: theme.colors.textGray, marginBottom: 4 }}>Font Family</label>
            <input value={bd.theme?.font || ''} onChange={(e) => update('theme.font', e.target.value)} placeholder="Inter" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
          </div>
        </div>

        {/* Live Mini Preview */}
        <div style={{ marginTop: '16px', background: 'white', borderRadius: '16px', boxShadow: theme.shadows.lg, overflow: 'hidden' }}>
          <div style={{ background: bd.theme?.gradient || `linear-gradient(135deg, ${colors.primary || '#3b82f6'} 0%, ${colors.secondary || '#1e40af'} 100%)`, padding: '20px', color: 'white' }}>
            <div style={{ fontWeight: 800 }}>{bd.businessName || 'Your Business'}</div>
          </div>
          <div style={{ padding: '20px' }}>
            <h2 style={{ margin: 0, color: colors.textDark || '#1f2937' }}>{bd.tagline || 'Your headline appears here'}</h2>
            <p style={{ color: colors.textGray || '#6b7280' }}>Preview updates instantly as you edit.</p>
          </div>
        </div>
      </main>

      <style jsx>{` @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} } `}</style>
    </div>
  );
}


