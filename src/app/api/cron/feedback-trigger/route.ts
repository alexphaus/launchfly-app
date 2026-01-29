/**
 * 7-Day Feedback Trigger Cron Job
 * 
 * THE REPUTATION ENGINE
 * 
 * Runs daily at 10 AM to:
 * 1. Find services completed exactly 7 days ago
 * 2. Send WhatsApp template asking "How is the AC cooling?"
 * 3. Mark customer context so AI knows they're responding to feedback request
 * 
 * WHY 7 DAYS?
 * - Long enough for customer to use the AC in various conditions
 * - Short enough that they remember the service
 * - Perfect timing to ask: was the work good?
 * 
 * OUTCOMES:
 * - Positive → Ask for Google Review + Referral (revenue multiplier)
 * - Negative → Route to warranty/support (quality control)
 * 
 * COST: ₱0.17 per WhatsApp Utility Template (super cheap!)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const LAUNCHFLY_BOT_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+13203627874';
const DAYS_AFTER_SERVICE = 7;
const BATCH_SIZE = 50;

interface FeedbackResult {
    customer: string;
    phone: string;
    status: 'sent' | 'failed' | 'skipped';
    error?: string;
    channel?: 'whatsapp' | 'sms';
}

interface CronResult {
    success: boolean;
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
    details: FeedbackResult[];
    duration: number;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    
    // Security: Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('⚠️ Unauthorized feedback-trigger attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📣 Starting 7-Day Feedback Trigger Cron');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`   Looking for services completed ${DAYS_AFTER_SERVICE} days ago`);

    const result: CronResult = {
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        details: [],
        duration: 0,
    };

    try {
        // 1. Find services completed 7 days ago that haven't received feedback request
        // Using date range to handle timezone edge cases
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - DAYS_AFTER_SERVICE);
        const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Query for services on that date - simple query first
        const { data: services, error: fetchError } = await supabase
            .from('service_records')
            .select('id, service_date, service_name, appliance_type, currency, customer_id, business_id')
            .gte('service_date', `${targetDateStr}T00:00:00Z`)
            .lt('service_date', `${targetDateStr}T23:59:59Z`)
            .is('feedback_request_sent_at', null)
            .limit(BATCH_SIZE);

        if (fetchError) {
            console.error('❌ Error fetching services:', fetchError);
            throw fetchError;
        }

        if (!services || services.length === 0) {
            console.log(`✅ No services from ${targetDateStr} need feedback requests`);
            return NextResponse.json({
                success: true,
                message: `No services from ${targetDateStr} need feedback requests`,
                processed: 0,
                targetDate: targetDateStr,
            });
        }

        console.log(`📋 Found ${services.length} services from ${targetDateStr} for feedback`);

        // 2. Process each service
        for (const service of services) {
            result.processed++;
            
            // Fetch customer and business separately to avoid join complexity
            const [customerResult, businessResult] = await Promise.all([
                supabase
                    .from('customers')
                    .select('id, name, first_name, phone, blast_optout, last_outbound_at')
                    .eq('id', service.customer_id)
                    .single(),
                supabase
                    .from('businesses')
                    .select('id, name, business_data')
                    .eq('id', service.business_id)
                    .single(),
            ]);
            
            const customer = customerResult.data;
            const business = businessResult.data;
            
            if (!customer || !business) {
                console.log(`⏭️ Skipping service ${service.id}: missing customer or business`);
                result.skipped++;
                result.details.push({
                    customer: 'Unknown',
                    phone: 'Unknown',
                    status: 'skipped',
                    error: 'Missing customer or business data',
                });
                continue;
            }

            // Skip if no phone
            if (!customer.phone) {
                console.log(`⏭️ Skipping ${customer.name || customer.first_name}: no phone`);
                result.skipped++;
                result.details.push({
                    customer: customer.name || customer.first_name || 'Unknown',
                    phone: 'None',
                    status: 'skipped',
                    error: 'No phone number',
                });
                continue;
            }

            // Skip if opted out
            if (customer.blast_optout) {
                console.log(`⏭️ Skipping ${customer.name || customer.first_name}: opted out`);
                result.skipped++;
                result.details.push({
                    customer: customer.name || customer.first_name || 'Unknown',
                    phone: customer.phone,
                    status: 'skipped',
                    error: 'Customer opted out',
                });
                continue;
            }

            // Rate limit: Don't message if we sent something in last 24h
            if (customer.last_outbound_at) {
                const lastOutbound = new Date(customer.last_outbound_at);
                const hoursSinceLastOutbound = (Date.now() - lastOutbound.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastOutbound < 24) {
                    console.log(`⏭️ Skipping ${customer.name || customer.first_name}: messaged ${hoursSinceLastOutbound.toFixed(1)}h ago`);
                    result.skipped++;
                    result.details.push({
                        customer: customer.name || customer.first_name || 'Unknown',
                        phone: customer.phone,
                        status: 'skipped',
                        error: `Messaged ${hoursSinceLastOutbound.toFixed(1)}h ago (rate limit)`,
                    });
                    continue;
                }
            }

            const customerName = customer.first_name || customer.name?.split(' ')[0] || 'there';
            const businessName = business.name;
            const customerPhone = customer.phone.startsWith('+') ? customer.phone : `+${customer.phone}`;

            try {
                // 3. Send the 7-Day Feedback Template
                // Template: "Hi {{1}}, it's {{2}}! It's been a week since our service. Is your unit still cooling well? ❄️ Reply: 1) Great ✅ 2) Not good ❌"
                const FEEDBACK_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_FEEDBACK_7D;
                
                if (FEEDBACK_TEMPLATE_SID) {
                    // Use approved WhatsApp Utility Template (₱0.17)
                    await twilioClient.messages.create({
                        from: LAUNCHFLY_BOT_NUMBER.startsWith('whatsapp:') ? LAUNCHFLY_BOT_NUMBER : `whatsapp:${LAUNCHFLY_BOT_NUMBER}`,
                        to: `whatsapp:${customerPhone}`,
                        contentSid: FEEDBACK_TEMPLATE_SID,
                        contentVariables: JSON.stringify({
                            '1': customerName,
                            '2': businessName,
                        }),
                    });
                    console.log(`   ✅ Sent template to ${customerName} (${customerPhone})`);
                } else {
                    // Fallback: Send plain message (only works within 24h window)
                    // This should rarely happen - we should always have the template configured
                    const message = `Hi ${customerName}, it's ${businessName}! 👋\n\nIt's been a week since our service. Is your unit still cooling well? ❄️\n\nReply:\n1️⃣ Great ✅\n2️⃣ Not good ❌`;
                    
                    await twilioClient.messages.create({
                        from: LAUNCHFLY_BOT_NUMBER.startsWith('whatsapp:') ? LAUNCHFLY_BOT_NUMBER : `whatsapp:${LAUNCHFLY_BOT_NUMBER}`,
                        to: `whatsapp:${customerPhone}`,
                        body: message,
                    });
                    console.log(`   ⚠️ Sent plain message (no template) to ${customerName}`);
                }

                // 4. Update service_record as sent
                await supabase
                    .from('service_records')
                    .update({
                        feedback_request_sent_at: new Date().toISOString(),
                        feedback_status: 'pending',
                    })
                    .eq('id', service.id);

                // 5. Update customer context for AI to recognize feedback responses
                await supabase
                    .from('customers')
                    .update({
                        last_outbound_type: 'FEEDBACK_7D',
                        last_outbound_at: new Date().toISOString(),
                        last_service_record_id: service.id,
                        status: 'feedback_requested', // So V2 knows context
                    })
                    .eq('id', customer.id);

                result.sent++;
                result.details.push({
                    customer: customerName,
                    phone: customerPhone,
                    status: 'sent',
                    channel: FEEDBACK_TEMPLATE_SID ? 'whatsapp' : 'whatsapp',
                });

            } catch (sendError: any) {
                console.error(`❌ Failed to send to ${customerPhone}:`, sendError.message);
                result.failed++;
                result.details.push({
                    customer: customerName,
                    phone: customerPhone,
                    status: 'failed',
                    error: sendError.message,
                });
            }
        }

        result.duration = Date.now() - startTime;
        console.log(`\n📊 Feedback Trigger Results:`);
        console.log(`   Processed: ${result.processed}`);
        console.log(`   Sent: ${result.sent}`);
        console.log(`   Failed: ${result.failed}`);
        console.log(`   Skipped: ${result.skipped}`);
        console.log(`   Duration: ${result.duration}ms`);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('❌ Feedback trigger cron failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
            },
            { status: 500 }
        );
    }
}

/**
 * POST handler for manual triggers (e.g., from dashboard)
 * Allows specifying a specific date to backfill feedback requests
 */
export async function POST(request: NextRequest) {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { daysAgo, businessId } = body;

        // Validate
        if (daysAgo !== undefined && (daysAgo < 1 || daysAgo > 30)) {
            return NextResponse.json({ error: 'daysAgo must be between 1 and 30' }, { status: 400 });
        }

        // For POST, we'll just redirect to GET with query params
        // The actual logic is the same
        console.log(`📣 Manual feedback trigger: daysAgo=${daysAgo || 7}, businessId=${businessId || 'all'}`);
        
        // In a real implementation, you'd add these as query params or handle here
        return NextResponse.json({
            message: 'Manual trigger received. Use GET endpoint with CRON_SECRET for actual execution.',
            daysAgo: daysAgo || 7,
            businessId: businessId || 'all',
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
