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

    // Extract logo from images
    const images = businessData.images || businessData.prospectImages || [];
    const logoImage = images.find(img => img.type === 'logo');
    const logoUrl = logoImage?.url || businessData.logo_url || businessData.logoUrl || null;

    // Get services from quoteCalculator or generate defaults
    const quoteCalculator = businessData.quoteCalculator || businessData.leadMagnet?.landing_page?.quoteCalculator;

    // Build services array from quoteCalculator or defaults
    let services = [];
    let basePrice = 100;

    if (quoteCalculator) {
        basePrice = quoteCalculator.basePrice || 100;

        // Look for the service type question (type: 'select' with options)
        const serviceQuestion = quoteCalculator.questions?.find(q => q.type === 'select' && q.options?.length > 0);

        if (serviceQuestion?.options) {
            // Convert options to service buttons
            services = serviceQuestion.options.map((option, idx) => ({
                id: option.toLowerCase().replace(/\s+/g, '_'),
                label: option,
                basePrice: basePrice * (idx === 0 ? 1 : idx === 1 ? 1.5 : 2), // Scale price by option
                priceVariance: basePrice * 0.25,
            }));
        }
    }

    // Fallback based on niche if no services from quoteCalculator
    if (services.length === 0) {
        const niche = (businessData.niche || '').toLowerCase();
        if (niche.includes('aircon') || niche.includes('ac') || niche.includes('hvac')) {
            services = [
                { id: 'general_service', label: 'General Service', basePrice: 80, priceVariance: 20 },
                { id: 'chemical_wash', label: 'Chemical Wash', basePrice: 150, priceVariance: 50 },
                { id: 'troubleshooting', label: 'Troubleshooting', basePrice: 100, isRange: true, maxPrice: 300 },
            ];
        } else if (niche.includes('pest')) {
            services = [
                { id: 'general', label: 'General Pest', basePrice: 150, priceVariance: 50 },
                { id: 'termite', label: 'Termite', basePrice: 500, isRange: true, maxPrice: 2000 },
                { id: 'rodent', label: 'Rodent Control', basePrice: 200, priceVariance: 100 },
            ];
        } else {
            services = [
                { id: 'basic', label: 'Basic Service', basePrice: 100, priceVariance: 50 },
                { id: 'standard', label: 'Standard', basePrice: 250, priceVariance: 100 },
            ];
        }
    }

    // Determine currency (prefer quoteCalculator, then businessData, then default)
    const currency = quoteCalculator?.currency || businessData.currency || 'RM';

    return (
        <QuoteFunnel
            businessId={business.id}
            businessName={businessData.businessName || business.name}
            logoUrl={logoUrl}
            // Route to Launchfly Assistant Bot
            whatsappNumber="13203627874"
            phoneNumber={businessData.phone || businessData.whatsapp_number || business.phone_number}
            currency={currency}
            services={services}
            isProspect={business.status === 'prospect'}
        />
    );
}
