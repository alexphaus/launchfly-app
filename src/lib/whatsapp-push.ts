import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER; // Must be a WhatsApp enabled number like 'whatsapp:+14155238886'

let client: any = null;

if (accountSid && authToken) {
    try {
        client = twilio(accountSid, authToken);
    } catch (err) {
        console.error('Failed to initialize Twilio client:', err);
    }
}

interface LeadData {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    businessName: string;
    subdomain?: string;
}

export async function sendLeadNotification(ownerPhone: string, lead: LeadData) {
    if (!ownerPhone) {
        console.warn('⚠️ No owner phone provided for notification');
        return false;
    }

    // Sanitize phone number to E.164 format roughly
    const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    const messageBody = `🔔 *New Lead Alert for ${lead.businessName}*\n\n` +
        `👤 *Name:* ${lead.name || 'N/A'}\n` +
        `📧 *Email:* ${lead.email || 'N/A'}\n` +
        `📱 *Phone:* ${lead.phone || 'N/A'}\n` +
        (lead.message ? `📝 *Msg:* ${lead.message}\n` : '') +
        `\nReply to this lead now!`;

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`✅ WhatsApp sent to ${recipient}: ${message.sid}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log('⚠️ Twilio credentials missing. MOCKING SEND:');
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            // Simulate success for dev
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending WhatsApp notification:', error);
        return false;
    }
}
export async function sendJobCard(ownerPhone: string, job: {
    id: string;
    serviceName: string;
    serviceEmoji?: string;
    customerName: string;
    customerPhone: string;
    estimate: { min: number; max: number; currency: string };
    answers: Record<string, string | number>;
    businessName: string;
    businessId?: string; // For dashboard link
}) {
    if (!ownerPhone) {
        console.warn('⚠️ No owner phone provided for job card');
        return false;
    }

    const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    // Format Q&A pairs (truncate for safety)
    const details = job.answers
        ? Object.entries(job.answers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
            .substring(0, 50)
        : 'No additional details';

    // Clean customer phone for wa.me link (remove + and spaces)
    const customerPhoneClean = job.customerPhone.replace(/[^\d]/g, '');

    // Content Template SID for Job Card with URL buttons
    // Template should have: "📞 Call Customer" → wa.me/{{8}} and "📋 View Dashboard" → app.launchfly.ai/command/{{9}}
    // Variables: 1=ID, 2=Emoji, 3=ServiceName, 4=CustomerName, 5=Phone, 6=Estimate, 7=Details, 8=CustomerPhoneClean, 9=BusinessId
    const JOB_CARD_TEMPLATE_SID = process.env.TWILIO_JOB_CARD_TEMPLATE_SID || 'HX1a609be111ce4713fe3ac8b9eb024b1b';

    // Fallback plain text body (for mock mode)
    const messageBody = `🆕 *NEW JOB REQUEST #${job.id}*\n\n` +
        `${job.serviceEmoji || '🔧'} *${job.serviceName}*\n` +
        `👤 ${job.customerName}\n` +
        `📞 ${job.customerPhone}\n` +
        `💰 *Est:* ${job.estimate.currency} ${job.estimate.min} - ${job.estimate.max}\n\n` +
        `📋 *Details:* ${details}\n\n` +
        `Customer will self-book. You'll be notified when confirmed! 🎯`;

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                contentSid: JOB_CARD_TEMPLATE_SID,
                // NEW LEAD ALERT template: {{1}}=ID, {{2}}=Emoji, {{3}}=Service, {{4}}=Price, {{5}}=CustomerName, {{6}}=Phone, {{7}}=BusinessId
                contentVariables: JSON.stringify({
                    '1': job.id,
                    '2': job.serviceEmoji || '🔧',
                    '3': job.serviceName,
                    '4': `${job.estimate.currency} ${job.estimate.min} - ${job.estimate.max}`,
                    '5': job.customerName,
                    '6': job.customerPhone,
                    '7': job.businessId || ''
                })
            });
            console.log(`✅ Job Card (template) sent to ${recipient}: ${message.sid}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log('⚠️ Twilio credentials missing. MOCKING JOB CARD:');
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending WhatsApp Job Card:', error);
        return false;
    }
}

// Send Job Confirmed notification to owner (after customer confirms booking with address)
// This uses a template with Navigate (Waze) and Call Customer buttons
export async function sendJobConfirmed(ownerPhone: string, job: {
    id: string;
    serviceName: string;
    serviceEmoji?: string;
    timeSlot: string;
    address: string;
    customerName: string;
    customerPhone: string;
    estimate?: string;
}) {
    if (!ownerPhone) {
        console.warn('⚠️ No owner phone provided for job confirmed');
        return false;
    }

    const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    // Clean customer phone for wa.me link
    const customerPhoneClean = job.customerPhone.replace(/[^\d]/g, '');

    // URL-encode the address for Waze
    const wazeAddress = encodeURIComponent(job.address);

    // Content Template SID for Job Confirmed with URL buttons
    // Template: 🟢 JOB CONFIRMED #{{1}} | {{2}} {{3}} | 🗓️ {{4}} | 📍 {{5}} | 👤 {{6}}
    // Buttons: Navigate (waze.com/ul?q={{7}}) | Call Customer (wa.me/{{8}})
    const JOB_CONFIRMED_TEMPLATE_SID = process.env.TWILIO_JOB_CONFIRMED_TEMPLATE_SID;

    // Fallback plain text body
    const messageBody = `🟢 *JOB CONFIRMED #${job.id}*\n\n` +
        `${job.serviceEmoji || '🔧'} *${job.serviceName}*\n` +
        `🗓️ *Time:* ${job.timeSlot}\n` +
        `📍 *Address:* ${job.address}\n` +
        `👤 *Customer:* ${job.customerName}\n` +
        `📞 *Phone:* ${job.customerPhone}\n` +
        (job.estimate ? `💰 *Estimate:* ${job.estimate}\n\n` : '\n') +
        `Drive safe! 🚚\n\n` +
        `🗺️ Navigate: https://www.google.com/maps/search/${wazeAddress}\n` +
        `📞 Call: https://wa.me/${customerPhoneClean}`;

    try {
        if (client && fromNumber) {
            // Use Twilio Content Template
            // JOB CONFIRMED: {{1}}=ID, {{2}}=Emoji, {{3}}=Service, {{4}}=Time, {{5}}=Location, {{6}}=CustomerName, {{7}}=MapAddress, {{8}}=Phone
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                contentSid: JOB_CONFIRMED_TEMPLATE_SID,
                contentVariables: JSON.stringify({
                    '1': job.id,
                    '2': job.serviceEmoji || '🔧',
                    '3': job.serviceName,
                    '4': job.timeSlot,
                    '5': job.address,
                    '6': job.customerName,
                    '7': wazeAddress, // URL-encoded address for Google Maps
                    '8': job.customerPhone
                })
            });
            console.log(`✅ Job Confirmed (template) sent to ${recipient}: ${message.sid}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log('⚠️ Twilio credentials missing. MOCKING JOB CONFIRMED:');
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending Job Confirmed notification:', error);
        return false;
    }
}

// Follow-up message template generators with Urgency Cascade
// Now uses dynamic slot times instead of hardcoded values
function getFollowUpMessage(type: string, nextSlot?: string): string {
    const slot = nextSlot || 'soon';

    const templates: Record<string, string> = {
        // Stage 1: Helpful (+2 hours) - Dynamic slot
        '2h_slot_check': `Hi! 👋 Quick check — we have a slot ${slot}. Want to grab it before it's gone?`,

        // Stage 2: Urgency (+6 hours)
        '6h_last_chance': `⚠️ Last chance for today's slot! Reply "YES" to confirm or we'll give it to someone else.`,

        // Stage 3: Re-engage (+24 hours)  
        '24h_nudge': `Hi! 👋 Still need help? We kept a slot reserved for you. Just reply if you're still interested — no pressure!`,

        // Stage 4: Discount (+72 hours)
        '72h_discount': `🔥 Special offer: 10% off if you book today! Just reply "YES" to claim your discount and we'll send available slots.`,

        // Legacy compatibility
        '3d_promo': `🔥 Final reminder: Priority slot available! Reply to claim before it's gone.`
    };

    return templates[type] || templates['2h_slot_check'];
}

export async function sendFollowUpMessage(customerPhone: string, options: {
    type: string;
    businessName: string;
    nextSlot?: string;  // e.g., "today 4pm-6pm" or "tomorrow 10am"
}) {
    if (!customerPhone) {
        console.warn('⚠️ No customer phone provided for follow-up');
        return false;
    }

    const cleanPhone = customerPhone.replace(/[^\\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    const messageBody = getFollowUpMessage(options.type, options.nextSlot);

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`✅ Follow-up (${options.type}) sent to ${recipient}: ${message.sid}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log(`⚠️ Twilio credentials missing. MOCKING FOLLOW-UP (${options.type}):`);
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending WhatsApp Follow-up:', error);
        return false;
    }
}


/**
 * Send a confirmation message to the customer after they submit a quote request
 */
export async function sendQuoteConfirmation(customerPhone: string, options: {
    businessName: string;
    estimateMin: number;
    estimateMax: number;
    currency: string;
}) {
    if (!customerPhone) {
        console.warn('⚠️ No customer phone provided for quote confirmation');
        return false;
    }

    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    const messageBody = `✅ *Quote Ready: ${options.currency} ${options.estimateMin} - ${options.estimateMax}*\n\n` +
        `Hi! Thanks for requesting a quote from *${options.businessName}*.\n\n` +
        `We have openings this week! *Check available slots below* 👇`;

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`✅ Quote confirmation sent to customer ${recipient}: ${message.sid}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log(`⚠️ Twilio credentials missing. MOCKING QUOTE CONFIRMATION:`);
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending quote confirmation:', error);
        return false;
    }
}

/**
 * Generate smart time slots based on current day/time
 * Only shows future slots - never past times
 */
function generateSlotOptions(): { label: string; value: string }[] {
    const now = new Date();
    const hour = now.getHours();
    const slots: { label: string; value: string }[] = [];

    // Helper to format date
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    // Today slots - only if before the slot starts
    // Morning slot: only if before 9am (slot is 9am-11am)
    if (hour < 9) {
        slots.push({ label: 'Today 9am - 11am', value: 'today_morning' });
    }
    // Afternoon slot: only if before 2pm (slot is 2pm-4pm)
    if (hour < 14) {
        slots.push({ label: 'Today 2pm - 4pm', value: 'today_afternoon' });
    }
    // Late afternoon: only if before 4pm (slot is 4pm-6pm)
    if (hour < 16) {
        slots.push({ label: 'Today 4pm - 6pm', value: 'today_late' });
    }

    // Tomorrow slots (always show)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (slots.length < 3) {
        slots.push({ label: `${formatDate(tomorrow)} 9am - 11am`, value: 'tomorrow_morning' });
    }
    if (slots.length < 3) {
        slots.push({ label: `${formatDate(tomorrow)} 2pm - 4pm`, value: 'tomorrow_afternoon' });
    }

    // Day after tomorrow (if needed)
    if (slots.length < 3) {
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        slots.push({ label: `${formatDate(dayAfter)} 10am - 12pm`, value: 'day_after' });
    }

    return slots.slice(0, 3);
}

/**
 * Send slot suggestions to customer for one-tap booking
 * Can accept pre-fetched slots from API or generate defaults
 */
export async function sendSlotSuggester(customerPhone: string, options: {
    businessName: string;
    customerName: string;
    currency: string;
    estimateMin: number;
    estimateMax: number;
    slots?: { label: string; value: string }[]; // Optional: pre-fetched from /api/slots/available
}) {
    if (!customerPhone) {
        console.warn('⚠️ No customer phone provided for slot suggester');
        return false;
    }

    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    // Use provided slots or generate defaults
    const slots = options.slots || generateSlotOptions();

    if (slots.length === 0) {
        // No slots available - fully booked
        const noSlotsMessage = `📅 *Booking Request*\n\n` +
            `Hi ${options.customerName}! Thanks for your interest.\n\n` +
            `We're currently fully booked for the next few days.\n` +
            `We'll contact you as soon as a slot opens up! 📞\n\n` +
            `💰 *Estimate:* ${options.currency} ${options.estimateMin} - ${options.estimateMax}`;

        if (client && fromNumber) {
            await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: noSlotsMessage
            });
        }
        return { success: true, slots: [], fullyBooked: true };
    }

    const slotList = slots.map((s, i) => `${['1️⃣', '2️⃣', '3️⃣'][i]} ${s.label}`).join('\n');

    const messageBody = `📅 *Book Your Service*\n\n` +
        `Hi ${options.customerName}! Here are available slots:\n\n` +
        `${slotList}\n\n` +
        `💰 *${options.currency} ${options.estimateMin} - ${options.estimateMax}*\n\n` +
        `Reply *1*, *2*, or *3* to confirm your booking! 🎯\n\n` +
        `_Slots fill fast - first come, first served!_`;

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`📅 Slot suggestions sent to customer ${recipient}: ${message.sid}`);
            return { success: true, slots };
        } else {
            console.log('---------------------------------------------------');
            console.log(`⚠️ Twilio credentials missing. MOCKING SLOT SUGGESTER:`);
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return { success: true, slots };
        }
    } catch (error) {
        console.error('❌ Error sending slot suggestions:', error);
        return { success: false, slots: [] };
    }
}

/**
 * Send a review request after service completion
 */
export async function sendReviewRequest(customerPhone: string, options: {
    businessName: string;
    customerName: string;
    googleReviewUrl?: string;
}) {
    if (!customerPhone) return false;

    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    const messageBody = `⭐ *How was your service?*\n\n` +
        `Hi ${options.customerName}! Thanks for choosing *${options.businessName}*.\n\n` +
        `If you loved our service, we'd really appreciate a quick review:\n` +
        `${options.googleReviewUrl || '👉 Reply with your feedback!'}\n\n` +
        `📸 Got photos of the completed work? Send them here!\n\n` +
        `Thanks for your support! 🙏`;

    try {
        if (client && fromNumber) {
            await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`⭐ Review request sent to ${recipient}`);
            return true;
        } else {
            console.log('---------------------------------------------------');
            console.log(`⚠️ MOCKING REVIEW REQUEST:`);
            console.log(`To: ${recipient}`);
            console.log(`Body:\n${messageBody}`);
            console.log('---------------------------------------------------');
            return true;
        }
    } catch (error) {
        console.error('❌ Error sending review request:', error);
        return false;
    }
}
