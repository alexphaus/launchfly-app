// test-sms-simple.js
// Simple SMS test that checks configuration without sending

console.log('🧪 SMS Notifications Configuration Check\n');
console.log('='.repeat(60));

// Check if Twilio environment variables are set
console.log('\n📋 Checking Twilio Configuration...\n');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

console.log('Environment Variables:');
console.log(`- TWILIO_ACCOUNT_SID: ${accountSid ? '✅ Set' : '❌ Missing'}`);
if (accountSid) {
  console.log(`  Value: ${accountSid.substring(0, 10)}...`);
  console.log(`  Valid format: ${accountSid.startsWith('AC') ? '✅ Yes' : '❌ No (should start with "AC")'}`);
}

console.log(`\n- TWILIO_AUTH_TOKEN: ${authToken ? '✅ Set' : '❌ Missing'}`);
if (authToken) {
  console.log(`  Length: ${authToken.length} characters`);
}

console.log(`\n- TWILIO_PHONE_NUMBER: ${fromNumber ? '✅ Set' : '❌ Missing'}`);
if (fromNumber) {
  console.log(`  Value: ${fromNumber}`);
  console.log(`  Valid format: ${fromNumber.startsWith('+') ? '✅ Yes' : '⚠️  Should include country code (e.g., +1)'}`);
}

// Check Supabase configuration
console.log('\n\n📋 Checking Supabase Configuration...\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Environment Variables:');
console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
if (supabaseUrl) {
  console.log(`  Value: ${supabaseUrl}`);
}

console.log(`\n- SUPABASE_SERVICE_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
if (supabaseKey) {
  console.log(`  Length: ${supabaseKey.length} characters`);
}

// Overall status
console.log('\n' + '='.repeat(60));
console.log('\n📊 Configuration Summary:\n');

const twilioConfigured = accountSid && authToken && fromNumber && accountSid.startsWith('AC');
const supabaseConfigured = supabaseUrl && supabaseKey;

console.log(`Twilio Configuration: ${twilioConfigured ? '✅ READY' : '❌ INCOMPLETE'}`);
console.log(`Supabase Configuration: ${supabaseConfigured ? '✅ READY' : '❌ INCOMPLETE'}`);

if (twilioConfigured && supabaseConfigured) {
  console.log('\n🎉 SMS Notifications are ready to use!\n');
  console.log('Next steps:');
  console.log('1. Add your phone number in Settings');
  console.log('2. Make a test purchase to receive SMS');
  console.log('3. Try a cashout to test payout notifications');
} else {
  console.log('\n⚠️  Configuration needed:\n');
  
  if (!twilioConfigured) {
    console.log('Twilio Setup:');
    console.log('1. Sign up at https://www.twilio.com');
    console.log('2. Get your Account SID and Auth Token');
    console.log('3. Buy a phone number');
    console.log('4. Add to .env.local:');
    console.log('   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('   TWILIO_AUTH_TOKEN=your_auth_token_here');
    console.log('   TWILIO_PHONE_NUMBER=+15551234567\n');
  }
  
  if (!supabaseConfigured) {
    console.log('Supabase Setup:');
    console.log('1. Check your .env.local file');
    console.log('2. Ensure these are set:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
    console.log('   SUPABASE_SERVICE_KEY=your_service_key\n');
  }
}

console.log('\n📚 Documentation:');
console.log('- Quick Start: SMS_QUICK_START.md');
console.log('- Full Guide: SMS_NOTIFICATIONS_SETUP.md');
console.log('- Summary: SMS_IMPLEMENTATION_SUMMARY.md\n');

