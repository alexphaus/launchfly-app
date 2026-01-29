// test-feedback-cron.ts
// Quick test to verify the 7-day feedback cron logic

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function testFeedbackQuery() {
    console.log('🧪 Testing 7-day feedback query...\n');
    
    const today = new Date();
    const sevenDaysAgoStart = new Date(today);
    sevenDaysAgoStart.setDate(today.getDate() - 7);
    sevenDaysAgoStart.setHours(0, 0, 0, 0);

    const sevenDaysAgoEnd = new Date(today);
    sevenDaysAgoEnd.setDate(today.getDate() - 7);
    sevenDaysAgoEnd.setHours(23, 59, 59, 999);
    
    console.log(`Looking for services between:`);
    console.log(`  Start: ${sevenDaysAgoStart.toISOString()}`);
    console.log(`  End:   ${sevenDaysAgoEnd.toISOString()}\n`);

    // Test query
    const { data: services, error } = await supabase
        .from('service_records')
        .select(`
            id, 
            service_date,
            customer_id,
            business_id,
            feedback_request_sent_at,
            customers!inner(id, first_name, phone, last_name), 
            businesses!inner(id, name, phone_number, whatsapp_template_feedback)
        `)
        .gte('service_date', sevenDaysAgoStart.toISOString())
        .lte('service_date', sevenDaysAgoEnd.toISOString())
        .is('feedback_request_sent_at', null);

    if (error) {
        console.error('❌ Query error:', error);
        return;
    }

    console.log(`✅ Found ${services?.length || 0} service records\n`);
    
    if (services && services.length > 0) {
        services.forEach((record: any) => {
            const customer = record.customers as any;
            const business = record.businesses as any;
            console.log(`  📋 Service ID: ${record.id}`);
            console.log(`     Customer: ${customer?.first_name || 'Unknown'} (${customer?.phone || 'no phone'})`);
            console.log(`     Business: ${business?.name || 'Unknown'}`);
            console.log(`     Service Date: ${record.service_date}`);
            console.log(`     Template SID: ${business?.whatsapp_template_feedback || 'NOT CONFIGURED'}`);
            console.log('');
        });
    } else {
        console.log('ℹ️ No services from exactly 7 days ago that need feedback.\n');
        
        // Check if there are ANY service records
        const { data: allServices, count } = await supabase
            .from('service_records')
            .select('id, service_date, feedback_request_sent_at', { count: 'exact' })
            .order('service_date', { ascending: false })
            .limit(5);
        
        console.log(`📊 Total service records: ${count || 0}`);
        if (allServices && allServices.length > 0) {
            console.log('   Most recent:');
            allServices.forEach((s: any) => {
                const daysAgo = Math.floor((Date.now() - new Date(s.service_date).getTime()) / (1000 * 60 * 60 * 24));
                console.log(`     - ${s.service_date?.split('T')[0]} (${daysAgo} days ago) | Feedback sent: ${s.feedback_request_sent_at ? '✅' : '❌'}`);
            });
        }
    }
    
    // Check if TWILIO_TEMPLATE_FEEDBACK_7D is set
    console.log('\n📧 Environment check:');
    console.log(`   TWILIO_TEMPLATE_FEEDBACK_7D: ${process.env.TWILIO_TEMPLATE_FEEDBACK_7D ? '✅ Set' : '❌ NOT SET'}`);
    console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ NOT SET'}`);
}

testFeedbackQuery().catch(console.error);
