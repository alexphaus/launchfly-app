// Test script to verify multi-item revenue update fix
// This tests the webhook functionality for multi-item purchases

console.log('🧪 Testing Multi-Item Revenue Update Fix...\n');

// Simulate a multi-item checkout session completed webhook
const testMultiItemWebhook = {
  id: 'evt_test_webhook_multi_item',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_multi_item_session_123',
      amount_total: 29700, // $297.00 in cents (multiple products)
      currency: 'usd',
      customer_details: {
        email: 'test@example.com',
        name: 'Test Customer'
      },
      metadata: {
        business_id: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind business ID
        business_name: 'ModernGrind',
        business_owner_email: 'owner@moderngrind.com',
        subdomain: 'moderngrind',
        customer_name: 'Test Customer',
        items_count: '3', // This is key - indicates multi-item purchase
        item_names: 'Premium Coffee Blend, Coffee Mug, Coffee Beans'
      }
    }
  }
};

async function testWebhook() {
  try {
    console.log('📋 Test Data:');
    console.log('  - Session ID:', testMultiItemWebhook.data.object.id);
    console.log('  - Amount Total: $' + (testMultiItemWebhook.data.object.amount_total / 100));
    console.log('  - Items Count:', testMultiItemWebhook.data.object.metadata.items_count);
    console.log('  - Item Names:', testMultiItemWebhook.data.object.metadata.item_names);
    console.log('  - Business ID:', testMultiItemWebhook.data.object.metadata.business_id);
    console.log();

    console.log('🔄 Calling webhook endpoint...');
    
    const response = await fetch('http://localhost:3000/api/webhook/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature' // In real scenario, this would be properly signed
      },
      body: JSON.stringify(testMultiItemWebhook)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', result);
    
    if (response.ok && result.received) {
      console.log('✅ SUCCESS: Multi-item webhook processed successfully!');
      console.log('   Revenue should now be updated in the dashboard.');
    } else {
      console.log('❌ FAILED: Webhook processing failed');
      console.log('   This means the multi-item revenue update issue persists.');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('   Check if the Next.js development server is running.');
  }
}

// Run the test
testWebhook();
