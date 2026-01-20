// /sites/[subdomain]/quote/page.js
// Quote Funnel page for subdomain-based businesses
// URL: mybusiness.launchfly.ai/quote

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import QuoteFunnel from '@/components/launchfly-ui/QuoteFunnel';

export async function generateMetadata({ params }) {
    const { subdomain } = await params;
    return {
        title: `Get a Quote | ${subdomain}`,
        description: 'Get an instant quote for your service needs.',
    };
}

export default async function SubdomainQuotePage({ params }) {
    const { subdomain } = await params;

    let business = null;

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        // Find business by subdomain
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('subdomain', subdomain)
            .single();

        if (data && !error) {
            business = data;
        }
    } catch (err) {
        console.error('Error fetching business:', err);
    }

    if (!business) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="text-5xl mb-4">🔍</div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Business Not Found</h1>
                    <p className="text-slate-500">No business found with subdomain: <code className="bg-slate-100 px-2 py-1 rounded">{subdomain}</code></p>
                </div>
            </div>
        );
    }

    const businessData = business.business_data || {};

    return (
        <QuoteFunnel
            businessId={business.id}
            businessName={businessData.businessName || business.name}
            niche={businessData.niche}
            logoUrl={businessData.logo_url || businessData.logoUrl}
            // Route to Launchfly Assistant Bot
            whatsappNumber="13203627874"
            subdomain={subdomain}
            phoneNumber={businessData.phone || businessData.whatsapp_number}
            serviceOptions={businessData.quoteConfig?.serviceOptions || businessData.serviceOptions}
            priceMatrix={businessData.quoteConfig?.priceMatrix || businessData.priceMatrix}
        />
    );
}
