#!/usr/bin/env node

/**
 * Simple Email Delivery Test
 * 
 * Uses existing business to test email delivery after purchase
 */

const https = require('https');
const http = require('http');

const LOCAL_URL = 'http://localhost:3000';
const SESSION_ID = 'bfVfJ3g8tJh9j1R83PcT5'; // From the created business
const TEST_EMAIL = 'emailtest1755445371@example.com';

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

async function testSimpleEmailDelivery() {
  console.log('📧 SIMPLE EMAIL DELIVERY TEST');
  console.log('==============================\n');
  
  try {
    console.log('1️⃣ Using existing business...');
    console.log(`   Session ID: ${SESSION_ID}`);
    console.log(`   Customer: ${TEST_EMAIL}\n`);
    
    console.log('2️⃣ Testing purchase simulation...');
    
    // Try to use the cart/purchase endpoint
    const purchaseTest = await makeRequest(`${LOCAL_URL}/api/cart/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        customerEmail: TEST_EMAIL,
        customerName: 'Email Test User',
        amount: 47.99,
        productName: 'Premium Anti-Aging Serum - Email Test'
      })
    });
    
    console.log('Purchase test response:', purchaseTest.status);
    
    if (purchaseTest.status === 200) {
      console.log('✅ Purchase simulated successfully!');
      console.log('   This should trigger email delivery...\n');
      
      console.log('3️⃣ Waiting for email processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ EMAIL DELIVERY TEST COMPLETE!');
      console.log('=================================');
      console.log(`📧 Check email: ${TEST_EMAIL}`);
      console.log('');
      console.log('Expected email:');
      console.log('📋 Subject: 🎉 Your order is ready - value inside!');
      console.log('📋 From: fulfillment@launchfly.ai');
      console.log('📋 Content: Personalized skincare routine & guides');
      
    } else {
      console.log('❌ Purchase test failed:', purchaseTest.data);
      
      console.log('\n3️⃣ Trying manual fulfillment trigger...');
      
      // Try to trigger fulfillment manually using test business
      const manualTest = await makeRequest(`${LOCAL_URL}/api/test/fulfillment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          customerEmail: TEST_EMAIL,
          customerName: 'Email Test User',
          testMode: false
        })
      });
      
      console.log('Manual fulfillment response:', manualTest.status);
      if (manualTest.status === 200) {
        console.log('✅ Manual fulfillment triggered!');
        console.log(`📧 Check email: ${TEST_EMAIL}`);
      } else {
        console.log('❌ Manual fulfillment failed:', manualTest.data);
      }
    }
    
    console.log('\n🔍 EMAIL TROUBLESHOOTING:');
    console.log('=========================');
    console.log('1. Check spam/junk folder');
    console.log('2. Look for fulfillment@launchfly.ai');
    console.log('3. Check server logs for errors');
    console.log('4. Verify RESEND_API_KEY is configured');
    console.log('5. Check Resend dashboard for delivery status');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSimpleEmailDelivery();
