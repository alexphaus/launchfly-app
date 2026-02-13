
require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '13203627874';
const templateSid = process.env.TWILIO_TEMPLATE_PROMO;

if (!accountSid || !authToken) {
    console.error('Missing Twilio credentials');
    process.exit(1);
}

const client = twilio(accountSid, authToken);

async function testSend() {
    console.log('--- Debug Twilio Template Sending ---');
    console.log(`From: ${fromNumber}`);
    console.log(`To: +34643649326`);
    console.log(`Template SID: ${templateSid}`);

    if (!templateSid) {
        console.error('❌ Error: TWILIO_TEMPLATE_PROMO env var is missing! This is likely the cause.');
        return;
    }

    const whatsappFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    const whatsappTo = 'whatsapp:+34643649326';

    try {
        console.log('Attempting to send...');
        const message = await client.messages.create({
            from: whatsappFrom,
            to: whatsappTo,
            contentSid: templateSid,
            contentVariables: JSON.stringify({
                '1': 'ANA',
                '2': 'DANS. AIRCON TEAM',
                '3': 'promo',
            }),
        });
        console.log('✅ Message sent successfully!');
        console.log(`SID: ${message.sid}`);
        console.log(`Status: ${message.status}`);
    } catch (error) {
        console.error('❌ Failed to send:');
        console.error(`Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        console.error(`More Info: ${error.moreInfo}`);
    }
}

testSend();
