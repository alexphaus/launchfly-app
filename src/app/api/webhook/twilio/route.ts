// /api/webhook/twilio/route.ts
// Twilio WhatsApp Webhook - Receives incoming messages from customers
// This is called when a customer sends a message to the Launchfly assistant number

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendQuoteConfirmation, sendSlotSuggester } from '@/lib/whatsapp-push';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        // Twilio sends form-urlencoded data
        const formData = await request.formData();

        const from = formData.get('From') as string; // e.g., whatsapp:+34683233450
        const body = formData.get('Body') as string;
        const to = formData.get('To') as string;

        console.log('📨 Incoming WhatsApp message:');
        console.log(`   From: ${from}`);
        console.log(`   Body: ${body?.substring(0, 100)}...`);

        // Extract phone number from WhatsApp format
        const customerPhone = from.replace('whatsapp:', '');

        // Check if this looks like a quote request (matches our prefilled message pattern)
        const isQuoteRequest = body?.toLowerCase().includes('quote') ||
            body?.toLowerCase().includes('requested') ||
            body?.toLowerCase().includes('estimated');

        if (isQuoteRequest) {
            console.log('🎯 Detected quote request message');

            // Find the most recent pending customer with this phone
            const { data: customer, error } = await supabase
                .from('customers')
                .select('*, businesses(name, business_data)')
                .eq('phone', customerPhone)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (customer && !error) {
                console.log(`✅ Found customer: ${customer.name} for business: ${customer.businesses?.name}`);

                // Parse quote details from notes
                const notes = customer.notes || '';
                const estimateMatch = notes.match(/Estimate: ([^\n]+)/);
                const estimate = estimateMatch ? estimateMatch[1] : 'Check with us';

                // Extract service from notes
                const serviceMatch = notes.match(/Details: (.+)/);
                let serviceName = 'Service';
                if (serviceMatch) {
                    try {
                        const details = JSON.parse(serviceMatch[1]);
                        serviceName = details.type || details.service || 'Service';
                    } catch {
                        serviceName = 'Service';
                    }
                }

                // Now we can send the confirmation - customer is in 24h window!
                console.log('📤 Sending Quote Confirmation (customer now in 24h window)...');

                // Parse estimate values
                let estimateMin = 0;
                let estimateMax = 0;
                let currency = 'RM';
                if (estimateMatch) {
                    const parts = estimateMatch[1].split(' ');
                    currency = parts[0] || 'RM';
                    const range = parts.slice(1).join(' ').split('-').map((s: string) => parseInt(s.replace(/\D/g, '')));
                    estimateMin = range[0] || 0;
                    estimateMax = range[1] || estimateMin;
                }

                const confirmResult = await sendQuoteConfirmation(customerPhone, {
                    businessName: customer.businesses?.name || 'Local Service',
                    estimateMin,
                    estimateMax,
                    currency
                });

                console.log(`📤 Quote Confirmation result: ${confirmResult}`);

                // Also send slot suggester
                const slotResult = await sendSlotSuggester(customerPhone, {
                    businessName: customer.businesses?.name || 'Local Service',
                    customerName: customer.name || 'there',
                    currency,
                    estimateMin,
                    estimateMax
                });

                console.log(`📤 Slot Suggester result: ${JSON.stringify(slotResult)}`);

                // Update customer status
                await supabase
                    .from('customers')
                    .update({ status: 'contacted' })
                    .eq('id', customer.id);

            } else {
                console.log(`⚠️ No matching customer found for phone: ${customerPhone}`);
            }
        } else {
            // Generic message - could be a reply, follow-up question, etc.
            console.log('💬 Generic message received (not a quote request)');
            // TODO: Add AI response or forward to owner
        }

        // Return empty TwiML response (no immediate reply from webhook)
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
            {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            }
        );

    } catch (error) {
        console.error('❌ Webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

// GET for Twilio validation
export async function GET() {
    return NextResponse.json({ status: 'Twilio webhook active' });
}
