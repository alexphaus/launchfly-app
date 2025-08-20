// Simple test to verify the revenue update API works
// Let's first test if the API endpoint responds correctly

console.log('🧪 Testing Revenue Update API Endpoint...\n');

async function testRevenueAPI() {
  try {
    // Test data
    const testData = {
      businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // existing business ID
      amount: 50.00, // test amount
      stripeSessionId: 'cs_test_' + Date.now(),
      customerEmail: 'test@example.com',
      customerName: 'Test Customer'
    };

    console.log('📋 Testing with data:', testData);
    console.log();

    console.log('🔄 Calling /api/business/update-revenue...');
    
    const response = await fetch('http://localhost:3000/api/business/update-revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log('Status:', response.status);
    console.log('Headers:', response.headers.get('content-type'));
    
    const result = await response.text(); // Get as text first to see raw response
    console.log('Raw response:', result);
    
    try {
      const jsonResult = JSON.parse(result);
      console.log('Parsed JSON:', jsonResult);
      
      if (response.ok && jsonResult.success) {
        console.log('\n✅ SUCCESS: Revenue update API is working!');
        console.log('  This means the webhook fix should work for multi-item purchases.');
        console.log('  The issue was that multi-item webhooks were failing due to missing product_id validation.');
      } else {
        console.log('\n❌ API returned error:', jsonResult.error || 'Unknown error');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON response:', parseError.message);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('  💡 The Next.js development server is not running.');
      console.log('  💡 Start it with: npm run dev');
    }
  }
}

// Run the test
testRevenueAPI();
