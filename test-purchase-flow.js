#!/usr/bin/env node

/**
 * Simple Purchase Flow Test
 */

const http = require('http');

// Configuration
const LOCAL_URL = 'http://localhost:3000';
const YOUR_EMAIL = 'alexphaus@gmail.com';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
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

async function testPurchaseFlow() {
  console.log('🛒 TESTING PURCHASE → EMAIL FLOW');
  console.log('=================================');
  console.log(`Using email: ${YOUR_EMAIL}\n`);

  try {
    // Create business
    console.log('1️⃣ Creating test business...');
    const businessResponse = await makeRequest(`${LOCAL_URL}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Test Business',
        email: YOUR_EMAIL,
        business_data: { niche: 'skincare', target_audience: 'men', type: 'ecommerce' }
      })
    });
    
    console.log(`Business creation: ${businessResponse.status}`);
    if (businessResponse.status !== 200 && businessResponse.status !== 201) {
      console.log('❌ Business creation failed:', businessResponse.data);
      return;
    }
    
    const businessId = businessResponse.data.business?.id || businessResponse.data.id;
    console.log(`✅ Business created: ${businessId}`);
    
    // Create sale
    console.log('\n2️⃣ Creating test sale...');
    const saleResponse = await makeRequest(`${LOCAL_URL}/api/sales/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: businessId,
        amount: 47.99,
        currency: 'usd',
        customer_email: YOUR_EMAIL,
        customer_name: 'Alex Test',
        reference: 'Email Test Product'
      })
    });
    
    console.log(`Sale creation: ${saleResponse.status}`);
    if (saleResponse.status !== 200) {
      console.log('❌ Sale creation failed:', saleResponse.data);
      return;
    }
    
    const saleId = saleResponse.data.sale.id;
    console.log(`✅ Sale created: ${saleId}`);
    
    // Trigger fulfillment
    console.log('\n3️⃣ Triggering fulfillment (this should send email)...');
    const fulfillmentResponse = await makeRequest(`${LOCAL_URL}/api/fulfillment/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId: saleId, force: true })
    });
    
    console.log(`Fulfillment response: ${fulfillmentResponse.status}`);
    console.log('Fulfillment data:', JSON.stringify(fulfillmentResponse.data, null, 2));
    
    if (fulfillmentResponse.status === 200) {
      console.log('\n🎉 SUCCESS! Check your email inbox!');
      console.log(`📧 Email should be sent to: ${YOUR_EMAIL}`);
      console.log('📧 Subject should contain: "Your Email Test Business order is ready"');
    } else {
      console.log('\n❌ Fulfillment failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPurchaseFlow();
