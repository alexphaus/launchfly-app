/**
 * Warranty Flow Templates
 * 
 * Handles the "Forever Customer" lifecycle management flow:
 * 1. Tech Registration: Tech scans sticker to register completed service
 * 2. Customer Warranty Activation: Customer scans to activate warranty
 * 3. Returning Customer Recognition: Personalized greetings for repeat customers
 */

import { getFlowConfig, type StickerFlowConfig } from './sticker-flow-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceRecord {
    id?: string;
    businessId: string;
    customerId: string;
    serviceType: 'cleaning' | 'repair' | 'installation' | 'maintenance' | 'inspection';
    serviceName?: string;
    applianceType?: string;
    unitsServiced?: number;
    amount?: number;
    currency?: string;
    address?: string;
    buildingName?: string;
    warrantyDays?: number;
    serviceIntervalDays?: number;
    registeredVia: 'sticker_scan' | 'tech_register' | 'manual' | 'import' | 'booking_complete';
    serviceDate?: Date;
}

export interface CustomerServiceHistory {
    customerId: string;
    customerName: string;
    totalServices: number;
    lastServiceDate?: Date;
    nextDueDate?: Date;
    services: {
        id: string;
        serviceDate: Date;
        serviceName: string;
        applianceType?: string;
        warrantyActive: boolean;
        warrantyExpiresAt?: Date;
    }[];
}

export interface ReminderContext {
    customerName: string;
    applianceType: string;
    serviceName: string;
    lastServiceDate: Date;
    businessName: string;
    businessPhone: string;
    daysOverdue?: number;
}

// ============================================================================
// TECH REGISTRATION FLOW
// ============================================================================
// When tech scans sticker themselves to register a completed service

/**
 * Detect if message is a tech registration trigger
 * Format: REGISTER_SERVICE [BIZ:uuid] or just REGISTER [BIZ:uuid]
 */
export function isTechRegistrationTrigger(message: string): boolean {
    const normalized = message.toUpperCase().trim();
    return normalized.startsWith('REGISTER_SERVICE') || 
           normalized.startsWith('REGISTER SERVICE') ||
           (normalized.startsWith('REGISTER') && normalized.includes('[BIZ:'));
}

/**
 * Generate tech registration prompt
 */
export function generateTechRegistrationPrompt(businessName: string): string {
    return `✅ *Service Registration Mode*

Registering completed job for *${businessName}*.

Please enter the *Customer's Phone Number* (e.g., +60123456789):`;
}

/**
 * Generate tech registration confirmation
 */
export function generateTechRegistrationConfirmation(params: {
    customerPhone: string;
    serviceName: string;
    warrantyDays: number;
    warrantyExpiresAt: string;
    nextReminderDate: string;
}): string {
    return `✅ *Service Registered Successfully!*

📱 *Customer:* ${params.customerPhone}
🛠️ *Service:* ${params.serviceName}
🛡️ *Warranty:* ${params.warrantyDays} days (expires ${params.warrantyExpiresAt})
📅 *Auto-Reminder:* Scheduled for ${params.nextReminderDate}

The customer will receive an automatic reminder when service is due. 🔄`;
}

/**
 * Generate prompt asking for service details
 */
export function generateServiceDetailsPrompt(config: StickerFlowConfig): string {
    return `What type of service was completed?

1️⃣ ${config.cleaningLabel.replace(/[^\w\s]/g, '').trim()}
2️⃣ ${config.repairLabel.replace(/[^\w\s]/g, '').trim()}
3️⃣ Other

Reply with 1, 2, or 3:`;
}

// ============================================================================
// CUSTOMER WARRANTY ACTIVATION FLOW
// ============================================================================
// When customer scans sticker to activate warranty

/**
 * Detect if message is a warranty activation trigger
 */
export function isWarrantyActivationTrigger(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return normalized.includes('warranty') || 
           normalized.includes('activate') ||
           normalized.includes('register warranty');
}

/**
 * Generate warranty activation prompt for NEW customer
 */
export function generateWarrantyActivationPrompt(businessName: string): string {
    return `🛡️ *Warranty Activation*

Thanks for using *${businessName}*!

To activate your *30-Day Service Warranty*, please reply with your *Full Name*:`;
}

/**
 * Generate warranty activation confirmation
 */
export function generateWarrantyConfirmation(params: {
    customerName: string;
    serviceName: string;
    warrantyDays: number;
    warrantyExpiresAt: string;
    businessName: string;
}): string {
    return `✅ *Warranty Activated!*

👤 *Name:* ${params.customerName}
🛠️ *Service:* ${params.serviceName}
🛡️ *Coverage:* ${params.warrantyDays} days
📅 *Valid Until:* ${params.warrantyExpiresAt}

If you experience any issues within the warranty period, just scan this sticker again or message us here.

Thanks for choosing *${params.businessName}*! 🙏`;
}

// ============================================================================
// CUSTOMER SELF-ACTIVATION FLOW
// ============================================================================
// When customer scans sticker directly (tech didn't register)

/**
 * Generate warranty activation offer for new customer scan
 * Gives customer choice to activate warranty or just book
 */
export function generateWarrantyOffer(params: {
    businessName: string;
    cleaningLabel: string;
    repairLabel: string;
    priceLabel: string;
}): string {
    return `Hi there! 👋
Thanks for scanning the service sticker from *${params.businessName}*.

Did you just have a service completed? 🛠️

1️⃣ ✅ Yes - Activate my warranty
2️⃣ ${params.cleaningLabel}
3️⃣ ${params.repairLabel}
4️⃣ ${params.priceLabel}

Reply with 1, 2, 3, or 4`;
}

/**
 * Generate service type selection for customer self-activation
 */
export function generateCustomerServiceTypePrompt(config: { 
    cleaningLabel: string; 
    repairLabel: string; 
}): string {
    return `Welcome to the *Warranty Registration Center* 🛡️

To activate your warranty, please tell us:
*What service was just completed?*

1️⃣ ${config.cleaningLabel.replace(/[^\w\s\/]/g, '').trim()}
2️⃣ ${config.repairLabel.replace(/[^\w\s\/]/g, '').trim()}
3️⃣ Other service

Reply with 1, 2, or 3:`;
}

/**
 * Generate name capture prompt (Golden Flow Step 2)
 */
export function generateNameCapturePrompt(params: {
    serviceName: string;
    businessName: string;
}): string {
    return `✅ Registering: *${params.serviceName}*
Provider: *${params.businessName}*

To complete your warranty activation, please reply with your *FULL NAME*:`;
}

/**
 * Detect if customer wants warranty activation
 */
export function isWarrantyActivationChoice(message: string): boolean {
    const cleaned = message.trim().toLowerCase();
    return cleaned === '1' || 
           cleaned.includes('yes') || 
           cleaned.includes('warranty') ||
           cleaned.includes('activate');
}

// ============================================================================
// RETURNING CUSTOMER FLOW
// ============================================================================
// Personalized experience for customers who have service history

/**
 * Generate VIP greeting for returning customer
 */
export function generateReturningCustomerGreeting(
    history: CustomerServiceHistory, 
    businessName: string,
    flowConfig?: { cleaningLabel: string; repairLabel: string; priceLabel: string }
): string {
    const lastService = history.services[0];
    const lastServiceDateStr = lastService?.serviceDate
        ? new Date(lastService.serviceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'recently';

    // Check if warranty is active
    const warrantyActive = lastService?.warrantyActive;
    const warrantyExpiry = lastService?.warrantyExpiresAt
        ? new Date(lastService.warrantyExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : null;
    
    const warrantyLine = warrantyActive && warrantyExpiry
        ? `🛡️ Warranty: *Active until ${warrantyExpiry}*`
        : '🛡️ Warranty: Expired';

    // Default menu options if flowConfig not provided
    const option1 = flowConfig?.cleaningLabel || 'Book Cleaning 💨';
    const option2 = flowConfig?.repairLabel || 'Not Cooling / Repair 🔧';
    const option3 = flowConfig?.priceLabel || 'Check Price 💰';

    // Name handling - use first name or "there"
    const displayName = history.customerName && history.customerName !== 'there' 
        ? history.customerName.split(' ')[0] 
        : '';
    const nameGreeting = displayName ? `, *${displayName}*` : '';

    return `Welcome back${nameGreeting}! 👋

📋 *Your Record with ${businessName}:*
• Last: ${lastService?.serviceName || 'Service'} (${lastServiceDateStr})
${warrantyLine}

What do you need help with today?

1️⃣ ${option1}
2️⃣ ${option2}
3️⃣ ${option3}

Reply with 1, 2, or 3`;
}

/**
 * Generate service history message
 */
export function generateServiceHistoryMessage(history: CustomerServiceHistory): string {
    if (history.services.length === 0) {
        return `📋 *Service History*\n\nNo services recorded yet.`;
    }

    const serviceLines = history.services.slice(0, 5).map((s, i) => {
        const date = new Date(s.serviceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const warranty = s.warrantyActive ? '🛡️' : '⏱️';
        return `${i + 1}. ${s.serviceName || 'Service'} - ${date} ${warranty}`;
    });

    let message = `📋 *Service History for ${history.customerName}*\n\n`;
    message += serviceLines.join('\n');
    
    if (history.nextDueDate) {
        const dueDate = new Date(history.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        message += `\n\n⏰ *Next Service Due:* ${dueDate}`;
    }

    message += '\n\nReply "BOOK" to schedule your next service!';
    
    return message;
}

/**
 * Check if customer is due for service reminder
 */
export function isServiceDueSoon(nextDueDate: Date | null, daysThreshold: number = 14): boolean {
    if (!nextDueDate) return false;
    const now = new Date();
    const dueDate = new Date(nextDueDate);
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= daysThreshold;
}

/**
 * Generate "service due soon" nudge for returning customer
 */
export function generateServiceDueNudge(params: {
    customerName: string;
    applianceType: string;
    daysToDue: number;
    lastServiceDate: string;
}): string {
    const urgency = params.daysToDue <= 0 
        ? "⚠️ *Your service is OVERDUE!*"
        : params.daysToDue <= 7 
            ? "⏰ *Your service is due THIS WEEK!*"
            : `📅 Your service is due in ${params.daysToDue} days`;

    return `Hi ${params.customerName}! 👋

${urgency}

Your ${params.applianceType || 'appliance'} was last serviced on ${params.lastServiceDate}. Regular maintenance keeps it running efficiently and saves electricity! ⚡

Ready to book? Reply "YES" and I'll show you available slots.`;
}

// ============================================================================
// SMS REMINDER TEMPLATES
// ============================================================================
// Used by the Smart Nag cron job - sent via SMS to avoid WhatsApp template costs

/**
 * Generate SMS reminder message (main reminder at ~5.5 months)
 */
export function generateSmsReminder(context: ReminderContext): string {
    const applianceText = context.applianceType || 'appliance';
    
    return `Hi ${context.customerName}! Your ${applianceText} is due for ${context.serviceName}. Book now for efficient performance! Reply 'Hi' on WhatsApp: wa.me/${context.businessPhone} - ${context.businessName}`;
}

/**
 * Generate SMS follow-up (if first reminder not actioned)
 */
export function generateSmsFollowUp(context: ReminderContext): string {
    return `Reminder: ${context.customerName}, your ${context.applianceType || 'service'} maintenance is ${context.daysOverdue && context.daysOverdue > 0 ? context.daysOverdue + ' days overdue' : 'due now'}. Book today: wa.me/${context.businessPhone}`;
}

/**
 * Generate SMS warranty expiry warning
 */
export function generateSmsWarrantyExpiring(params: {
    customerName: string;
    daysUntilExpiry: number;
    businessName: string;
    businessPhone: string;
}): string {
    return `Hi ${params.customerName}! Your ${params.businessName} service warranty expires in ${params.daysUntilExpiry} days. Questions? Reply on WhatsApp: wa.me/${params.businessPhone}`;
}

// ============================================================================
// REFERRAL FLOW
// ============================================================================
// Refer-a-neighbor program for viral growth

/**
 * Generate referral code for customer
 */
export function generateReferralCode(customerId: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing chars
    const shortId = customerId.replace(/-/g, '').substring(0, 4).toUpperCase();
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REF${shortId}${randomPart}`;
}

/**
 * Generate referral message to send 24h after service
 */
export function generateReferralMessage(params: {
    customerName: string;
    referralCode: string;
    discountPercent: number;
    businessName: string;
    referralLink: string;
}): string {
    return `Hi ${params.customerName}! 👋

Thanks for choosing *${params.businessName}*! We hope you're happy with the service.

🎁 *Share with your neighbors!*
Give them ${params.discountPercent}% off their first service, and you'll get ${params.discountPercent}% off your next one too!

Your referral code: *${params.referralCode}*
Share this link: ${params.referralLink}

The more neighbors you refer, the more you save! 🏠`;
}

/**
 * Generate welcome message for referred customer
 */
export function generateReferredCustomerWelcome(params: {
    referrerName: string;
    discountPercent: number;
    businessName: string;
}): string {
    return `Welcome! 🎉

You've been referred by *${params.referrerName}*!

As a thank-you, enjoy *${params.discountPercent}% OFF* your first service with *${params.businessName}*.

Reply with what you need, and I'll get you booked! 📅`;
}

// ============================================================================
// CONVERSATION STATE DETECTION
// ============================================================================

export type WarrantyFlowState = 
    | 'tech_registering'       // Tech is registering a service
    | 'tech_awaiting_phone'    // Waiting for customer phone from tech
    | 'tech_awaiting_service'  // Waiting for service type selection
    | 'warranty_activating'    // Customer activating warranty
    | 'warranty_awaiting_name' // Waiting for customer name
    | 'returning_menu'         // Showing returning customer menu
    | 'viewing_history'        // Customer viewing service history
    | null;

/**
 * Detect current warranty flow state from customer notes
 */
export function detectWarrantyFlowState(notes: string | null): WarrantyFlowState {
    if (!notes) return null;
    
    if (notes.includes('[TECH_REGISTERING]')) return 'tech_registering';
    if (notes.includes('[TECH_AWAITING_PHONE]')) return 'tech_awaiting_phone';
    if (notes.includes('[TECH_AWAITING_SERVICE]')) return 'tech_awaiting_service';
    if (notes.includes('[WARRANTY_ACTIVATING]')) return 'warranty_activating';
    if (notes.includes('[WARRANTY_AWAITING_NAME]')) return 'warranty_awaiting_name';
    if (notes.includes('[RETURNING_MENU]')) return 'returning_menu';
    if (notes.includes('[VIEWING_HISTORY]')) return 'viewing_history';
    
    return null;
}

/**
 * Generate state tag for customer notes
 */
export function generateStateTag(state: WarrantyFlowState): string {
    return state ? `[${state.toUpperCase()}]` : '';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate next service due date
 */
export function calculateNextServiceDue(serviceDate: Date, intervalDays: number = 180): Date {
    const dueDate = new Date(serviceDate);
    dueDate.setDate(dueDate.getDate() + intervalDays);
    return dueDate;
}

/**
 * Calculate warranty expiry date
 */
export function calculateWarrantyExpiry(serviceDate: Date, warrantyDays: number = 30): Date {
    const expiryDate = new Date(serviceDate);
    expiryDate.setDate(expiryDate.getDate() + warrantyDays);
    return expiryDate;
}

/**
 * Format date for display in SEA region
 */
export function formatDateSEA(date: Date): string {
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Get default service interval based on service type
 */
export function getDefaultServiceInterval(serviceType: string): number {
    switch (serviceType.toLowerCase()) {
        case 'cleaning':
        case 'maintenance':
            return 180; // 6 months
        case 'installation':
            return 365; // 1 year checkup
        case 'repair':
            return 90;  // 3 month follow-up
        default:
            return 180;
    }
}

/**
 * Get default warranty days based on service type
 */
export function getDefaultWarrantyDays(serviceType: string): number {
    switch (serviceType.toLowerCase()) {
        case 'cleaning':
        case 'maintenance':
            return 30;
        case 'installation':
            return 90;
        case 'repair':
            return 30;
        default:
            return 30;
    }
}

// ============================================================================
// FEEDBACK & REVIEW FLOW
// ============================================================================
// Post-service feedback collection with Google Review redirect

/**
 * Generate feedback request after warranty activation
 * Sent to customer after tech registers the service
 * Uses "validate workmanship" framing from Golden Flow
 */
export function generateFeedbackRequest(params: {
    customerName: string;
    serviceName: string;
    businessName: string;
    warrantyDays?: number;
    warrantyExpires?: string;
    nextServiceDue?: string;
    feedbackUrl?: string; // URL to web feedback page
}): string {
    const name = params.customerName?.split(' ')[0] || '';
    const greeting = name ? `Thanks, ${name}! ` : '';
    
    // Build warranty details section
    let warrantyInfo = '';
    if (params.warrantyDays && params.warrantyExpires) {
        warrantyInfo = `\n🛡️ *Coverage:* ${params.warrantyDays} Days (Workmanship)\n📅 *Valid Until:* ${params.warrantyExpires}`;
    }
    if (params.nextServiceDue) {
        warrantyInfo += `\n🔔 *Next Service Due:* ${params.nextServiceDue}`;
    }
    
    return `${greeting}✅ *Warranty ACTIVATED!*
${warrantyInfo}

_One final step to validate the workmanship:_
*How would you rate the service today?*

1️⃣ ⭐ *Excellent* - Loved it!
2️⃣ 👍 *Good* - Satisfied
3️⃣ 👎 *Not Good* - Had issues

Reply 1, 2, or 3:`;
}

/**
 * Detect feedback rating from message
 * Returns rating 1-3 or null if not a rating
 * Golden Flow: 1=Excellent, 2=Good, 3=Not Good
 */
export function detectFeedbackRating(message: string): number | null {
    const cleaned = message.trim().toLowerCase();
    
    // Direct number (1-3 scale now)
    if (['1', '2', '3'].includes(cleaned)) {
        return parseInt(cleaned);
    }
    
    // Legacy support for '4' -> map to 3 (Not Good)
    if (cleaned === '4') {
        return 3;
    }
    
    // Keywords
    if (cleaned.includes('excellent') || cleaned.includes('loved') || cleaned.includes('amazing') || cleaned.includes('great') || cleaned.includes('perfect')) {
        return 1; // Excellent
    }
    if (cleaned.includes('good') || cleaned.includes('satisfied') || cleaned.includes('nice') || cleaned.includes('okay') || cleaned.includes('ok')) {
        return 2; // Good
    }
    if (cleaned.includes('not good') || cleaned.includes('bad') || cleaned.includes('issue') || cleaned.includes('problem') || cleaned.includes('poor') || cleaned.includes('terrible') || cleaned.includes('awful')) {
        return 3; // Not Good
    }
    
    return null;
}

/**
 * Generate response based on feedback rating
 */
export function generateFeedbackResponse(params: {
    rating: number;
    businessName: string;
    googleReviewLink?: string;
    ownerWhatsApp?: string;
}): string {
    const reviewLink = params.googleReviewLink || 'https://g.page/review'; // Fallback
    
    if (params.rating <= 2) {
        // Positive feedback (1 = Excellent, 2 = Good)
        return `🌟 *Awesome!* We're so glad you had a great experience!

To finalize your warranty, please tap the link below and share your rating on Google Maps - it helps *${params.businessName}* a lot!

👉 ${reviewLink}

_Reply 'DONE' when finished._

You don't need to remember your next service date - we'll send you a reminder automatically when it's time! 🔔`;
    } else {
        // Negative feedback (3 = Not Good)
        return `😔 We're sorry to hear that.

Your feedback is *private* and won't be posted publicly. Please tell us what went wrong so we can fix it immediately:

_(Just type your concern below)_`;
    }
}

/**
 * Generate alert to tech/owner about negative feedback
 */
export function generateServiceRecoveryAlert(params: {
    customerName: string;
    customerPhone: string;
    rating: number;
    serviceName: string;
    serviceDate?: string;
    complaint?: string;
}): string {
    const ratingEmoji = params.rating === 3 ? '😐' : '👎';
    const urgency = params.rating === 4 ? '🚨 URGENT' : '⚠️ ATTENTION';
    
    return `${urgency} *Service Recovery Needed*

${ratingEmoji} Customer rated *${params.rating}/4*

👤 *Customer:* ${params.customerName}
📱 *Phone:* ${params.customerPhone}
🛠️ *Service:* ${params.serviceName}${params.serviceDate ? `\n📅 *Date:* ${params.serviceDate}` : ''}${params.complaint ? `\n\n💬 *Feedback:*\n"${params.complaint}"` : ''}

👉 *Tap to message customer now:*
https://wa.me/${params.customerPhone.replace(/[^\d]/g, '')}

_Quick response = happy customer = saved review!_`;
}

/**
 * Generate thank you after complaint is logged
 */
export function generateComplaintAcknowledgment(businessName: string, ownerName?: string): string {
    const name = ownerName || 'our team';
    return `✅ *Feedback Received*

Thank you for letting us know. ${name} from *${businessName}* will review this personally and get back to you soon.

We appreciate you giving us the chance to make things right! 🙏`;
}

/**
 * Check if customer is in feedback flow
 */
export function isFeedbackFlowStatus(status: string): boolean {
    return ['feedback_pending', 'feedback_negative', 'complaint_pending'].includes(status);
}
