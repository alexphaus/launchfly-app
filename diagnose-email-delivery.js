#!/usr/bin/env node

/**
 * Email Delivery Diagnostic Tool
 * 
 * This tool helps diagnose why you didn't receive a fulfillment email after purchase.
 * It checks the system components and provides actionable troubleshooting steps.
 */

const https = require('https');
const http = require('http');

const LOCAL_URL = 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestModule = urlObj.protocol === 'https:' ? https : http;
    
    const req = requestModule.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function diagnoseEmailDelivery() {
  console.log('🔍 EMAIL DELIVERY DIAGNOSTIC TOOL');
  console.log('=================================\n');
  
  console.log('This tool will help diagnose why you didn\'t receive a fulfillment email after purchase.\n');
  
  // Check 1: Server Status
  console.log('1️⃣ CHECKING SERVER STATUS');
  console.log('-------------------------');
  try {
    const health = await makeRequest(`${LOCAL_URL}/api/health`);
    if (health.status === 200) {
      console.log('✅ Server is running and responsive');
      console.log(`   Health check response: ${JSON.stringify(health.data)}`);
    } else {
      console.log('❌ Server health check failed');
      console.log('   → Make sure your dev server is running: npm run dev');
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server');
    console.log('   → Start your development server: npm run dev');
    console.log('   → Check that port 3000 is available');
    return;
  }
  
  // Check 2: Email System Components
  console.log('\n2️⃣ CHECKING EMAIL SYSTEM COMPONENTS');
  console.log('-----------------------------------');
  
  // Check if fulfillment-core.js exists and has email functionality
  const fs = require('fs');
  const path = require('path');
  
  const fulfillmentPath = path.join(process.cwd(), 'src/lib/fulfillment-core.js');
  if (fs.existsSync(fulfillmentPath)) {
    console.log('✅ Fulfillment core exists: src/lib/fulfillment-core.js');
    
    const fulfillmentContent = fs.readFileSync(fulfillmentPath, 'utf8');
    
    if (fulfillmentContent.includes('sendFulfillmentEmail')) {
      console.log('✅ Email sending function found: sendFulfillmentEmail');
    } else {
      console.log('❌ Email sending function missing');
    }
    
    if (fulfillmentContent.includes('resend.emails.send')) {
      console.log('✅ Resend integration found');
    } else {
      console.log('❌ Resend integration missing');
    }
    
    if (fulfillmentContent.includes('RESEND_API_KEY')) {
      console.log('✅ Resend API key configuration found');
    } else {
      console.log('❌ Resend API key configuration missing');
    }
  } else {
    console.log('❌ Fulfillment core missing: src/lib/fulfillment-core.js');
  }
  
  // Check 3: Purchase Flow
  console.log('\n3️⃣ CHECKING PURCHASE FLOW');
  console.log('-------------------------');
  
  // Check if webhook endpoints exist
  try {
    const webhookTest = await makeRequest(`${LOCAL_URL}/api/webhook/tally`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    
    if (webhookTest.status === 400 || webhookTest.status === 200) {
      console.log('✅ Tally webhook endpoint is accessible');
    } else {
      console.log('⚠️  Tally webhook may have issues');
    }
  } catch (error) {
    console.log('❌ Tally webhook not accessible');
  }
  
  // Check if fulfillment endpoints exist
  const fulfillmentEndpoints = [
    'fulfillment/manual',
    'fulfillment/trigger'
  ];
  
  for (const endpoint of fulfillmentEndpoints) {
    try {
      const test = await makeRequest(`${LOCAL_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (test.status === 400 || test.status === 200) {
        console.log(`✅ Fulfillment endpoint exists: /api/${endpoint}`);
      } else {
        console.log(`⚠️  Fulfillment endpoint may have issues: /api/${endpoint}`);
      }
    } catch (error) {
      console.log(`❌ Fulfillment endpoint not accessible: /api/${endpoint}`);
    }
  }
  
  // Check 4: Environment Variables
  console.log('\n4️⃣ ENVIRONMENT VARIABLE DIAGNOSIS');
  console.log('---------------------------------');
  console.log('The following environment variables are required for email delivery:');
  console.log('');
  console.log('📧 RESEND_API_KEY - for sending emails');
  console.log('   → Get from: https://resend.com/api-keys');
  console.log('   → Set in your .env.local file');
  console.log('');
  console.log('🤖 OPENAI_API_KEY - for generating content');
  console.log('   → Get from: https://platform.openai.com/api-keys');
  console.log('   → Set in your .env.local file');
  console.log('');
  console.log('🗄️  Database variables:');
  console.log('   → NEXT_PUBLIC_SUPABASE_URL');
  console.log('   → SUPABASE_SERVICE_KEY');
  console.log('');
  
  // Check 5: Common Issues & Solutions
  console.log('5️⃣ COMMON ISSUES & SOLUTIONS');
  console.log('----------------------------');
  console.log('');
  console.log('🔍 EMAIL NOT RECEIVED? CHECK THESE:');
  console.log('');
  console.log('📧 SPAM/JUNK FOLDER:');
  console.log('   → Check spam/junk folder for hello@launchfly.ai');
  console.log('   → Look for subject containing "order is ready"');
  console.log('   → Add hello@launchfly.ai to safe senders');
  console.log('');
  console.log('⚙️  CONFIGURATION ISSUES:');
  console.log('   → Verify RESEND_API_KEY is set and valid');
  console.log('   → Check Resend dashboard for delivery logs');
  console.log('   → Ensure domain verification is complete');
  console.log('');
  console.log('🔄 FULFILLMENT NOT TRIGGERED:');
  console.log('   → Check server logs for fulfillment processing');
  console.log('   → Verify purchase was recorded in database');
  console.log('   → Ensure fulfillment system is activated');
  console.log('');
  console.log('📝 DEBUGGING STEPS:');
  console.log('   1. Check browser developer console for errors');
  console.log('   2. Monitor server logs during purchase process');
  console.log('   3. Verify Stripe webhook is configured correctly');
  console.log('   4. Test with a different email address');
  console.log('   5. Check Resend dashboard for send attempts');
  console.log('');
  console.log('🧪 MANUAL TESTING:');
  console.log('   → Run: node test-fulfillment-system.js');
  console.log('   → Run: node test-fulfillment-direct.js');
  console.log('   → Check server console for detailed error messages');
  console.log('');
  console.log('📞 SUPPORT:');
  console.log('   → Check server logs for specific error messages');
  console.log('   → Verify all environment variables are correctly set');
  console.log('   → Test email delivery with a simple test first');
  
  console.log('\n✅ DIAGNOSTIC COMPLETE');
  console.log('======================');
  console.log('Review the checks above to identify the issue.');
  console.log('Most commonly, the issue is:');
  console.log('• Missing RESEND_API_KEY environment variable');
  console.log('• Email went to spam/junk folder');
  console.log('• Fulfillment was not triggered after purchase');
  console.log('• Domain verification incomplete on Resend');
}

// Run the diagnostic
diagnoseEmailDelivery();
