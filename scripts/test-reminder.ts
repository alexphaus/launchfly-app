// scripts/test-reminder.ts
// Test the 6-month service reminder flow (Smart Nag)
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const DANS_BUSINESS_ID = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';
const TEST_PHONE = '+639627459049'; // Same as 7-day feedback test
const SEND_FLAG = process.argv.includes('--send');

async function test() {
    console.log('🧪 Testing 6-Month Service Reminder (Smart Nag)\n');
    console.log('   Mode:', SEND_FLAG ? '📤 LIVE SEND' : '🔍 DRY RUN (add --send to actually send)');
    console.log('');
    
    // 1. Check what the cron would find
    console.log('1️⃣ Checking services due for reminder...\n');
    
    const { data: dueServices, error } = await supabase
        .rpc('get_services_due_for_reminder', { p_days_ahead: 14 });
    
    if (error) {
        console.log('❌ Error calling get_services_due_for_reminder:', error.message);
        console.log('   Hint: Make sure the function exists. Check db/migrations/20260121_forever_customer.sql');
        return;
    }
    
    if (!dueServices || dueServices.length === 0) {
        console.log('⚠️ No services due for reminder found.');
        console.log('   Run: npx tsx scripts/setup-test-reminder.ts first');
        return;
    }
    
    console.log(`✅ Found ${dueServices.length} services due for reminder:`);
    dueServices.forEach((s: any) => {
        console.log(`   - ${s.customer_name} (${s.customer_phone})`);
        console.log(`     Service: ${s.service_name}`);
        console.log(`     Due: ${s.next_due_at} (${s.days_until_due} days)`);
        console.log(`     Reminders sent: ${s.reminder_count}`);
    });
    
    // 2. Find our test customer
    const testService = dueServices.find((s: any) => 
        s.customer_phone === TEST_PHONE || s.customer_phone === '34683233450'
    );
    
    if (!testService) {
        console.log('\n⚠️ Test customer not in due list. Check setup.');
        return;
    }
    
    console.log('\n2️⃣ Test customer found:', testService.customer_name);
    
    // 3. Check template config
    console.log('\n3️⃣ Template Configuration:');
    console.log('   TWILIO_TEMPLATE_SERVICE_DUE:', process.env.TWILIO_TEMPLATE_SERVICE_DUE || '❌ NOT SET');
    console.log('   TWILIO_TEMPLATE_SERVICE_OVERDUE:', process.env.TWILIO_TEMPLATE_SERVICE_OVERDUE || '❌ NOT SET');
    
    if (!SEND_FLAG) {
        console.log('\n📋 DRY RUN COMPLETE');
        console.log('   To actually send the reminder, run:');
        console.log('   npx tsx scripts/test-reminder.ts --send');
        return;
    }
    
    // 4. Trigger the cron
    console.log('\n4️⃣ Triggering service-reminders cron...');
    
    const cronUrl = 'http://localhost:3000/api/cron/service-reminders';
    
    try {
        const res = await fetch(cronUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
        });
        
        const data = await res.json();
        
        if (res.ok) {
            console.log('✅ Cron executed successfully!');
            console.log('   Processed:', data.processed);
            console.log('   Sent:', data.sent);
            console.log('   WhatsApp:', data.sentWhatsApp);
            console.log('   SMS:', data.sentSms);
            console.log('   Failed:', data.failed);
            console.log('   Skipped:', data.skipped);
            if (data.errors?.length > 0) {
                console.log('   Errors:', data.errors);
            }
        } else {
            console.log('❌ Cron failed:', data.error || res.status);
        }
    } catch (err: any) {
        console.log('❌ Failed to call cron:', err.message);
        console.log('   Is the dev server running? (npm run dev)');
    }
    
    console.log('\n📱 Check your WhatsApp for the reminder message!');
}

test().catch(console.error);
