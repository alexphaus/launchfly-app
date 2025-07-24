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
    
    // Poll for updates every 2 seconds
    const pollInterval = setInterval(async () => {
      if (sessionData?.stage !== 'complete' && sessionData?.stage !== 'error') {
        await fetchLatestData();
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionData?.stage]);

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
      // Update local state immediately
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

  return (
    <LaunchflyDashboard 
      session={sessionData}
      business={businessData}
      onPhoneCapture={handlePhoneCapture}
      onStepComplete={handleStepComplete}
    />
  );
}
// 'use client';

// import { useEffect, useState } from 'react';
// import { useParams, useRouter } from 'next/navigation';
// import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// import LaunchflyDashboard from '@/components/LaunchflyDashboard';

// export default function DashboardPage() {
//   const params = useParams();
//   const router = useRouter();
//   const [sessionData, setSessionData] = useState(null);
//   const [businessData, setBusinessData] = useState(null);
//   const [loading, setLoading] = useState(true);
  
//   const supabase = createClientComponentClient();

//   useEffect(() => {
//     loadInitialData();
//     setupRealtimeSubscription();
//   }, [params.sessionId]);

//   async function loadInitialData() {
//     const maxRetries = 10;
//     const baseDelay = 1000; // Start with 1 second
    
//     for (let attempt = 0; attempt < maxRetries; attempt++) {
//       try {
//         // Get session first
//         const { data: session, error: sessionError } = await supabase
//           .from('sessions')
//           .select('*')
//           .eq('id', params.sessionId)
//           .single();

//         // If session doesn't exist yet, wait and retry
//         if (sessionError?.code === 'PGRST116') { // No rows returned
//           if (attempt < maxRetries - 1) {
//             const delay = baseDelay * Math.pow(1.5, attempt); // Exponential backoff
//             console.log(`Session not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
//             await new Promise(resolve => setTimeout(resolve, delay));
//             continue;
//           } else {
//             throw new Error('Session not found after maximum retries');
//           }
//         }
        
//         if (sessionError) throw sessionError;

//         // Get business using session_id
//         const { data: business, error: businessError } = await supabase
//           .from('businesses')
//           .select('*')
//           .eq('session_id', params.sessionId)
//           .single();

//         // If business doesn't exist yet, wait and retry
//         if (businessError?.code === 'PGRST116') {
//           if (attempt < maxRetries - 1) {
//             const delay = baseDelay * Math.pow(1.5, attempt);
//             console.log(`Business not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
//             await new Promise(resolve => setTimeout(resolve, delay));
//             continue;
//           } else {
//             throw new Error('Business not found after maximum retries');
//           }
//         }
        
//         if (businessError) throw businessError;
        
//         // Success! Set data and exit retry loop
//         setSessionData(session);
//         setBusinessData(business);
//         setLoading(false);
//         return;
        
//       } catch (error) {
//         if (attempt === maxRetries - 1) {
//           console.error('Load error after all retries:', error);
//           router.push('/');
//           return;
//         }
//         // Continue to next retry attempt
//       }
//     }
//   }

//   function setupRealtimeSubscription() {
//     // Subscribe to session changes
//     const sessionChannel = supabase
//       .channel(`session-${params.sessionId}`)
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'sessions',
//           filter: `id=eq.${params.sessionId}`
//         },
//         (payload) => {
//           console.log('Session update:', payload);
//           setSessionData(current => ({ ...current, ...payload.new }));
//         }
//       )
//       .subscribe();

//     // Subscribe to business changes
//     const businessChannel = supabase
//       .channel(`business-${params.sessionId}`)
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'businesses',
//           filter: `session_id=eq.${params.sessionId}`
//         },
//         (payload) => {
//           console.log('Business update:', payload);
//           setBusinessData(payload.new);
//         }
//       )
//       .subscribe();

//     return () => {
//       supabase.removeChannel(sessionChannel);
//       supabase.removeChannel(businessChannel);
//     };
//   }

//   // Handler functions
//   const handlePhoneCapture = async (phoneNumber) => {
//     await fetch('/api/phone/capture', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ sessionId: params.sessionId, phoneNumber })
//     });
//   };

//   const handleStepComplete = async (stepId) => {
//     const newSteps = [...(sessionData.completed_steps || []), stepId.toString()];
    
//     await supabase
//       .from('sessions')
//       .update({ completed_steps: newSteps })
//       .eq('id', params.sessionId);
      
//     // Track analytics
//     await supabase
//       .from('analytics')
//       .insert({
//         business_id: businessData.id,
//         event_type: 'step_completed',
//         event_data: { step_id: stepId }
//       });
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
//           <p className="mt-4 text-gray-600">Loading your dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <LaunchflyDashboard 
//       session={sessionData}
//       business={businessData}
//       onPhoneCapture={handlePhoneCapture}
//       onStepComplete={handleStepComplete}
//     />
//   );
// }