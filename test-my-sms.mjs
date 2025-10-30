// test-my-sms.mjs
// Simple SMS test with inline config

import { readFileSync } from 'fs';
import twilio from 'twilio';

// Load .env file
const envFile = readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

console.log('🧪 SMS Test to Your Number\n');
console.log('='.repeat(60));

const accountSid = envVars.TWILIO_ACCOUNT_SID;
const authToken = envVars.TWILIO_AUTH_TOKEN;
const fromNumber = envVars.TWILIO_PHONE_NUMBER;
const toNumber = '+34683233450'; // Your number

console.log('\n📋 Configuration:');
console.log(`✅ From: ${fromNumber}`);
console.log(`✅ To: ${toNumber}`);
console.log(`✅ Account: ${accountSid?.substring(0, 10)}...`);

console.log('\n⏳ Sending test SMS...\n');

const client = twilio(accountSid, authToken);

try {
  const message = await client.messages.create({
    body: '🚀 Launchfly SMS Test: Your notifications are working! You\'ll receive alerts for:\n💰 Sales\n💸 Payouts\n🎯 Milestones\n\nWelcome to instant business alerts! 🎉',
    from: fromNumber,
    to: toNumber
  });
  
  console.log('✅ SUCCESS! SMS sent!');
  console.log(`\n📱 Message Details:`);
  console.log(`   SID: ${message.sid}`);
  console.log(`   Status: ${message.status}`);
  console.log(`   To: ${message.to}`);
  console.log(`   From: ${message.from}`);
  console.log(`   Direction: ${message.direction}`);
  
  console.log('\n🎉 Check your phone (+34683233450) for the message!');
  console.log('\n✨ SMS Notifications are fully operational!');
  
  console.log('\n📋 What happens next:');
  console.log('1. Add +34683233450 to your Settings');
  console.log('2. You\'ll get SMS for every sale automatically');
  console.log('3. Payout notifications will arrive instantly');
  console.log('4. Celebrate milestones via text! 🎊\n');
  
} catch (error) {
  console.error('❌ Failed to send SMS');
  console.error(`   Error: ${error.message}`);
  console.error(`   Code: ${error.code || 'unknown'}`);
  
  if (error.code === 21211) {
    console.error('\n💡 Invalid phone number. Double-check the format.');
  } else if (error.code === 21608) {
    console.error('\n💡 Unverified number. In Twilio trial:');
    console.error('   1. Go to https://console.twilio.com/verify/phone-numbers');
    console.error('   2. Add +34683233450 as a verified number');
    console.error('   3. Or upgrade your Twilio account');
  } else if (error.code === 21610) {
    console.error('\n💡 Number is blocked. Check Twilio console.');
  } else if (error.status === 401) {
    console.error('\n💡 Authentication failed. Check credentials.');
  }
  
  console.error('\n📚 Twilio Console: https://console.twilio.com');
}

