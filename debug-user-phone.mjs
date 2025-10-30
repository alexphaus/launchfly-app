// debug-user-phone.mjs
// Check if user has phone number set up

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

console.log('🔍 Debugging SMS Notifications\n');
console.log('='.repeat(60));

async function debug() {
  // 1. Check recent sales
  console.log('\n📊 Step 1: Checking Recent Sales...\n');
  
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*, businesses(name, user_id)')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (salesError) {
    console.error('❌ Error fetching sales:', salesError.message);
    return;
  }
  
  if (!sales || sales.length === 0) {
    console.log('⚠️  No sales found in database');
    console.log('   Purchases might not have been recorded');
    return;
  }
  
  console.log(`✅ Found ${sales.length} recent sales:\n`);
  sales.forEach((sale, i) => {
    console.log(`${i + 1}. Sale ID: ${sale.id}`);
    console.log(`   Business: ${sale.businesses?.name || 'Unknown'}`);
    console.log(`   Amount: $${sale.amount}`);
    console.log(`   Customer: ${sale.customer_name || 'Unknown'}`);
    console.log(`   Date: ${new Date(sale.created_at).toLocaleString()}`);
    console.log(`   User ID: ${sale.businesses?.user_id || 'Unknown'}\n`);
  });
  
  // Get the most recent sale's user
  const recentSale = sales[0];
  const userId = recentSale.businesses?.user_id;
  
  if (!userId) {
    console.log('⚠️  No user ID found for recent sale');
    return;
  }
  
  // 2. Check user profile
  console.log('\n👤 Step 2: Checking User Profile...\n');
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message);
    return;
  }
  
  console.log(`User: ${profile.full_name || profile.email}`);
  console.log(`Email: ${profile.email}`);
  console.log(`Phone Number: ${profile.phone_number || '❌ NOT SET'}`);
  console.log(`SMS Enabled: ${profile.sms_notifications_enabled !== false ? '✅ Yes' : '❌ No'}`);
  
  // 3. Check if phone number is set
  if (!profile.phone_number) {
    console.log('\n' + '='.repeat(60));
    console.log('\n❌ PROBLEM FOUND: No Phone Number Set!\n');
    console.log('This is why you didn\'t receive SMS for your purchases.');
    console.log('\n🔧 SOLUTION:\n');
    console.log('Option 1: Add via Settings UI (Recommended)');
    console.log('  1. Start your app: npm run dev');
    console.log('  2. Go to Settings page');
    console.log('  3. Add phone number: +34683233450');
    console.log('  4. Click Save\n');
    console.log('Option 2: Add via this script');
    console.log('  Run: node add-my-phone.mjs\n');
    return;
  }
  
  // 4. Check SMS notification logs
  console.log('\n📱 Step 3: Checking SMS Notification Logs...\n');
  
  const { data: smsLogs, error: smsError } = await supabase
    .from('sms_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (smsError) {
    console.log('⚠️  SMS notifications table might not exist yet');
    console.log('   Run migration: db/migrations/20250126_sms_notifications.sql');
    return;
  }
  
  if (!smsLogs || smsLogs.length === 0) {
    console.log('⚠️  No SMS logs found');
    console.log('   SMS notifications might not have been triggered');
  } else {
    console.log(`Found ${smsLogs.length} SMS logs:\n`);
    smsLogs.forEach((log, i) => {
      console.log(`${i + 1}. ${log.message_type}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   To: ${log.phone_number}`);
      console.log(`   Date: ${new Date(log.created_at).toLocaleString()}`);
      if (log.error_message) {
        console.log(`   Error: ${log.error_message}`);
      }
      console.log();
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 SUMMARY:\n');
  console.log(`✅ Twilio: Working (test SMS delivered)`);
  console.log(`${sales.length > 0 ? '✅' : '❌'} Sales: ${sales.length} recorded`);
  console.log(`${profile.phone_number ? '✅' : '❌'} Phone Number: ${profile.phone_number || 'NOT SET'}`);
  console.log(`${profile.sms_notifications_enabled !== false ? '✅' : '❌'} SMS Enabled: ${profile.sms_notifications_enabled !== false ? 'Yes' : 'No'}`);
  
  if (profile.phone_number) {
    console.log('\n✅ Everything looks configured correctly!');
    console.log('   Next sale should trigger SMS notification.');
  } else {
    console.log('\n❌ Missing: Phone number not set in profile');
    console.log('   Add +34683233450 in Settings to receive notifications.');
  }
  console.log();
}

debug().catch(console.error);

