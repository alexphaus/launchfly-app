// src/app/claim/[businessId]/success/page.js
// Success page after claiming a prospect funnel
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function ClaimSuccessPage({ params, searchParams }) {
  const { businessId } = await params;
  const { session_id } = await searchParams;
  
  let business = null;
  let activated = false;
  let error = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Verify the Stripe session
    if (session_id) {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      if (session.payment_status === 'paid' && session.metadata?.businessId === businessId) {
        // Activate the prospect business - change status to 'ready'
        const { data, error: updateError } = await supabase
          .from('businesses')
          .update({ 
            status: 'ready',
            source: 'claimed-prospect',
            expires_at: null, // Remove expiry since it's now claimed
            paid_plan_session_id: session_id
          })
          .eq('id', businessId)
          .eq('status', 'prospect')
          .select()
          .single();

        if (data && !updateError) {
          business = data;
          activated = true;
          console.log(`✅ Activated prospect business: ${businessId}`);
        } else {
          // Maybe already activated or different status
          const { data: existingBusiness } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();
          
          business = existingBusiness;
          activated = existingBusiness?.status === 'ready';
        }
      }
    }

    // Fallback: try to get business info
    if (!business) {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      business = data;
    }

  } catch (err) {
    console.error('Error activating business:', err);
    error = err.message;
  }

  const businessName = business?.business_data?.businessName || business?.name || 'Your Business';
  const subdomain = business?.subdomain;
  const funnelUrl = subdomain ? `https://${subdomain}.launchfly.ai` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg text-center">
        {activated || business?.status === 'ready' ? (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Funnel Activated!
            </h1>
            <p className="text-slate-600 mb-6">
              Your lead capture funnel for <strong>{businessName}</strong> is now live and ready to capture leads.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-500 mb-2">Your funnel URL:</p>
              {funnelUrl ? (
                <a 
                  href={funnelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-mono text-sm hover:underline break-all"
                >
                  {funnelUrl}
                </a>
              ) : (
                <span className="text-slate-400 text-sm">Setting up...</span>
              )}
            </div>

            <div className="space-y-3">
              {funnelUrl && (
                <a 
                  href={funnelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
                >
                  View My Funnel →
                </a>
              )}
              <Link 
                href="/"
                className="block w-full bg-slate-100 text-slate-700 py-3 px-6 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>

            <p className="text-sm text-slate-500 mt-6">
              Check your email for next steps and tips to maximize your leads.
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              Processing Your Order
            </h1>
            <p className="text-slate-600 mb-6">
              We're setting up your funnel. This usually takes a few seconds.
              If this page doesn't update, please refresh or contact support.
            </p>
            <Link 
              href={`/claim/${businessId}`}
              className="text-blue-600 hover:underline"
            >
              ← Back to claim page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
