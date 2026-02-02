/**
 * Service Reminders Cron Job
 * 
 * THE SMART NAG SYSTEM
 * 
 * Runs daily at 9 AM UTC+8 (SEA timezone) to:
 * 1. Find services due for reminder
 * 2. Send WhatsApp Templates first (cheapest!) → SMS fallback if needed
 * 3. Track reminder delivery and conversion
 * 
 * COST STRATEGY (Updated 2026):
 * - WhatsApp Utility: ₱0.17 / RM0.06 per message (PRIMARY!)
 * - SMS: ₱3.25 / RM0.18 per message (FALLBACK - 19x more expensive!)
 * - Each reminder can bring back a RM 120 / ₱800 job
 * - ROI: ~470x for WhatsApp, ~25x for SMS
 * 
 * WATERFALL STRATEGY:
 * 1. Try WhatsApp Utility Template (₱0.17)
 * 2. If fails, fall back to SMS (₱3.25)
 * 3. If SMS fails, mark for retry tomorrow
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import {
    type ReminderRecipient,
    type ReminderTemplate,
    getWaterfallTemplates,
    hasReachedMaxReminders,
    TWILIO_COSTS,
} from '@/lib/reminder-templates';

// Initialize clients
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Config
const MAX_REMINDERS_PER_SERVICE = 4;
const BATCH_SIZE = 50; // Process 50 at a time to avoid timeout
const LAUNCHFLY_BOT_NUMBER = '13203627874';

interface CronResult {
    success: boolean;
    processed: number;
    sent: number;
    sentWhatsApp: number;
    sentSms: number;
    failed: number;
    skipped: number;
    totalCost: { MY: number; PH: number };
    errors: string[];
    duration: number;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('⚠️ Unauthorized cron attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔔 Starting Service Reminders Cron Job');
    console.log(`   Time: ${new Date().toISOString()}`);

    const result: CronResult = {
        success: true,
        processed: 0,
        sent: 0,
        sentWhatsApp: 0,
        sentSms: 0,
        failed: 0,
        skipped: 0,
        totalCost: { MY: 0, PH: 0 },
        errors: [],
        duration: 0,
    };

    try {
        // 1. Find services due for reminder (within next 14 days or overdue by up to 14 days)
        const { data: dueServices, error: fetchError } = await supabase
            .rpc('get_services_due_for_reminder', { p_days_ahead: 14 });

        if (fetchError) {
            console.error('❌ Error fetching due services:', fetchError);
            throw fetchError;
        }

        if (!dueServices || dueServices.length === 0) {
            console.log('✅ No services due for reminder');
            return NextResponse.json({
                success: true,
                message: 'No services due for reminder',
                processed: 0,
            });
        }

        console.log(`📋 Found ${dueServices.length} services due for reminder`);

        // 2. Process each service
        for (const service of dueServices.slice(0, BATCH_SIZE)) {
            result.processed++;

            try {
                // Skip if max reminders reached
                if (hasReachedMaxReminders(service.reminder_count, MAX_REMINDERS_PER_SERVICE)) {
                    console.log(`⏭️ Skipping ${service.customer_name}: max reminders reached`);
                    result.skipped++;
                    continue;
                }

                // Skip if no phone number
                if (!service.customer_phone) {
                    console.log(`⏭️ Skipping ${service.customer_name}: no phone number`);
                    result.skipped++;
                    continue;
                }

                // Build recipient object
                const recipient: ReminderRecipient = {
                    customerId: service.customer_id,
                    customerName: service.customer_name || 'there',
                    customerPhone: service.customer_phone,
                    businessId: service.business_id,
                    businessName: service.business_name,
                    businessPhone: LAUNCHFLY_BOT_NUMBER,
                    serviceRecordId: service.service_record_id,
                    serviceName: service.service_name || 'maintenance',
                    applianceType: service.appliance_type,
                    lastServiceDate: new Date(service.service_date),
                    nextDueDate: new Date(service.next_due_at),
                    daysUntilDue: service.days_until_due,
                    reminderCount: service.reminder_count,
                    reminderPreference: service.reminder_preference || 'both',
                    currency: 'RM', // Default
                };

                // Get waterfall templates (WA primary, SMS fallback)
                const waterfall = getWaterfallTemplates(
                    recipient.daysUntilDue,
                    recipient.reminderCount
                );

                if (!waterfall) {
                    console.log(`⏭️ Skipping ${service.customer_name}: no applicable template`);
                    result.skipped++;
                    continue;
                }

                // Try primary channel first (WhatsApp if available)
                let sendResult: SendResult;
                let usedTemplate: ReminderTemplate = waterfall.primary;
                let channel: 'whatsapp' | 'sms' = waterfall.primary.channel.startsWith('whatsapp') ? 'whatsapp' : 'sms';

                if (waterfall.primary.channel.startsWith('whatsapp')) {
                    // Try WhatsApp Template first (₱0.17)
                    const message = waterfall.primary.getMessage(recipient);
                    const templateVars = waterfall.primary.getTemplateVariables?.(recipient);
                    
                    sendResult = await sendWhatsAppTemplate(
                        recipient.customerPhone,
                        waterfall.primary.templateSid || '',
                        templateVars || {},
                        message // fallback to freeform if no template
                    );

                    // If WhatsApp failed and we have SMS fallback, try that
                    if (!sendResult.success && waterfall.fallback) {
                        console.log(`⚠️ WhatsApp failed for ${recipient.customerName}, trying SMS fallback...`);
                        
                        const smsMessage = waterfall.fallback.getMessage(recipient);
                        sendResult = await sendSmsReminder(recipient.customerPhone, smsMessage);
                        usedTemplate = waterfall.fallback;
                        channel = 'sms';
                    }
                } else {
                    // Primary is SMS (no WhatsApp template for this sequence)
                    const message = waterfall.primary.getMessage(recipient);
                    sendResult = await sendSmsReminder(recipient.customerPhone, message);
                }

                // Process result
                const message = usedTemplate.getMessage(recipient);
                const cost = usedTemplate.costEstimate;

                if (sendResult.success) {
                    result.sent++;
                    if (channel === 'whatsapp') {
                        result.sentWhatsApp++;
                        result.totalCost.MY += cost.MY;
                        result.totalCost.PH += cost.PH;
                    } else {
                        result.sentSms++;
                        result.totalCost.MY += cost.MY;
                        result.totalCost.PH += cost.PH;
                    }

                    // Log to service_reminders table
                    await supabase.from('service_reminders').insert({
                        service_record_id: service.service_record_id,
                        business_id: service.business_id,
                        customer_id: service.customer_id,
                        scheduled_for: new Date(),
                        reminder_type: recipient.daysUntilDue > 0 ? 'due_soon' : 
                                       recipient.daysUntilDue === 0 ? 'due_now' : 'overdue',
                        channel,
                        status: 'sent',
                        sent_at: new Date(),
                        message_template: usedTemplate.id,
                        message_sent: message,
                        cost: cost.MY, // Track MY cost for now
                        sequence_number: recipient.reminderCount + 1,
                    });

                    // Update service record
                    await supabase
                        .from('service_records')
                        .update({
                            reminder_sent: true,
                            reminder_sent_at: new Date(),
                            reminder_count: recipient.reminderCount + 1,
                        })
                        .eq('id', service.service_record_id);

                    // UPDATE CUSTOMER STATUS for V2 handler (Critical!)
                    await supabase.from('customers')
                        .update({ 
                            status: 'reminder_sent',
                            last_interaction_context: 'REMINDER_6M', // Tag for V2 context awareness
                            notes: (service.customer_notes || '') + `\n[SMART_NAG_SENT: ${new Date().toISOString()}] Service: ${service.service_name || 'General Service'}`
                        })
                        .eq('id', service.customer_id);

                    console.log(`✅ Sent ${channel.toUpperCase()} reminder to ${recipient.customerName}: ${usedTemplate.name}`);
                } else {
                    result.failed++;
                    result.errors.push(`Failed to send to ${recipient.customerPhone}: ${sendResult.error}`);

                    // Log failed reminder
                    await supabase.from('service_reminders').insert({
                        service_record_id: service.service_record_id,
                        business_id: service.business_id,
                        customer_id: service.customer_id,
                        scheduled_for: new Date(),
                        reminder_type: 'due_now',
                        channel,
                        status: 'failed',
                        message_template: usedTemplate.id,
                        message_sent: message,
                        error_message: sendResult.error,
                    });

                    console.error(`❌ Failed to send to ${recipient.customerPhone}: ${sendResult.error}`);
                }

            } catch (error) {
                result.failed++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Error processing ${service.customer_name}: ${errorMsg}`);
                console.error(`❌ Error processing service ${service.service_record_id}:`, error);
            }
        }

        // Calculate duration
        result.duration = Date.now() - startTime;

        // Log summary to ai_activities for dashboard visibility
        await supabase.from('ai_activities').insert({
            business_id: process.env.SYSTEM_BUSINESS_ID || dueServices[0]?.business_id,
            type: 'smart_nag_run',
            icon: '🔔',
            message: `Smart Nag: ${result.sentWhatsApp} WhatsApp + ${result.sentSms} SMS sent`,
            details: `Processed: ${result.processed}, WA: ${result.sentWhatsApp}, SMS: ${result.sentSms}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
            metadata: {
                ...result,
                timestamp: new Date().toISOString(),
            },
        });

        console.log('─'.repeat(50));
        console.log('🔔 Service Reminders Cron Complete');
        console.log(`   Processed: ${result.processed}`);
        console.log(`   📱 WhatsApp Sent: ${result.sentWhatsApp} (₱${(result.sentWhatsApp * TWILIO_COSTS.WHATSAPP_UTILITY.PH).toFixed(2)})`);
        console.log(`   💬 SMS Sent: ${result.sentSms} (₱${(result.sentSms * TWILIO_COSTS.SMS.PH).toFixed(2)})`);
        console.log(`   ❌ Failed: ${result.failed}`);
        console.log(`   ⏭️ Skipped: ${result.skipped}`);
        console.log(`   💰 Total Cost: RM ${result.totalCost.MY.toFixed(2)} / ₱${result.totalCost.PH.toFixed(2)}`);
        console.log(`   ⏱️ Duration: ${result.duration}ms`);
        console.log('─'.repeat(50));

        return NextResponse.json(result);

    } catch (error) {
        console.error('❌ Cron job failed:', error);
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        result.duration = Date.now() - startTime;

        return NextResponse.json(result, { status: 500 });
    }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
    return GET(request);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface SendResult {
    success: boolean;
    messageSid?: string;
    error?: string;
    channel?: 'whatsapp' | 'sms';
}

/**
 * Send WhatsApp Template Message via Twilio
 * 
 * Uses Twilio's Content API for pre-approved templates.
 * These are MUCH cheaper than SMS: ₱0.17 vs ₱3.25
 * 
 * Note: If no templateSid provided, falls back to freeform message
 * (only works within 24-hour window)
 */
async function sendWhatsAppTemplate(
    phoneNumber: string,
    templateSid: string,
    variables: Record<string, string>,
    fallbackMessage: string
): Promise<SendResult> {
    try {
        // Format phone number
        let formattedPhone = formatPhoneNumber(phoneNumber);
        const whatsappTo = `whatsapp:${formattedPhone}`;
        
        // Validate Twilio credentials
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('⚠️ Twilio credentials not configured');
            console.log(`📱 [MOCK WA TEMPLATE] To: ${whatsappTo}`);
            console.log(`   Template: ${templateSid || 'FREEFORM'}`);
            console.log(`   Message: ${fallbackMessage}`);
            return { success: true, messageSid: 'MOCK_WA_' + Date.now(), channel: 'whatsapp' };
        }

        const whatsappFrom = `whatsapp:+${process.env.TWILIO_WHATSAPP_NUMBER || '13203627874'}`;

        // If we have a template SID, use Content API
        if (templateSid) {
            const twilioMessage = await twilioClient.messages.create({
                contentSid: templateSid,
                contentVariables: JSON.stringify(variables),
                from: whatsappFrom,
                to: whatsappTo,
            });
            
            console.log(`📱 WhatsApp Template sent: ${twilioMessage.sid}`);
            return { success: true, messageSid: twilioMessage.sid, channel: 'whatsapp' };
        } else {
            // No template - try freeform (only works in 24h window)
            // This will likely fail for outbound, but worth trying
            const twilioMessage = await twilioClient.messages.create({
                body: fallbackMessage,
                from: whatsappFrom,
                to: whatsappTo,
            });
            
            console.log(`📱 WhatsApp Freeform sent: ${twilioMessage.sid}`);
            return { success: true, messageSid: twilioMessage.sid, channel: 'whatsapp' };
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ WhatsApp send error:`, error);
        return { success: false, error: errorMsg, channel: 'whatsapp' };
    }
}

/**
 * Format phone number with country code
 */
function formatPhoneNumber(phoneNumber: string): string {
    let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '+60' + formattedPhone.substring(1); // Malaysia
        } else if (formattedPhone.startsWith('60')) {
            formattedPhone = '+' + formattedPhone;
        } else if (formattedPhone.startsWith('63')) {
            formattedPhone = '+' + formattedPhone; // Philippines
        } else {
            formattedPhone = '+60' + formattedPhone; // Default to MY
        }
    }
    return formattedPhone;
}

/**
 * Send SMS via Twilio (Fallback)
 * 
 * Cost: ₱3.25 / RM0.18 per message - use as fallback only!
 */
async function sendSmsReminder(phoneNumber: string, message: string): Promise<SendResult> {
    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Validate we have Twilio credentials
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('⚠️ Twilio credentials not configured');
            console.log(`📱 [MOCK SMS] To: ${formattedPhone}`);
            console.log(`   Message: ${message}`);
            return { success: true, messageSid: 'MOCK_SMS_' + Date.now(), channel: 'sms' };
        }

        // Get SMS-capable number
        const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER;
        if (!fromNumber) {
            console.warn('⚠️ No SMS-capable Twilio number configured');
            return { success: false, error: 'No SMS number configured', channel: 'sms' };
        }

        // Send SMS
        const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: formattedPhone,
        });

        console.log(`💬 SMS sent: ${twilioMessage.sid}`);
        return { success: true, messageSid: twilioMessage.sid, channel: 'sms' };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ SMS send error:`, error);
        return { success: false, error: errorMsg, channel: 'sms' };
    }
}

/**
 * Calculate days until due date
 */
function calculateDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
