// Test WhatsApp Template: 2nd Nudge (Service Overdue)
import dotenv from 'dotenv';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const templateSid = process.env.TWILIO_TEMPLATE_SERVICE_OVERDUE;
const phone = process.env.MY_PHONE || '+34683233450'; // Fallback to test phone

async function run() {
    console.log('Testing WhatsApp 2nd Nudge (Overdue) + Status Update...');
    console.log('Template SID:', templateSid);
    console.log('To:', phone);

    if (!templateSid) {
        console.error('❌ Missing TWILIO_TEMPLATE_SERVICE_OVERDUE in .env');
        process.exit(1);
    }

    // 1. Send Message
    try {
        const variables = {
            '1': 'Alex',           // customerName
            '2': 'Launchfly',      // businessName
            '3': 'aircon',         // appliance
            '4': '7',              // days overdue
        };
        
        console.log('Variables:', variables);

        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+13203627874';
        const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

        const msg = await client.messages.create({
            contentSid: templateSid,
            contentVariables: JSON.stringify(variables),
            from: from,
            to: `whatsapp:${phone}`,
        });
        console.log('✅ Success! SID:', msg.sid);

        // 2. Update Status to 'reminder_sent' so V2 handler catches the "YES" reply
        // We need to find the customer ID first
        const phoneWithoutPlus = phone.replace('+', '');
        const { data: customer } = await supabase
            .from('customers')
            .select('id, business_id')
            .or(`phone.eq.${phone},phone.eq.${phoneWithoutPlus}`)
            .single();

        if (customer) {
            await supabase.from('customers')
                .update({ 
                    status: 'reminder_sent',
                    // Also fake a last service date for context if needed
                })
                .eq('id', customer.id);
            console.log('✅ Customer status updated to "reminder_sent"');
            console.log(`✅ Linked to Business ID: ${customer.business_id}`);
            console.log('👉 NOW REPLY "YES" TO TEST THE 2ND NUDGE HANDLER!');
        } else {
            console.log('⚠️ Could not find customer to update status');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

run();
