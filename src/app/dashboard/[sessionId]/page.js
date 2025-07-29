// app/dashboard/[sessionId]/page.js
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LaunchflyDashboard from '@/components/LaunchflyDashboard';
import FutureProofDashboard from '@/components/FutureProofDashboard';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationStarted, setGenerationStarted] = useState(false);
  const generationTriggered = useRef(false);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Start polling when we have data and generation is in progress
    if (sessionData && sessionData.stage !== 'complete' && sessionData.stage !== 'error') {
      const pollInterval = setInterval(async () => {
        await fetchLatestData();
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(pollInterval);
    }
  }, [sessionData?.stage]);

  useEffect(() => {
    // Trigger generation if session is pending
    if (sessionData?.stage === 'pending' && businessData && !generationTriggered.current) {
      generationTriggered.current = true;
      startBusinessGeneration();
    }
  }, [sessionData, businessData]);

  async function loadInitialData() {
    const maxRetries = 10;
    const baseDelay = 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', params.sessionId)
          .single();

        if (sessionError?.code === 'PGRST116') {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(1.5, attempt);
            console.log(`Session not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            throw new Error('Session not found after maximum retries');
          }
        }
        
        if (sessionError) throw sessionError;

        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('session_id', params.sessionId)
          .single();

        if (businessError?.code === 'PGRST116') {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(1.5, attempt);
            console.log(`Business not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            throw new Error('Business not found after maximum retries');
          }
        }
        
        if (businessError) throw businessError;
        
        console.log('Initial data loaded:', { session, business });
        setSessionData(session);
        setBusinessData(business);
        setLoading(false);
        return;
        
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error('Load error after all retries:', error);
          router.push('/');
          return;
        }
      }
    }
  }

  async function fetchLatestData() {
    try {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

      if (!sessionError && session) {
        console.log('Fetched updated session:', session);
        setSessionData(session);
      }

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('session_id', params.sessionId)
        .single();

      if (!businessError && business) {
        console.log('Fetched updated business:', business);
        setBusinessData(business);
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  }

  async function startBusinessGeneration() {
    console.log('Starting future-proof business launch from dashboard...');
    setGenerationStarted(true);
    
    try {
      // Try the new future-proof API first
      const response = await fetch('/api/launch-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: params.sessionId,
          businessId: businessData.id,
          formData: businessData.form_data
        })
      });
      
      if (!response.ok) {
        // Fallback to legacy generation if new system fails
        console.log('New system failed, falling back to legacy generation...');
        const fallbackResponse = await fetch('/api/generate-business', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: params.sessionId,
            businessId: businessData.id,
            formData: businessData.form_data
          })
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Both new and legacy systems failed');
        }
        
        const fallbackResult = await fallbackResponse.json();
        console.log('Legacy generation completed:', fallbackResult);
        return;
      }
      
      const result = await response.json();
      console.log('Future-proof business launch completed:', result);
      
    } catch (error) {
      console.error('Error starting business launch:', error);
      // Update UI to show error
      setSessionData(prev => ({ ...prev, stage: 'error' }));
    }
  }

  const handlePhoneCapture = async (phoneNumber) => {
    await fetch('/api/phone/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: params.sessionId, phoneNumber })
    });
  };

  const handleStepComplete = async (stepId) => {
    const newSteps = [...(sessionData.completed_steps || []), stepId.toString()];
    
    const { error } = await supabase
      .from('sessions')
      .update({ completed_steps: newSteps })
      .eq('id', params.sessionId);
    
    if (!error) {
      setSessionData(prev => ({ ...prev, completed_steps: newSteps }));
    }
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

  // Decide which dashboard to show based on business data structure
  const showFutureProofDashboard = businessData?.business_data?.opportunity || businessData?.business_data?.validation;

  return (
    <>
      {showFutureProofDashboard ? (
        <FutureProofDashboard 
          session={sessionData}
          business={businessData}
          onPhoneCapture={handlePhoneCapture}
          onStepComplete={handleStepComplete}
        />
      ) : (
        <LaunchflyDashboard 
          session={sessionData}
          business={businessData}
          onPhoneCapture={handlePhoneCapture}
          onStepComplete={handleStepComplete}
        />
      )}
    </>
  );
}