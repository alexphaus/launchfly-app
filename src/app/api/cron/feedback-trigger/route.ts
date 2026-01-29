import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function GET(req: NextRequest) {
    // Security: Check for a secret key to prevent unauthorized triggering
    if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = new Date();
        const sevenDaysAgoStart = new Date(today);
        sevenDaysAgoStart.setDate(today.getDate() - 7);
        sevenDaysAgoStart.setHours(0, 0, 0, 0);

        const sevenDaysAgoEnd = new Date(today);
        sevenDaysAgoEnd.setDate(today.getDate() - 7);
        sevenDaysAgoEnd.setHours(23, 59, 59, 999);

        // 1. Find services from 7 days ago that haven't been asked for feedback yet
        const { data: services, error } = await supabase
            .from('service_records')
            .select(`
                id, 
                service_date,
                customer_id,
                business_id,
                customers!service_records_customer_id_fkey(id, first_name, phone, last_name), 
                businesses!service_records_business_id_fkey(id, name, phone_number, whatsapp_template_feedback)
            `)
            .gte('service_date', sevenDaysAgoStart.toISOString())
            .lte('service_date', sevenDaysAgoEnd.toISOString())
            .is('feedback_request_sent_at', null);

        if (error) {
            console.error("Error fetching services:", error);
            return NextResponse.json({ error }, { status: 500 });
        }

        if (!services || services.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No services found for 7-day feedback." });
        }

        const results = [];

        // 2. Loop and Send Templates
        for (const record of services) {
            // Supabase returns joined tables as objects (single) due to foreign key
            const customer = record.customers as unknown as { id: string; first_name: string | null; phone: string | null; last_name: string | null } | null;
            const business = record.businesses as unknown as { id: string; name: string; phone_number: string | null; whatsapp_template_feedback: string | null } | null;
            
            if (!customer || !business || !customer.phone) continue;

            const customerName = customer.first_name || 'Valued Customer';
            const businessName = business.name;
            // Use business-specific template, or env fallback, or skip if none configured
            const templateSid = business.whatsapp_template_feedback || process.env.TWILIO_TEMPLATE_FEEDBACK_7D;
            
            if (!templateSid) {
                console.warn(`⚠️ No feedback template configured for business ${business.id}`);
                results.push({ customer: customerName, status: 'skipped', reason: 'No template configured' });
                continue;
            }

            try {
                const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
                const formattedFrom = fromNumber?.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
                
                console.log(`📤 Sending 7-day feedback to ${customer.phone} for ${businessName}`);
                
                // Send the 7-Day Follow-up Template
                await twilioClient.messages.create({
                    from: formattedFrom,
                    to: `whatsapp:${customer.phone}`,
                    contentSid: templateSid, 
                    contentVariables: JSON.stringify({
                        1: customerName,
                        2: businessName
                    })
                });

                // 3. Mark as sent so we don't spam them
                await supabase
                    .from('service_records')
                    .update({ 
                        feedback_request_sent_at: new Date().toISOString()
                    })
                    .eq('id', record.id);

                // 4. Update Customer Context for AI
                await supabase
                    .from('customers')
                    .update({
                        last_interaction_context: 'FEEDBACK_7D'
                    })
                    .eq('id', customer.id);

                results.push({ 
                    customer: customerName, 
                    status: 'sent', 
                    service_id: record.id 
                });

            } catch (e: any) {
                console.error(`Failed to send to ${customer.phone}`, e);
                results.push({ customer: customerName, status: 'failed', error: e.message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });

    } catch (err: any) {
        console.error("Cron execution error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
