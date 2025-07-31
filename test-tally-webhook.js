#!/usr/bin/env node

/**
 * Test Tally webhook simulation
 * Run with: node test-tally-webhook.js
 */

require('dotenv').config({ path: '.env.local' });

async function testTallyWebhook() {
  console.log('🎯 Testing Tally Webhook Simulation\n');

  // Create test form data that mimics what Tally sends
  const tallyFormData = {
    data: {
      fields: [
        { label: "Name", value: "Alex Test User" },
        { label: "Email", value: `test-${Date.now()}@example.com` },
        { label: "What are your main skills or interests?", value: "Web development and design" },
        { label: "What type of business are you most interested in?", value: "Digital services" },
        { label: "What's your business goal?", value: "Make $5000 per month" },
        { label: "Any special preferences or ideas you have?", value: "Work with tech startups" },
        { label: "plan", value: "Starter" }
      ]
    }
  };

  console.log('📋 Test form data:');
  console.log(`   Name: ${tallyFormData.data.fields[0].value}`);
  console.log(`   Email: ${tallyFormData.data.fields[1].value}`);
  console.log(`   Skills: ${tallyFormData.data.fields[2].value}`);

  try {
    console.log('\n🚀 Calling Tally webhook...');
    const response = await fetch('http://localhost:3002/api/webhook/tally', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Tally-Webhook-Test'
      },
      body: JSON.stringify(tallyFormData)
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Webhook successful!');
      console.log('Response:', responseText);
    } else {
      console.log('❌ Webhook failed:');
      console.log('Status:', response.status, response.statusText);
      console.log('Response:', responseText);
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testTallyWebhook().catch(console.error);
