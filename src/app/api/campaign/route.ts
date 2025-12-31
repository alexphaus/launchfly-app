/**
 * Campaign Broadcast API
 * Send re-engagement messages to all past leads
 * Supports WhatsApp and SMS delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Pre-written campaign templates
const CAMPAIGN_TEMPLATES = {
    seasonal_promo: {
        id: 'seasonal_promo',
        name: 'Seasonal Promotion',
        emoji: '🌟',
        message: `Hi {name}! 👋

*Limited Time Offer* 🎉

We're running a special promotion this week!

📞 Reply to this message or call us to claim your discount.

— {business_name}`
    },

    holiday_special: {
        id: 'holiday_special',
        name: 'Holiday Special',
        emoji: '🎄',
        message: `Hi {name}! 

*Holiday Special* 🎁

Wishing you happy holidays! As a thank you for being our customer, we're offering an exclusive deal.

Reply "INTERESTED" to learn more!

— {business_name}`
    },

    limited_slots: {
        id: 'limited_slots',
        name: 'Limited Slots',
        emoji: '⏰',
        message: `Hi {name}!

*Quick Update* ⏰

We have a few slots opening up this week. Thought of you since you showed interest before!

Would you like to book one?

— {business_name}`
    },

    check_in: {
        id: 'check_in',
        name: 'Friendly Check-In',
        emoji: '👋',
        message: `Hi {name}! 👋

Just checking in — hope everything's going well!

If you ever need help with {service}, we're just a message away.

— {business_name}`
    },

    custom: {
        id: 'custom',
        name: 'Custom Message',
        emoji: '✏️',
        message: ''
    }
};

interface CampaignRequest {
    businessId: string;
    templateId: string;
    customMessage?: string;
    channel: 'whatsapp' | 'sms' | 'both';
    testMode?: boolean; // Send only to first lead for testing
}

export async function POST(request: NextRequest) {
    try {
        const body: CampaignRequest = await request.json();
        const { businessId, templateId, customMessage, channel = 'whatsapp', testMode = false } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'businessId required' }, { status: 400 });
        }

        // Get business data
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Check rate limiting (max 1 blast per week)
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentCampaigns } = await supabase
            .from('ai_activities')
            .select('id')
            .eq('business_id', businessId)
            .eq('type', 'campaign_blast')
            .gte('created_at', oneWeekAgo);

        if (recentCampaigns && recentCampaigns.length > 0 && !testMode) {
            return NextResponse.json({
                error: 'Campaign limit reached. You can send 1 blast per week.',
                nextAvailable: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }, { status: 429 });
        }

        // Get all leads with phone numbers
        let leadsQuery = supabase
            .from('customers')
            .select('id, email, phone, status')
            .eq('business_id', businessId)
            .not('phone', 'is', null)
            .eq('accepts_marketing', true);

        if (testMode) {
            leadsQuery = leadsQuery.limit(1);
        }

        const { data: leads, error: leadsError } = await leadsQuery;

        if (leadsError) {
            return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
        }

        if (!leads || leads.length === 0) {
            return NextResponse.json({
                error: 'No leads with phone numbers found',
                hint: 'Make sure leads have provided phone numbers and accepted marketing'
            }, { status: 400 });
        }

        // Get template
        const template = CAMPAIGN_TEMPLATES[templateId as keyof typeof CAMPAIGN_TEMPLATES];
        if (!template && templateId !== 'custom') {
            return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
        }

        const messageTemplate = templateId === 'custom' ? customMessage : template.message;
        if (!messageTemplate) {
            return NextResponse.json({ error: 'Message content required' }, { status: 400 });
        }

        // Prepare business info for template
        const businessData = business.business_data || {};
        const businessName = businessData.businessName || business.name || 'Your Local Business';
        const serviceName = businessData.niche || 'our services';

        // Send to all leads
        const results = {
            total: leads.length,
            sent: 0,
            failed: 0,
            errors: [] as string[]
        };

        const baseUrl = process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000';

        for (const lead of leads) {
            try {
                // Personalize message
                const leadName = lead.email?.split('@')[0] || 'there';
                const personalizedMessage = messageTemplate
                    .replace(/{name}/g, leadName)
                    .replace(/{business_name}/g, businessName)
                    .replace(/{service}/g, serviceName);

                // Send via WhatsApp
                if (channel === 'whatsapp' || channel === 'both') {
                    const waResponse = await fetch(`${baseUrl}/api/whatsapp-notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            businessId,
                            toPhone: lead.phone,
                            type: 'campaign_blast',
                            data: { message: personalizedMessage }
                        })
                    });

                    const waResult = await waResponse.json();
                    if (waResult.success) {
                        results.sent++;
                    } else {
                        results.failed++;
                        results.errors.push(`${lead.phone}: ${waResult.error}`);
                    }
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (sendError: any) {
                results.failed++;
                results.errors.push(`${lead.phone}: ${sendError.message}`);
            }
        }

        // Log campaign activity
        await supabase
            .from('ai_activities')
            .insert({
                business_id: businessId,
                type: 'campaign_blast',
                icon: 'C',
                message: `Campaign Sent: ${template?.name || 'Custom'}`,
                details: `Sent to ${results.sent}/${results.total} leads via ${channel}`,
                metadata: {
                    templateId,
                    channel,
                    results,
                    testMode
                }
            });

        return NextResponse.json({
            success: true,
            results,
            message: testMode
                ? `Test message sent to 1 lead`
                : `Campaign sent to ${results.sent} leads`
        });

    } catch (error: any) {
        console.error('Campaign error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: List available templates
export async function GET() {
    const templates = Object.values(CAMPAIGN_TEMPLATES).map(t => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        preview: t.message.substring(0, 100) + '...'
    }));

    return NextResponse.json({ templates });
}
