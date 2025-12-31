/**
 * WhatsApp Lead Delivery API
 * Sends PDF/guide directly to leads via WhatsApp when they submit the form
 * This provides instant delivery with 90%+ open rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

interface DeliverRequest {
    businessId: string;
    toPhone: string;
    leadName?: string;
    leadEmail?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: DeliverRequest = await request.json();
        const { businessId, toPhone, leadName, leadEmail } = body;

        if (!businessId || !toPhone) {
            return NextResponse.json({ error: 'businessId and toPhone required' }, { status: 400 });
        }

        // Normalize phone number
        const normalizedPhone = toPhone.replace(/[^0-9+]/g, '');
        const formattedPhone = normalizedPhone.startsWith('+')
            ? normalizedPhone
            : `+${normalizedPhone}`;

        // Get business and lead magnet data
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Extract lead magnet info
        const businessData = business.business_data || {};
        const title = businessData.lead_magnet_title || 'Your Expert Guide';
        const businessName = businessData.businessName || business.name || 'Expert';

        // Build download link (public PDF URL)
        const pdfUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://launchfly.app'}/api/lead-magnet/pdf/${businessId}`;

        // Build landing page link for more info
        const landingUrl = business.subdomain
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://launchfly.app'}/sites/${business.subdomain}`
            : null;

        // === TWILIO WHATSAPP MESSAGE ===
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!accountSid?.startsWith('AC') || !authToken || !fromWhatsApp) {
            console.warn('⚠️ WhatsApp delivery skipped - Twilio not configured');
            return NextResponse.json({
                success: false,
                skipped: true,
                reason: 'WhatsApp not configured',
                fallback: 'email'
            });
        }

        try {
            const twilio = require('twilio')(accountSid, authToken);

            // Message with PDF link
            // Note: For actual PDF file sending, you'd need Twilio Media Messages
            // which requires a publicly accessible URL to the PDF
            const messageBody = `Hi ${leadName || 'there'}! 👋

Thanks for your interest in *${title}*!

📄 *Download your guide here:*
${pdfUrl}

Questions? Just reply to this message!

— ${businessName}`;

            const message = await twilio.messages.create({
                body: messageBody,
                from: fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp}`,
                to: `whatsapp:${formattedPhone}`
            });

            console.log(`📱 WhatsApp delivered to ${formattedPhone}: ${message.sid}`);

            // Log the delivery
            await supabase
                .from('ai_activities')
                .insert({
                    business_id: businessId,
                    type: 'whatsapp_delivery',
                    icon: 'W',
                    message: 'Lead Magnet Delivered via WhatsApp',
                    details: `Sent "${title}" to ${formattedPhone}`,
                    metadata: {
                        phone: formattedPhone,
                        email: leadEmail,
                        messageSid: message.sid
                    }
                });

            return NextResponse.json({
                success: true,
                method: 'whatsapp',
                messageSid: message.sid,
                to: formattedPhone
            });

        } catch (twilioError: any) {
            console.error('❌ Twilio WhatsApp delivery error:', twilioError.message);

            // Return failure but indicate email fallback available
            return NextResponse.json({
                success: false,
                error: twilioError.message,
                code: twilioError.code,
                fallback: 'email' // Caller should fall back to email
            }, { status: twilioError.code === 21614 ? 400 : 500 });
        }

    } catch (error: any) {
        console.error('WhatsApp deliver error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
