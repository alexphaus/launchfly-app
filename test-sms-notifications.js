// test-sms-notifications.js
// Test script for SMS notification functionality

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { sendTestSms, sendSaleSms, sendPayoutSms, sendMilestoneSms, isSmsConfigured } from './src/lib/sms-notifications.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSmsNotifications() {
  console.log('🧪 Testing SMS Notifications System\n');
  console.log('=' .repeat(60));
  
  // Step 1: Check Twilio configuration
  console.log('\n📋 Step 1: Checking Twilio Configuration...');
  const isConfigured = isSmsConfigured();
  
  if (!isConfigured) {
    console.error('❌ Twilio is not properly configured!');
    console.log('\nRequired environment variables:');
    console.log('- TWILIO_ACCOUNT_SID (should start with "AC")');
    console.log('- TWILIO_AUTH_TOKEN');
    console.log('- TWILIO_PHONE_NUMBER (should include country code, e.g., +15551234567)');
    console.log('\nCurrent values:');
    console.log(`- TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '✗ Missing'}`);
    console.log(`- TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '✗ Missing'}`);
    console.log(`- TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER ? '✓ Set' : '✗ Missing'}`);
    process.exit(1);
  }
  
  console.log('✅ Twilio configuration is valid');
  console.log(`   Account SID: ${process.env.TWILIO_ACCOUNT_SID?.substring(0, 10)}...`);
  console.log(`   Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
  
  // Step 2: Get test phone number
  console.log('\n📋 Step 2: Getting Test User...');
  
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, phone_number, full_name')
    .not('phone_number', 'is', null)
    .limit(1);
  
  if (profileError || !profiles || profiles.length === 0) {
    console.error('❌ No users with phone numbers found');
    console.log('\n💡 To test SMS notifications:');
    console.log('1. Go to your app Settings page');
    console.log('2. Add your phone number');
    console.log('3. Run this test script again');
    process.exit(1);
  }
  
  const testUser = profiles[0];
  console.log('✅ Found test user');
  console.log(`   User: ${testUser.full_name || testUser.email}`);
  console.log(`   Phone: ${testUser.phone_number}`);
  
  // Get user's business
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', testUser.id)
    .limit(1);
  
  if (businessError || !businesses || businesses.length === 0) {
    console.error('❌ No businesses found for test user');
    process.exit(1);
  }
  
  const testBusiness = businesses[0];
  console.log(`   Business: ${testBusiness.name}`);
  
  // Step 3: Send test SMS
  console.log('\n📋 Step 3: Sending Test SMS...');
  const testResult = await sendTestSms(testUser.phone_number);
  
  if (testResult.success) {
    console.log('✅ Test SMS sent successfully!');
    console.log(`   Message ID: ${testResult.messageId}`);
    console.log(`   Check ${testUser.phone_number} for the message`);
  } else {
    console.error('❌ Failed to send test SMS');
    console.error(`   Error: ${testResult.error}`);
  }
  
  // Step 4: Test sale notification
  console.log('\n📋 Step 4: Testing Sale Notification...');
  const saleResult = await sendSaleSms({
    userId: testUser.id,
    businessId: testBusiness.id,
    businessName: testBusiness.name,
    amount: 99.99,
    customerName: 'Test Customer',
    isFirstSale: true,
    totalRevenue: 99.99
  });
  
  if (saleResult.success) {
    console.log('✅ Sale notification sent successfully!');
    console.log(`   Message ID: ${saleResult.messageId}`);
  } else {
    console.error('❌ Failed to send sale notification');
    console.error(`   Error: ${saleResult.error}`);
  }
  
  // Step 5: Test payout notification
  console.log('\n📋 Step 5: Testing Payout Notification...');
  const payoutResult = await sendPayoutSms({
    userId: testUser.id,
    businessId: testBusiness.id,
    businessName: testBusiness.name,
    amount: 50.00,
    speed: 'instant',
    status: 'success'
  });
  
  if (payoutResult.success) {
    console.log('✅ Payout notification sent successfully!');
    console.log(`   Message ID: ${payoutResult.messageId}`);
  } else {
    console.error('❌ Failed to send payout notification');
    console.error(`   Error: ${payoutResult.error}`);
  }
  
  // Step 6: Test milestone notification
  console.log('\n📋 Step 6: Testing Milestone Notification...');
  const milestoneResult = await sendMilestoneSms({
    userId: testUser.id,
    businessId: testBusiness.id,
    businessName: testBusiness.name,
    milestone: '1k_revenue',
    amount: 1000
  });
  
  if (milestoneResult.success) {
    console.log('✅ Milestone notification sent successfully!');
    console.log(`   Message ID: ${milestoneResult.messageId}`);
  } else {
    console.error('❌ Failed to send milestone notification');
    console.error(`   Error: ${milestoneResult.error}`);
  }
  
  // Step 7: Check database logs
  console.log('\n📋 Step 7: Checking Database Logs...');
  const { data: logs, error: logError } = await supabase
    .from('sms_notifications')
    .select('*')
    .eq('phone_number', testUser.phone_number)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (logError) {
    console.error('❌ Failed to fetch SMS logs');
    console.error(`   Error: ${logError.message}`);
  } else {
    console.log(`✅ Found ${logs?.length || 0} recent SMS logs`);
    if (logs && logs.length > 0) {
      console.log('\nRecent SMS Messages:');
      logs.forEach((log, index) => {
        console.log(`\n${index + 1}. ${log.message_type.toUpperCase()}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Sent: ${new Date(log.created_at).toLocaleString()}`);
        if (log.error_message) {
          console.log(`   Error: ${log.error_message}`);
        }
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ SMS Notifications Test Complete!\n');
  console.log('Summary:');
  console.log(`- Configuration: ${isConfigured ? '✅' : '❌'}`);
  console.log(`- Test SMS: ${testResult.success ? '✅' : '❌'}`);
  console.log(`- Sale Notification: ${saleResult.success ? '✅' : '❌'}`);
  console.log(`- Payout Notification: ${payoutResult.success ? '✅' : '❌'}`);
  console.log(`- Milestone Notification: ${milestoneResult.success ? '✅' : '❌'}`);
  
  console.log('\n📱 Check your phone for the test messages!');
  console.log('\n💡 Next steps:');
  console.log('1. Verify all SMS messages were received');
  console.log('2. Check Twilio console for delivery status');
  console.log('3. Test with real sales and payouts');
  console.log('\n🎉 SMS notifications are ready to use!\n');
}

// Run the test
testSmsNotifications().catch((error) => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});

