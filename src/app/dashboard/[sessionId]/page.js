// src/app/dashboard/[sessionId]/page.js
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LaunchflyDashboard from '@/components/LaunchflyDashboard';

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
    // Poll if session is not complete OR if business is still pending/generating
    const isSessionIncomplete = sessionData && sessionData.stage !== 'complete' && sessionData.stage !== 'error';
    const isBusinessPending = businessData && (businessData.status === 'pending' || businessData.status === 'generating');

    if (isSessionIncomplete || isBusinessPending) {
      const pollInterval = setInterval(async () => {
        await fetchLatestData();
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [sessionData?.stage, businessData?.status]);

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
    console.log('Starting business generation from dashboard...');
    setGenerationStarted(true);
    
    try {
      const response = await fetch('/api/generate-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: params.sessionId,
          businessId: businessData.id,
          formData: businessData.form_data
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start generation');
      }
      
      const result = await response.json();
      console.log('Generation started successfully:', result);
      
    } catch (error) {
      console.error('Error starting generation:', error);
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
      
      // When the business is activated (step 3), run the growth strategies
      if (stepId === 3 && businessData) {
        try {
          // Growth strategies will be handled by the generate-business API endpoint
          // or a separate growth API endpoint in the future
          console.log('Business activated - growth strategies will be applied automatically');
          
          // For now, just mark the step as complete
          // TODO: Create a separate API endpoint for growth strategies if needed
          
        } catch (error) {
          console.error('Error handling step completion:', error);
        }
      }
    }
  };

  const handleUpdateBusiness = async (updates) => {
    try {
      console.log('Updating business:', updates);
      
      // Use API route to bypass RLS issues and ensure persistence
      const response = await fetch('/api/business/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: businessData.id,
          sessionId: params.sessionId,
          updates
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update');
      }

      // Update local state
      setBusinessData(prev => ({ ...prev, ...updates }));
      return { success: true };
    } catch (error) {
      console.error('Error updating business:', error);
      return { success: false, error };
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

  return (
    <LaunchflyDashboard 
      session={sessionData}
      business={businessData}
      onPhoneCapture={handlePhoneCapture}
      onStepComplete={handleStepComplete}
      onUpdateBusiness={handleUpdateBusiness}
    />
  );
}