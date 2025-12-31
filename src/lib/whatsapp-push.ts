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
}) {
    if (!ownerPhone) {
        console.warn('⚠️ No owner phone provided for job card');
        return false;
    }

    const cleanPhone = ownerPhone.replace(/[^\d+]/g, '');
    const recipient = cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`;

    // Format Q&A pairs
    const details = Object.entries(job.answers)
        .map(([q, a]) => `• ${q}: ${a}`)
        .join('\n');

    const messageBody = `🆕 *JOB Request #${job.id}*\n\n` +
        `${job.serviceEmoji || '🔧'} *${job.serviceName}*\n` +
        `👤 ${job.customerName}\n` +
        `📞 ${job.customerPhone}\n` +
        `💰 *Est:* ${job.estimate.currency} ${job.estimate.min} - ${job.estimate.max}\n\n` +
        `📋 *Details:*\n${details}\n\n` +
        `👉 *Reply to accept this job.*`;

    try {
        if (client && fromNumber) {
            const message = await client.messages.create({
                from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
                to: recipient,
                body: messageBody
            });
            console.log(`✅ Job Card sent to ${recipient}: ${message.sid}`);
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
