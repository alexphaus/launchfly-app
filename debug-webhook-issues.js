// Check webhook events and logs to see if your purchase was processed
// This will help us determine if the webhook is being called at all

require('dotenv').config({ path: '.env.local' });

async function checkWebhookIssues() {
  try {
    console.log('🔍 Checking Webhook Processing Issues...\n');

    // 1. Check if webhook endpoint is accessible
    console.log('1️⃣ Testing webhook endpoint accessibility...');
    const healthResponse = await fetch('http://localhost:3000/api/webhook/stripe');
    const healthData = await healthResponse.json();
    
    console.log('Webhook Health:', healthData);
    
    if (healthData.env_check) {
      console.log('✅ Environment variables are properly configured');
    } else {
      console.log('❌ Environment variables missing');
      return;
    }

    // 2. Check recent webhook events in Stripe (if possible)
    console.log('\n2️⃣ Checking recent purchase scenarios...');
    
    // Common issues that could cause webhook failures:
    console.log('\n🔍 Common Multi-Item Purchase Issues:');
    console.log('Issue 1: Webhook signature validation failure');
    console.log('  - Solution: Check STRIPE_WEBHOOK_SECRET in production');
    console.log('  - In development, signature validation might be skipped');
    
    console.log('\nIssue 2: Business ID mismatch');
    console.log('  - The business_id in checkout metadata doesn\'t match database');
    console.log('  - This would cause foreign key constraint errors');
    
    console.log('\nIssue 3: Webhook not configured in Stripe dashboard');
    console.log('  - Multi-item purchases create sessions but webhook never fires');
    console.log('  - Check Stripe Dashboard > Webhooks');
    
    console.log('\nIssue 4: Race condition or timing issue');
    console.log('  - Webhook fires before our fix is loaded');
    console.log('  - Server restart needed after code changes');

    // 3. Test the specific scenario that should work now
    console.log('\n3️⃣ Testing Multi-Item Logic Directly...');
    
    // Simulate the exact logic our webhook uses
    const testMetadata = {
      business_id: '54c0ec82-d17b-41b2-9442-0163a3b7b9a4',
      items_count: '2',
      item_names: 'Product A, Product B',
      business_name: 'Test Business'
    };
    
    const isMultiItem = testMetadata.items_count && parseInt(testMetadata.items_count) > 1;
    const hasProductId = !!testMetadata.product_id;
    
    console.log('Test Metadata Analysis:');
    console.log('  items_count:', testMetadata.items_count);
    console.log('  isMultiItem:', isMultiItem);
    console.log('  hasProductId:', hasProductId);
    console.log('  Should pass validation:', isMultiItem || hasProductId);
    
    if (isMultiItem && !hasProductId) {
      console.log('✅ This would trigger our multi-item fix correctly!');
      
      // Test the revenue update directly
      console.log('\n4️⃣ Testing revenue update with multi-item purchase...');
      
      const revenueTest = await fetch('http://localhost:3000/api/business/update-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: testMetadata.business_id,
          amount: 89.97,
          stripeSessionId: 'cs_test_multiitem_' + Date.now(),
          customerEmail: 'test@multiitem.com',
          customerName: 'Multi Item Customer'
        })
      });
      
      const revenueResult = await revenueTest.json();
      console.log('Revenue Update Test:', revenueResult);
      
      if (revenueResult.success) {
        console.log('✅ Revenue update works! The issue might be:');
        console.log('   - Webhook not being called by Stripe');
        console.log('   - Different business ID than expected');
        console.log('   - Webhook signature validation failing');
      } else {
        console.log('❌ Revenue update failed:', revenueResult.error);
      }
    }

    console.log('\n🎯 NEXT STEPS TO DEBUG YOUR ISSUE:');
    console.log('1. Check Stripe Dashboard > Events for recent webhook calls');
    console.log('2. Look at your browser network tab during checkout');
    console.log('3. Check the business_id being used in your checkout');
    console.log('4. Verify webhook endpoint URL in Stripe is correct');
    console.log('5. Make sure the server was restarted after the fix');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkWebhookIssues();
