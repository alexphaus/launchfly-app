// scripts/test-6m-reminder-direct.ts
// Direct test of 6-month reminder - bypasses cron, sends directly
// Usage: npx tsx scripts/test-6m-reminder-direct.ts [--send]

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const DANS_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+639627459049';
const DRY_RUN = !process.argv.includes('--send');

async function test() {
    console.log('🧪 Testing 6-Month Service Reminder (Direct Send)\n');
    console.log(`   Mode: ${DRY_RUN ? '🔒 DRY RUN (use --send to actually send)' : '🚀 LIVE - WILL SEND MESSAGE'}`);
    console.log('');

    // 1. Find customer
    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone, business_id')
        .eq('business_id', DANS_BUSINESS_ID)
        .or(`phone.eq.${TEST_PHONE},phone.eq.639627459049`)
        .single();

    if (!customer) {
        console.log('❌ No customer found. Run setup first.');
        return;
    }

    console.log('✅ Found customer:', customer.name, customer.phone);

    // 2. Get business info
    const { data: business } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', DANS_BUSINESS_ID)
        .single();

    console.log('✅ Business:', business?.name);

    // 3. Get template SID
    const templateSid = process.env.TWILIO_TEMPLATE_SERVICE_DUE;
    console.log('📋 Template SID:', templateSid);

    if (!templateSid) {
        console.log('❌ TWILIO_TEMPLATE_SERVICE_DUE not set');
        return;
    }

    if (DRY_RUN) {
        console.log('\n🔒 DRY RUN - Would send:');
        console.log('   To:', `whatsapp:${customer.phone}`);
        console.log('   From:', `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`);
        console.log('   Template:', templateSid);
        console.log('   Variables: { 1: "' + customer.name + '", 2: "' + business?.name + '" }');
        console.log('\n💡 Run with --send to actually send');
        return;
    }

    // 4. Send the message
    console.log('\n📤 Sending WhatsApp template...');
    
    try {
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        const formattedFrom = fromNumber?.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

        const message = await twilioClient.messages.create({
            from: formattedFrom,
            to: `whatsapp:${customer.phone}`,
            contentSid: templateSid,
            contentVariables: JSON.stringify({
                1: customer.name || 'Valued Customer',
                2: business?.name || 'Your Service Provider'
            })
        });

        console.log('✅ Sent! Message SID:', message.sid);

        // 5. Update customer context
        await supabase
            .from('customers')
            .update({ 
                last_interaction_context: 'REMINDER_6M',
                status: 'reminder_sent'
            })
            .eq('id', customer.id);

        console.log('✅ Customer context updated: REMINDER_6M');
        console.log('\n📱 Check WhatsApp! When you reply, V2 will know it\'s a 6-month reminder response.');

    } catch (e: any) {
        console.error('❌ Failed:', e.message);
        
        // Show more details
        if (e.code) console.log('   Error code:', e.code);
        if (e.moreInfo) console.log('   More info:', e.moreInfo);
    }
}

test().catch(console.error);
