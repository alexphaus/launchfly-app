// Quick test to verify email sending is working
const fetch = require('node-fetch');

async function testEmailFlow() {
  console.log('🧪 Testing email flow...');
  
  try {
    const response = await fetch('http://localhost:3000/api/test/customer-acquisition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: '94f30cf6-e8e0-48c9-9133-c67cc9712730',
        businessData: {
          name: 'ManDew Skincare',
          industry: 'Technology'
        },
        testMode: false
      })
    });
    
    const result = await response.text();
    console.log('📧 Test result:', result.slice(0, 500));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmailFlow();
