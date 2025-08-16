// Test both single and multi-item checkout webhooks
// This simulates what Stripe webhook should do for both cases

console.log('Testing webhook simulation for both single and multi-item purchases...');

// Test 1: Single product purchase (like what's working)
async function testSingleProductWebhook() {
  console.log('\n--- Testing Single Product Webhook ---');
  
  const singleProductData = {
    businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind
    amount: 25.99, // Example single product
    stripeSessionId: 'cs_test_single_' + Date.now(),
    customerEmail: 'test@example.com',
    customerName: 'Test User'
  };

  try {
    const response = await fetch('http://localhost:3000/api/business/update-revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(singleProductData)
    });
    
    const result = await response.json();
    console.log('Single product result:', result);
  } catch (error) {
    console.error('Single product error:', error);
  }
}

// Test 2: Multi-item purchase (like what's not working)
async function testMultiItemWebhook() {
  console.log('\n--- Testing Multi-Item Webhook ---');
  
  const multiItemData = {
    businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind
    amount: 87.50, // Example multi-item total
    stripeSessionId: 'cs_test_multi_' + Date.now(),
    customerEmail: 'test@example.com',
    customerName: 'Test User'
  };

  try {
    const response = await fetch('http://localhost:3000/api/business/update-revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(multiItemData)
    });
    
    const result = await response.json();
    console.log('Multi-item result:', result);
  } catch (error) {
    console.error('Multi-item error:', error);
  }
}

// Run both tests
async function runTests() {
  await testSingleProductWebhook();
  await testMultiItemWebhook();
  
  console.log('\n--- Test Complete ---');
  console.log('If both work, the issue is likely with webhook configuration in development.');
  console.log('In production, make sure the Stripe webhook endpoint is properly configured.');
}

runTests();
