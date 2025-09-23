// src/app/dashboard/[sessionId]/manage/products/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ManageProductsPage from '@/components/ManageProductsPage';
import { ArrowLeft } from 'lucide-react';


export default function ManageProducts() {
  const params = useParams();
  const router = useRouter();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchBusiness = async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('session_id', params.sessionId)
        .single();

      if (data) {
        setBusiness(data);
      }
      setLoading(false);
    };

    if (params.sessionId) {
      fetchBusiness();
    }
  }, [params.sessionId]);

  if (loading) {
    return <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    }}>Loading...</div>;
  }

  if (!business) {
    return <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    }}>Business not found.</div>;
  }

  return (
    <div style={{
        background: '#F9FAFB',
        minHeight: '100vh',
    }}>
         <header style={{
            background: 'white',
            padding: '16px 24px',
            borderBottom: '1px solid #E4E7EB',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
        }}>
            <button 
                onClick={() => router.back()}
                style={{
                    background: 'none',
                    border: '1px solid #E4E7EB',
                    borderRadius: '50%',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <ArrowLeft size={20} />
            </button>
            <h1 style={{fontSize: '20px', fontWeight: '600'}}>Back to Dashboard</h1>
        </header>
        <ManageProductsPage business={business} />
    </div>
  )
}
