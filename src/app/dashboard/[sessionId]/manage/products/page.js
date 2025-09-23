'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, Plus, Save, Trash2, Wand2, RefreshCcw } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
    success: '#10b981',
    error: '#ef4444'
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)'
  }
};

function ProductRow({ product, onChange, onDelete }) {
  const [local, setLocal] = useState(product);

  useEffect(() => setLocal(product), [product]);

  const update = (field, value) => {
    const next = { ...local, [field]: value };
    setLocal(next);
    onChange(next);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 2fr 1fr auto',
      gap: '10px',
      padding: '12px',
      background: 'white',
      border: `1px solid ${theme.colors.borderLight}`,
      borderRadius: '10px',
      alignItems: 'center'
    }}>
      <input
        value={local.name || ''}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Product name"
        style={{
          width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '8px', outline: 'none'
        }}
      />
      <input
        value={local.price || ''}
        onChange={(e) => update('price', e.target.value)}
        placeholder="$99"
        style={{
          width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '8px', outline: 'none'
        }}
      />
      <input
        value={local.description || ''}
        onChange={(e) => update('description', e.target.value)}
        placeholder="Short description"
        style={{
          width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '8px', outline: 'none'
        }}
      />
      <input
        value={local.category || ''}
        onChange={(e) => update('category', e.target.value)}
        placeholder="Category"
        style={{
          width: '100%', padding: '10px 12px', border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '8px', outline: 'none'
        }}
      />
      <button
        onClick={onDelete}
        style={{
          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
          padding: '10px', borderRadius: '8px', cursor: 'pointer'
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function ManageProductsPage() {
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
      // Normalize products to array
      const bd = data.business_data || {};
      if (!Array.isArray(bd.products)) bd.products = [];
      setBusiness({ ...data, business_data: bd });
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const products = useMemo(() => business?.business_data?.products || [], [business]);

  const updateProduct = (index, updated) => {
    setBusiness(prev => {
      const next = [...(prev.business_data.products || [])];
      next[index] = updated;
      return { ...prev, business_data: { ...prev.business_data, products: next } };
    });
  };

  const addProduct = () => {
    const id = Math.random().toString(36).slice(2, 10);
    setBusiness(prev => {
      const next = [
        ...(prev.business_data.products || []),
        { id, name: 'New Product', price: '$99', description: '', icon: '📦', category: '' }
      ];
      return { ...prev, business_data: { ...prev.business_data, products: next } };
    });
  };

  const deleteProduct = (index) => {
    setBusiness(prev => {
      const next = [...(prev.business_data.products || [])];
      next.splice(index, 1);
      return { ...prev, business_data: { ...prev.business_data, products: next } };
    });
  };

  const save = async () => {
    if (!business) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ business_data: business.business_data, updated_at: new Date().toISOString() })
        .eq('id', business.id);
      if (error) throw error;
      alert('Products saved');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generateImages = async () => {
    try {
      const response = await fetch('/api/generate/product-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, generateAll: true })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Image generation failed');
      alert('Started AI image generation. This will refresh when complete.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.colors.bgLight }}>
        <div>
          <div style={{ width: '48px', height: '48px', border: '4px solid #E4E7EB', borderTop: '4px solid #007BFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: theme.colors.textGray }}>Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bgLight, paddingBottom: '40px' }}>
      {/* Header */}
      <header style={{ background: 'white', borderBottom: `1px solid ${theme.colors.borderLight}`, padding: '20px 0', marginBottom: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push(`/dashboard/${params.sessionId}`)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: theme.colors.textGray, cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', background: theme.colors.borderLight }} />
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: theme.colors.textDark, margin: 0 }}>Manage Products</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={addProduct} style={{ background: theme.colors.bgLight, border: `1px solid ${theme.colors.borderLight}`, padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
              <Plus size={16} />
            </button>
            <button onClick={generateImages} style={{ background: theme.colors.bgLight, border: `1px solid ${theme.colors.borderLight}`, padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
              <Wand2 size={16} />
            </button>
            <button disabled={saving} onClick={save} style={{ background: saving ? theme.colors.primaryDark : theme.colors.primary, color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Save size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>{error}</div>
        )}

        {products.length === 0 && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', textAlign: 'center', boxShadow: theme.shadows.lg, marginBottom: '16px' }}>
            <p style={{ color: theme.colors.textGray, marginBottom: '12px' }}>No products yet.</p>
            <button onClick={addProduct} style={{ background: theme.colors.primary, color: 'white', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> Add your first product
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {products.map((p, i) => (
            <ProductRow key={p.id || i} product={p} onChange={(np) => updateProduct(i, np)} onDelete={() => deleteProduct(i)} />
          ))}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <button onClick={addProduct} style={{ background: 'white', border: `1px solid ${theme.colors.borderLight}`, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer' }}>
            <Plus size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> Add Product
          </button>
          <button disabled={saving} onClick={save} style={{ background: theme.colors.primary, color: 'white', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Save size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> Save Changes
          </button>
        </div>
      </main>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
    </div>
  );
}


