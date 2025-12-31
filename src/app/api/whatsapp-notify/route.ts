/**
 * WhatsApp Notification API
 * Sends WhatsApp messages to business owners when leads come in
 * Uses Twilio WhatsApp API (with Meta Cloud API support planned)
 */

import { NextRequest, NextResponse } from 'next/server';

// WhatsApp notification types
type NotificationType = 'new_lead' | 'lead_followup' | 'campaign_blast';

interface WhatsAppNotifyRequest {
    businessId: string;
    toPhone: string;
    type: NotificationType;
    data: {
        leadName?: string;
        leadPhone?: string;
        leadEmail?: string;
        serviceName?: string;
        message?: string;
    };
}

// Pre-approved message templates (WhatsApp Business API compliant)
const MESSAGE_TEMPLATES = {
    new_lead: (data: WhatsAppNotifyRequest['data']) => {
        const leadName = data.leadName || 'Someone';
        const leadPhone = data.leadPhone;
        const leadEmail = data.leadEmail || 'No email';
        const serviceName = data.serviceName || 'Service';

        // Sanitize phone for link (strip + and everything else, ensure pure numbers)
        // Note: wa.me expects country code without +. If local 0, might need handling but for now assume clean.
        const cleanPhone = leadPhone ? leadPhone.replace(/[^0-9]/g, '') : '';
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

        return `🔥 *New Lead: ${leadName}*

Looking for: ${serviceName}
Email: ${leadEmail}
${leadPhone ? `Phone: ${leadPhone}` : ''}

👇 *TAP TO CHAT NOW*
${waLink || '(No phone number provided - email them!)'}

*Suggested Quick Reply:*
"Hi ${leadName}, this is ${serviceName}. Saw you downloaded our guide. Do you have any questions I can help with?"`;
    },

    lead_followup: (data: WhatsAppNotifyRequest['data']) => {
        return `⏰ *Follow-up Reminder*

${data.leadName || 'A lead'} hasn't responded yet.

${data.message || 'Time to send a nudge!'}`;
    },

    campaign_blast: (data: WhatsAppNotifyRequest['data']) => {
        return data.message || 'Your campaign message';
    }
};

export async function POST(request: NextRequest) {
    try {
        const body: WhatsAppNotifyRequest = await request.json();
        const { toPhone, type, data } = body;

        if (!toPhone) {
            return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
        }

        if (!type || !MESSAGE_TEMPLATES[type]) {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        // Normalize phone number (remove spaces, ensure + prefix)
        const normalizedPhone = toPhone.replace(/[^0-9+]/g, '');
        const formattedPhone = normalizedPhone.startsWith('+')
            ? normalizedPhone
            : `+${normalizedPhone}`;

        // Generate message from template
        const messageBody = MESSAGE_TEMPLATES[type](data);

        // === TWILIO WHATSAPP INTEGRATION ===
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER; // Format: whatsapp:+14155238886

        if (!accountSid || !authToken || !fromWhatsApp) {
            console.warn('⚠️ WhatsApp notification skipped - Twilio not configured');
            return NextResponse.json({
                success: false,
                skipped: true,
                reason: 'WhatsApp not configured'
            });
        }

        // Validate Twilio credentials
        if (!accountSid.startsWith('AC')) {
            console.error('❌ Invalid TWILIO_ACCOUNT_SID (must start with AC)');
            return NextResponse.json({
                success: false,
                error: 'Invalid Twilio configuration'
            }, { status: 500 });
        }

        try {
            // Dynamic import to avoid bundling issues
            const twilio = require('twilio')(accountSid, authToken);

            const message = await twilio.messages.create({
                body: messageBody,
                from: fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp}`,
                to: `whatsapp:${formattedPhone}`
            });

            console.log(`📱 WhatsApp sent to ${formattedPhone}: ${message.sid}`);

            return NextResponse.json({
                success: true,
                messageSid: message.sid,
                to: formattedPhone
            });

        } catch (twilioError: any) {
            console.error('❌ Twilio WhatsApp error:', twilioError.message);

            // Common error handling
            if (twilioError.code === 21614) {
                return NextResponse.json({
                    success: false,
                    error: 'Phone number not on WhatsApp or not opted-in'
                }, { status: 400 });
            }

            if (twilioError.code === 21408) {
                return NextResponse.json({
                    success: false,
                    error: 'WhatsApp message template not approved'
                }, { status: 400 });
            }

            return NextResponse.json({
                success: false,
                error: twilioError.message
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('WhatsApp notify error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET endpoint for testing/health check
export async function GET() {
    const configured = !!(
        process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_NUMBER
    );

    return NextResponse.json({
        service: 'whatsapp-notify',
        configured,
        provider: 'twilio'
    });
}
