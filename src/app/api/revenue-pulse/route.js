// src/app/api/revenue-pulse/route.js
// "Revenue Pulse" — Money Left on the Table Detector
// Analyzes business data to find revenue leaks and generate daily money moves

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
        return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];

        // --- Parallel data fetching for all leak sources ---
        const [
            { data: business },
            { data: unansweredLeads },
            { data: overdueFollowups },
            { data: expiredWarranties },
            { data: serviceDueCustomers },
            { data: recentBookings },
            { data: allCustomers },
            { data: completedBookingsThisMonth },
        ] = await Promise.all([
            // Business data
            supabase.from('businesses').select('*').eq('id', businessId).single(),

            // LEAK 1: Unanswered leads (new leads > 2 hours old, not booked/archived)
            supabase
                .from('customers')
                .select('id, name, phone, notes, created_at, status')
                .eq('business_id', businessId)
                .in('status', ['new', 'pending', null])
                .order('created_at', { ascending: false })
                .limit(50),

            // LEAK 2: Overdue follow-ups (leads 24h+ old, status not booked/archived/completed)
            supabase
                .from('customers')
                .select('id, name, phone, notes, created_at, status, email_sequence_day')
                .eq('business_id', businessId)
                .not('status', 'in', '("booked","confirmed","completed","archived","warranty_activated")')
                .order('created_at', { ascending: false })
                .limit(100),

            // LEAK 3: Expired warranties (warranty ended but customer not re-engaged)
            supabase
                .from('service_records')
                .select('id, customer_id, service_type, warranty_expires_at, next_service_due_at, customers!inner(id, name, phone, status)')
                .eq('business_id', businessId)
                .lt('warranty_expires_at', now.toISOString())
                .order('warranty_expires_at', { ascending: true })
                .limit(30),

            // LEAK 4: Customers due for service (6-month cycle overdue)
            supabase
                .from('customers')
                .select('id, name, phone, last_service_date, next_reminder_due, status')
                .eq('business_id', businessId)
                .not('next_reminder_due', 'is', null)
                .lt('next_reminder_due', now.toISOString())
                .limit(30),

            // Context: Recent bookings for conversion rate
            supabase
                .from('bookings')
                .select('id, status, estimate, created_at')
                .eq('business_id', businessId)
                .gte('created_at', new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),

            // Context: All active customers count
            supabase
                .from('customers')
                .select('id, created_at, status')
                .eq('business_id', businessId)
                .gte('created_at', new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()),

            // Context: Completed bookings this month for revenue
            supabase
                .from('bookings')
                .select('id, estimate, status')
                .eq('business_id', businessId)
                .eq('status', 'completed')
                .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
        ]);

        const currency = business?.business_data?.currency || '₱';
        const niche = business?.business_data?.niche || 'Service';

        // --- CALCULATE LEAKS ---

        // Average job value (from bookings with estimates)
        const allEstimates = (recentBookings || [])
            .map(b => {
                const match = b.estimate?.match(/(\d[\d,]*)/);
                return match ? parseInt(match[1].replace(/,/g, '')) : null;
            })
            .filter(Boolean);
        const avgJobValue = allEstimates.length > 0
            ? Math.round(allEstimates.reduce((a, b) => a + b, 0) / allEstimates.length)
            : 2500; // Default estimate for service businesses

        // LEAK 1: Unanswered Leads (> 2 hours old, no response)
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
        const coldLeads = (unansweredLeads || []).filter(l => {
            return new Date(l.created_at) < twoHoursAgo;
        });
        const coldLeadRevenue = coldLeads.length * avgJobValue;

        // LEAK 2: Follow-up Needed (24h+ no action, not in funnel)
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const overdueLeads = (overdueFollowups || []).filter(l => {
            return new Date(l.created_at) < oneDayAgo;
        });
        const overdueRevenue = overdueLeads.length * avgJobValue;

        // LEAK 3: Expired Warranties (opportunity to sell maintenance plan)
        const expiredCount = (expiredWarranties || []).length;
        const warrantyUpsellValue = Math.round(avgJobValue * 0.6); // Maintenance is ~60% of full service
        const warrantyRevenue = expiredCount * warrantyUpsellValue;

        // LEAK 4: Service Due (6-month reminder overdue)
        const serviceDueCount = (serviceDueCustomers || []).length;
        const serviceDueRevenue = serviceDueCount * avgJobValue;

        // Total money on table
        const totalLeakage = coldLeadRevenue + overdueRevenue + warrantyRevenue + serviceDueRevenue;

        // --- BUILD LEAK ITEMS (for one-tap actions) ---
        const leaks = [];

        // Cold leads (highest priority - freshest money)
        coldLeads.slice(0, 5).forEach(lead => {
            const hoursAgo = Math.round((now - new Date(lead.created_at)) / (1000 * 60 * 60));
            const estimateMatch = lead.notes?.match(/Estimate:\s*([^\n]+)/);
            const estimate = estimateMatch ? estimateMatch[1].trim() : `~${currency}${avgJobValue}`;

            leaks.push({
                id: lead.id,
                type: 'cold_lead',
                priority: 'high',
                icon: '🔥',
                title: `${lead.name || 'New Lead'} — no reply`,
                subtitle: `Sent quote ${hoursAgo}h ago • ${estimate}`,
                value: avgJobValue,
                action: 'whatsapp',
                actionLabel: 'Follow Up',
                phone: lead.phone,
                name: lead.name,
                message: `Hi ${lead.name || 'there'}! Just checking in on your ${niche.toLowerCase()} quote. Still interested? I have a slot available this week! 😊`,
            });
        });

        // Overdue follow-ups (medium priority)
        overdueLeads
            .filter(l => !coldLeads.find(c => c.id === l.id)) // Avoid duplicates with cold leads
            .slice(0, 3)
            .forEach(lead => {
                const daysAgo = Math.round((now - new Date(lead.created_at)) / (1000 * 60 * 60 * 24));
                leaks.push({
                    id: lead.id,
                    type: 'overdue_followup',
                    priority: 'medium',
                    icon: '⏰',
                    title: `${lead.name || 'Lead'} — ${daysAgo}d no follow-up`,
                    subtitle: `Last contact ${daysAgo} days ago`,
                    value: avgJobValue,
                    action: 'whatsapp',
                    actionLabel: 'Re-engage',
                    phone: lead.phone,
                    name: lead.name,
                    message: `Hi ${lead.name || 'there'}! It's ${business?.name || 'us'} — still need help with your ${niche.toLowerCase()}? We have special rates this week! 🔧`,
                });
            });

        // Service due customers (steady revenue)
        (serviceDueCustomers || []).slice(0, 3).forEach(cust => {
            const monthsSince = cust.last_service_date
                ? Math.round((now - new Date(cust.last_service_date)) / (1000 * 60 * 60 * 24 * 30))
                : 6;
            leaks.push({
                id: cust.id,
                type: 'service_due',
                priority: 'medium',
                icon: '🔧',
                title: `${cust.name || 'Customer'} — ${monthsSince}mo since last service`,
                subtitle: `Due for maintenance • ${currency}${avgJobValue}`,
                value: avgJobValue,
                action: 'whatsapp',
                actionLabel: 'Send Reminder',
                phone: cust.phone,
                name: cust.name,
                message: `Hi ${cust.name || 'there'}! It's been ${monthsSince} months since your last ${niche.toLowerCase()} service. Time for a checkup to keep everything running smooth! 🛡️ Want me to schedule you in?`,
            });
        });

        // Expired warranties (upsell opportunity)
        (expiredWarranties || []).slice(0, 3).forEach(record => {
            const customer = record.customers;
            const daysSinceExpiry = Math.round((now - new Date(record.warranty_expires_at)) / (1000 * 60 * 60 * 24));
            leaks.push({
                id: record.id,
                type: 'expired_warranty',
                priority: 'low',
                icon: '🛡️',
                title: `${customer?.name || 'Customer'} — warranty expired`,
                subtitle: `Expired ${daysSinceExpiry}d ago • Upsell maintenance`,
                value: warrantyUpsellValue,
                action: 'whatsapp',
                actionLabel: 'Offer Service',
                phone: customer?.phone,
                name: customer?.name,
                message: `Hi ${customer?.name || 'there'}! Your 30-day warranty just ended. Want to extend your protection with a maintenance plan? I can offer a special rate since you're an existing customer! 💪`,
            });
        });

        // --- TODAY'S MONEY MOVES (AI-prioritized top 3 actions) ---
        const moneyMoves = [];

        // Move 1: Always prioritize unanswered leads (hottest money)
        if (coldLeads.length > 0) {
            moneyMoves.push({
                id: 'move_1',
                icon: '🔥',
                action: `Reply to ${coldLeads.length} unanswered lead${coldLeads.length > 1 ? 's' : ''}`,
                impact: `${currency}${(coldLeads.length * avgJobValue).toLocaleString()} potential`,
                urgency: 'NOW',
                urgencyColor: 'red',
            });
        }

        // Move 2: Service reminders for due customers
        if (serviceDueCount > 0) {
            moneyMoves.push({
                id: 'move_2',
                icon: '🔧',
                action: `Send reminder to ${serviceDueCount} customer${serviceDueCount > 1 ? 's' : ''} due for service`,
                impact: `${currency}${(serviceDueCount * avgJobValue).toLocaleString()} repeat revenue`,
                urgency: 'TODAY',
                urgencyColor: 'orange',
            });
        }

        // Move 3: Re-engage stale leads
        if (overdueLeads.length > 3) {
            moneyMoves.push({
                id: 'move_3',
                icon: '📣',
                action: `Blast ${overdueLeads.length} old leads with a promo`,
                impact: `Even 1 conversion = ${currency}${avgJobValue.toLocaleString()}`,
                urgency: 'THIS WEEK',
                urgencyColor: 'blue',
            });
        }

        // Move 4: Warranty upsells
        if (expiredCount > 0 && moneyMoves.length < 3) {
            moneyMoves.push({
                id: 'move_4',
                icon: '🛡️',
                action: `Offer maintenance to ${expiredCount} expired warranty customer${expiredCount > 1 ? 's' : ''}`,
                impact: `${currency}${(expiredCount * warrantyUpsellValue).toLocaleString()} upsell`,
                urgency: 'THIS WEEK',
                urgencyColor: 'blue',
            });
        }

        // If no moves at all, give a proactive one
        if (moneyMoves.length === 0) {
            moneyMoves.push({
                id: 'move_default',
                icon: '🎯',
                action: 'Share your quote page link to get new leads',
                impact: 'Every share = potential new customer',
                urgency: 'DAILY',
                urgencyColor: 'green',
            });
        }

        // --- HEALTH SCORE (0-100) ---
        const totalLeads90d = (allCustomers || []).length;
        const bookedCount = (allCustomers || []).filter(c => ['booked', 'confirmed', 'completed'].includes(c.status)).length;
        const conversionRate = totalLeads90d > 0 ? (bookedCount / totalLeads90d) : 0;
        const responseRate = totalLeads90d > 0 ? Math.max(0, 1 - (coldLeads.length / Math.max(totalLeads90d, 1))) : 1;
        const retentionRate = serviceDueCount > 0 ? 0.5 : 1; // Penalize if customers overdue

        const healthScore = Math.round(
            (conversionRate * 40) + // 40% weight on converting leads
            (responseRate * 35) +   // 35% weight on responding quickly
            (retentionRate * 25)    // 25% weight on customer retention
        );

        // --- TREND (compare to rough baseline) ---
        const completedThisMonth = (completedBookingsThisMonth || []).length;
        const estimatedMonthlyRevenue = completedThisMonth * avgJobValue;

        return NextResponse.json({
            success: true,
            pulse: {
                totalLeakage,
                currency,
                avgJobValue,
                healthScore: Math.min(100, Math.max(0, healthScore)),
                estimatedMonthlyRevenue,
                leakSummary: {
                    coldLeads: { count: coldLeads.length, revenue: coldLeadRevenue },
                    overdueFollowups: { count: overdueLeads.length, revenue: overdueRevenue },
                    expiredWarranties: { count: expiredCount, revenue: warrantyRevenue },
                    serviceDue: { count: serviceDueCount, revenue: serviceDueRevenue },
                },
                leaks: leaks.slice(0, 8), // Top 8 actionable leaks
                moneyMoves: moneyMoves.slice(0, 3), // Top 3 daily actions
            },
        });
    } catch (err) {
        console.error('Revenue Pulse error:', err);
        return NextResponse.json({ error: 'Failed to calculate revenue pulse' }, { status: 500 });
    }
}
