/**
 * Service Reminders Cron Job
 * 
 * THE SMART NAG SYSTEM
 * 
 * Runs daily at 9 AM UTC+8 (SEA timezone) to:
 * 1. Find services due for reminder
 * 2. Send SMS reminders nudging customers to WhatsApp
 * 3. Track reminder delivery and conversion
 * 
 * This is the core of the "Forever Customer Engine" - automatic
 * follow-ups that turn one-time customers into repeat revenue.
 * 
 * Cost Strategy:
 * - SMS costs ~RM 0.05 / ₱1 per message
 * - Each SMS can bring back a RM 120 / ₱800 job
 * - ROI: ~2,400% - 80,000%
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import {
    type ReminderRecipient,
    getApplicableTemplate,
    hasReachedMaxReminders,
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
const SMS_COST_ESTIMATE = { MY: 0.05, PH: 0.02 }; // RM / PHP

interface CronResult {
    success: boolean;
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
    totalCost: number;
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
        failed: 0,
        skipped: 0,
        totalCost: 0,
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
                    businessPhone: '13203627874', // Launchfly bot number
                    serviceRecordId: service.service_record_id,
                    serviceName: service.service_name || 'maintenance',
                    applianceType: service.appliance_type,
                    lastServiceDate: new Date(service.service_date),
                    nextDueDate: new Date(service.next_due_at),
                    daysUntilDue: service.days_until_due,
                    reminderCount: service.reminder_count,
                    reminderPreference: service.reminder_preference || 'sms',
                    currency: 'RM', // Default
                };

                // Get appropriate template
                const template = getApplicableTemplate(
                    recipient.daysUntilDue,
                    recipient.reminderCount,
                    recipient.reminderPreference
                );

                if (!template) {
                    console.log(`⏭️ Skipping ${service.customer_name}: no applicable template`);
                    result.skipped++;
                    continue;
                }

                // Generate message
                const message = template.getMessage(recipient);

                // Send SMS
                const sendResult = await sendSmsReminder(recipient.customerPhone, message);

                if (sendResult.success) {
                    result.sent++;
                    result.totalCost += SMS_COST_ESTIMATE.MY; // Estimate

                    // Log to service_reminders table
                    await supabase.from('service_reminders').insert({
                        service_record_id: service.service_record_id,
                        business_id: service.business_id,
                        customer_id: service.customer_id,
                        scheduled_for: new Date(),
                        reminder_type: recipient.daysUntilDue > 0 ? 'due_soon' : 
                                       recipient.daysUntilDue === 0 ? 'due_now' : 'overdue',
                        channel: 'sms',
                        status: 'sent',
                        sent_at: new Date(),
                        message_template: template.id,
                        message_sent: message,
                        cost: SMS_COST_ESTIMATE.MY,
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

                    console.log(`✅ Sent reminder to ${recipient.customerName}: ${template.name}`);
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
                        channel: 'sms',
                        status: 'failed',
                        message_template: template.id,
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
            message: `Smart Nag: Sent ${result.sent} reminders`,
            details: `Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}, Skipped: ${result.skipped}`,
            metadata: {
                ...result,
                timestamp: new Date().toISOString(),
            },
        });

        console.log('─'.repeat(50));
        console.log('🔔 Service Reminders Cron Complete');
        console.log(`   Processed: ${result.processed}`);
        console.log(`   Sent: ${result.sent}`);
        console.log(`   Failed: ${result.failed}`);
        console.log(`   Skipped: ${result.skipped}`);
        console.log(`   Est. Cost: RM ${result.totalCost.toFixed(2)}`);
        console.log(`   Duration: ${result.duration}ms`);
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
}

/**
 * Send SMS via Twilio
 */
async function sendSmsReminder(phoneNumber: string, message: string): Promise<SendResult> {
    try {
        // Ensure phone number has country code
        let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
        if (!formattedPhone.startsWith('+')) {
            // Assume Malaysian number if no prefix
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '+60' + formattedPhone.substring(1);
            } else if (formattedPhone.startsWith('60')) {
                formattedPhone = '+' + formattedPhone;
            } else if (formattedPhone.startsWith('63')) {
                formattedPhone = '+' + formattedPhone; // Philippines
            } else {
                formattedPhone = '+60' + formattedPhone; // Default to MY
            }
        }

        // Validate we have Twilio credentials
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('⚠️ Twilio credentials not configured');
            // Mock mode for development
            console.log(`📱 [MOCK SMS] To: ${formattedPhone}`);
            console.log(`   Message: ${message}`);
            return { success: true, messageSid: 'MOCK_' + Date.now() };
        }

        // Get SMS-capable number (different from WhatsApp number)
        const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER;
        if (!fromNumber) {
            console.warn('⚠️ No SMS-capable Twilio number configured');
            return { success: false, error: 'No SMS number configured' };
        }

        // Send SMS
        const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: formattedPhone,
        });

        return { success: true, messageSid: twilioMessage.sid };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ SMS send error:`, error);
        return { success: false, error: errorMsg };
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
