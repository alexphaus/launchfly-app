/**
 * Monthly Value Report Cron Job
 * 
 * THE CHURN KILLER
 * 
 * Runs on the 1st of every month at 9 AM to:
 * 1. Calculate each business's monthly stats
 * 2. Send a "Monthly Performance Report" to each owner
 * 3. Show estimated revenue saved to reinforce value
 * 
 * WHY THIS WORKS:
 * - Shows tangible value ("Estimated Revenue Saved: ₱4,500")
 * - Creates fear of loss ("If I cancel, I lose that")
 * - Reminds them the system is working even when they don't see it
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize clients
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER || '+13203627874';

interface MonthlyStats {
    businessId: string;
    businessName: string;
    ownerPhone: string;
    currency: string;
    customersCapured: number;
    warrantiesActivated: number;
    remindersSent: number;
    reviewsSecured: number;
    bookingsCreated: number;
    estimatedRevenue: number;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('⚠️ Unauthorized cron attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Starting Monthly Value Report Cron Job');
    console.log(`   Time: ${new Date().toISOString()}`);

    const results = {
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        errors: [] as string[],
    };

    try {
        // Get the previous month's date range
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long' });
        
        console.log(`📅 Reporting period: ${lastMonth.toISOString().split('T')[0]} to ${lastMonthEnd.toISOString().split('T')[0]}`);

        // Get all active businesses with owner phone numbers
        const { data: businesses, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, whatsapp_number, phone_number, business_data')
            .not('whatsapp_number', 'is', null);

        if (bizError) {
            throw new Error(`Failed to fetch businesses: ${bizError.message}`);
        }

        if (!businesses || businesses.length === 0) {
            console.log('⚠️ No businesses found with WhatsApp numbers');
            return NextResponse.json({ success: true, message: 'No businesses to report', sent: 0 });
        }

        console.log(`📋 Found ${businesses.length} businesses to report`);

        // Process each business
        for (const business of businesses) {
            results.processed++;
            
            try {
                const ownerPhone = business.whatsapp_number || business.phone_number;
                if (!ownerPhone) {
                    console.log(`⏭️ Skipping ${business.name}: No phone number`);
                    continue;
                }

                const config = business.business_data || {};
                const currency = config.currency || 'RM';
                const cleaningPrice = config.cleaningPrice || 120;

                // Query stats for this business
                const stats = await getMonthlyStats(business.id, lastMonth, lastMonthEnd, cleaningPrice);

                // Skip if no activity
                if (stats.customersCapured === 0 && stats.warrantiesActivated === 0 && 
                    stats.remindersSent === 0 && stats.bookingsCreated === 0) {
                    console.log(`⏭️ Skipping ${business.name}: No activity this month`);
                    continue;
                }

                // Build the message
                const message = buildMonthlyReport(business.name, monthName, stats, currency);

                // Send via WhatsApp
                const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
                const formattedFrom = TWILIO_FROM.startsWith('whatsapp:') ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`;

                await twilioClient.messages.create({
                    from: formattedFrom,
                    to: `whatsapp:${cleanPhone}`,
                    body: message,
                });

                console.log(`✅ Sent report to ${business.name} (${cleanPhone})`);
                results.sent++;

                // Log to ai_activities
                await supabase.from('ai_activities').insert({
                    business_id: business.id,
                    type: 'monthly_report',
                    icon: '📊',
                    title: `Monthly Report Sent - ${monthName}`,
                    description: `Customers: ${stats.customersCapured}, Warranties: ${stats.warrantiesActivated}, Reviews: ${stats.reviewsSecured}, Est. Revenue: ${currency} ${stats.estimatedRevenue}`,
                    metadata: stats,
                });

            } catch (err: any) {
                console.error(`❌ Failed to send report to ${business.name}:`, err.message);
                results.failed++;
                results.errors.push(`${business.name}: ${err.message}`);
            }
        }

        console.log(`\n📊 Monthly Report Summary:`);
        console.log(`   Processed: ${results.processed}`);
        console.log(`   Sent: ${results.sent}`);
        console.log(`   Failed: ${results.failed}`);
        console.log(`   Duration: ${Date.now() - startTime}ms`);

        return NextResponse.json({
            success: true,
            ...results,
            duration: Date.now() - startTime,
        });

    } catch (error: any) {
        console.error('❌ Monthly report cron failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}

async function getMonthlyStats(
    businessId: string, 
    startDate: Date, 
    endDate: Date,
    cleaningPrice: number
): Promise<MonthlyStats> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    // Run all queries in parallel
    const [
        customersResult,
        serviceRecordsResult,
        remindersResult,
        feedbackResult,
        bookingsResult,
    ] = await Promise.all([
        // New customers this month
        supabase
            .from('customers')
            .select('id', { count: 'exact' })
            .eq('business_id', businessId)
            .gte('created_at', start)
            .lte('created_at', end),
        
        // Warranties activated (service records created)
        supabase
            .from('service_records')
            .select('id', { count: 'exact' })
            .eq('business_id', businessId)
            .gte('created_at', start)
            .lte('created_at', end),
        
        // Reminders sent
        supabase
            .from('service_reminders')
            .select('id', { count: 'exact' })
            .eq('business_id', businessId)
            .eq('status', 'sent')
            .gte('sent_at', start)
            .lte('sent_at', end),
        
        // Positive feedback (reviews secured)
        supabase
            .from('customer_feedback')
            .select('id', { count: 'exact' })
            .eq('business_id', businessId)
            .lte('rating', 2) // 1 = Excellent, 2 = Good
            .gte('created_at', start)
            .lte('created_at', end),
        
        // Bookings created
        supabase
            .from('bookings')
            .select('id', { count: 'exact' })
            .eq('business_id', businessId)
            .gte('created_at', start)
            .lte('created_at', end),
    ]);

    const customersCapured = customersResult.count || 0;
    const warrantiesActivated = serviceRecordsResult.count || 0;
    const remindersSent = remindersResult.count || 0;
    const reviewsSecured = feedbackResult.count || 0;
    const bookingsCreated = bookingsResult.count || 0;

    // Calculate estimated revenue:
    // - Each warranty activation = potential repeat customer = ~1.5x cleaning price
    // - Each reminder sent that converts (assume 30%) = cleaning price
    // - Each booking = cleaning price
    // - Each review = word of mouth value (~0.5x cleaning price)
    const estimatedRevenue = Math.round(
        (warrantiesActivated * cleaningPrice * 1.5) +
        (remindersSent * 0.3 * cleaningPrice) +
        (bookingsCreated * cleaningPrice) +
        (reviewsSecured * cleaningPrice * 0.5)
    );

    return {
        businessId,
        businessName: '',
        ownerPhone: '',
        currency: '',
        customersCapured,
        warrantiesActivated,
        remindersSent,
        reviewsSecured,
        bookingsCreated,
        estimatedRevenue,
    };
}

function buildMonthlyReport(
    businessName: string,
    monthName: string,
    stats: MonthlyStats,
    currency: string
): string {
    const lines = [
        `📊 *Monthly Performance Report (${monthName})*`,
        ``,
        `Boss, here's what your 'Digital Receptionist' did for you this month:`,
        ``,
    ];

    // Only show stats that have values
    if (stats.customersCapured > 0) {
        lines.push(`✅ Customers Captured: *${stats.customersCapured}*`);
    }
    if (stats.warrantiesActivated > 0) {
        lines.push(`✅ Warranties Activated: *${stats.warrantiesActivated}*`);
    }
    if (stats.remindersSent > 0) {
        lines.push(`✅ Auto-Reminders Sent: *${stats.remindersSent}*`);
    }
    if (stats.bookingsCreated > 0) {
        lines.push(`✅ Bookings Created: *${stats.bookingsCreated}*`);
    }
    if (stats.reviewsSecured > 0) {
        lines.push(`⭐ 5-Star Reviews Secured: *${stats.reviewsSecured}*`);
    }

    lines.push(``);
    lines.push(`💰 *Estimated Revenue Generated: ${currency} ${stats.estimatedRevenue.toLocaleString()}*`);
    lines.push(``);
    lines.push(`System Status: *ACTIVE & RUNNING* 🟢`);
    lines.push(`No action needed. Just keep sticking! 🫡`);

    return lines.join('\n');
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
    return GET(request);
}
