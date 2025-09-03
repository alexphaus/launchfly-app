#!/usr/bin/env node

/**
 * Test script for Revenue Generation Engine
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testRevenueEngine() {
  console.log('\n🚀 Testing Revenue Engine...\n');
  
  let businessId = null;
  
  try {
    // 1. Create test business
    console.log('1. Creating test business...');
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Revenue Business',
        email: 'test@example.com',
        subdomain: `test-${Date.now()}`,
        business_type: 'ecommerce'
      })
      .select()
      .single();
    
    businessId = business.id;
    console.log('   ✓ Business created:', businessId);
    
    // 2. Initialize revenue engine
    console.log('\n2. Initializing revenue engine...');
    const response = await fetch(`${API_BASE}/api/revenue-engine/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: businessId,
        templateId: 'ecommerce-dropship'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to initialize revenue engine');
    }
    
    const result = await response.json();
    console.log('   ✓ Revenue engine initialized');
    console.log('   • Revenue streams:', result.data.revenueStreams);
    console.log('   • Projected monthly: $' + result.data.projectedMonthlyRevenue);
    
    // 3. Check revenue streams
    console.log('\n3. Checking revenue streams...');
    const { data: streams } = await supabase
      .from('revenue_streams')
      .select('*')
      .eq('business_id', businessId);
    
    console.log('   ✓ Active streams:', streams.length);
    
    // 4. Check products
    console.log('\n4. Checking products...');
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId);
    
    console.log('   ✓ Products created:', products.length);
    
    // 5. Test analytics
    console.log('\n5. Testing analytics...');
    const analyticsResponse = await fetch(
      `${API_BASE}/api/revenue-engine/analytics?businessId=${businessId}`
    );
    
    if (!analyticsResponse.ok) {
      throw new Error('Failed to get analytics');
    }
    
    console.log('   ✓ Analytics working');
    
    console.log('\n✅ All tests passed!');
    console.log('💰 Revenue engine is ready for beta users.\n');
    
    // Cleanup
    await cleanup(businessId);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (businessId) await cleanup(businessId);
    process.exit(1);
  }
}

async function cleanup(businessId) {
  console.log('\nCleaning up test data...');
  
  // Delete test data
  await supabase.from('revenue_streams').delete().eq('business_id', businessId);
  await supabase.from('products').delete().eq('business_id', businessId);
  await supabase.from('businesses').delete().eq('id', businessId);
  
  console.log('✓ Cleanup complete');
}

// Run test
testRevenueEngine();