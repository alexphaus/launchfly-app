import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendLeadNotification, sendJobCard } from '@/lib/whatsapp-push';

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
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .insert({
                business_id: businessId,
                email: formData.email,
                phone: formData.phone,
                name: formData.name || formData.email.split('@')[0],
                status: 'new',
                tags: formData.type === 'quote_request' ? ['quote_request', 'web_lead'] : ['web_lead'],
                notes: notes
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
            if (formData.type === 'quote_request') {
                await sendJobCard(ownerPhone, {
                    id: customer.id.substring(0, 8).toUpperCase(), // Short ID
                    serviceName: business.business_data?.niche || 'Service',
                    serviceEmoji: business.business_data?.emoji, // Assuming emoji might exist in business_data (it's in serviceTemplate)
                    customerName: formData.name || 'Customer',
                    customerPhone: formData.phone,
                    estimate: formData.quoteDetails.estimate,
                    answers: formData.quoteDetails.answers,
                    businessName: business.name
                });
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
