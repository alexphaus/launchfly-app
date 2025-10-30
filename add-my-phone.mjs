// add-my-phone.mjs
// Add phone number to user profile

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_KEY
);

console.log('📱 Adding Phone Number to Profile\n');
console.log('='.repeat(60));

const phoneNumber = '+34683233450';
const userEmail = 'axpg31@gmail.com';

async function addPhone() {
  console.log(`\n📋 Adding phone ${phoneNumber} to ${userEmail}...\n`);
  
  // Update profile
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      phone_number: phoneNumber,
      sms_notifications_enabled: true 
    })
    .eq('email', userEmail)
    .select();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log('✅ SUCCESS! Phone number added!\n');
  console.log('📱 Profile updated:');
  console.log(`   Email: ${userEmail}`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   SMS Enabled: Yes`);
  
  console.log('\n🎉 You\'re all set!\n');
  console.log('What happens next:');
  console.log('1. ✅ Future sales will trigger instant SMS');
  console.log('2. ✅ Payouts will send SMS notifications');
  console.log('3. ✅ Milestones will send celebration SMS');
  
  console.log('\n💡 Want to test it?');
  console.log('   Make another test purchase and you\'ll get an SMS!\n');
}

addPhone().catch(console.error);

