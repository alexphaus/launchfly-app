// src/app/claim/[businessId]/success/page.js
// Success page after claiming a prospect funnel - with client-side activation
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import ActivationStatus from './ActivationStatus';

export default async function ClaimSuccessPage({ params, searchParams }) {
  const { businessId } = await params;
  const { session_id } = await searchParams;
  
  let initialBusiness = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Just fetch the business info, let client handle activation
    const { data } = await supabase
      .from('businesses')
      .select('id, status, name, subdomain, business_data, session_id')
      .eq('id', businessId)
      .single();
    
    if (data) {
      // Try to get session ID from sessions table as well
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id')
        .eq('business_id', businessId)
        .single();
      
      initialBusiness = {
        id: data.id,
        status: data.status,
        name: data.business_data?.businessName || data.name,
        subdomain: data.subdomain,
        sessionId: sessionData?.id || data.session_id
      };
    }
  } catch (err) {
    console.error('Error fetching business:', err);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <ActivationStatus 
        businessId={businessId}
        sessionId={session_id}
        initialBusiness={initialBusiness}
      />
    </div>
  );
}
