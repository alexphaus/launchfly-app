/**
 * Fast Quote Funnel Generator
 * 
 * Creates a minimal business entry for the Quote Funnel in ~3-5 seconds.
 * Skips obsolete assets (PDF, email, scripts) and uses SERVICE_TEMPLATES directly.
 * 
 * Use this for sales pipeline prospects when you just need a working quote funnel preview.
 */

import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { SERVICE_TEMPLATES, getServiceTemplate } from '@/lib/content-library';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Default expiry for prospect businesses (14 days)
const PROSPECT_EXPIRY_DAYS = 14;

// Niche aliases for matching service types
const NICHE_ALIASES: Record<string, string[]> = {
    aircon: ['aircon', 'air conditioning', 'ac', 'hvac', 'air-con', 'aircond', 'refrigeration', 'cooling'],
    pest_control: ['pest', 'pest control', 'exterminator', 'termite', 'rodent', 'fumigation', 'insect'],
    plumbing: ['plumbing', 'plumber', 'pipe', 'drain', 'leak', 'water heater', 'sanitary'],
    cleaning: ['cleaning', 'cleaner', 'housekeeping', 'maid', 'janitor', 'home cleaning', 'office cleaning'],
    electrical: ['electrical', 'electrician', 'wiring', 'power', 'lighting'],
    renovation: ['renovation', 'renovate', 'remodel', 'interior design', 'contractor'],
    roofing: ['roofing', 'roof', 'gutter', 'waterproofing'],
    landscaping: ['landscaping', 'garden', 'lawn', 'tree', 'grass'],
    moving: ['moving', 'mover', 'relocation', 'lorry', 'transport'],
    auto_repair: ['auto', 'car', 'vehicle', 'mechanic', 'workshop', 'tyre', 'tire'],
    locksmith: ['locksmith', 'lock', 'key', 'security', 'safe'],
    handyman: ['handyman', 'repair', 'maintenance', 'general contractor', 'home repair']
};

function matchServiceType(niche: string): string {
    if (!niche) return 'other';
    const nicheLower = niche.toLowerCase();

    // Check for direct match first
    if (SERVICE_TEMPLATES[nicheLower]) {
        return nicheLower;
    }

    // Check aliases
    for (const [key, aliases] of Object.entries(NICHE_ALIASES)) {
        if (aliases.some(alias => nicheLower.includes(alias) || alias.includes(nicheLower.split(' ')[0]))) {
            return key;
        }
    }

    return 'other';
}

function generateCleanSubdomain(name: string): string {
    if (!name) return `biz-${nanoid(6)}`.toLowerCase();

    let clean = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);

    if (clean.length < 3) {
        clean = `biz-${nanoid(6)}`.toLowerCase();
    }

    return clean;
}

// Default testimonials based on service type
function generateDefaultTestimonials(businessName: string, serviceType: string) {
    const firstNames = ['Sarah', 'Mike', 'Emily', 'James', 'Lisa', 'David'];
    const lastInitials = ['L', 'T', 'R', 'K', 'M', 'S'];

    const templates: Record<string, string[]> = {
        aircon: [
            `${businessName} came same-day to fix our AC. Super fast and professional!`,
            `Finally found a reliable aircon service. Will definitely use them again.`,
            `Great pricing and honest work. Highly recommend!`
        ],
        pest_control: [
            `No more cockroaches after their treatment. Worth every penny!`,
            `Professional and thorough. ${businessName} knows their stuff.`,
            `Finally can sleep peacefully. Thank you!`
        ],
        default: [
            `Great service from ${businessName}. Very professional!`,
            `Fast response and fair pricing. Recommended!`,
            `Excellent work quality. Will use again.`
        ]
    };

    const testimonialTexts = templates[serviceType] || templates.default;

    return testimonialTexts.map((content, i) => ({
        name: `${firstNames[i % firstNames.length]} ${lastInitials[i % lastInitials.length]}.`,
        role: 'Verified Customer',
        content,
        avatar: i % 2 === 0 ? '👩' : '👨',
        rating: 5
    }));
}

export async function POST(request: Request) {
    const startTime = Date.now();

    try {
        const {
            businessName,
            serviceType,
            area,
            phone,
            email,
            ownerName,
            websiteUrl,
            currency = 'RM',
            context  // Optional raw context for notes
        } = await request.json();

        // Validate required fields
        if (!businessName) {
            return Response.json({ error: 'Business name is required' }, { status: 400 });
        }

        // Match service type to template
        const matchedType = matchServiceType(serviceType || 'other');
        const template = SERVICE_TEMPLATES[matchedType] || SERVICE_TEMPLATES.other;

        // Generate clean subdomain
        let subdomain = generateCleanSubdomain(businessName);

        // Check if subdomain exists
        const { data: existingBusiness } = await supabase
            .from('businesses')
            .select('id')
            .eq('subdomain', subdomain)
            .single();

        if (existingBusiness) {
            subdomain = `${subdomain}-${nanoid(4)}`.toLowerCase();
        }

        // Set expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + PROSPECT_EXPIRY_DAYS);

        // Build minimal business_data using template
        const businessData = {
            businessName,
            niche: template.name,
            websiteUrl: websiteUrl || '',
            email: email || '',
            phone: phone || '',
            ownerName: ownerName || '',
            currency,
            currencyCode: currency === 'RM' ? 'MYR' : currency === '₱' ? 'PHP' : 'USD',
            testimonials: generateDefaultTestimonials(businessName, matchedType),
            prospectImages: [],
            notes: context || '',
            // **CRITICAL** - Quote Calculator from template
            quoteCalculator: template.quoteCalculator
                ? { ...template.quoteCalculator, currency }
                : null,
            // Landing page content from template
            leadMagnet: {
                lead_magnet: {
                    title: template.leadMagnet.title,
                    type: 'checklist',
                    preview_tips: template.leadMagnet.items.slice(0, 3).map((item, i) => ({
                        title: `Tip ${i + 1}`,
                        description: item
                    }))
                },
                landing_page: {
                    hero_headline: template.landingPage.headline,
                    hero_subheadline: template.landingPage.subheadline,
                    benefits: template.landingPage.benefits,
                    cta_text: template.landingPage.ctaButton,
                    quoteCalculator: template.quoteCalculator || null
                }
            }
        };

        // Get system user for prospect business
        let systemUserId = process.env.SYSTEM_USER_ID;

        if (!systemUserId) {
            const { data: anyUser } = await supabase
                .from('profiles')
                .select('id')
                .limit(1)
                .single();
            systemUserId = anyUser?.id;
        }

        if (!systemUserId) {
            return Response.json({
                error: 'No system user configured. Set SYSTEM_USER_ID in .env.local'
            }, { status: 500 });
        }

        // Insert business
        const { data: business, error: bizErr } = await supabase
            .from('businesses')
            .insert({
                user_id: systemUserId,
                name: businessName,
                subdomain,
                status: 'prospect',
                source: 'quick-preview',
                business_data: businessData,
                form_data: {
                    niche: template.name,
                    websiteUrl: websiteUrl || '',
                    prospectEmail: email || '',
                    prospectPhone: phone || '',
                    prospectOwnerName: ownerName || '',
                    area: area || '',
                    context: context || ''
                },
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();

        if (bizErr) {
            console.error('Quick preview error:', bizErr);
            return Response.json({ error: bizErr.message }, { status: 500 });
        }

        const previewUrl = `https://${subdomain}.launchfly.ai/quote`;
        const duration = Date.now() - startTime;

        console.log(`✅ Quick preview created in ${duration}ms: ${business.id} -> ${previewUrl}`);

        return Response.json({
            success: true,
            businessId: business.id,
            previewUrl,
            subdomain,
            serviceType: matchedType,
            duration: `${duration}ms`
        });

    } catch (error: any) {
        console.error('Quick preview error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
