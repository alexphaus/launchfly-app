// diagnose-stuck-campaign.js
// Debug script to find why campaign is stuck

const { createClient } = require('@supabase/supabase-js');

console.log('🔍 DIAGNOSING STUCK CAMPAIGN');
console.log('============================\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`✅ SUPABASE_SERVICE_KEY: ${!!process.env.SUPABASE_SERVICE_KEY}`);
console.log(`❌ RESEND_API_KEY: ${!!process.env.RESEND_API_KEY}`);
console.log(`❌ FROM_EMAIL: ${!!process.env.FROM_EMAIL}`);
console.log(`❌ APOLLO_API_KEY: ${!!process.env.APOLLO_API_KEY}`);
console.log(`❌ AUTO_START_OUTREACH: ${process.env.AUTO_START_OUTREACH || 'not set'}`);
console.log(`❌ ACQUISITION_DRY_RUN: ${process.env.ACQUISITION_DRY_RUN || 'not set'}`);

console.log('\n🚨 LIKELY ISSUES:');
console.log('==================');

if (!process.env.RESEND_API_KEY) {
  console.log('❌ BLOCKING: No RESEND_API_KEY - emails cannot be sent');
}

if (!process.env.FROM_EMAIL) {
  console.log('❌ BLOCKING: No FROM_EMAIL - no sender address configured');
}

if (!process.env.APOLLO_API_KEY) {
  console.log('❌ BLOCKING: No APOLLO_API_KEY - cannot find real prospects');
}

if (process.env.AUTO_START_OUTREACH !== 'true') {
  console.log('❌ BLOCKING: AUTO_START_OUTREACH not set to "true" - campaigns won\'t auto-start');
}

if (process.env.ACQUISITION_DRY_RUN === 'true') {
  console.log('❌ BLOCKING: ACQUISITION_DRY_RUN is "true" - emails are simulated only');
}

console.log('\n🎯 WHAT HAPPENED:');
console.log('=================');
console.log('1. Campaign launched successfully ✅');
console.log('2. Inngest function triggered ✅'); 
console.log('3. Email outreach attempted ❌');
console.log('4. Blocked by missing environment variables ❌');
console.log('5. No emails sent = no further activity ❌');

console.log('\n🛠️ TO FIX THE STUCK CAMPAIGN:');
console.log('=============================');
console.log('1. Set RESEND_API_KEY in environment variables');
console.log('2. Set FROM_EMAIL to your sender email address');
console.log('3. Set AUTO_START_OUTREACH=true');
console.log('4. Set ACQUISITION_DRY_RUN=false (or remove it)');
console.log('5. Optional: Set APOLLO_API_KEY for real prospects');

console.log('\n⚡ QUICK TEST:');
console.log('=============');
console.log('Add to your .env.local file:');
console.log('RESEND_API_KEY=your_resend_api_key');
console.log('FROM_EMAIL=noreply@yourdomain.com');
console.log('AUTO_START_OUTREACH=true');
console.log('ACQUISITION_DRY_RUN=false');

console.log('\n🚀 AFTER FIXING:');
console.log('================');
console.log('Expected timeline after restart:');
console.log('• campaign.launched (immediate)');
console.log('• email.batch_sent (1-2 minutes)');
console.log('• lead.clicked (5-30 minutes)');
console.log('• lead.replied (hours to days)');
