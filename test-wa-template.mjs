// Test WhatsApp Template directly and update status for conversion testing
import dotenv from 'dotenv';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const templateSid = process.env.TWILIO_TEMPLATE_SERVICE_DUE;
const phone = '+34683233450';

async function run() {
    console.log('Testing WhatsApp template + Status Update...');
    console.log('Template SID:', templateSid);
    console.log('To:', phone);

    // 1. Send Message
    try {
        const msg = await client.messages.create({
            contentSid: templateSid,
            contentVariables: JSON.stringify({
                '1': 'Alex',           // customerName
                '2': 'Launchfly',      // businessName
                '3': 'aircon',         // appliance
                '4': '28 Jul',         // lastServiceDate
            }),
            from: 'whatsapp:+13203627874',
            to: `whatsapp:${phone}`,
        });
        console.log('✅ Success! SID:', msg.sid);

        // 2. Update Status to 'reminder_sent' so V2 handler catches the "YES" reply
        // We need to find the customer ID first
        const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .or(`phone.eq.${phone},phone.eq.${phone.substring(1)}`)
            .single();

        if (customer) {
            await supabase.from('customers')
                .update({ status: 'reminder_sent' })
                .eq('id', customer.id);
            console.log('✅ Customer status updated to "reminder_sent"');
            console.log('👉 NOW REPLY "YES" TO TEST THE HANDLER!');
        } else {
            console.log('⚠️ Could not find customer to update status');
        }

    } catch (err) {
        console.log('❌ Error:', err.message);
        console.log('   Code:', err.code);
        if (err.moreInfo) console.log('   More info:', err.moreInfo);
    }
}

run();
