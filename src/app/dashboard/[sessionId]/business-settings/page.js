'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BusinessSettings from '@/components/BusinessSettings';

export default function BusinessSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', params.sessionId)
          .single();

        if (sessionError || !session) {
          router.push('/');
          return;
        }

        setSessionData(session);

        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('session_id', params.sessionId)
          .single();

        if (businessError || !business) {
          console.error('Business not found');
          return;
        }

        setBusinessData(business);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params.sessionId, router, supabase]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!sessionData || !businessData) {
    return <div>Error loading data</div>;
  }

  return (
    <BusinessSettings 
      session={sessionData}
      business={businessData}
      onBack={() => router.back()}
    />
  );
}
