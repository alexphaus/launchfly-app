// Test the checkout API directly
async function testCheckout() {
  try {
    const response = await fetch('http://localhost:3000/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: 'Monthly Plan',
        businessId: '8399c5fc-7802-4b40-8263-b57d6a27ddab',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        subdomain: 'cococonnoisseur'
      })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (data.url) {
      console.log('✅ Checkout session created successfully!');
      console.log('Redirect URL:', data.url);
    } else {
      console.log('❌ Failed to create checkout session');
    }
    
  } catch (error) {
    console.error('Error testing checkout:', error);
  }
}

testCheckout();
