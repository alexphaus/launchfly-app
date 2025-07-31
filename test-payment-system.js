#!/usr/bin/env node

/**
 * Test script for payment processing system
 * Run with: node test-payment-system.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testPaymentSystem() {
  console.log('🧪 Testing Payment Processing System\n');

  // Test 1: Check if businesses have products
  console.log('1. Checking businesses with products...');
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('status', 'ready')
    .limit(5);

  if (error) {
    console.error('❌ Error fetching businesses:', error.message);
    return;
  }

  const businessesWithProducts = businesses.filter(b => 
    b.business_data?.products && b.business_data.products.length > 0
  );

  console.log(`✅ Found ${businessesWithProducts.length} businesses with products`);
  
  if (businessesWithProducts.length > 0) {
    const testBusiness = businessesWithProducts[0];
    console.log(`📋 Test Business: ${testBusiness.name} (${testBusiness.subdomain})`);
    console.log(`🛍️  Products: ${testBusiness.business_data.products.length}`);
    
    // List products
    testBusiness.business_data.products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - ${product.price}`);
    });
  }

  // Test 2: Check sales table structure
  console.log('\n2. Checking sales table...');
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .limit(5);

  if (salesError) {
    console.error('❌ Error fetching sales:', salesError.message);
  } else {
    console.log(`✅ Sales table accessible, ${sales.length} recent sales found`);
    if (sales.length > 0) {
      console.log(`💰 Recent sale: $${sales[0].amount} - ${sales[0].product_id}`);
    }
  }

  // Test 3: Environment variables
  console.log('\n3. Checking environment variables...');
  const requiredEnvVars = [
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY', 
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY'
  ];

  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: ${process.env[envVar].substring(0, 10)}...`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
    }
  });

  console.log('\n🎉 Payment system test completed!');
  console.log('\n📖 Next steps:');
  console.log('1. Set up Stripe webhook endpoint');
  console.log('2. Test checkout flow with test cards');
  console.log('3. Verify email notifications work');
  console.log('\n💡 Test URLs:');
  if (businessesWithProducts.length > 0) {
    const testBusiness = businessesWithProducts[0];
    console.log(`   Business: http://localhost:3002/sites/${testBusiness.subdomain}`);
    if (testBusiness.business_data.products[0]) {
      const firstProduct = testBusiness.business_data.products[0];
      const productSlug = firstProduct.id || firstProduct.name.toLowerCase().replace(/\s+/g, '-');
      console.log(`   Product:  http://localhost:3002/sites/${testBusiness.subdomain}/product/${productSlug}`);
    }
  }
}

testPaymentSystem().catch(console.error);
