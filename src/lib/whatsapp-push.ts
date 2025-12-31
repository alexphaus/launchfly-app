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
