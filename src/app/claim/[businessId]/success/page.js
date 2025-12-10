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
      .select('id, status, name, subdomain, business_data')
      .eq('id', businessId)
      .single();
    
    if (data) {
      initialBusiness = {
        id: data.id,
        status: data.status,
        name: data.business_data?.businessName || data.name,
        subdomain: data.subdomain
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
