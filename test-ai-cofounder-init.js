#!/usr/bin/env node
/**
 * Test AI Cofounder initialization with proper error handling
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInitialization() {
  console.log('🧪 Testing AI Cofounder Initialization...\n');

  try {
    // Get a recent business
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.log('❌ Database error:', error.message);
      return;
    }

    if (!businesses || businesses.length === 0) {
      console.log('❌ No businesses found. Create a business first.');
      return;
    }

    const business = businesses[0];
    console.log(`🎯 Testing with business: ${business.business_data?.businessName || 'Unnamed'}`);
    console.log(`   ID: ${business.id}\n`);

    // Test initialization
    console.log('1️⃣ Testing AI Cofounder initialization...');
    const response = await fetch('http://localhost:3000/api/ai-cofounder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        action: 'initialize'
      })
    });

    console.log(`   Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ HTTP Error: ${errorText}`);
      return;
    }

    let result;
    try {
      result = await response.json();
      console.log('   ✅ JSON parsing successful');
    } catch (jsonError) {
      const text = await response.text();
      console.log('   ❌ JSON parsing failed');
      console.log(`   Raw response: ${text.substring(0, 200)}...`);
      return;
    }

    if (result.success) {
      console.log('   ✅ Initialization successful!');
      console.log(`   Integrations: ${JSON.stringify(result.integrations, null, 2)}`);
    } else {
      console.log('   ❌ Initialization failed:', result.error);
    }

    // Test status endpoint
    console.log('\n2️⃣ Testing status endpoint...');
    const statusResponse = await fetch(`http://localhost:3000/api/ai-cofounder?businessId=${business.id}&action=status`);
    
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log('   ✅ Status endpoint working');
      console.log(`   Status: ${JSON.stringify(statusResult, null, 2)}`);
    } else {
      console.log(`   ❌ Status endpoint failed: ${statusResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInitialization();
