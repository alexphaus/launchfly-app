// src/app/api/whatsapp/blast/route.ts
// Enhanced WhatsApp Blast API with Smart Segments + Template Support
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

// Template SIDs for outside 24-hour window
const PROMO_TEMPLATE_SID = process.env.TWILIO_TEMPLATE_PROMO || '';

let client: any = null;
if (accountSid && authToken) {
    const twilio = require('twilio');
    client = twilio(accountSid, authToken);
}

// Segment types
export type BlastSegment = 
    | 'all_old_leads'      // Original: leads not booked, older than 3 days
    | 'cold_leads'          // Never responded
    | 'quoted_not_booked'   // Got quote but didn't book (highest conversion!)
    | 'past_customers'      // Have service history
    | 'service_due_soon'    // Service due within 30 days (Forever Customer Engine)
    | 'imported'            // Database Reactivation: imported external contacts
    | 'custom';             // Custom selection

// Message templates
export const MESSAGE_TEMPLATES: Record<string, {
    name: string;
    icon: string;
    template: (niche: string, businessName: string, customerName?: string, dueInfo?: string) => string;
}> = {
    promo_10off: {
        name: '10% Off Promo',
        icon: '🔥',
        template: (niche: string, businessName: string) => 
            `🔥 ${niche} Promo! 10% OFF this week only. Reply "BOOK" to claim your slot! - ${businessName}`
    },
    miss_you: {
        name: 'We Miss You',
        icon: '👋',
        template: (niche: string, businessName: string, customerName?: string) => 
            `Hi${customerName ? ` ${customerName}` : ''}! 👋 It's been a while since your last ${niche.toLowerCase()} service. Ready to book again? Reply "YES" - ${businessName}`
    },
    service_reminder: {
        name: 'Service Reminder',
        icon: '🔧',
        template: (niche: string, businessName: string, customerName?: string, dueInfo?: string) => 
            `Hi${customerName ? ` ${customerName}` : ''}! 🔧 Your ${niche.toLowerCase()} is ${dueInfo || 'due for service'}. Book now to keep it running smoothly! Reply "BOOK" - ${businessName}`
    },
    seasonal: {
        name: 'Seasonal Special',
        icon: '🎉',
        template: (niche: string, businessName: string) => 
            `🎉 SPECIAL OFFER! Get your ${niche.toLowerCase()} serviced before the rush. Limited slots this month! Reply "BOOK" - ${businessName}`
    },
    follow_up: {
        name: 'Quote Follow-up',
        icon: '💬',
        template: (niche: string, businessName: string, customerName?: string) => 
            `Hi${customerName ? ` ${customerName}` : ''}! 💬 Still need that ${niche.toLowerCase()} service? I can hold a slot for you today. Reply "YES" to confirm! - ${businessName}`
    }
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            businessId, 
            message,          // Custom message (overrides template)
            templateId,       // Template key from MESSAGE_TEMPLATES
            segment = 'all_old_leads',  // Target segment
            dryRun = false    // Preview mode - don't actually send
        } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-ignore
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // 1. Get business details
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, business_data, blast_credits, blast_credits_used')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const businessName = business.business_data?.businessName || business.name || 'Your Local Service';
        const niche = business.business_data?.niche || 'Service';

        // 2. Get leads based on segment
        let leads: any[] = [];
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        switch (segment) {
            case 'cold_leads':
                // Leads who never responded (status still 'new' or 'sticker_menu')
                const { data: coldLeads } = await supabase
                    .from('customers')
                    .select('id, phone, name, first_name, status, notes, blast_optout')
                    .eq('business_id', businessId)
                    .in('status', ['new', 'sticker_menu', 'menu'])
                    .lt('created_at', threeDaysAgo.toISOString())
                    .not('phone', 'is', null)
                    .neq('blast_optout', true);
                leads = coldLeads || [];
                break;

            case 'quoted_not_booked':
                // Leads who got a quote but didn't book (HIGHEST CONVERSION!)
                const { data: quotedLeads } = await supabase
                    .from('customers')
                    .select('id, phone, name, first_name, status, notes, blast_optout')
                    .eq('business_id', businessId)
                    .in('status', ['quoted', 'pricing_shown', 'pending_booking', 'awaiting_confirmation'])
                    .not('phone', 'is', null)
                    .neq('blast_optout', true);
                leads = quotedLeads || [];
                break;

            case 'past_customers':
                // Customers with service history (cross-sell/loyalty)
                const { data: serviceRecords } = await supabase
                    .from('service_records')
                    .select('customer_id')
                    .eq('business_id', businessId);
                
                if (serviceRecords && serviceRecords.length > 0) {
                    const customerIds = [...new Set(serviceRecords.map(r => r.customer_id))];
                    const { data: pastCustomers } = await supabase
                        .from('customers')
                        .select('id, phone, name, first_name, status, notes, blast_optout')
                        .in('id', customerIds)
                        .not('phone', 'is', null)
                        .neq('blast_optout', true);
                    leads = pastCustomers || [];
                }
                break;

            case 'service_due_soon':
                // Forever Customer Engine: service due within 30 days
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                
                const { data: dueRecords } = await supabase
                    .from('service_records')
                    .select(`
                        customer_id,
                        next_service_due_at,
                        service_name,
                        customers!inner (id, phone, name, first_name, blast_optout)
                    `)
                    .eq('business_id', businessId)
                    .lte('next_service_due_at', thirtyDaysFromNow.toISOString())
                    .gte('next_service_due_at', new Date().toISOString());
                
                if (dueRecords) {
                    // Deduplicate by customer and enrich with due info
                    const customerMap = new Map();
                    for (const record of dueRecords) {
                        const customer = (record as any).customers;
                        if (customer && customer.phone && customer.blast_optout !== true) {
                            const daysUntilDue = Math.ceil(
                                (new Date(record.next_service_due_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                            );
                            customerMap.set(customer.id, {
                                ...customer,
                                dueInfo: daysUntilDue <= 0 ? 'overdue' : `due in ${daysUntilDue} days`,
                                serviceName: record.service_name
                            });
                        }
                    }
                    leads = Array.from(customerMap.values());
                }
                break;

            case 'imported':
                // Database Reactivation: externally imported contacts
                const { data: importedLeads } = await supabase
                    .from('customers')
                    .select('id, phone, name, first_name, status, notes, blast_optout')
                    .eq('business_id', businessId)
                    .eq('source', 'reactivation_import')
                    .not('phone', 'is', null)
                    .neq('blast_optout', true);
                leads = importedLeads || [];
                break;

            case 'all_old_leads':
            default:
                // Original behavior: all old leads not booked
                const { data: oldLeads } = await supabase
                    .from('customers')
                    .select('id, phone, name, first_name, status, notes, blast_optout')
                    .eq('business_id', businessId)
                    .neq('status', 'booked')
                    .neq('status', 'confirmed')
                    .lt('created_at', threeDaysAgo.toISOString())
                    .not('phone', 'is', null)
                    .neq('blast_optout', true);
                leads = oldLeads || [];
                break;
        }

        if (!leads || leads.length === 0) {
            return NextResponse.json({ 
                success: true,
                message: 'No leads in this segment', 
                sent: 0,
                segment,
                segmentName: getSegmentName(segment)
            });
        }

        // 3. CHECK CREDITS
        const COST_PER_MESSAGE = 5;
        const totalCost = leads.length * COST_PER_MESSAGE;
        const currentCredits = business.blast_credits || 0;

        // Dry run mode - return preview without sending
        if (dryRun) {
            return NextResponse.json({
                success: true,
                dryRun: true,
                segment,
                segmentName: getSegmentName(segment),
                recipientCount: leads.length,
                estimatedCost: totalCost,
                availableCredits: currentCredits,
                canAfford: currentCredits >= totalCost,
                sampleRecipients: leads.slice(0, 5).map(l => ({
                    name: l.name || l.first_name || 'Unknown',
                    phone: l.phone?.slice(-4).padStart(l.phone?.length || 4, '*'),
                    dueInfo: l.dueInfo
                }))
            });
        }

        if (currentCredits < totalCost) {
            return NextResponse.json({
                error: 'Insufficient credits',
                required: totalCost,
                available: currentCredits,
                recipientCount: leads.length,
                costPerMessage: COST_PER_MESSAGE
            }, { status: 402 });
        }

        // 4. Prepare message
        let blastMessage: string;
        if (message) {
            // Custom message provided
            blastMessage = message;
        } else if (templateId && MESSAGE_TEMPLATES[templateId]) {
            // Use template
            const template = MESSAGE_TEMPLATES[templateId];
            blastMessage = template.template(niche, businessName);
        } else {
            // Default promo
            blastMessage = MESSAGE_TEMPLATES.promo_10off.template(niche, businessName);
        }

        // 5. Send messages
        let sentCount = 0;
        let sentViaTemplate = 0;
        let sentViaFreeform = 0;
        const errors: string[] = [];

        console.log(`📣 Blast starting: ${leads.length} leads, segment=${segment}, client=${!!client}, from=${fromNumber}, templateSID=${PROMO_TEMPLATE_SID ? 'set' : 'MISSING'}`);

        for (const lead of leads) {
            if (!lead.phone) continue;

            const cleanPhone = lead.phone.replace(/[^\d+]/g, '');
            // Format phone number properly
            let formattedPhone = cleanPhone;
            if (!formattedPhone.startsWith('+')) {
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '+60' + formattedPhone.substring(1);
                } else if (formattedPhone.startsWith('63')) {
                    formattedPhone = '+' + formattedPhone;
                } else if (formattedPhone.startsWith('60')) {
                    formattedPhone = '+' + formattedPhone;
                } else {
                    formattedPhone = '+63' + formattedPhone; // Default to PH
                }
            }
            const recipient = `whatsapp:${formattedPhone}`;

            // Personalize message if template supports it
            let personalizedMessage = blastMessage;
            const customerName = lead.first_name || lead.name?.split(' ')[0] || 'there';
            if (customerName) {
                personalizedMessage = personalizedMessage.replace(/Hi!/, `Hi ${customerName}!`);
            }
            if (lead.dueInfo) {
                personalizedMessage = personalizedMessage.replace(/due for service/, lead.dueInfo);
            }

            try {
                if (client && fromNumber) {
                    const whatsappFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
                    
                    // WATERFALL: Try freeform first (free if within 24h), then template
                    let sent = false;
                    
                    try {
                        // Try freeform first (works within 24h window - FREE)
                        await client.messages.create({
                            from: whatsappFrom,
                            to: recipient,
                            body: personalizedMessage
                        });
                        sentViaFreeform++;
                        sent = true;
                    } catch (freeformErr: any) {
                        // Freeform failed - try template fallback for ANY Twilio error
                        // Common codes: 63016 (outside window), 63007 (freeform not allowed), 21610 (unsubscribed)
                        console.log(`⚠️ Freeform failed for ${lead.phone} (code: ${freeformErr.code}, msg: ${freeformErr.message}). Trying template...`);
                        
                        if (PROMO_TEMPLATE_SID) {
                            try {
                                await client.messages.create({
                                    from: whatsappFrom,
                                    to: recipient,
                                    contentSid: PROMO_TEMPLATE_SID,
                                    contentVariables: JSON.stringify({
                                        '1': customerName,
                                        '2': businessName,
                                        '3': niche.toLowerCase(),
                                    }),
                                });
                                sentViaTemplate++;
                                sent = true;
                                console.log(`✅ Template sent to ${lead.phone}`);
                            } catch (templateErr: any) {
                                console.error(`❌ Template also failed for ${lead.phone}: code=${templateErr.code} msg=${templateErr.message}`);
                                errors.push(`${lead.phone}: template failed (${templateErr.code})`);
                            }
                        } else {
                            console.error('❌ No TWILIO_TEMPLATE_PROMO configured');
                            errors.push(`${lead.phone}: no template configured`);
                        }
                    }

                    if (sent) {
                        sentCount++;
                        
                        // Update customer
                        await supabase
                            .from('customers')
                            .update({
                                status: segment === 'service_due_soon' ? 'reminder_sent' : 'reengaged',
                                last_blast_at: new Date().toISOString(),
                                notes: `${lead.notes || ''}\n[BLAST:${segment} ${new Date().toISOString()}]: ${templateId || 'custom'}`
                            })
                            .eq('id', lead.id);
                    }

                } else {
                    // Mock mode - Twilio not configured
                    console.warn(`⚠️ MOCK MODE: client=${!!client}, fromNumber=${fromNumber}. Message NOT actually sent to ${recipient}`);
                    sentCount++;
                    sentViaFreeform++;
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (err: any) {
                console.error(`Failed to send to ${lead.phone}:`, err.message);
                errors.push(lead.phone);
            }
        }

        // 6. DEDUCT CREDITS (templates cost more!)
        // Freeform within 24h = free session msg, Template = ₱2.50
        const freeformCost = 0; // Session messages are free
        const templateCost = sentViaTemplate * 2.50; // Marketing template cost
        const actualCost = freeformCost + templateCost;
        
        if (sentCount > 0 && actualCost > 0) {
            const newCredits = currentCredits - actualCost;
            const newUsed = (business.blast_credits_used || 0) + actualCost;

            await supabase
                .from('businesses')
                .update({
                    blast_credits: newCredits,
                    blast_credits_used: newUsed
                })
                .eq('id', businessId);

            // Record transaction
            await supabase
                .from('blast_transactions')
                .insert({
                    business_id: businessId,
                    type: 'blast',
                    amount: -actualCost,
                    recipient_count: sentCount,
                    description: `${getSegmentName(segment)} blast: ${sentViaFreeform} free + ${sentViaTemplate} template (₱${actualCost.toFixed(2)})`
                });
        }

        console.log(`📢 Blast [${segment}] sent to ${sentCount}/${leads.length} for ${businessName}. Freeform: ${sentViaFreeform}, Template: ${sentViaTemplate}, Cost: ₱${actualCost.toFixed(2)}`);

        return NextResponse.json({
            success: true,
            sent: sentCount,
            sentViaFreeform,
            sentViaTemplate,
            total: leads.length,
            errors: errors.length,
            cost: actualCost,
            remainingCredits: currentCredits - actualCost,
            segment,
            segmentName: getSegmentName(segment),
            templateId: templateId || 'custom',
            message: `Sent to ${sentCount} leads (${sentViaFreeform} free + ${sentViaTemplate} template = ₱${actualCost.toFixed(2)})`
        });

    } catch (error: any) {
        console.error('Blast error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET endpoint to preview segments
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const businessId = searchParams.get('businessId');

        if (!businessId) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-ignore
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        // Count each segment
        const [allOld, cold, quoted, pastService, dueSoon, imported] = await Promise.all([
            // All old leads
            supabase
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .neq('status', 'booked')
                .neq('status', 'confirmed')
                .lt('created_at', threeDaysAgo.toISOString())
                .not('phone', 'is', null)
                .neq('blast_optout', true),
            
            // Cold leads
            supabase
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .in('status', ['new', 'sticker_menu', 'menu'])
                .lt('created_at', threeDaysAgo.toISOString())
                .not('phone', 'is', null)
                .neq('blast_optout', true),
            
            // Quoted not booked
            supabase
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .in('status', ['quoted', 'pricing_shown', 'pending_booking', 'awaiting_confirmation'])
                .not('phone', 'is', null)
                .neq('blast_optout', true),
            
            // Past customers (with service records)
            supabase
                .from('service_records')
                .select('customer_id', { count: 'exact', head: true })
                .eq('business_id', businessId),
            
            // Service due soon
            supabase
                .from('service_records')
                .select('customer_id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .lte('next_service_due_at', thirtyDaysFromNow.toISOString())
                .gte('next_service_due_at', new Date().toISOString()),
            
            // Imported contacts (Database Reactivation)
            supabase
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('source', 'reactivation_import')
                .not('phone', 'is', null)
                .neq('blast_optout', true)
        ]);

        return NextResponse.json({
            segments: {
                all_old_leads: {
                    name: 'All Old Leads',
                    description: 'Leads older than 3 days, not booked',
                    count: allOld.count || 0,
                    icon: '📋'
                },
                cold_leads: {
                    name: 'Cold Leads',
                    description: 'Never responded to messages',
                    count: cold.count || 0,
                    icon: '❄️'
                },
                quoted_not_booked: {
                    name: 'Quoted, Not Booked',
                    description: 'Got pricing but didn\'t book (high intent!)',
                    count: quoted.count || 0,
                    icon: '🎯',
                    recommended: true
                },
                past_customers: {
                    name: 'Past Customers',
                    description: 'Previous service history',
                    count: pastService.count || 0,
                    icon: '⭐'
                },
                service_due_soon: {
                    name: 'Service Due Soon',
                    description: 'Service needed within 30 days',
                    count: dueSoon.count || 0,
                    icon: '🔧',
                    recommended: true
                },
                imported: {
                    name: 'Imported Contacts',
                    description: 'Database reactivation — imported phone list',
                    count: imported.count || 0,
                    icon: '📥',
                    recommended: true
                }
            },
            templates: Object.entries(MESSAGE_TEMPLATES).map(([id, t]) => ({
                id,
                name: t.name,
                icon: t.icon
            }))
        });

    } catch (error: any) {
        console.error('Segments error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function getSegmentName(segment: string): string {
    const names: Record<string, string> = {
        all_old_leads: 'All Old Leads',
        cold_leads: 'Cold Leads',
        quoted_not_booked: 'Quoted Not Booked',
        past_customers: 'Past Customers',
        service_due_soon: 'Service Due Soon',
        custom: 'Custom Selection',
        imported: 'Imported Contacts'
    };
    return names[segment] || segment;
}
