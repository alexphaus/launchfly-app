'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LaunchflyDashboard from '@/components/LaunchflyDashboard';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscription();
  }, [params.sessionId]);

  async function loadInitialData() {
    try {
      // Get session with business data
      const { data: session, error } = await supabase
        .from('sessions')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('id', params.sessionId)
        .single();

      if (error) throw error;
      
      setSessionData(session);
      setBusinessData(session.business);
      setLoading(false);
      
    } catch (error) {
      console.error('Load error:', error);
      router.push('/');
    }
  }

  function setupRealtimeSubscription() {
    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`session-${params.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${params.sessionId}`
        },
        (payload) => {
          console.log('Session update:', payload);
          setSessionData(current => ({ ...current, ...payload.new }));
        }
      )
      .subscribe();

    // Subscribe to business changes
    const businessChannel = supabase
      .channel(`business-${params.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `session_id=eq.${params.sessionId}`
        },
        (payload) => {
          console.log('Business update:', payload);
          setBusinessData(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(businessChannel);
    };
  }

  // Handler functions
  const handlePhoneCapture = async (phoneNumber) => {
    await fetch('/api/phone/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: params.sessionId, phoneNumber })
    });
  };

  const handleStepComplete = async (stepId) => {
    const newSteps = [...(sessionData.completed_steps || []), stepId.toString()];
    
    await supabase
      .from('sessions')
      .update({ completed_steps: newSteps })
      .eq('id', params.sessionId);
      
    // Track analytics
    await supabase
      .from('analytics')
      .insert({
        business_id: businessData.id,
        event_type: 'step_completed',
        event_data: { step_id: stepId }
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <LaunchflyDashboard 
      session={sessionData}
      business={businessData}
      onPhoneCapture={handlePhoneCapture}
      onStepComplete={handleStepComplete}
    />
  );
}