// src/app/api/whatsapp/blast/route.ts
// WhatsApp Re-engagement Blast API
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let client: any = null;
if (accountSid && authToken) {
    const twilio = require('twilio');
    client = twilio(accountSid, authToken);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { businessId, message, template } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-ignore
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // 1. Get business details
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, business_data')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // 2. Get old leads (not booked, older than 3 days)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: oldLeads, error: leadsError } = await supabase
            .from('customers')
            .select('id, phone, name, status, notes')
            .eq('business_id', businessId)
            .neq('status', 'booked')
            .neq('status', 'confirmed')
            .lt('created_at', threeDaysAgo.toISOString())
            .not('phone', 'is', null);

        if (leadsError) {
            console.error('Error fetching leads:', leadsError);
            return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
        }

        if (!oldLeads || oldLeads.length === 0) {
            return NextResponse.json({ message: 'No leads to blast', sent: 0 });
        }

        // 3. Prepare message
        const businessName = business.business_data?.businessName || business.name || 'Your Local Service';
        const niche = business.business_data?.niche || 'Service';

        const blastMessage = message ||
            `🔥 ${niche} Promo! 10% OFF this week only. Reply "BOOK" to claim your slot! - ${businessName}`;

        // 4. Send messages
        let sentCount = 0;
        const errors: string[] = [];

        for (const lead of oldLeads) {
            if (!lead.phone) continue;

            const cleanPhone = lead.phone.replace(/[^\d+]/g, '');
            const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

            try {
                if (client && fromNumber) {
                    await client.messages.create({
                        from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                        to: recipient,
                        body: blastMessage
                    });
                    sentCount++;

                    // Update customer status
                    await supabase
                        .from('customers')
                        .update({
                            status: 'reengaged',
                            notes: `${lead.notes || ''}\n[BLAST ${new Date().toISOString()}]: Sent promo message`
                        })
                        .eq('id', lead.id);

                } else {
                    // Mock mode
                    console.log(`[MOCK BLAST] To: ${recipient}\nMessage: ${blastMessage}`);
                    sentCount++;
                }
            } catch (err: any) {
                console.error(`Failed to send to ${lead.phone}:`, err.message);
                errors.push(lead.phone);
            }
        }

        // 5. Log the blast
        console.log(`📢 Blast sent to ${sentCount}/${oldLeads.length} leads for ${businessName}`);

        return NextResponse.json({
            success: true,
            sent: sentCount,
            total: oldLeads.length,
            errors: errors.length,
            message: `Sent to ${sentCount} leads`
        });

    } catch (error: any) {
        console.error('Blast error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
