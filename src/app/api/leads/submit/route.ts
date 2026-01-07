import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendLeadNotification, sendJobCard, sendQuoteConfirmation, sendSlotSuggester } from '@/lib/whatsapp-push';
import { inngest, EVENTS } from '@/lib/inngest/client';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { businessId, formData } = body;

        const cookieStore = await cookies();
        // @ts-ignore - Supabase types mismatch with Next.js 15 cookies
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        if (!businessId) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        // 1. Get Business Details (for Owner Phone and Business Name)
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id, user_id, name, business_data, phone_number, whatsapp_number') // Try to get number from business profile first
            .eq('id', businessId)
            .single();

        if (businessError || !business) {
            console.error('Error fetching business:', businessError);
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Prepare notes based on type
        let notes = formData.message;
        if (formData.type === 'quote_request' && formData.quoteDetails) {
            // Save quote details as readable string for now (until we have a better column)
            notes = `JOB QUOTE REQUEST:\n` +
                `Estimate: ${formData.quoteDetails.estimate?.currency} ${formData.quoteDetails.estimate?.min}-${formData.quoteDetails.estimate?.max}\n` +
                `Details: ${JSON.stringify(formData.quoteDetails.answers)}`;
        }

        // 2. Save Lead to 'customers' table
        // For WhatsApp OS, phone is primary. Email may be empty.
        // Use upsert to handle returning customers.
        const customerEmail = formData.email || `lead-${Date.now()}@noemail.local`; // Fallback for unique constraint

        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .upsert({
                business_id: businessId,
                email: customerEmail,
                phone: formData.phone,
                name: formData.name || (formData.email ? formData.email.split('@')[0] : 'Customer'),
                status: 'new',
                tags: formData.type === 'quote_request' ? ['quote_request', 'web_lead'] : ['web_lead'],
                notes: notes
            }, {
                onConflict: 'business_id,email',
                ignoreDuplicates: false // Update existing record
            })
            .select()
            .single();

        if (customerError) {
            console.error('Error saving customer:', customerError);
            return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 });
        }

        // 3. Send "Push" Notification to Business Owner
        // Priority: whatsapp_number > phone_number > business_data.phone > business_data.whatsapp
        const ownerPhone =
            business.whatsapp_number ||
            business.phone_number ||
            business.business_data?.whatsapp ||
            business.business_data?.phone;

        if (ownerPhone) {
            console.log(`📱 Owner phone found: ${ownerPhone}`);
            console.log(`📱 Customer phone: ${formData.phone}`);

            if (formData.type === 'quote_request') {
                // Get currency with fallback
                const currency = formData.quoteDetails.estimate?.currency || 'RM';
                const estimateWithCurrency = {
                    ...formData.quoteDetails.estimate,
                    currency: currency
                };

                console.log('📤 Sending Job Card to owner...');
                // Send Job Card to business owner
                const jobCardResult = await sendJobCard(ownerPhone, {
                    id: customer.id.substring(0, 8).toUpperCase(), // Short ID
                    serviceName: business.business_data?.niche || 'Service',
                    serviceEmoji: business.business_data?.emoji,
                    customerName: formData.name || 'Customer',
                    customerPhone: formData.phone,
                    estimate: estimateWithCurrency,
                    answers: formData.quoteDetails.answers,
                    businessName: business.name,
                    businessId: business.id // For dashboard link
                });
                console.log(`📤 Job Card result: ${jobCardResult}`);

                // NOTE: Quote Confirmation and Slot Suggester are now sent via webhook
                // /api/webhook/twilio - triggered AFTER customer sends their WhatsApp message
                // This respects the WhatsApp 24-hour window rule
                console.log('⏳ Customer confirmation will be sent when they message the bot');

                // 4. Schedule Follow-up Messages via Inngest
                // +2h: "Ready to book a slot?"
                await inngest.send({
                    name: EVENTS.WHATSAPP_FOLLOWUP_SCHEDULED,
                    data: {
                        customerId: customer.id,
                        customerPhone: formData.phone,
                        businessName: business.name,
                        followUpType: '2h_slot_check',
                        delayMinutes: 120 // 2 hours
                    }
                });
                // +24h: "Still thinking?"
                await inngest.send({
                    name: EVENTS.WHATSAPP_FOLLOWUP_SCHEDULED,
                    data: {
                        customerId: customer.id,
                        customerPhone: formData.phone,
                        businessName: business.name,
                        followUpType: '24h_nudge',
                        delayMinutes: 1440 // 24 hours
                    }
                });
                console.log(`📅 Scheduled 2h and 24h follow-ups for customer ${customer.id}`);
            } else {
                await sendLeadNotification(ownerPhone, {
                    businessName: business.name,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    message: formData.message
                });
            }
        } else {
            console.warn('⚠️ No owner phone found for business:', business.name);
        }

        return NextResponse.json({ success: true, leadId: customer.id });
    } catch (error) {
        console.error('Submit error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
