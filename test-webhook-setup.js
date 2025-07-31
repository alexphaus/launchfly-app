#!/usr/bin/env node

/**
 * Test script to verify Stripe webhook and database integration
 * Run this after setting up webhook forwarding with Stripe CLI
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jahdnckxduwkxodyjbnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE'
);

async function testWebhookSetup() {
  console.log('🧪 Testing Stripe Webhook and Database Integration\n');
  
  // Test 1: Check if sales table exists and is accessible
  console.log('1️⃣ Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return;
    }
    console.log('✅ Database connection successful');
  } catch (err) {
    console.error('❌ Database test failed:', err.message);
    return;
  }
  
  // Test 2: Check recent sales
  console.log('\n2️⃣ Checking recent sales...');
  try {
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Failed to fetch sales:', error.message);
      return;
    }
    
    console.log(`📊 Found ${sales.length} recent sales:`);
    if (sales.length === 0) {
      console.log('   No sales found. This is expected if webhooks aren\'t working yet.');
    } else {
      sales.forEach((sale, i) => {
        console.log(`   ${i + 1}. $${sale.amount} - ${sale.customer_email} - ${new Date(sale.created_at).toLocaleString()}`);
      });
    }
  } catch (err) {
    console.error('❌ Sales check failed:', err.message);
  }
  
  // Test 3: Check if webhook endpoint is accessible
  console.log('\n3️⃣ Testing webhook endpoint accessibility...');
  try {
    const response = await fetch('http://localhost:3001/api/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'webhook' })
    });
    
    const text = await response.text();
    if (text.includes('No stripe-signature header')) {
      console.log('✅ Webhook endpoint is accessible and responding correctly');
    } else {
      console.warn('⚠️ Webhook endpoint response unexpected:', text);
    }
  } catch (err) {
    console.error('❌ Webhook endpoint not accessible:', err.message);
    console.log('   Make sure your Next.js server is running on localhost:3001');
  }
  
  // Test 4: Check business data for product info
  console.log('\n4️⃣ Checking business data...');
  try {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error('❌ Failed to fetch businesses:', error.message);
      return;
    }
    
    console.log(`🏢 Found ${businesses.length} businesses:`);
    businesses.forEach((business, i) => {
      const productsCount = business.business_data?.products?.length || 0;
      const plansCount = business.business_data?.layout?.find(s => s.component === 'PricingTable')?.props?.plans?.length || 0;
      console.log(`   ${i + 1}. ${business.name} (${business.subdomain}) - ${productsCount} products, ${plansCount} pricing plans`);
    });
  } catch (err) {
    console.error('❌ Business data check failed:', err.message);
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Make sure your Next.js server is running: npm run dev');
  console.log('2. Start Stripe webhook forwarding: stripe listen --forward-to localhost:3001/api/stripe/webhook');
  console.log('3. Update STRIPE_WEBHOOK_SECRET in .env.local with the secret from stripe listen');
  console.log('4. Make a test purchase and watch the logs');
  console.log('\n📝 If you see webhook events in the Stripe CLI but no database records,');
  console.log('   check the Next.js server logs for webhook processing errors.');
}

testWebhookSetup().catch(console.error);
