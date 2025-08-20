#!/usr/bin/env node

/**
 * Debug Email Delivery Issue
 * Let's test each step of the fulfillment process to find where emails are failing
 */

const https = require('https');
const http = require('http');

// Configuration - Update this with your actual email
const LOCAL_URL = 'http://localhost:3000';
const YOUR_EMAIL = 'axpg31@gmail.com'; // Your actual email address

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

async function debugEmailIssue() {
  console.log('🔍 DEBUGGING EMAIL DELIVERY ISSUE');
  console.log('==================================');
  console.log(`Testing with email: ${YOUR_EMAIL}\n`);

  try {
    // Step 1: Test server connection
    console.log('1️⃣ Testing server connection...');
    const pingResponse = await makeRequest(`${LOCAL_URL}/api/fulfillment/manual`);
    console.log(`✅ Server responds: ${pingResponse.status}`);
    
    // Step 2: Test simple email sending
    console.log('\n2️⃣ Testing simple email functionality...');
    
    // Check if we can send a test email directly
    const emailTestResponse = await makeRequest(`${LOCAL_URL}/api/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: YOUR_EMAIL,
        subject: 'Test Email from Launchfly',
        message: 'This is a test email to verify email delivery works.'
      })
    });
    
    console.log(`Email test response: ${emailTestResponse.status}`);
    console.log('Response:', emailTestResponse.data);
    
    // Step 3: Test creating a business
    console.log('\n3️⃣ Testing business creation...');
    const businessResponse = await makeRequest(`${LOCAL_URL}/api/businesses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Debug Test Business',
        email: YOUR_EMAIL,
        business_data: {
          niche: 'skincare',
          target_audience: 'men',
          type: 'ecommerce'
        }
      })
    });
    
    if (businessResponse.status === 200 || businessResponse.status === 201) {
      console.log('✅ Business created successfully');
      const businessId = businessResponse.data.business?.id || businessResponse.data.id;
      
      // Step 4: Test creating a sale
      console.log('\n4️⃣ Testing sale creation...');
      const saleResponse = await makeRequest(`${LOCAL_URL}/api/sales/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: businessId,
          amount: 47.99,
          currency: 'usd',
          customer_email: YOUR_EMAIL,
          customer_name: 'Alex (Debug Test)',
          reference: 'Debug Test Product'
        })
      });
      
      if (saleResponse.status === 200) {
        console.log('✅ Sale created successfully');
        const saleId = saleResponse.data.sale.id;
        
        // Step 5: Test fulfillment trigger
        console.log('\n5️⃣ Testing fulfillment trigger...');
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
        
        console.log('Fulfillment response:', fulfillmentResponse.status);
        console.log('Fulfillment data:', fulfillmentResponse.data);
        
        if (fulfillmentResponse.status === 200) {
          console.log('\n✅ FULFILLMENT TRIGGERED SUCCESSFULLY!');
          console.log('📧 Check your email inbox for the fulfillment email.');
          console.log(`Email should be sent to: ${YOUR_EMAIL}`);
          console.log(`Subject: 🎉 Your Debug Test Business order is ready - $XXX+ value inside!`);
        } else {
          console.log('❌ Fulfillment failed');
        }
        
      } else {
        console.log('❌ Sale creation failed:', saleResponse.data);
      }
      
    } else {
      console.log('❌ Business creation failed:', businessResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the debug
debugEmailIssue();
