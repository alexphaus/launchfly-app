// Test WhatsApp Template directly
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const templateSid = process.env.TWILIO_TEMPLATE_SERVICE_DUE;
const phone = '+34683233450';

console.log('Testing WhatsApp template...');
console.log('Template SID:', templateSid);
console.log('To:', phone);

try {
    const msg = await client.messages.create({
        contentSid: templateSid,
        contentVariables: JSON.stringify({
            '1': 'Alex',           // customerName
            '2': 'Launchfly',      // businessName
            '3': 'aircon',         // appliance
            '4': '28 Jul',         // lastServiceDate
        }),
        from: 'whatsapp:+13203627874',
        to: `whatsapp:${phone}`,
    });
    console.log('✅ Success! SID:', msg.sid);
} catch (err) {
    console.log('❌ Error:', err.message);
    console.log('   Code:', err.code);
    if (err.moreInfo) console.log('   More info:', err.moreInfo);
}
