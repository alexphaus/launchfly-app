// Test both ID and name-based lookups
async function testBothLookups() {
  const basePayload = {
    businessId: '8399c5fc-7802-4b40-8263-b57d6a27ddab',
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    subdomain: 'cococonnoisseur'
  };
  
  console.log('Testing ID-based lookup...');
  try {
    const response1 = await fetch('http://localhost:3000/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, productId: 'monthly-plan' })
    });
    const data1 = await response1.json();
    console.log('ID lookup result:', response1.status === 200 ? '✅ Success' : '❌ Failed', data1.error || 'Session created');
  } catch (error) {
    console.log('ID lookup error:', error.message);
  }
  
  console.log('\nTesting name-based lookup...');
  try {
    const response2 = await fetch('http://localhost:3000/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, productId: 'Monthly Plan' })
    });
    const data2 = await response2.json();
    console.log('Name lookup result:', response2.status === 200 ? '✅ Success' : '❌ Failed', data2.error || 'Session created');
  } catch (error) {
    console.log('Name lookup error:', error.message);
  }
  
  console.log('\nTesting invalid product...');
  try {
    const response3 = await fetch('http://localhost:3000/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, productId: 'NonExistent Plan' })
    });
    const data3 = await response3.json();
    console.log('Invalid lookup result:', response3.status === 404 ? '✅ Correctly rejected' : '❌ Unexpected result', data3.error || data3);
  } catch (error) {
    console.log('Invalid lookup error:', error.message);
  }
}

testBothLookups();
