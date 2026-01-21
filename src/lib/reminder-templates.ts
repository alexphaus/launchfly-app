/**
 * Reminder Templates
 * 
 * SMS and WhatsApp message templates for the Smart Nag system.
 * These are used by the service-reminders cron job to send follow-ups.
 * 
 * Cost Strategy:
 * - Use SMS for initial reminders (cheaper, no opt-in needed)
 * - SMS nudges customer to WhatsApp for booking
 * - Once in WhatsApp 24h window, booking is free
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ReminderRecipient {
    customerId: string;
    customerName: string;
    customerPhone: string;
    businessId: string;
    businessName: string;
    businessPhone: string; // For wa.me link
    serviceRecordId: string;
    serviceName: string;
    applianceType?: string;
    lastServiceDate: Date;
    nextDueDate: Date;
    daysUntilDue: number;
    reminderCount: number;
    reminderPreference: 'sms' | 'whatsapp' | 'both';
    buildingName?: string; // For neighbor clustering
    currency: string;
}

export interface ReminderTemplate {
    id: string;
    name: string;
    channel: 'sms' | 'whatsapp_template' | 'whatsapp_session';
    triggerDays: number; // Days before/after due date (negative = before)
    sequence: number; // 1st, 2nd, 3rd reminder
    getMessage: (recipient: ReminderRecipient) => string;
    costEstimate: { MY: number; PH: number }; // Approximate cost per message
}

// ============================================================================
// SMS TEMPLATES (Primary channel - avoid WhatsApp template costs)
// ============================================================================

const LAUNCHFLY_BOT_NUMBER = '13203627874'; // Without + prefix

/**
 * SMS Reminder 1: Due Soon (sent 2 weeks before due date)
 * Goal: Give early heads-up, plant the seed
 */
export const SMS_DUE_SOON: ReminderTemplate = {
    id: 'sms_due_soon',
    name: 'Service Due Soon',
    channel: 'sms',
    triggerDays: -14, // 14 days before due
    sequence: 1,
    getMessage: (r) => {
        const applianceText = r.applianceType || 'appliance';
        return `Hi ${r.customerName}! Your ${applianceText} will be due for ${r.serviceName} in 2 weeks. Book early for best slots! Reply on WhatsApp: wa.me/${LAUNCHFLY_BOT_NUMBER} - ${r.businessName}`;
    },
    costEstimate: { MY: 0.05, PH: 0.02 } // RM / PHP
};

/**
 * SMS Reminder 2: Due Now (sent on due date)
 * Goal: Direct call-to-action
 */
export const SMS_DUE_NOW: ReminderTemplate = {
    id: 'sms_due_now',
    name: 'Service Due Now',
    channel: 'sms',
    triggerDays: 0, // On due date
    sequence: 2,
    getMessage: (r) => {
        return `${r.customerName}, it's time for your ${r.applianceType || 'service'} maintenance! Keep it running efficiently. Book now: wa.me/${LAUNCHFLY_BOT_NUMBER}?text=Hi - ${r.businessName}`;
    },
    costEstimate: { MY: 0.05, PH: 0.02 }
};

/**
 * SMS Reminder 3: Overdue (sent 1 week after due date)
 * Goal: Urgency + social proof
 */
export const SMS_OVERDUE: ReminderTemplate = {
    id: 'sms_overdue',
    name: 'Service Overdue',
    channel: 'sms',
    triggerDays: 7, // 7 days after due
    sequence: 3,
    getMessage: (r) => {
        return `Reminder: ${r.customerName}, your ${r.applianceType || 'service'} is ${Math.abs(r.daysUntilDue)} days overdue for maintenance. Don't wait for problems! Book: wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: { MY: 0.05, PH: 0.02 }
};

/**
 * SMS Reminder 4: Final Notice (sent 2 weeks after due date)
 * Goal: Last attempt before going silent
 */
export const SMS_FINAL_NOTICE: ReminderTemplate = {
    id: 'sms_final_notice',
    name: 'Final Reminder',
    channel: 'sms',
    triggerDays: 14, // 14 days after due
    sequence: 4,
    getMessage: (r) => {
        return `Final reminder: ${r.customerName}, skipping maintenance can lead to costly repairs. ${r.businessName} can help. Reply YES to book: wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: { MY: 0.05, PH: 0.02 }
};

/**
 * SMS: Warranty Expiring (sent 7 days before warranty expires)
 * Goal: Upsell service before warranty ends
 */
export const SMS_WARRANTY_EXPIRING: ReminderTemplate = {
    id: 'sms_warranty_expiring',
    name: 'Warranty Expiring',
    channel: 'sms',
    triggerDays: -7, // 7 days before warranty expires
    sequence: 1,
    getMessage: (r) => {
        return `Hi ${r.customerName}! Your ${r.businessName} service warranty expires in 7 days. Any issues? Report now at wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: { MY: 0.05, PH: 0.02 }
};

// ============================================================================
// WHATSAPP TEMPLATE MESSAGES (Premium option for higher engagement)
// ============================================================================
// Note: These require approved templates in Twilio and cost more

/**
 * WhatsApp Template: Service Reminder (Utility category)
 * Only use this if customer opted in for WhatsApp reminders
 */
export const WHATSAPP_REMINDER: ReminderTemplate = {
    id: 'wa_reminder',
    name: 'WhatsApp Service Reminder',
    channel: 'whatsapp_template',
    triggerDays: 0,
    sequence: 1,
    getMessage: (r) => {
        // This would use a pre-approved template with variables
        // Template: "Hi {{1}}! Your {{2}} is due for {{3}}. Book your slot: {{4}}"
        return JSON.stringify({
            templateName: 'service_reminder_v1',
            variables: {
                '1': r.customerName,
                '2': r.applianceType || 'appliance',
                '3': r.serviceName,
                '4': `wa.me/${LAUNCHFLY_BOT_NUMBER}?text=BOOK_${r.serviceRecordId.substring(0, 8)}`
            }
        });
    },
    costEstimate: { MY: 0.20, PH: 0.08 } // WhatsApp templates cost more
};

// ============================================================================
// ALL TEMPLATES (for iteration)
// ============================================================================

export const ALL_REMINDER_TEMPLATES: ReminderTemplate[] = [
    SMS_DUE_SOON,
    SMS_DUE_NOW,
    SMS_OVERDUE,
    SMS_FINAL_NOTICE,
    SMS_WARRANTY_EXPIRING,
    WHATSAPP_REMINDER,
];

/**
 * Get the appropriate template based on days until due and sequence
 */
export function getApplicableTemplate(
    daysUntilDue: number,
    reminderCount: number,
    preference: 'sms' | 'whatsapp' | 'both'
): ReminderTemplate | null {
    // Determine which sequence we're on
    const sequence = reminderCount + 1; // Next reminder to send

    // Find matching template
    for (const template of ALL_REMINDER_TEMPLATES) {
        // Check if timing matches
        const isMatch = 
            (template.triggerDays === -14 && daysUntilDue <= 14 && daysUntilDue > 7 && sequence === 1) ||
            (template.triggerDays === 0 && daysUntilDue <= 0 && daysUntilDue > -7 && sequence === 2) ||
            (template.triggerDays === 7 && daysUntilDue <= -7 && daysUntilDue > -14 && sequence === 3) ||
            (template.triggerDays === 14 && daysUntilDue <= -14 && sequence === 4);

        if (isMatch) {
            // Check channel preference
            if (template.channel === 'sms' && (preference === 'sms' || preference === 'both')) {
                return template;
            }
            if (template.channel.startsWith('whatsapp') && (preference === 'whatsapp' || preference === 'both')) {
                return template;
            }
        }
    }

    // Default to SMS if available
    if (sequence === 1) return SMS_DUE_SOON;
    if (sequence === 2) return SMS_DUE_NOW;
    if (sequence === 3) return SMS_OVERDUE;
    if (sequence === 4) return SMS_FINAL_NOTICE;

    return null; // Max reminders reached
}

// ============================================================================
// NEIGHBOR CLUSTERING TEMPLATES
// ============================================================================
// Special templates for building-based promotions

/**
 * Generate "same building" discount message
 */
export function generateBuildingClusterMessage(params: {
    customerName: string;
    buildingName: string;
    neighborsCount: number;
    discountPercent: number;
    businessName: string;
}): string {
    return `Hi ${params.customerName}! 🏢

We noticed ${params.neighborsCount} other customers in *${params.buildingName}* are also due for service.

Book on the same day as your neighbors and get *${params.discountPercent}% OFF*! 

Reply YES to check available dates.
- ${params.businessName}`;
}

/**
 * SMS version for building cluster
 */
export function generateBuildingClusterSms(params: {
    customerName: string;
    buildingName: string;
    discountPercent: number;
    businessPhone: string;
}): string {
    return `${params.customerName}, ${params.discountPercent}% off when you book with your ${params.buildingName} neighbors! Reply on WhatsApp: wa.me/${params.businessPhone}`;
}

// ============================================================================
// POST-SERVICE MESSAGES
// ============================================================================
// Sent after service completion to maximize retention

/**
 * Thank you message (sent immediately after service)
 */
export function generateThankYouMessage(params: {
    customerName: string;
    serviceName: string;
    warrantyDays: number;
    nextDueDate: string;
    businessName: string;
}): string {
    return `Thank you, ${params.customerName}! ✅

Your ${params.serviceName} is complete.

🛡️ *Warranty:* ${params.warrantyDays} days (just scan the sticker if any issues!)
📅 *Next Service Due:* ${params.nextDueDate}

We'll remind you automatically when it's time. No need to remember! 

Thanks for choosing *${params.businessName}*! 🙏`;
}

/**
 * Review request (sent 24h after service)
 */
export function generateReviewRequest(params: {
    customerName: string;
    businessName: string;
    googleReviewLink?: string;
}): string {
    const reviewLink = params.googleReviewLink || '#'; // Fallback if no Google link
    
    return `Hi ${params.customerName}! 👋

How was your experience with *${params.businessName}*?

If you were happy with the service, would you mind leaving a quick review? It really helps small businesses like ours! ⭐

${reviewLink}

Thank you so much! 🙏`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate cost of sending a reminder
 */
export function estimateReminderCost(
    template: ReminderTemplate,
    country: 'MY' | 'PH'
): number {
    return template.costEstimate[country];
}

/**
 * Calculate ROI messaging for technician
 */
export function generateRoiMessage(params: {
    reminderCost: number;
    averageJobValue: number;
    currency: string;
    rebookingRate: number; // e.g., 0.3 for 30%
}): string {
    const expectedReturn = params.averageJobValue * params.rebookingRate;
    const roi = Math.round((expectedReturn / params.reminderCost - 1) * 100);
    
    return `💡 *Smart Nag ROI:*
    
Cost per reminder: ${params.currency} ${params.reminderCost.toFixed(2)}
Average job value: ${params.currency} ${params.averageJobValue.toFixed(0)}
Expected rebooking rate: ${(params.rebookingRate * 100).toFixed(0)}%

*Expected return:* ${params.currency} ${expectedReturn.toFixed(0)} per reminder sent
*ROI:* ${roi}%+

Every ${params.currency} ${params.reminderCost.toFixed(2)} reminder can bring back a ${params.currency} ${params.averageJobValue.toFixed(0)} job!`;
}

/**
 * Check if customer has reached max reminders
 */
export function hasReachedMaxReminders(reminderCount: number, maxReminders: number = 4): boolean {
    return reminderCount >= maxReminders;
}

/**
 * Get next reminder date based on current count
 */
export function getNextReminderDate(dueDate: Date, reminderCount: number): Date | null {
    const intervals = [-14, 0, 7, 14]; // Days relative to due date
    
    if (reminderCount >= intervals.length) {
        return null; // Max reminders reached
    }
    
    const nextDate = new Date(dueDate);
    nextDate.setDate(nextDate.getDate() + intervals[reminderCount]);
    return nextDate;
}
