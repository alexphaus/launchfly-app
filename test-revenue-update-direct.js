// Direct test of the revenue update functionality for multi-item purchases
// This bypasses webhook signature validation and tests the revenue update directly

console.log('🧪 Testing Revenue Update API for Multi-Item Purchases...\n');

async function testRevenueUpdate() {
  try {
    // Test data for a multi-item purchase
    const multiItemPurchase = {
      businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind business ID
      amount: 297.00, // Total amount for multiple items
      stripeSessionId: 'cs_test_multi_item_session_' + Date.now(),
      customerEmail: 'test@multiitem.com',
      customerName: 'Multi Item Test Customer'
    };

    console.log('📋 Test Purchase Data:');
    console.log('  - Business ID:', multiItemPurchase.businessId);
    console.log('  - Amount: $' + multiItemPurchase.amount);
    console.log('  - Session ID:', multiItemPurchase.stripeSessionId);
    console.log('  - Customer:', multiItemPurchase.customerName);
    console.log();

    // First, get current revenue to compare
    console.log('📊 Fetching current business revenue...');
    const businessResponse = await fetch('http://localhost:3000/api/business/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: multiItemPurchase.businessId
      })
    });

    if (!businessResponse.ok) {
      throw new Error('Failed to fetch business data');
    }

    const businessData = await businessResponse.json();
    const currentRevenue = businessData.business?.total_revenue || 0;
    console.log('  Current Revenue: $' + currentRevenue);
    console.log();

    // Now test the revenue update
    console.log('💰 Testing revenue update...');
    
    const response = await fetch('http://localhost:3000/api/business/update-revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(multiItemPurchase)
    });

    const result = await response.json();
    
    console.log('📊 Update Response Status:', response.status);
    console.log('📋 Update Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log('\n✅ SUCCESS: Revenue update worked!');
      console.log('  Previous Revenue: $' + result.previousRevenue);
      console.log('  New Revenue: $' + result.newRevenue);
      console.log('  Purchase Amount: $' + result.saleAmount);
      console.log('  Revenue Increase: $' + (result.newRevenue - result.previousRevenue));
      
      // Verify the update persisted
      console.log('\n🔍 Verifying update persisted...');
      const verifyResponse = await fetch('http://localhost:3000/api/business/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: multiItemPurchase.businessId
        })
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const newRevenue = verifyData.business?.total_revenue || 0;
        console.log('  Verified Revenue: $' + newRevenue);
        
        if (newRevenue === result.newRevenue) {
          console.log('✅ VERIFIED: Revenue update persisted correctly!');
        } else {
          console.log('❌ WARNING: Revenue verification mismatch');
        }
      }
      
    } else {
      console.log('\n❌ FAILED: Revenue update failed');
      console.log('  This indicates the multi-item revenue update issue persists.');
      if (result.error) {
        console.log('  Error:', result.error);
      }
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('  Check if the Next.js development server is running.');
    console.log('  Make sure the business exists in the database.');
  }
}

// Run the test
testRevenueUpdate();
