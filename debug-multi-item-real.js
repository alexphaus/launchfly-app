// Real-time test to debug your multi-item purchase issue
// This will help us see exactly what's happening

console.log('🔍 Testing Multi-Item Purchase Debug...\n');

async function testMultiItemPurchase() {
  try {
    // Test creating a multi-item checkout session first
    console.log('1️⃣ Testing multi-item checkout session creation...');
    
    const checkoutData = {
      items: [
        {
          productId: 'test-product-1',
          productName: 'Test Product 1',
          productPrice: 29.99,
          quantity: 1,
          productDescription: 'First test product'
        },
        {
          productId: 'test-product-2', 
          productName: 'Test Product 2',
          productPrice: 19.99,
          quantity: 2,
          productDescription: 'Second test product'
        }
      ],
      businessId: '54c0ec82-d17b-41b2-9442-0163a3b7b9a4', // Using a different business ID
      subdomain: 'test-business',
      customerEmail: 'test@multiitem.com',
      customerName: 'Multi Item Test'
    };

    console.log('📋 Checkout Data:', {
      itemCount: checkoutData.items.length,
      totalValue: checkoutData.items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0),
      businessId: checkoutData.businessId
    });

    const checkoutResponse = await fetch('http://localhost:3000/api/stripe/checkout-multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
    });

    console.log('📊 Checkout Response Status:', checkoutResponse.status);
    
    if (checkoutResponse.ok) {
      const checkoutResult = await checkoutResponse.json();
      console.log('✅ Checkout session created:', checkoutResult.sessionId);
      
      // Now test the webhook with this session data
      console.log('\n2️⃣ Testing webhook with multi-item session...');
      
      const webhookData = {
        id: 'evt_test_' + Date.now(),
        type: 'checkout.session.completed',
        data: {
          object: {
            id: checkoutResult.sessionId || 'cs_test_multi_' + Date.now(),
            amount_total: 6997, // $69.97 in cents
            currency: 'usd',
            customer_details: {
              email: checkoutData.customerEmail,
              name: checkoutData.customerName
            },
            metadata: {
              business_id: checkoutData.businessId,
              business_name: 'Test Business',
              subdomain: checkoutData.subdomain,
              customer_name: checkoutData.customerName,
              items_count: '2', // This is the key field for multi-item detection
              item_names: 'Test Product 1, Test Product 2'
            }
          }
        }
      };

      console.log('📋 Webhook Test Data:', {
        sessionId: webhookData.data.object.id,
        amount: webhookData.data.object.amount_total / 100,
        itemsCount: webhookData.data.object.metadata.items_count,
        hasProductId: !!webhookData.data.object.metadata.product_id
      });

      // Note: We can't actually send this webhook because of signature validation
      // But we can check if the business exists and the logic is correct
      
      console.log('\n3️⃣ Checking if business exists...');
      
      // Check if the business ID exists (this might be the issue)
      const businessCheck = await fetch('http://localhost:3000/api/business/update-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: checkoutData.businessId,
          amount: 1.00, // Small test amount
          stripeSessionId: 'test_' + Date.now(),
          customerEmail: 'test@example.com',
          customerName: 'Test'
        })
      });

      const businessResult = await businessCheck.json();
      console.log('📊 Business Check Result:', businessResult);
      
      if (businessResult.error) {
        console.log('\n❌ ISSUE FOUND: The business ID might not exist!');
        console.log('This could be why your multi-item purchase didn\'t update revenue.');
        console.log('Need to use the correct business ID from your actual business.');
      } else {
        console.log('\n✅ Business exists and revenue update works!');
      }
      
    } else {
      const error = await checkoutResponse.text();
      console.log('❌ Checkout failed:', error);
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure the Next.js dev server is running: npm run dev');
    }
  }
}

// Run the test
testMultiItemPurchase();
