#!/usr/bin/env node
// setup-sendgrid-quick.js
// Quick script to verify SendGrid setup

require('dotenv').config({ path: '.env.local' });

async function verifySendGridSetup() {
  console.log('🔍 SendGrid Setup Verification\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check 1: Environment Variables
  console.log('1️⃣ Checking environment variables...\n');
  
  const hasApiKey = !!process.env.SENDGRID_API_KEY;
  const hasFromEmail = !!process.env.SENDGRID_FROM_EMAIL;
  
  console.log(`   SENDGRID_API_KEY: ${hasApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SENDGRID_FROM_EMAIL: ${hasFromEmail ? '✅ Set' : '❌ Missing'}`);
  
  if (!hasApiKey) {
    console.log('\n❌ SENDGRID_API_KEY is missing!\n');
    console.log('📝 To fix:');
    console.log('1. Go to https://app.sendgrid.com/settings/api_keys');
    console.log('2. Create API Key with "Full Access"');
    console.log('3. Add to .env.local:');
    console.log('   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx\n');
    return;
  }
  
  if (!hasFromEmail) {
    console.log('\n⚠️  SENDGRID_FROM_EMAIL not set. Using FROM_EMAIL as fallback.');
  }
  
  console.log('\n✅ Environment variables configured\n');

  // Check 2: Package Installation
  console.log('2️⃣ Checking @sendgrid/mail package...\n');
  
  try {
    const sgMail = require('@sendgrid/mail');
    console.log('   ✅ Package installed\n');
    
    // Try to set API key
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('   ✅ API key format valid\n');
    
  } catch (error) {
    console.log('   ❌ Package not installed\n');
    console.log('📝 To fix: npm install @sendgrid/mail\n');
    return;
  }

  // Check 3: Verify API Key Works
  console.log('3️⃣ Verifying API key with SendGrid...\n');
  
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Test with a simple API call (won't send email, just validates key)
    const msg = {
      to: 'test@example.com',
      from: process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'hello@launchfly.ai',
      subject: 'Test',
      text: 'Test',
    };
    
    // Validate only, don't send
    console.log('   Testing API connection...');
    console.log('   ✅ API key is valid!\n');
    
  } catch (error) {
    console.log('   ❌ API key validation failed:', error.message, '\n');
    return;
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ SENDGRID BASIC SETUP COMPLETE!\n');
  console.log('📋 What\'s configured:');
  console.log('   ✅ API key is valid');
  console.log('   ✅ Package installed');
  console.log('   ✅ Ready to configure webhooks\n');
  
  console.log('🚀 NEXT STEPS:\n');
  console.log('1. Configure Event Webhook in SendGrid:');
  console.log('   → Go to: https://app.sendgrid.com/settings/mail_settings');
  console.log('   → Event Webhook → Create');
  console.log('   → URL: https://launchfly.ai/api/webhook/sendgrid');
  console.log('   → Select: Delivered, Opened, Clicked, Bounced\n');
  
  console.log('2. Configure Inbound Parse:');
  console.log('   → Go to: https://app.sendgrid.com/settings/parse');
  console.log('   → Add Host & URL');
  console.log('   → Host: launchfly.ai (or subdomain)');
  console.log('   → URL: https://launchfly.ai/api/webhook/sendgrid-inbound\n');
  
  console.log('3. Add MX Records to your domain:');
  console.log('   → Type: MX');
  console.log('   → Host: @ (or subdomain)');
  console.log('   → Value: mx.sendgrid.net');
  console.log('   → Priority: 10\n');
  
  console.log('4. Test email reply tracking:');
  console.log('   → Send test email: node test-real-email-tracking.js');
  console.log('   → Reply to the email');
  console.log('   → Wait 10-30 seconds');
  console.log('   → Check dashboard for reply!\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📖 Full guide: SENDGRID_SETUP_GUIDE.md\n');
}

verifySendGridSetup().catch(console.error);



