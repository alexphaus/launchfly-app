// src/app/claim/[businessId]/page.js
// Claim page for prospects who want to activate their preview funnel
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ClaimButton from './ClaimButton';

export async function generateMetadata({ params }) {
  return {
    title: 'Claim Your Lead Capture Funnel | Launchfly',
    description: 'Activate your personalized lead capture funnel and start capturing leads today.',
  };
}

export default async function ClaimPage({ params }) {
  const { businessId } = await params;
  
  let business = null;
  let businessData = null;
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('status', 'prospect')
      .single();
    
    if (data && !error) {
      business = data;
      businessData = data.business_data || {};
    }
  } catch (err) {
    console.error('Error fetching business:', err);
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Preview Not Found</h1>
          <p className="text-slate-600 mb-6">
            This preview may have expired or already been claimed.
          </p>
          <Link 
            href="https://www.launchfly.ai"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Create Your Own Funnel →
          </Link>
        </div>
      </div>
    );
  }

  const leadMagnetTitle = businessData?.leadMagnet?.lead_magnet?.title || 'Lead Capture Funnel';
  const businessName = businessData?.businessName || business?.name || 'Your Business';
  const niche = businessData?.niche || business?.form_data?.niche || 'your industry';
  const prospectEmail = business?.form_data?.prospectEmail || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-white font-bold text-xl">🚀 Launchfly</div>
          <a 
            href={`/preview/${businessId}`}
            className="text-white/80 hover:text-white text-sm"
          >
            ← Back to Preview
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-block bg-green-500/20 text-green-400 px-4 py-1 rounded-full text-sm font-medium mb-4">
            ✨ Your Custom Funnel is Ready
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Claim Your Lead Capture Funnel
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            We&apos;ve built a personalized <strong>{leadMagnetTitle}</strong> for <strong>{businessName}</strong>. 
            Activate it now and start capturing leads today.
          </p>
        </div>

        {/* What's Included */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            What&apos;s Included
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📄</span>
              </div>
              <h3 className="font-semibold text-white mb-1">Custom PDF Guide</h3>
              <p className="text-slate-400 text-sm">
                A professionally designed lead magnet tailored for {niche}
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold text-white mb-1">Landing Page</h3>
              <p className="text-slate-400 text-sm">
                High-converting page to capture visitor emails
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="font-semibold text-white mb-1">Email Delivery</h3>
              <p className="text-slate-400 text-sm">
                Automatic PDF delivery to your new leads
              </p>
            </div>
          </div>
        </div>

        {/* CTA Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Special Offer: $97 One-Time
          </h2>
          <p className="text-slate-600 mb-6">
            Get your complete lead capture system. No monthly fees. Yours forever.
          </p>
          
          <div className="space-y-4">
            <ClaimButton 
              businessId={businessId} 
              email={prospectEmail}
            />
            
            <p className="text-sm text-slate-500">
              30-day money-back guarantee • Instant access • No coding required
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-slate-500 text-sm mb-3">Have questions?</p>
            <a 
              href="mailto:hello@launchfly.ai?subject=Question about my preview funnel&body=Business ID: ${businessId}"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Contact us at hello@launchfly.ai
            </a>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-slate-400 text-sm">
          <span>✓ 500+ Funnels Created</span>
          <span>✓ Instant Setup</span>
          <span>✓ No Technical Skills Needed</span>
        </div>
      </div>
    </div>
  );
}
