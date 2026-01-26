/**
 * Reminder Templates
 * 
 * WhatsApp Template → SMS Fallback Waterfall System
 * 
 * PRICING REALITY (Twilio 2026):
 * ┌─────────────────────────────┬──────────┬──────────┐
 * │ Channel                     │ PH (₱)   │ MY (RM)  │
 * ├─────────────────────────────┼──────────┼──────────┤
 * │ WhatsApp Utility Template   │ 0.17     │ 0.15     │  ← CHEAPEST
 * │ WhatsApp Marketing Template │ 2.50     │ 0.90     │
 * │ Twilio SMS                  │ 3.25     │ 0.18     │  ← EXPENSIVE!
 * └─────────────────────────────┴──────────┴──────────┘
 * 
 * STRATEGY: 
 * 1. Try WhatsApp UTILITY Template first (cheapest, trusted)
 * 2. If WhatsApp fails → Fall back to SMS
 * 
 * WHY UTILITY vs MARKETING:
 * - Customer REGISTERED warranty (scanned sticker)
 * - 6-month reminder = "Post-Purchase Update" = UTILITY category
 * - UTILITY = ₱0.17 vs MARKETING = ₱2.50
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
    channel: 'sms' | 'whatsapp_utility' | 'whatsapp_marketing';
    category?: 'utility' | 'marketing'; // WhatsApp template category
    templateSid?: string; // Twilio Content Template SID
    triggerDays: number; // Days before/after due date (negative = before)
    sequence: number; // 1st, 2nd, 3rd reminder
    getMessage: (recipient: ReminderRecipient) => string;
    getTemplateVariables?: (recipient: ReminderRecipient) => Record<string, string>;
    costEstimate: { MY: number; PH: number }; // Accurate Twilio costs
}

// ============================================================================
// REAL TWILIO COSTS (2026)
// ============================================================================

export const TWILIO_COSTS = {
    SMS: { PH: 3.25, MY: 0.18 },              // ₱3.25 / RM0.18 per SMS
    WHATSAPP_UTILITY: { PH: 0.17, MY: 0.15 },  // ₱0.17 / RM0.15 per utility template
    WHATSAPP_MARKETING: { PH: 2.50, MY: 0.90 }, // ₱2.50 / RM0.90 per marketing template
};

const LAUNCHFLY_BOT_NUMBER = '13203627874'; // Without + prefix

// ============================================================================
// WHATSAPP UTILITY TEMPLATES (PRIMARY - CHEAPEST!)
// ============================================================================
// These must be pre-approved in Twilio Console as "UTILITY" category
// Utility = Post-purchase updates, appointment reminders, account alerts

/**
 * WhatsApp Utility: Service Due Reminder
 * Category: UTILITY (Post-purchase update for registered warranty)
 * Cost: ₱0.17 (19x cheaper than SMS!)
 * 
 * Template must be approved in Twilio Console with this exact format:
 * "Hi {{1}}! Friendly reminder from {{2}}: Your {{3}} was last serviced on {{4}}. 
 * It's now due for maintenance to keep running efficiently. Reply YES to book a slot."
 */
export const WA_UTILITY_SERVICE_DUE: ReminderTemplate = {
    id: 'wa_utility_service_due',
    name: 'WhatsApp Service Due (Utility)',
    channel: 'whatsapp_utility',
    category: 'utility',
    templateSid: process.env.TWILIO_TEMPLATE_SERVICE_DUE || '', // Set in env
    triggerDays: 0, // On due date
    sequence: 1,
    getMessage: (r) => {
        // Fallback plain text if template fails
        const lastServiceStr = r.lastServiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return `Hi ${r.customerName}! Friendly reminder from ${r.businessName}: Your ${r.applianceType || 'unit'} was last serviced on ${lastServiceStr}. It's now due for maintenance to keep running efficiently. Reply YES to book a slot.`;
    },
    getTemplateVariables: (r) => ({
        '1': r.customerName,
        '2': r.businessName,
        '3': r.applianceType || 'unit',
        '4': r.lastServiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }),
    costEstimate: TWILIO_COSTS.WHATSAPP_UTILITY,
};

/**
 * WhatsApp Utility: Service Overdue
 * Category: UTILITY (Account/service status alert)
 */
export const WA_UTILITY_SERVICE_OVERDUE: ReminderTemplate = {
    id: 'wa_utility_service_overdue',
    name: 'WhatsApp Service Overdue (Utility)',
    channel: 'whatsapp_utility',
    category: 'utility',
    templateSid: process.env.TWILIO_TEMPLATE_SERVICE_OVERDUE || '',
    triggerDays: 7, // 1 week after due
    sequence: 2,
    getMessage: (r) => {
        const daysPast = Math.abs(r.daysUntilDue);
        return `Hi ${r.customerName}, this is ${r.businessName}. Your ${r.applianceType || 'unit'} is ${daysPast} days past its recommended service date. Skipping maintenance can lead to higher electricity bills and breakdowns. Reply YES to check available slots.`;
    },
    getTemplateVariables: (r) => ({
        '1': r.customerName,
        '2': r.businessName,
        '3': r.applianceType || 'unit',
        '4': Math.abs(r.daysUntilDue).toString(),
    }),
    costEstimate: TWILIO_COSTS.WHATSAPP_UTILITY,
};

// ============================================================================
// SMS TEMPLATES (FALLBACK - When WhatsApp fails)
// ============================================================================
// Only used if customer doesn't have WhatsApp or template delivery fails

/**
 * SMS Reminder 1: Due Soon (sent 2 weeks before due date)
 * Goal: Give early heads-up, plant the seed
 * FALLBACK: Only used if WhatsApp fails
 */
export const SMS_DUE_SOON: ReminderTemplate = {
    id: 'sms_due_soon',
    name: 'SMS Service Due Soon (Fallback)',
    channel: 'sms',
    triggerDays: -14, // 14 days before due
    sequence: 1,
    getMessage: (r) => {
        const applianceText = r.applianceType || 'appliance';
        // Short SMS - nudge to WhatsApp for details
        return `Hi ${r.customerName}! Your ${applianceText} due for service in 2 wks. Book early: wa.me/${LAUNCHFLY_BOT_NUMBER} - ${r.businessName}`;
    },
    costEstimate: TWILIO_COSTS.SMS, // ₱3.25 / RM0.18
};

/**
 * SMS Reminder 2: Due Now (sent on due date)
 * Goal: Direct call-to-action
 * FALLBACK: Only used if WhatsApp fails
 */
export const SMS_DUE_NOW: ReminderTemplate = {
    id: 'sms_due_now',
    name: 'SMS Service Due Now (Fallback)',
    channel: 'sms',
    triggerDays: 0, // On due date
    sequence: 2,
    getMessage: (r) => {
        return `${r.customerName}, ${r.applianceType || 'service'} maintenance due! Keep it efficient. Book: wa.me/${LAUNCHFLY_BOT_NUMBER} - ${r.businessName}`;
    },
    costEstimate: TWILIO_COSTS.SMS,
};

/**
 * SMS Reminder 3: Overdue (sent 1 week after due date)
 * Goal: Urgency + social proof
 * FALLBACK: Only used if WhatsApp fails
 */
export const SMS_OVERDUE: ReminderTemplate = {
    id: 'sms_overdue',
    name: 'SMS Service Overdue (Fallback)',
    channel: 'sms',
    triggerDays: 7, // 7 days after due
    sequence: 3,
    getMessage: (r) => {
        return `${r.customerName}, ${r.applianceType || 'service'} ${Math.abs(r.daysUntilDue)} days overdue. Don't wait for problems! wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: TWILIO_COSTS.SMS,
};

/**
 * SMS Reminder 4: Final Notice (sent 2 weeks after due date)
 * Goal: Last attempt before going silent
 * FALLBACK: Only used if WhatsApp fails
 */
export const SMS_FINAL_NOTICE: ReminderTemplate = {
    id: 'sms_final_notice',
    name: 'SMS Final Reminder (Fallback)',
    channel: 'sms',
    triggerDays: 14, // 14 days after due
    sequence: 4,
    getMessage: (r) => {
        return `Last notice: ${r.customerName}, skipping maintenance = costly repairs. ${r.businessName}: wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: TWILIO_COSTS.SMS,
};

/**
 * SMS: Warranty Expiring (sent 7 days before warranty expires)
 * Goal: Upsell service before warranty ends
 */
export const SMS_WARRANTY_EXPIRING: ReminderTemplate = {
    id: 'sms_warranty_expiring',
    name: 'SMS Warranty Expiring',
    channel: 'sms',
    triggerDays: -7, // 7 days before warranty expires
    sequence: 1,
    getMessage: (r) => {
        return `${r.customerName}, your ${r.businessName} warranty expires in 7 days. Issues? wa.me/${LAUNCHFLY_BOT_NUMBER}`;
    },
    costEstimate: TWILIO_COSTS.SMS,
};

// ============================================================================
// WHATSAPP MARKETING TEMPLATES (For promos - use sparingly)
// ============================================================================
// More expensive but higher engagement for special offers

/**
 * WhatsApp Marketing: Promotional Offer
 * Category: MARKETING (Promotions, discounts)
 * Cost: ₱2.50 / RM0.90 - use sparingly!
 */
export const WA_MARKETING_PROMO: ReminderTemplate = {
    id: 'wa_marketing_promo',
    name: 'WhatsApp Promo (Marketing)',
    channel: 'whatsapp_marketing',
    category: 'marketing',
    templateSid: process.env.TWILIO_TEMPLATE_PROMO || '',
    triggerDays: 0,
    sequence: 1,
    getMessage: (r) => {
        return `Hi ${r.customerName}! 🎉 Special offer from ${r.businessName}: Book your ${r.applianceType || 'service'} this week and get 10% OFF! Reply YES to claim.`;
    },
    getTemplateVariables: (r) => ({
        '1': r.customerName,
        '2': r.businessName,
        '3': r.applianceType || 'service',
    }),
    costEstimate: TWILIO_COSTS.WHATSAPP_MARKETING,
};

// ============================================================================
// ALL TEMPLATES (for iteration)
// ============================================================================

export const ALL_REMINDER_TEMPLATES: ReminderTemplate[] = [
    // WhatsApp Utility (PRIMARY - Cheapest!)
    WA_UTILITY_SERVICE_DUE,
    WA_UTILITY_SERVICE_OVERDUE,
    // SMS (FALLBACK - Expensive but works without WhatsApp)
    SMS_DUE_SOON,
    SMS_DUE_NOW,
    SMS_OVERDUE,
    SMS_FINAL_NOTICE,
    SMS_WARRANTY_EXPIRING,
    // WhatsApp Marketing (Promos only)
    WA_MARKETING_PROMO,
];

// ============================================================================
// WATERFALL STRATEGY: WhatsApp Template → SMS Fallback
// ============================================================================

export interface WaterfallResult {
    primary: ReminderTemplate;
    fallback: ReminderTemplate | null;
    estimatedCost: { MY: number; PH: number };
}

/**
 * Get templates using waterfall strategy:
 * 1. Try WhatsApp Utility first (₱0.17)
 * 2. Fall back to SMS if needed (₱3.25)
 */
export function getWaterfallTemplates(
    daysUntilDue: number,
    reminderCount: number
): WaterfallResult | null {
    const sequence = reminderCount + 1;
    
    // Sequence 1: Due Soon or On Due Date
    if (sequence === 1 && daysUntilDue <= 14 && daysUntilDue > -7) {
        return {
            primary: WA_UTILITY_SERVICE_DUE,
            fallback: daysUntilDue > 0 ? SMS_DUE_SOON : SMS_DUE_NOW,
            estimatedCost: WA_UTILITY_SERVICE_DUE.costEstimate,
        };
    }
    
    // Sequence 2: Overdue (1 week)
    if (sequence === 2 && daysUntilDue <= -7 && daysUntilDue > -14) {
        return {
            primary: WA_UTILITY_SERVICE_OVERDUE,
            fallback: SMS_OVERDUE,
            estimatedCost: WA_UTILITY_SERVICE_OVERDUE.costEstimate,
        };
    }
    
    // Sequence 3: Very Overdue (2 weeks) - SMS only
    if (sequence === 3 && daysUntilDue <= -14) {
        return {
            primary: SMS_FINAL_NOTICE,
            fallback: null,
            estimatedCost: SMS_FINAL_NOTICE.costEstimate,
        };
    }
    
    return null; // Max reminders reached
}

/**
 * Get the appropriate template based on days until due and sequence
 * DEPRECATED: Use getWaterfallTemplates() instead for cost optimization
 */
export function getApplicableTemplate(
    daysUntilDue: number,
    reminderCount: number,
    preference: 'sms' | 'whatsapp' | 'both'
): ReminderTemplate | null {
    // Use waterfall for best cost optimization
    const waterfall = getWaterfallTemplates(daysUntilDue, reminderCount);
    
    if (!waterfall) return null;
    
    // If preference is SMS-only, return fallback (or primary if it's SMS)
    if (preference === 'sms') {
        return waterfall.fallback || waterfall.primary;
    }
    
    // Default: return primary (WhatsApp if available)
    return waterfall.primary;
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
