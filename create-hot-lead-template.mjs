// Create and test HOT LEAD ALERT template for owner notifications
// Use this AFTER the template is approved in Twilio Console
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config({ path: '.env.local' });

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ============================================================
// STEP 1: Create the template via Content API (run once)
// ============================================================
async function createTemplate() {
    console.log('Creating HOT_LEAD_ALERT template...');
    
    try {
        const content = await client.content.v1.contents.create({
            friendlyName: 'hot_lead_alert',
            language: 'en',
            variables: {
                '1': 'Customer Name',
                '2': 'Customer Phone', 
                '3': 'Service Type'
            },
            types: {
                'twilio/text': {
                    body: '� *HOT LEAD ALERT*\n\n{{1}} just replied to your service reminder!\n\n📱 Phone: {{2}}\n🔧 Interest: {{3}} service\n\nThey\'re ready to book. Reply to start the conversation.'
                }
            }
        });
        
        console.log('✅ Template created!');
        console.log('Content SID:', content.sid);
        console.log('\n⚠️  Now submit for WhatsApp approval:');
        console.log(`   1. Go to: https://console.twilio.com/us1/develop/sms/content-editor/content-templates/${content.sid}`);
        console.log('   2. Click "Submit for WhatsApp Approval"');
        console.log('   3. Category: UTILITY');
        console.log('   4. Wait for approval (usually 24-48h)');
        console.log('\n📝 Add to .env.local:');
        console.log(`TWILIO_TEMPLATE_HOT_LEAD=${content.sid}`);
        
        return content.sid;
    } catch (error) {
        if (error.code === 22105) {
            console.log('⚠️  Template already exists or similar name in use');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// ============================================================
// STEP 2: Test sending (after approval)
// ============================================================
async function testSend() {
    const templateSid = process.env.TWILIO_TEMPLATE_HOT_LEAD;
    
    if (!templateSid) {
        console.error('❌ TWILIO_TEMPLATE_HOT_LEAD not set in .env.local');
        console.log('Run with --create first, then add the SID to .env.local');
        return;
    }
    
    const ownerPhone = process.env.MY_PHONE || '+34683233450';
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+13203627874';
    const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    
    console.log('Testing HOT_LEAD_ALERT template...');
    console.log('To Owner:', ownerPhone);
    console.log('Template SID:', templateSid);
    
    try {
        const msg = await client.messages.create({
            contentSid: templateSid,
            contentVariables: JSON.stringify({
                '1': 'Alex Test',
                '2': '+34683233450',
                '3': 'aircon cleaning'
            }),
            from: from,
            to: `whatsapp:${ownerPhone}`,
        });
        
        console.log('✅ Sent! SID:', msg.sid);
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 63016) {
            console.log('💡 Template not approved yet. Check Twilio Console.');
        }
    }
}

// ============================================================
// Main
// ============================================================
const args = process.argv.slice(2);

if (args.includes('--create')) {
    createTemplate();
} else if (args.includes('--test')) {
    testSend();
} else {
    console.log('Usage:');
    console.log('  node create-hot-lead-template.mjs --create   # Create template (run once)');
    console.log('  node create-hot-lead-template.mjs --test     # Test sending (after approval)');
}
