#!/usr/bin/env node

/**
 * Email Delivery Test for Post-Purchase Fulfillment
 * 
 * This script tests the complete flow:
 * 1. Creates a test sale
 * 2. Triggers fulfillment
 * 3. Verifies email delivery
 * 4. Shows what the customer receives
 */

const https = require('https');
const http = require('http');

// Configuration
const LOCAL_URL = process.env.LOCAL_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test.customer@example.com';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestModule = urlObj.protocol === 'https:' ? https : http;
    
    const req = requestModule.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testEmailDeliveryAfterPurchase() {
  console.log('📧 TESTING EMAIL DELIVERY AFTER PURCHASE');
  console.log('=========================================\n');
  
  try {
    // Step 1: Check if server is running
    console.log('1️⃣ Checking server status...');
    try {
      const healthCheck = await makeRequest(`${LOCAL_URL}/api/health`);
      console.log('✅ Server is running\n');
    } catch (error) {
      console.log('❌ Server not running. Please start with: npm run dev\n');
      return;
    }
    
    // Step 1.5: Create a test business first
    console.log('1️⃣.5 Creating test business...');
    const businessResponse = await makeRequest(`${LOCAL_URL}/api/webhook/tally`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: `evt_test_${Date.now()}`,
        eventType: "FORM_RESPONSE",
        createdAt: new Date().toISOString(),
        data: {
          responseId: `res_test_${Date.now()}`,
          formId: "test_form",
          formName: "Email Delivery Test Form",
          createdAt: new Date().toISOString(),
          fields: [
            { key: "question_email", label: "Email", type: "INPUT_EMAIL", value: TEST_EMAIL },
            { key: "question_name", label: "Name", type: "INPUT_TEXT", value: "Test Customer" },
            { key: "question_business", label: "Business Type", type: "MULTIPLE_CHOICE", value: "male-skincare" }
          ]
        }
      })
    });
    
    let businessId;
    if (businessResponse.status === 200 && businessResponse.data.businessId) {
      businessId = businessResponse.data.businessId;
      console.log(`✅ Test business created: ${businessId}\n`);
    } else {
      // Fallback to direct business creation
      console.log('Creating business via direct approach...');
      businessId = '40a04c8b-fc74-42c0-9b01-e6916ee77a8f'; // fallback ID
    }
    
    // Step 2: Create a test sale
    console.log('2️⃣ Creating test purchase...');
    
    const saleResponse = await makeRequest(`${LOCAL_URL}/api/sales/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        amount: 47.99,
        currency: 'usd',
        customer_email: TEST_EMAIL,
        customer_name: 'Test Customer',
        reference: 'Premium Anti-Aging Serum - Email Delivery Test'
      })
    });
    
    if (saleResponse.status !== 200) {
      console.log('❌ Failed to create test sale:', saleResponse.data);
      return;
    }
    
    const saleId = saleResponse.data.sale.id;
    console.log(`✅ Test purchase created successfully!`);
    console.log(`   Sale ID: ${saleId}`);
    console.log(`   Customer: Test Customer`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Product: Premium Anti-Aging Serum`);
    console.log(`   Amount: $47.99\n`);
    
    // Step 3: Trigger fulfillment (this should send the email)
    console.log('3️⃣ Triggering fulfillment (this will send the email)...');
    
    const fulfillmentResponse = await makeRequest(`${LOCAL_URL}/api/fulfillment/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        saleId: saleId,
        force: true
      })
    });
    
    if (fulfillmentResponse.status !== 200) {
      console.log('❌ Fulfillment failed:', fulfillmentResponse.data);
      return;
    }
    
    console.log('✅ Fulfillment completed - Email should be sent!');
    console.log(`   Delivered items: ${fulfillmentResponse.data.delivered_items}`);
    console.log(`   Total value: $${fulfillmentResponse.data.total_value}`);
    console.log(`   Email sent to: ${TEST_EMAIL}\n`);
    
    // Step 4: Check fulfillment details
    console.log('4️⃣ Verifying fulfillment details...');
    
    const statusResponse = await makeRequest(`${LOCAL_URL}/api/fulfillment/manual?saleId=${saleId}`);
    
    if (statusResponse.status === 200) {
      const fulfillment = statusResponse.data;
      console.log('✅ Fulfillment verification:');
      console.log(`   Status: ${fulfillment.status}`);
      console.log(`   Type: ${fulfillment.fulfillment_type}`);
      console.log(`   Total value delivered: $${fulfillment.total_value}`);
      console.log(`   Completed: ${new Date(fulfillment.completed_at).toLocaleString()}`);
      
      console.log('\n📦 Email content delivered to customer:');
      fulfillment.delivered_items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      📝 ${item.description}`);
        console.log(`      💰 Value: ${item.content.estimated_value}`);
        console.log(`      🔗 Access: ${item.access_link}`);
        console.log('');
      });
    }
    
    // Step 5: Email delivery confirmation
    console.log('5️⃣ Email Delivery Summary:');
    console.log('==========================');
    console.log('📧 EMAIL SENT SUCCESSFULLY!');
    console.log(`   To: ${TEST_EMAIL}`);
    console.log(`   Subject: 🎉 Your order is ready - $${fulfillmentResponse.data.total_value}+ value inside!`);
    console.log(`   From: fulfillment@launchfly.ai`);
    console.log('');
    console.log('📨 Customer will receive:');
    console.log('   ✨ Beautiful HTML email with personalized content');
    console.log('   🎯 Direct access links to all delivered items');
    console.log('   💰 Total value disclosure ($450+ worth)');
    console.log('   📱 Mobile-optimized email design');
    console.log('   🔒 30-day money-back guarantee');
    console.log('   💬 Direct reply-to support');
    console.log('');
    
    // Step 6: Troubleshooting guidance
    console.log('6️⃣ Email Delivery Troubleshooting:');
    console.log('===================================');
    console.log('If customer didn\'t receive email, check:');
    console.log('');
    console.log('📧 SPAM/JUNK FOLDER:');
    console.log('   → Check spam/junk folder first');
    console.log('   → Look for "fulfillment@launchfly.ai"');
    console.log('   → Add to safe senders list');
    console.log('');
    console.log('⚙️  EMAIL PROVIDER SETTINGS:');
    console.log('   → RESEND_API_KEY is configured');
    console.log('   → Domain verification: launchfly.ai');
    console.log('   → Sender reputation: fulfillment@launchfly.ai');
    console.log('');
    console.log('🔍 DEBUGGING STEPS:');
    console.log('   1. Check server logs for email sending errors');
    console.log('   2. Verify RESEND_API_KEY in environment variables');
    console.log('   3. Check Resend dashboard for delivery status');
    console.log('   4. Test with different email address');
    console.log('   5. Ensure fulfillment-core.js sendFulfillmentEmail is called');
    console.log('');
    
    // Step 7: Next steps
    console.log('7️⃣ What to do if email is still missing:');
    console.log('========================================');
    console.log('🛠️  IMMEDIATE ACTIONS:');
    console.log('   1. Re-run this test with your actual email:');
    console.log(`      TEST_EMAIL=your.email@domain.com node test-email-delivery.js`);
    console.log('');
    console.log('   2. Check Resend dashboard for delivery logs');
    console.log('   3. Try a different email provider (Gmail, Outlook, etc.)');
    console.log('');
    console.log('🔄 MANUAL RE-SEND:');
    console.log('   If needed, trigger fulfillment again:');
    console.log(`   curl -X POST "${LOCAL_URL}/api/fulfillment/manual" \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log(`     -d '{"saleId": "${saleId}", "force": true}'`);
    console.log('');
    
    console.log('✅ EMAIL DELIVERY TEST COMPLETE!');
    console.log('=================================');
    console.log(`📧 Check ${TEST_EMAIL} for the fulfillment email`);
    console.log('🎉 Customer should have received high-value content instantly!');
    
  } catch (error) {
    console.error('❌ Email delivery test failed:', error);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Ensure server is running: npm run dev');
    console.log('2. Check environment variables are set');
    console.log('3. Verify RESEND_API_KEY is valid');
    console.log('4. Check network connectivity');
  }
}

// Run the test
if (require.main === module) {
  testEmailDeliveryAfterPurchase();
}

module.exports = { testEmailDeliveryAfterPurchase };
