// src/app/claim/[businessId]/page.js
// Cleaner, high-conversion claim page for Launchfly Launchpad
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ClaimButton from './ClaimButton';
import { Check, Shield, Star, Zap, MessageCircle, BarChart, Truck, ArrowRight } from 'lucide-react';

export async function generateMetadata({ params }) {
  return {
    title: 'Activate Your Launchpad | Launchfly',
    description: 'Activate your personalized lead capture system.',
  };
}

export default async function ClaimPage({ params }) {
  const { businessId } = await params;

  let business = null;
  let businessData = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Fetch business data
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

  // Error State
  if (!business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-slate-100">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔍</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">System Not Found</h1>
          <p className="text-slate-500 mb-6">This preview may have expired or is invalid.</p>
          <Link href="https://www.launchfly.ai" className="text-blue-600 font-medium hover:underline">
            Go to Launchfly Home →
          </Link>
        </div>
      </div>
    );
  }

  // Data prep
  const businessName = businessData?.businessName || business?.name || 'Your Business';
  const niche = businessData?.niche || 'Service';
  const prospectEmail = business?.form_data?.prospectEmail || '';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">

      {/* Minimal Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <span className="font-bold text-slate-900 tracking-tight">Launchfly</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <Shield size={12} />
            <span>Secure Activation</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
            Use This System to Fill <br className="hidden md:block" />
            <span className="text-blue-600">{businessName}&apos;s</span> Calendar.
          </h1>
          <p className="text-lg text-slate-500">
            Your automated &quot;Anti-Empty-Schedule&quot; system is built and ready to launch.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 md:gap-12 items-start">

          {/* LEFT COLUMN: The Product (Live Preview) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Live Preview Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative group">
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                </div>
                <div className="text-[10px] items-center gap-1.5 text-slate-400 font-medium uppercase tracking-wider hidden sm:flex">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Live Preview Generated
                </div>
              </div>

              <div className="aspect-[16/10] relative bg-slate-50">
                <iframe
                  src={`/preview/${businessId}?embed=true`}
                  className="w-[200%] h-[200%] border-0 absolute top-0 left-0 origin-top-left scale-50 pointer-events-none"
                  title="Preview"
                />

                {/* Overlay CTA */}
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center">
                  <a
                    href={`/preview/${businessId}?preview=true`}
                    target="_blank"
                    className="bg-white text-slate-900 px-5 py-2.5 rounded-full font-bold shadow-lg transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2"
                  >
                    Interact with Website <ArrowRight size={16} />
                  </a>
                </div>
              </div>
            </div>

            {/* Supporting Evidence */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Speed</p>
                <p className="font-semibold text-slate-900">Setup in 60s</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MessageCircle size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Automation</p>
                <p className="font-semibold text-slate-900">24/7 Replies</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Results</p>
                <p className="font-semibold text-slate-900">Guaranteed</p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: The Offer (Stack) */}
          <div className="lg:col-span-5 relative">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8 sticky top-24">

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Launchfly Launchpad</h2>
                <p className="text-slate-500 text-sm mt-1">Complete Lead Generation System for {niche}</p>
              </div>

              {/* The Stack List */}
              <div className="space-y-4 mb-8">

                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Instant Quote Engine</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Replaces "Contact Us". Gives customers instant price ranges so they stop shopping.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">WhatsApp Digital Receptionist</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Auto-replies to inquiries while you work. Captures leads 24/7.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">"Cash Injection" Script</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Copy-paste reactivator for past clients. Fills calendar fast.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 -mx-2">
                  <div className="mt-1 flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <Truck size={12} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 text-sm">BONUS: Van Magnet QR Design</h3>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                      Turns your vehicle into a lead source.
                    </p>
                  </div>
                </div>

              </div>

              {/* Pricing & CTA */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mb-6">
                <div className="flex items-end gap-2 mb-2">
                  <div className="text-4xl font-extrabold text-slate-900">$297</div>
                  <div className="text-sm font-medium text-slate-500 mb-1.5">one-time setup</div>
                </div>
                <div className="text-xs text-slate-400 line-through mb-4">No monthly fees. No subscriptions.</div>

                <ClaimButton businessId={businessId} email={prospectEmail} />

                <div className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-2">
                  <Shield size={10} /> Secure checkout via Stripe
                </div>
              </div>

              {/* Guarantee */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-100">
                  <span className="text-lg">🛡️</span>
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">The No-Risk Promise</p>
                    <p className="text-xs font-bold leading-tight">3 Booked Jobs in 30 Days or Full Refund.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
