/**
 * WhatsApp Templates Library
 * 
 * Pre-approved message templates to prevent WhatsApp Business API bans.
 * These are designed to be safe, non-spammy, and effective.
 */

// Template categories for organization
export type TemplateCategory =
    | 'lead_notification'
    | 'auto_reply'
    | 'follow_up'
    | 'reengagement'
    | 'confirmation';

export interface WhatsAppTemplate {
    id: string;
    name: string;
    category: TemplateCategory;
    message: string;
    description: string;
    cooldownHours?: number; // Min hours between sends to same person
    riskLevel: 'low' | 'medium' | 'high'; // Ban risk level
}

// Lead notification templates (sent to business owner, not customer)
export const LEAD_NOTIFICATION_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'lead_new_standard',
        name: 'New Lead Alert',
        category: 'lead_notification',
        message: `🔔 New Lead!

Name: {{name}}
Phone: {{phone}}
Service: {{service}}
{{message}}

👉 Reply now: {{waLink}}`,
        description: 'Standard notification when new lead comes in',
        riskLevel: 'low'
    },
    {
        id: 'lead_new_urgent',
        name: 'Urgent Lead Alert',
        category: 'lead_notification',
        message: `🚨 HOT LEAD!

{{name}} just requested {{service}}!
📞 {{phone}}

Fast reply = higher close rate!
👉 {{waLink}}`,
        description: 'Urgent tone for immediate action',
        riskLevel: 'low'
    }
];

// Auto-reply templates (sent to customer automatically)
export const AUTO_REPLY_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'auto_greeting',
        name: 'Greeting',
        category: 'auto_reply',
        message: `Hi! Thanks for reaching out to {{business_name}} 👋

We usually reply within 15 minutes. In the meantime, could you share:
1. What service you need?
2. Your location/area?

We'll get back to you ASAP! 🙏`,
        description: 'Initial greeting when customer contacts',
        riskLevel: 'low'
    },
    {
        id: 'auto_after_hours',
        name: 'After Hours',
        category: 'auto_reply',
        message: `Hi! Thanks for contacting {{business_name}} 👋

We're currently closed but will reply first thing tomorrow morning.

If urgent, please describe your issue and we'll prioritize your message!

Business hours: 9am - 6pm`,
        description: 'After hours auto-response',
        riskLevel: 'low'
    },
    {
        id: 'auto_lead_magnet',
        name: 'Lead Magnet Delivery',
        category: 'auto_reply',
        message: `Thanks for requesting our free guide! 📋

Here's your download link:
{{download_link}}

If you have any questions or need help, just reply to this message!

- {{business_name}}`,
        description: 'Deliver lead magnet with download link',
        riskLevel: 'low'
    }
];

// Follow-up templates (sent after initial contact)
export const FOLLOW_UP_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'followup_24h',
        name: '24 Hour Follow-up',
        category: 'follow_up',
        message: `Hi {{name}}! 👋

Just checking in - still need help with {{service}}?

We have availability today/tomorrow if you'd like to book 👍`,
        description: '24-hour follow-up for unresponded leads',
        cooldownHours: 24,
        riskLevel: 'low'
    },
    {
        id: 'followup_preview_viewed',
        name: 'Preview Viewed',
        category: 'follow_up',
        message: `Hey {{name}}! 👋

Saw you checked out the page I made for you - any thoughts?

Happy to adjust it based on your feedback 👍`,
        description: 'Follow up when they viewed the preview',
        cooldownHours: 4,
        riskLevel: 'low'
    },
    {
        id: 'followup_soft_close',
        name: 'Soft Close',
        category: 'follow_up',
        message: `Hi {{name}},

Just a quick check-in - are you still interested or should I stop following up?

Either way is fine, just want to respect your time 👍`,
        description: 'Final polite follow-up',
        cooldownHours: 48,
        riskLevel: 'low'
    },
    {
        id: 'followup_quote_sent',
        name: 'Quote Follow-up',
        category: 'follow_up',
        message: `Hi {{name}}! 👋

Did you get a chance to review the quote I sent?

Let me know if you have any questions or need adjustments.`,
        description: 'After sending a quote',
        cooldownHours: 24,
        riskLevel: 'low'
    }
];

// Re-engagement / Blast templates (for past leads)
export const REENGAGEMENT_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'blast_seasonal',
        name: 'Seasonal Promo',
        category: 'reengagement',
        message: `Hi {{name}}! 👋

Just a heads up - we're running a special this week for returning customers!

{{promo_details}}

Interested? Reply "YES" and I'll send details.`,
        description: 'Seasonal promotion to past leads',
        cooldownHours: 168, // 1 week minimum
        riskLevel: 'medium'
    },
    {
        id: 'blast_reminder',
        name: 'Service Reminder',
        category: 'reengagement',
        message: `Hi {{name}}! 👋

It's been a while since we connected. Hope all is well!

If you ever need {{service}} again, just drop me a message 👍

- {{business_name}}`,
        description: 'Friendly reminder to past customers',
        cooldownHours: 720, // 30 days minimum
        riskLevel: 'low'
    },
    {
        id: 'blast_checkin',
        name: 'Check-in',
        category: 'reengagement',
        message: `Hi {{name}}! 👋

Just checking in - how's everything going since our last service?

If you need any maintenance or have questions, I'm here!

- {{business_name}}`,
        description: 'Post-service check-in',
        cooldownHours: 336, // 2 weeks minimum
        riskLevel: 'low'
    }
];

// Confirmation templates
export const CONFIRMATION_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'confirm_booking',
        name: 'Booking Confirmation',
        category: 'confirmation',
        message: `✅ Booking Confirmed!

Service: {{service}}
Date: {{date}}
Time: {{time}}
Location: {{address}}

We'll send a reminder before arrival. Save this message!

Questions? Just reply here.`,
        description: 'After booking is confirmed',
        riskLevel: 'low'
    },
    {
        id: 'confirm_quote',
        name: 'Quote Sent',
        category: 'confirmation',
        message: `Here's your quote for {{service}}:

{{quote_details}}

Total: {{total}}

This quote is valid for 7 days. Reply "CONFIRM" to proceed!`,
        description: 'Send quote to customer',
        riskLevel: 'low'
    }
];

// Export all templates
export const ALL_TEMPLATES = {
    lead_notification: LEAD_NOTIFICATION_TEMPLATES,
    auto_reply: AUTO_REPLY_TEMPLATES,
    follow_up: FOLLOW_UP_TEMPLATES,
    reengagement: REENGAGEMENT_TEMPLATES,
    confirmation: CONFIRMATION_TEMPLATES
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): WhatsAppTemplate | undefined {
    for (const category of Object.values(ALL_TEMPLATES)) {
        const found = category.find(t => t.id === templateId);
        if (found) return found;
    }
    return undefined;
}

/**
 * Fill template with data
 */
export function fillWhatsAppTemplate(
    template: WhatsAppTemplate,
    data: Record<string, string>
): string {
    let result = template.message;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

/**
 * Check if it's safe to send (respects cooldown)
 */
export function canSendTemplate(
    template: WhatsAppTemplate,
    lastSentAt?: Date
): boolean {
    if (!template.cooldownHours || !lastSentAt) return true;

    const hoursSince = (Date.now() - lastSentAt.getTime()) / (1000 * 60 * 60);
    return hoursSince >= template.cooldownHours;
}

/**
 * Get templates safe for automated sending (low risk only)
 */
export function getSafeTemplates(): WhatsAppTemplate[] {
    return Object.values(ALL_TEMPLATES)
        .flat()
        .filter(t => t.riskLevel === 'low');
}

/**
 * Generate WhatsApp link with pre-filled message
 */
export function generateWhatsAppLink(
    phone: string,
    message: string
): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}
