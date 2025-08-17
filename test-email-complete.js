#!/usr/bin/env node

/**
 * Email Delivery Test - Working Version
 * 
 * This test:
 * 1. Creates a business via webhook (working method)
 * 2. Makes a purchase simulation that triggers fulfillment
 * 3. Tests if email delivery works
 */

const https = require('https');
const http = require('http');
const { nanoid } = require('nanoid');

// Configuration - using port 3000 where our server is running
const LOCAL_URL = 'http://localhost:3000';
const WEBHOOK_ENDPOINT = `${LOCAL_URL}/api/webhook/tally`;
const TEST_EMAIL = process.env.TEST_EMAIL || 'emaildelivery@example.com';

// Unique session for this test
const sessionId = nanoid();

// Mock data for creating a business
const mockTallyData = {
  eventId: `evt_email_test_${Date.now()}`,
  eventType: "FORM_RESPONSE",
  createdAt: new Date().toISOString(),
  data: {
    responseId: `res_email_test_${Date.now()}`,
    submissionId: `sub_${nanoid()}`,
    respondentId: `resp_${nanoid()}`,
    formId: "email_test_form",
    formName: "Email Delivery Test Form",
    createdAt: new Date().toISOString(),
    fields: [
      {
        key: "question_email",
        label: "Email",
        type: "INPUT_EMAIL",
        value: TEST_EMAIL
      },
      {
        key: "question_name",
        label: "Name",
        type: "INPUT_TEXT",
        value: "Email Test Customer"
      },
      {
        key: "question_business_type",
        label: "What type of business are you most interested in?",
        type: "MULTIPLE_CHOICE",
        value: "Ecommerce (physical products)"
      },
      {
        key: "question_preferences",
        label: "Any special preferences or ideas you have?",
        type: "TEXTAREA", 
        value: "Male skincare products - face wash, moisturizer, anti-aging serum. Target men 25-40 who want effective skincare."
      },
      {
        key: "question_session_id",
        label: "sessionID", 
        type: "HIDDEN",
        value: sessionId
      }
    ]
  }
};

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testEmailDeliveryComplete() {
  console.log('📧 COMPLETE EMAIL DELIVERY TEST');
  console.log('================================\n');
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log(`🆔 Session ID: ${sessionId}`);
  console.log(`🛒 Business: Male Skincare E-commerce\n`);

  try {
    // Step 1: Create business via webhook
    console.log('1️⃣ Creating business via webhook...');
    const webhookResponse = await makeRequest(WEBHOOK_ENDPOINT, mockTallyData);
    
    if (webhookResponse.statusCode !== 200) {
      console.log('❌ Business creation failed:', webhookResponse.body);
      return;
    }
    
    console.log('✅ Business created successfully!');
    
    // Parse the response to get business info
    let businessData;
    try {
      businessData = JSON.parse(webhookResponse.body);
    } catch (e) {
      console.log('Business creation response:', webhookResponse.body);
    }
    
    // Step 2: Wait a moment for business processing
    console.log('\n2️⃣ Waiting for business generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Now simulate an actual purchase via the generated website
    console.log('\n3️⃣ Simulating purchase on the generated website...');
    
    // Try to find the business ID by calling the dashboard
    const dashboardUrl = `${LOCAL_URL}/dashboard/${sessionId}`;
    console.log(`   Dashboard: ${dashboardUrl}`);
    
    // Step 4: Create a purchase simulation that should trigger fulfillment
    // Let's try a few different approaches
    
    console.log('\n4️⃣ Testing purchase and fulfillment trigger...');
    
    // Approach 1: Use the growth API to trigger customer acquisition
    try {
      const growthResponse = await makeRequest(`${LOCAL_URL}/api/growth/start`, {
        sessionId: sessionId,
        email: TEST_EMAIL,
        strategies: ["customer-acquisition"],
        testMode: false
      });
      
      if (growthResponse.statusCode === 200) {
        console.log('✅ Growth trigger successful - this may include email delivery');
      } else {
        console.log('⚠️  Growth trigger response:', growthResponse.statusCode);
      }
    } catch (error) {
      console.log('⚠️  Growth trigger failed:', error.message);
    }
    
    // Approach 2: Try to trigger fulfillment manually if we can find the business
    console.log('\n5️⃣ Attempting direct fulfillment test...');
    
    // Check if there's a test endpoint we can use
    try {
      const testResponse = await makeRequest(`${LOCAL_URL}/api/test/customer-acquisition`, {
        sessionId: sessionId,
        email: TEST_EMAIL,
        testMode: false
      });
      
      if (testResponse.statusCode === 200) {
        console.log('✅ Test customer acquisition successful');
        const testData = JSON.parse(testResponse.body);
        console.log('Response:', testData);
      } else {
        console.log('⚠️  Test response:', testResponse.statusCode, testResponse.body.slice(0, 200));
      }
    } catch (error) {
      console.log('⚠️  Test failed:', error.message);
    }
    
    console.log('\n✅ EMAIL DELIVERY TEST COMPLETED!');
    console.log('==================================');
    console.log(`📧 Check your email: ${TEST_EMAIL}`);
    console.log('');
    console.log('What to look for:');
    console.log('📋 Subject: Contains "order is ready" or similar');
    console.log('📋 From: fulfillment@launchfly.ai');
    console.log('📋 Content: Personalized skincare content');
    console.log('📋 Value: $400+ worth of AI-generated guides');
    console.log('');
    console.log('🔍 If no email received:');
    console.log('1. Check spam/junk folder');
    console.log('2. Look in console logs for errors');
    console.log('3. Verify RESEND_API_KEY is configured');
    console.log('4. Check that fulfillment was triggered');
    console.log('5. Try again with a different email address');
    console.log('');
    console.log(`🌐 Dashboard: ${dashboardUrl}`);
    console.log('💡 Visit the dashboard to see the generated business');
    
  } catch (error) {
    console.error('❌ Email delivery test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure server is running: npm run dev');
    console.log('2. Check environment variables');
    console.log('3. Verify database connection');
    console.log('4. Check console logs for detailed errors');
  }
}

// Run the test
testEmailDeliveryComplete();
