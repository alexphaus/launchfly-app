// test-env-config.js
// Test environment configuration with proper env loading

require('dotenv').config({ path: '.env.local' });

console.log('🔍 TESTING ENVIRONMENT CONFIGURATION');
console.log('====================================\n');

console.log('📋 Environment Variables Status:');
console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ SUPABASE_SERVICE_KEY: ${!!process.env.SUPABASE_SERVICE_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ OPENAI_API_KEY: ${!!process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ RESEND_API_KEY: ${!!process.env.RESEND_API_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ FROM_EMAIL: ${!!process.env.FROM_EMAIL ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ STRIPE_SECRET_KEY: ${!!process.env.STRIPE_SECRET_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`✅ INNGEST_EVENT_KEY: ${!!process.env.INNGEST_EVENT_KEY ? '✅ SET' : '❌ MISSING'}`);

console.log('\n🎯 Campaign Control Settings:');
console.log(`📧 AUTO_START_OUTREACH: ${process.env.AUTO_START_OUTREACH || 'false'}`);
console.log(`🧪 ACQUISITION_DRY_RUN: ${process.env.ACQUISITION_DRY_RUN || 'false'}`);
console.log(`📤 ENABLE_TEST_EMAILS: ${process.env.ENABLE_TEST_EMAILS || 'false'}`);
console.log(`🔍 APOLLO_API_KEY: ${process.env.APOLLO_API_KEY || 'false'}`);

console.log('\n⚡ Email Service Configuration:');
console.log(`📨 FROM_EMAIL: ${process.env.FROM_EMAIL || 'NOT SET'}`);
console.log(`🔑 RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET (re_...)' : 'NOT SET'}`);

console.log('\n🚨 CAMPAIGN BLOCKING ANALYSIS:');
console.log('===============================');

const canSendRealEmails = Boolean(
  process.env.RESEND_API_KEY && 
  process.env.FROM_EMAIL && 
  process.env.APOLLO_API_KEY !== 'false'
);

const autoStartEnabled = process.env.AUTO_START_OUTREACH === 'true';
const dryRunMode = process.env.ACQUISITION_DRY_RUN === 'true';

console.log(`📧 Can Send Real Emails: ${canSendRealEmails ? '✅ YES' : '❌ NO'}`);
console.log(`🚀 Auto Start Enabled: ${autoStartEnabled ? '✅ YES' : '❌ NO'}`);
console.log(`🧪 Dry Run Mode: ${dryRunMode ? '⚠️ YES (emails simulated)' : '✅ NO (real emails)'}`);

console.log('\n🎯 CAMPAIGN STATUS PREDICTION:');
console.log('==============================');

if (!canSendRealEmails) {
  console.log('❌ BLOCKED: Missing email configuration');
  console.log('   • Need RESEND_API_KEY + FROM_EMAIL + APOLLO_API_KEY');
}

if (!autoStartEnabled) {
  console.log('❌ BLOCKED: AUTO_START_OUTREACH not enabled');
  console.log('   • Campaigns will launch but not send emails automatically');
}

if (dryRunMode) {
  console.log('⚠️ LIMITED: Dry run mode active');
  console.log('   • Campaigns will simulate sending but not send real emails');
}

if (canSendRealEmails && autoStartEnabled && !dryRunMode) {
  console.log('✅ READY: All systems configured for real email campaigns!');
  console.log('   • Emails will be sent automatically');
  console.log('   • Activity timeline will progress normally');
} else {
  console.log('\n🛠️ REQUIRED FIXES:');
  console.log('==================');
  if (!autoStartEnabled) {
    console.log('1. Set AUTO_START_OUTREACH=true');
  }
  if (process.env.APOLLO_API_KEY === 'false') {
    console.log('2. Set real APOLLO_API_KEY (or accept simulated prospects)');
  }
  if (dryRunMode) {
    console.log('3. Set ACQUISITION_DRY_RUN=false');
  }
}

console.log('\n🚀 EXPECTED RESULTS AFTER FIXES:');
console.log('=================================');
console.log('• campaign.launched → immediate');
console.log('• email.batch_sent → 1-2 minutes');
console.log('• lead.clicked → 5-30 minutes'); 
console.log('• lead.replied → hours-days');
console.log('• payment.succeeded → days-weeks');
