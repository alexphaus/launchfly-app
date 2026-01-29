#!/usr/bin/env npx tsx
// scripts/test-7d-feedback.ts
// Test script for the 7-day feedback cron job
// Usage: npx tsx scripts/test-7d-feedback.ts [--send]
// Without --send, it runs in dry-run mode (shows what would happen)

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const DRY_RUN = !process.argv.includes('--send');

async function testFeedbackCron() {
    console.log('🧪 Testing 7-Day Feedback Cron');
    console.log(`   Mode: ${DRY_RUN ? '🔒 DRY RUN (use --send to actually send)' : '🚀 LIVE - WILL SEND MESSAGES'}`);
    console.log('');

    // Check required env vars
    const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_KEY', 
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_WHATSAPP_NUMBER'
    ];
    
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        console.error('❌ Missing environment variables:', missingVars.join(', '));
        process.exit(1);
    }
    console.log('✅ Environment variables OK\n');

    // Calculate date range
    const today = new Date();
    const sevenDaysAgoStart = new Date(today);
    sevenDaysAgoStart.setDate(today.getDate() - 7);
    sevenDaysAgoStart.setHours(0, 0, 0, 0);

    const sevenDaysAgoEnd = new Date(today);
    sevenDaysAgoEnd.setDate(today.getDate() - 7);
    sevenDaysAgoEnd.setHours(23, 59, 59, 999);

    console.log('📅 Looking for services from 7 days ago:');
    console.log(`   Start: ${sevenDaysAgoStart.toISOString()}`);
    console.log(`   End:   ${sevenDaysAgoEnd.toISOString()}`);
    console.log('');

    // Query service records
    const { data: services, error } = await supabase
        .from('service_records')
        .select(`
            id, 
            service_date,
            customer_id,
            business_id,
            feedback_request_sent_at,
            customers!service_records_customer_id_fkey(id, first_name, phone, last_name), 
            businesses!service_records_business_id_fkey(id, name, phone_number, whatsapp_template_feedback)
        `)
        .gte('service_date', sevenDaysAgoStart.toISOString())
        .lte('service_date', sevenDaysAgoEnd.toISOString())
        .is('feedback_request_sent_at', null);

    if (error) {
        console.error('❌ Query error:', error);
        process.exit(1);
    }

    console.log(`📋 Found ${services?.length || 0} service records needing feedback\n`);

    if (!services || services.length === 0) {
        console.log('ℹ️  No services from exactly 7 days ago that need feedback.');
        console.log('');
        
        // Show recent service records for context
        const { data: recentServices } = await supabase
            .from('service_records')
            .select('id, service_date, feedback_request_sent_at, customers(first_name)')
            .order('service_date', { ascending: false })
            .limit(5);
        
        if (recentServices && recentServices.length > 0) {
            console.log('📊 Most recent service records:');
            recentServices.forEach((s: any) => {
                const daysAgo = Math.floor((Date.now() - new Date(s.service_date).getTime()) / (1000 * 60 * 60 * 24));
                const customerName = (s.customers as any)?.first_name || 'Unknown';
                console.log(`   • ${s.service_date?.split('T')[0]} (${daysAgo} days ago) - ${customerName} | Feedback: ${s.feedback_request_sent_at ? '✅ Sent' : '❌ Pending'}`);
            });
        }
        
        console.log('\n💡 TIP: To test, create a service record with service_date = 7 days ago');
        return;
    }

    // Process each service
    const results = [];
    
    for (const record of services) {
        const customer = record.customers as unknown as { id: string; first_name: string | null; phone: string | null; last_name: string | null };
        const business = record.businesses as unknown as { id: string; name: string; phone_number: string | null; whatsapp_template_feedback: string | null };
        
        if (!customer?.phone) {
            console.log(`⚠️  Skipping service ${record.id} - no customer phone`);
            continue;
        }

        const customerName = customer.first_name || 'Valued Customer';
        const businessName = business.name;
        const templateSid = business.whatsapp_template_feedback || process.env.TWILIO_TEMPLATE_FEEDBACK_7D;

        console.log(`\n📞 Customer: ${customerName} (${customer.phone})`);
        console.log(`   Business: ${businessName}`);
        console.log(`   Service Date: ${record.service_date}`);
        console.log(`   Template SID: ${templateSid || '❌ NOT CONFIGURED'}`);

        if (!templateSid) {
            console.log('   ⚠️  SKIPPING - No template configured');
            results.push({ customer: customerName, status: 'skipped', reason: 'No template' });
            continue;
        }

        if (DRY_RUN) {
            console.log('   🔒 DRY RUN - Would send feedback request');
            results.push({ customer: customerName, status: 'dry_run' });
            continue;
        }

        // Actually send the message
        try {
            const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
            const formattedFrom = fromNumber?.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

            console.log(`   📤 Sending template message...`);
            
            const message = await twilioClient.messages.create({
                from: formattedFrom,
                to: `whatsapp:${customer.phone}`,
                contentSid: templateSid,
                contentVariables: JSON.stringify({
                    1: customerName,
                    2: businessName
                })
            });

            console.log(`   ✅ Sent! Message SID: ${message.sid}`);

            // Mark as sent
            await supabase
                .from('service_records')
                .update({ feedback_request_sent_at: new Date().toISOString() })
                .eq('id', record.id);

            // Update customer context
            await supabase
                .from('customers')
                .update({ last_interaction_context: 'FEEDBACK_7D' })
                .eq('id', customer.id);

            console.log(`   ✅ Database updated`);
            results.push({ customer: customerName, status: 'sent', messageSid: message.sid });

        } catch (e: any) {
            console.error(`   ❌ Failed:`, e.message);
            results.push({ customer: customerName, status: 'failed', error: e.message });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Total processed: ${results.length}`);
    console.log(`   Sent: ${results.filter(r => r.status === 'sent').length}`);
    console.log(`   Dry run: ${results.filter(r => r.status === 'dry_run').length}`);
    console.log(`   Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);
    
    if (DRY_RUN && results.length > 0) {
        console.log('\n💡 Run with --send to actually send the messages:');
        console.log('   npx tsx scripts/test-7d-feedback.ts --send');
    }
}

testFeedbackCron().catch(console.error);
