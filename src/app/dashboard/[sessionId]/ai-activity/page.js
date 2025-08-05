// src/app/dashboard/[sessionId]/ai-activity/page.js
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ResponsiveAIActivityPage from '@/components/ResponsiveAIActivityPage';

export default function AIActivityPageRoute() {
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
      
      console.log('AI Activity Page - Initial data loaded:', { session, business });
      setSessionData(session);
      setBusinessData(business);
      setLoading(false);
      
    } catch (error) {
      console.error('Load error:', error);
      router.push('/');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI activity...</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveAIActivityPage 
      session={sessionData}
      business={businessData}
      onBack={() => router.push(`/dashboard/${params.sessionId}`)}
    />
  );
}