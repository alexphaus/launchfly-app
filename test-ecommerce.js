#!/usr/bin/env node

/**
 * Test E-commerce Business Generation
 * 
 * This script tests the AI business type detection and e-commerce functionality
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { nanoid } = require('nanoid');

// Configuration
const LOCAL_URL = process.env.LOCAL_URL || 'http://localhost:3001';
const WEBHOOK_ENDPOINT = `${LOCAL_URL}/api/webhook/tally`;

// Test data for male skincare e-commerce business
const sessionId = nanoid();
const mockTallyData = {
  eventId: `evt_${nanoid()}`,
  eventType: "FORM_RESPONSE",
  createdAt: new Date().toISOString(),
  data: {
    responseId: `res_${nanoid()}`,
    submissionId: `sub_${nanoid()}`,
    respondentId: `resp_${nanoid()}`,
    formId: "mock_tally_form_id",
    formName: "Launchfly Business Generation Form",
    createdAt: new Date().toISOString(),
    fields: [
      {
        key: "question_name",
        label: "Name",
        type: "INPUT_TEXT",
        value: "Alex Test"
      },
      {
        key: "question_email", 
        label: "Email",
        type: "INPUT_EMAIL",
        value: "alextest@example.com"
      },
      {
        key: "question_skills",
        label: "What are your main skills or interests?",
        type: "TEXTAREA",
        value: "DTC ecommerce, skincare formulation basics, content marketing, influencer partnerships"
      },
      {
        key: "question_business_type",
        label: "What type of business are you most interested in?",
        type: "MULTIPLE_CHOICE",
        value: "Ecommerce (physical products)"
      },
      {
        key: "question_goal",
        label: "What's your business goal?", 
        type: "MULTIPLE_CHOICE",
        value: "Launch and scale a profitable DTC brand"
      },
      {
        key: "question_preferences",
        label: "Any special preferences or ideas you have?",
        type: "TEXTAREA", 
        value: "Build a brand selling male skincare products (face wash, moisturizer, SPF). Start with a 3-product starter kit targeting men 25-40. Focus on clean ingredients, simple routines, and a modern brand voice. Prioritize Shopify, email capture, and UGC on TikTok/IG."
      },
      {
        key: "question_plan",
        label: "plan",
        type: "HIDDEN",
        value: "Starter"
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

async function testEcommerceGeneration() {
  console.log('🧪 Testing E-commerce Business Generation...');
  console.log(`📧 Email: alextest@example.com`);
  console.log(`👤 Name: Alex Test`);
  console.log(`🆔 Session ID: ${sessionId}`);
  console.log(`🛒 Business Type: Male Skincare E-commerce`);
  console.log('');

  try {
    console.log('📡 Sending webhook request...');
    const response = await makeRequest(WEBHOOK_ENDPOINT, mockTallyData);
    
    console.log(`📊 Response Status: ${response.statusCode}`);
    console.log(`📄 Response Body: ${response.body}`);
    
    if (response.statusCode === 200) {
      console.log('✅ Webhook request successful!');
      
      const dashboardUrl = `${LOCAL_URL}/dashboard/${sessionId}`;
      console.log('');
      console.log(`🎯 Dashboard URL: ${dashboardUrl}`);
      console.log('');
      console.log('🚀 Next Steps:');
      console.log('1. Open the dashboard URL in your browser');
      console.log('2. Start the business generation process');
      console.log('3. Watch for AI to detect this as an e-commerce business');
      console.log('4. Verify shopping cart, product grid, and checkout functionality');
      console.log('');
      console.log('Expected AI Business Type Detection:');
      console.log('- businessModel: "ecommerce"');
      console.log('- isEcommerce: true');
      console.log('- Should generate physical products (face wash, moisturizer, SPF)');
      console.log('- Should include shopping cart functionality');
      console.log('- Should display product grid instead of generic service layout');
      
    } else {
      console.log('❌ Webhook request failed');
      console.log('Response:', response.body);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your Next.js dev server is running (npm run dev)');
    console.log('2. Check that your environment variables are set correctly');
    console.log('3. Verify your database connection is working');
    console.log('4. Check the console logs in your Next.js app for errors');
  }
}

// Run the test
testEcommerceGeneration();
