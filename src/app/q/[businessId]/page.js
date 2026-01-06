// src/app/q/[businessId]/page.js
// Quote Funnel Entry Point - Mobile-first conversion page
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { QuoteFunnel } from '@/components/launchfly-ui';
import { SERVICE_TEMPLATES } from '@/lib/content-library';

export async function generateMetadata({ params }) {
    const { businessId } = await params;

    let meta = {
        title: 'Get Instant Quote',
        description: 'Get your service price in 30 seconds. No hidden fees.',
    };

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        const { data: business } = await supabase
            .from('businesses')
            .select('business_data, name')
            .eq('id', businessId)
            .in('status', ['ready', 'prospect'])
            .single();

        if (business?.business_data) {
            const bd = business.business_data;
            meta.title = `Get Quote - ${bd.businessName || business.name}`;
            meta.description = `Get your ${bd.niche || 'service'} price in 30 seconds. No hidden fees.`;
        }
    } catch (e) {
        console.error('Metadata error:', e);
    }

    return {
        title: meta.title,
        description: meta.description,
        openGraph: {
            title: meta.title,
            description: meta.description,
            type: 'website',
        },
    };
}

export default async function QuoteFunnelPage({ params }) {
    const { businessId: paramBusinessId } = await params;

    let businessData = null;
    let business = null;

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        const { data: businessRecord, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', paramBusinessId)
            .in('status', ['ready', 'prospect'])
            .single();

        if (businessRecord && !error) {
            business = businessRecord;
            businessData = businessRecord.business_data;
            console.log('✅ Loaded business for quote funnel:', businessRecord.id);
        }
    } catch (err) {
        console.log('⚠️ Database error:', err.message);
    }

    // Not found
    if (!businessData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Quote Page Not Found</h1>
                    <p className="text-gray-600 mb-4">This quote link may have expired or doesn&apos;t exist.</p>
                </div>
            </div>
        );
    }

    // Extract logo from images
    const images = businessData.images || businessData.prospectImages || [];
    const logoImage = images.find(img => img.type === 'logo');
    const logoUrl = logoImage?.url || null;

    // Get services from quoteCalculator or generate defaults
    const quoteCalculator = businessData.quoteCalculator || businessData.leadMagnet?.landing_page?.quoteCalculator;

    // Build services array from quoteCalculator or defaults
    let services = [];
    let basePrice = 500;

    if (quoteCalculator) {
        basePrice = quoteCalculator.basePrice || 500;

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
        } else if (niche.includes('clean')) {
            services = [
                { id: 'regular', label: 'Regular Cleaning', basePrice: 150, priceVariance: 50 },
                { id: 'deep', label: 'Deep Cleaning', basePrice: 400, priceVariance: 100 },
                { id: 'movein', label: 'Move-in/Out', basePrice: 600, priceVariance: 200 },
            ];
        } else if (niche.includes('plumb')) {
            services = [
                { id: 'repair', label: 'Repair', basePrice: 150, isRange: true, maxPrice: 500 },
                { id: 'installation', label: 'Installation', basePrice: 300, isRange: true, maxPrice: 1000 },
                { id: 'drain', label: 'Drain Cleaning', basePrice: 100, priceVariance: 50 },
            ];
        } else {
            // Generic fallback
            services = [
                { id: 'basic', label: 'Basic Service', basePrice: 100, priceVariance: 50 },
                { id: 'standard', label: 'Standard', basePrice: 250, priceVariance: 100 },
                { id: 'premium', label: 'Premium', basePrice: 500, priceVariance: 200 },
            ];
        }
    }

    // Determine currency (prefer businessData.currency from detection, then quoteCalculator, then default to PHP)
    const currency = businessData.currency || quoteCalculator?.currency || '₱';

    // Build headline from niche
    const niche = businessData.niche || 'service';
    const nicheFormatted = niche.charAt(0).toUpperCase() + niche.slice(1).toLowerCase();
    const headline = `Get your ${nicheFormatted} price in 30 seconds.`;

    // Primary color from theme
    const primaryColor = businessData.theme?.colors?.primary || '#2563eb';

    // Check if this is a prospect (for claim banner)
    const isProspect = business?.status === 'prospect';

    return (
        <QuoteFunnel
            businessName={businessData.businessName || business?.name || 'Local Service'}
            logoUrl={logoUrl}
            phoneNumber={businessData.phone || business?.phone_number}
            whatsappNumber={businessData.phone || business?.phone_number}
            headline={headline}
            subheadline="No hidden fees. 100% Free Estimate."
            urgencyText="⚡ Response in 2 mins"
            currency={currency}
            services={services}
            unitLabel="How many units?"
            businessId={paramBusinessId}
            primaryColor={primaryColor}
            isProspect={isProspect}
            recentBookings={[
                { name: "Recent Customer", action: "Just requested a quote", time: "2 mins ago", avatar: "👤" },
            ]}
            trustBadges={[
                { icon: "🛡️", text: "Verified Pro" },
                { icon: "⭐", text: "Trusted Service" },
            ]}
            processSteps={[
                { icon: "📱", title: "You Request", desc: "Pick your slot" },
                { icon: "✅", title: "We Confirm", desc: "Get tech photo" },
                { icon: "🎉", title: "Job Done", desc: "Pay after" },
            ]}
        />
    );
}
