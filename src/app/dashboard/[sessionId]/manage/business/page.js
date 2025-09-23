'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
    error: '#dc2626',
    success: '#16a34a'
  },
  shadows: { lg: '0 12px 20px rgba(26, 43, 72, 0.1)' }
};

export default function BusinessSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [business, setBusiness] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [phone, setPhone] = useState('');
  const [subdomainStatus, setSubdomainStatus] = useState(null); // {available: boolean, message}

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('session_id', params.sessionId)
        .single();
      if (error) throw error;
      setBusiness(data);
      setName(data.name || '');
      setSubdomain(data.subdomain || '');
      setPhone(data.phone_number || '');
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const checkSubdomain = async (value) => {
    if (!value || value.length < 3) {
      setSubdomainStatus({ available: false, message: 'Too short' });
      return;
    }
    try {
      const res = await fetch(`/api/check-subdomain?subdomain=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (res.ok) {
        setSubdomainStatus({ available: data.available, message: data.available ? 'Available' : 'Unavailable' });
      } else {
        setSubdomainStatus({ available: false, message: data.error || 'Error' });
      }
    } catch (e) {
      setSubdomainStatus({ available: false, message: 'Error checking' });
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = { name, phone_number: phone };
      // Only update subdomain if changed
      if (subdomain && subdomain !== business.subdomain) {
        // Ensure last check passed
        if (!subdomainStatus?.available) {
          setError('Please choose an available subdomain');
          setSaving(false);
          return;
        }
        updates.subdomain = subdomain.toLowerCase();
      }

      const { error } = await supabase
        .from('businesses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', business.id);
      if (error) throw error;
      alert('Business settings saved');
      await load();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.colors.bgLight }}>
        <div>
          <div style={{ width: '48px', height: '48px', border: '4px solid #E4E7EB', borderTop: '4px solid #007BFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: theme.colors.textGray }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bgLight, paddingBottom: '40px' }}>
      <header style={{ background: 'white', borderBottom: `1px solid ${theme.colors.borderLight}`, padding: '20px 0', marginBottom: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push(`/dashboard/${params.sessionId}`)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: theme.colors.textGray, cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', background: theme.colors.borderLight }} />
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: theme.colors.textDark, margin: 0 }}>Business Settings</h1>
          <div style={{ marginLeft: 'auto' }}>
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

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: theme.shadows.lg, marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.colors.textDark }}>General</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" style={{ padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" style={{ padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: theme.shadows.lg }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, color: theme.colors.textDark }}>Domain</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: theme.colors.textGray }}>https://app.launchfly.ai/sites/</span>
              <input value={subdomain} onChange={(e) => { const v = e.target.value.toLowerCase(); setSubdomain(v); }} onBlur={() => checkSubdomain(subdomain)} placeholder="your-brand" style={{ flex: 1, padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px' }} />
            </div>
            {subdomainStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: subdomainStatus.available ? theme.colors.success : theme.colors.error }}>
                <ShieldCheck size={16} /> {subdomainStatus.message}
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx>{` @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} } `}</style>
    </div>
  );
}


