// test-sms-direct.js
// Direct SMS test - sends to a specific phone number

import twilio from 'twilio';

console.log('🧪 Direct SMS Test\n');
console.log('='.repeat(60));

// Get credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

console.log('\n📋 Configuration Check...');
console.log(`✅ Account SID: ${accountSid?.substring(0, 10)}...`);
console.log(`✅ Phone Number: ${fromNumber}`);

// Get test phone number from command line or use default
const testPhoneNumber = process.argv[2] || fromNumber;

console.log(`\n📱 Sending test SMS to: ${testPhoneNumber}`);

const client = twilio(accountSid, authToken);

async function sendTestSms() {
  try {
    const message = await client.messages.create({
      body: '🚀 Launchfly SMS Test: Your SMS notifications are working perfectly! You\'ll now receive instant alerts for sales, payouts, and milestones. 🎉',
      from: fromNumber,
      to: testPhoneNumber
    });
    
    console.log('\n✅ SMS sent successfully!');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   To: ${message.to}`);
    console.log(`   From: ${message.from}`);
    
    console.log('\n🎉 Success! Check your phone for the message.');
    console.log('\n📱 Next: Add your phone number in Settings to receive automatic notifications.');
    
  } catch (error) {
    console.error('\n❌ Failed to send SMS');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 21211) {
      console.error('\n💡 Invalid phone number format. Use international format: +15551234567');
    } else if (error.code === 21608) {
      console.error('\n💡 Phone number is not verified. Add it to your Twilio verified numbers or upgrade your account.');
    } else if (error.status === 401) {
      console.error('\n💡 Authentication failed. Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    } else {
      console.error(`\n💡 Error code: ${error.code || 'unknown'}`);
    }
  }
}

console.log('\n⏳ Sending...\n');
sendTestSms();

