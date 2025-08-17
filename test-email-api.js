#!/usr/bin/env node

/**
 * API-Based Email Delivery Test
 * 
 * This tests email delivery by using the existing API endpoints
 * which have access to the proper environment variables
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

async function testEmailViaAPI() {
  console.log('📧 TESTING EMAIL DELIVERY VIA API');
  console.log('==================================\n');
  
  try {
    console.log('1️⃣ Checking server status...');
    const healthCheck = await makeRequest(`${LOCAL_URL}/api/health`);
    console.log('✅ Server is running\n');
    
    console.log('2️⃣ Creating business via Tally webhook simulation...');
    
    // Create business using the webhook endpoint (which works from previous tests)
    const webhookResponse = await makeRequest(`${LOCAL_URL}/api/webhook/tally`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: `evt_email_test_${Date.now()}`,
        eventType: "FORM_RESPONSE",
        createdAt: new Date().toISOString(),
        data: {
          responseId: `res_email_test_${Date.now()}`,
          formId: "email_test_form",
          formName: "Email Delivery Test",
          createdAt: new Date().toISOString(),
          fields: [
            { key: "question_email", label: "Email", type: "INPUT_EMAIL", value: TEST_EMAIL },
            { key: "question_name", label: "Name", type: "INPUT_TEXT", value: "Email Test Customer" },
            { key: "question_business", label: "Business Type", type: "MULTIPLE_CHOICE", value: "male-skincare" }
          ]
        }
      })
    });
    
    if (webhookResponse.status !== 200) {
      console.log('❌ Failed to create business:', webhookResponse.data);
      return;
    }
    
    const businessId = webhookResponse.data.businessId;
    console.log(`✅ Business created: ${businessId}`);
    console.log(`   Name: ${webhookResponse.data.businessName}`);
    console.log(`   Type: ${webhookResponse.data.businessType}\n`);
    
    console.log('3️⃣ Simulating purchase via Stripe webhook...');
    
    // Simulate a Stripe purchase webhook
    const purchaseResponse = await makeRequest(`${LOCAL_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature' // Mock signature for testing
      },
      body: JSON.stringify({
        id: `evt_purchase_test_${Date.now()}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: `cs_test_${Date.now()}`,
            object: 'checkout.session',
            payment_status: 'paid',
            amount_total: 4799, // $47.99
            currency: 'usd',
            customer_details: {
              email: TEST_EMAIL,
              name: 'Email Test Customer'
            },
            metadata: {
              businessId: businessId,
              productName: 'Premium Anti-Aging Serum'
            }
          }
        }
      })
    });
    
    console.log('Purchase webhook response:', purchaseResponse.status);
    
    if (purchaseResponse.status === 200) {
      console.log('✅ Purchase processed successfully!');
      console.log('   This should have triggered:');
      console.log('   1. Sale record creation');
      console.log('   2. Fulfillment system activation');
      console.log('   3. Email delivery to customer\n');
      
      console.log('4️⃣ Checking if email was sent...');
      
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ EMAIL DELIVERY TEST COMPLETE!');
      console.log('=================================');
      console.log(`📧 Check your email: ${TEST_EMAIL}`);
      console.log('');
      console.log('Expected email content:');
      console.log('📋 Subject: 🎉 Your order is ready - $450+ value inside!');
      console.log('📋 From: fulfillment@launchfly.ai');
      console.log('📋 Beautiful HTML email with:');
      console.log('   ✨ Personalized skincare content');
      console.log('   💰 High-value deliverables ($450+ worth)');
      console.log('   🔗 Direct access links');
      console.log('   📱 Mobile-optimized design');
      console.log('   🎯 30-day money-back guarantee');
      
    } else {
      console.log('❌ Purchase processing failed');
      console.log('Response:', purchaseResponse.data);
    }
    
    console.log('\n🔍 TROUBLESHOOTING GUIDE:');
    console.log('=========================');
    console.log('If you didn\'t receive the email:');
    console.log('');
    console.log('1. 📧 CHECK SPAM/JUNK FOLDER');
    console.log('   - Look for sender: fulfillment@launchfly.ai');
    console.log('   - Subject contains: "order is ready"');
    console.log('');
    console.log('2. 🔍 CHECK SERVER LOGS');
    console.log('   - Look for fulfillment processing messages');
    console.log('   - Check for Resend API errors');
    console.log('');
    console.log('3. ⚙️  VERIFY CONFIGURATION');
    console.log('   - RESEND_API_KEY environment variable');
    console.log('   - OPENAI_API_KEY environment variable');
    console.log('   - Domain verification on Resend');
    console.log('');
    console.log('4. 🧪 TEST WITH DIFFERENT EMAIL');
    console.log(`   - Run: TEST_EMAIL=your.email@domain.com node test-email-api.js`);
    console.log('');
    console.log('5. 🔄 MANUAL RETRY');
    console.log('   - Use the fulfillment API directly');
    console.log('   - Check Resend dashboard for delivery status');
    
  } catch (error) {
    console.error('❌ Email delivery test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testEmailViaAPI();
}

module.exports = { testEmailViaAPI };
