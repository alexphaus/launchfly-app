// src/app/dashboard/[sessionId]/settings/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import SettingsPage from '@/components/SettingsPage';

export default function SettingsPageRoute() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

      if (sessionError) {
        console.error('Session error:', sessionError);
        router.push('/');
        return;
      }

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('session_id', params.sessionId)
        .single();

      if (businessError) {
        console.error('Business error:', businessError);
        router.push('/');
        return;
      }
      
      console.log('Settings Page - Initial data loaded:', { session, business });
      setSessionData(session);
      setBusinessData(business);
      setLoading(false);
      
    } catch (error) {
      console.error('Load error:', error);
      router.push('/');
    }
  }

  const handlePhoneUpdate = async (newPhoneNumber) => {
    // Optimistically update the business data
    setBusinessData(prev => ({
      ...prev,
      phone_number: newPhoneNumber
    }));

    // Optionally refresh data from server
    setTimeout(() => {
      loadInitialData();
    }, 1000);
  };

  const handleBankUpdate = () => {
    // The bank setup redirects to Stripe, so we'll refresh when they return
    // This could be enhanced with URL params or webhooks
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E4E7EB',
            borderTop: '4px solid #007BFF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#5A6982', fontSize: '16px' }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsPage 
      session={sessionData}
      business={businessData}
      onBack={() => router.push(`/dashboard/${params.sessionId}`)}
      onPhoneUpdate={handlePhoneUpdate}
      onBankUpdate={handleBankUpdate}
    />
  );
}
