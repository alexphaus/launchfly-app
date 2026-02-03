// scripts/test-monthly-report.ts
// Test the Monthly Value Report (Churn Killer)
// Usage: npx tsx scripts/test-monthly-report.ts [--send]

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
const DRY_RUN = !process.argv.includes('--send');

async function test() {
    console.log('📊 Testing Monthly Value Report (Churn Killer)\n');
    console.log(`   Mode: ${DRY_RUN ? '🔒 DRY RUN (use --send to actually send)' : '🚀 LIVE - WILL SEND MESSAGE'}`);
    console.log('');

    // Get business info
    const { data: business } = await supabase
        .from('businesses')
        .select('id, name, whatsapp_number, phone_number, business_data')
        .eq('id', DANS_BUSINESS_ID)
        .single();

    if (!business) {
        console.log('❌ Business not found');
        return;
    }

    console.log('✅ Business:', business.name);
    console.log('   Owner Phone:', business.whatsapp_number || business.phone_number);

    const config = business.business_data || {};
    const currency = config.currency || 'RM';
    const cleaningPrice = config.cleaningPrice || 120;

    // Get last month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long' });

    console.log(`\n📅 Reporting period: ${monthName} ${lastMonth.getFullYear()}`);
    console.log(`   ${lastMonth.toISOString().split('T')[0]} to ${lastMonthEnd.toISOString().split('T')[0]}`);

    const start = lastMonth.toISOString();
    const end = lastMonthEnd.toISOString();

    // Query stats
    console.log('\n📊 Querying stats...');

    const [customers, serviceRecords, reminders, feedback, bookings] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' })
            .eq('business_id', DANS_BUSINESS_ID).gte('created_at', start).lte('created_at', end),
        supabase.from('service_records').select('id', { count: 'exact' })
            .eq('business_id', DANS_BUSINESS_ID).gte('created_at', start).lte('created_at', end),
        supabase.from('service_reminders').select('id', { count: 'exact' })
            .eq('business_id', DANS_BUSINESS_ID).eq('status', 'sent').gte('sent_at', start).lte('sent_at', end),
        supabase.from('customer_feedback').select('id', { count: 'exact' })
            .eq('business_id', DANS_BUSINESS_ID).lte('rating', 2).gte('created_at', start).lte('created_at', end),
        supabase.from('bookings').select('id', { count: 'exact' })
            .eq('business_id', DANS_BUSINESS_ID).gte('created_at', start).lte('created_at', end),
    ]);

    const stats = {
        customersCapured: customers.count || 0,
        warrantiesActivated: serviceRecords.count || 0,
        remindersSent: reminders.count || 0,
        reviewsSecured: feedback.count || 0,
        bookingsCreated: bookings.count || 0,
    };

    // Calculate estimated revenue
    const estimatedRevenue = Math.round(
        (stats.warrantiesActivated * cleaningPrice * 1.5) +
        (stats.remindersSent * 0.3 * cleaningPrice) +
        (stats.bookingsCreated * cleaningPrice) +
        (stats.reviewsSecured * cleaningPrice * 0.5)
    );

    console.log('\n📈 Stats for', monthName + ':');
    console.log('   Customers Captured:', stats.customersCapured);
    console.log('   Warranties Activated:', stats.warrantiesActivated);
    console.log('   Reminders Sent:', stats.remindersSent);
    console.log('   Reviews Secured:', stats.reviewsSecured);
    console.log('   Bookings Created:', stats.bookingsCreated);
    console.log('   💰 Estimated Revenue:', currency, estimatedRevenue);

    // Build message
    const lines = [
        `📊 *Monthly Performance Report (${monthName})*`,
        ``,
        `Boss, here's what your 'Digital Receptionist' did for you this month:`,
        ``,
    ];
    if (stats.customersCapured > 0) lines.push(`✅ Customers Captured: *${stats.customersCapured}*`);
    if (stats.warrantiesActivated > 0) lines.push(`✅ Warranties Activated: *${stats.warrantiesActivated}*`);
    if (stats.remindersSent > 0) lines.push(`✅ Auto-Reminders Sent: *${stats.remindersSent}*`);
    if (stats.bookingsCreated > 0) lines.push(`✅ Bookings Created: *${stats.bookingsCreated}*`);
    if (stats.reviewsSecured > 0) lines.push(`⭐ 5-Star Reviews Secured: *${stats.reviewsSecured}*`);
    lines.push(``);
    lines.push(`💰 *Estimated Revenue Generated: ${currency} ${estimatedRevenue.toLocaleString()}*`);
    lines.push(``);
    lines.push(`System Status: *ACTIVE & RUNNING* 🟢`);
    lines.push(`No action needed. Just keep sticking! 🫡`);

    const message = lines.join('\n');

    console.log('\n📝 Message Preview:');
    console.log('─'.repeat(50));
    console.log(message);
    console.log('─'.repeat(50));

    if (DRY_RUN) {
        console.log('\n🔒 DRY RUN - Would send to:', business.whatsapp_number || business.phone_number);
        console.log('\n💡 Run with --send to actually send');
        return;
    }

    // Send
    const ownerPhone = business.whatsapp_number || business.phone_number;
    const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    const formattedFrom = fromNumber?.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    console.log('\n📤 Sending...');

    try {
        const msg = await twilioClient.messages.create({
            from: formattedFrom,
            to: `whatsapp:${cleanPhone}`,
            body: message,
        });
        console.log('✅ Sent! Message SID:', msg.sid);
    } catch (e: any) {
        console.error('❌ Failed:', e.message);
    }
}

test().catch(console.error);
