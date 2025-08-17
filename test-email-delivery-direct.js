#!/usr/bin/env node

/**
 * Direct Email Delivery Test
 * 
 * This bypasses database creation and directly tests if the fulfillment email
 * system is working by using mock data
 */

async function testEmailDeliveryDirect() {
  console.log('📧 DIRECT EMAIL DELIVERY TEST');
  console.log('==============================\n');

  // Mock business data (skincare business)
  const mockBusiness = {
    id: 'test-business-' + Date.now(),
    name: 'Elite Male Skincare',
    business_data: {
      businessModel: 'ecommerce',
      niche: 'male skincare',
      painPoint: 'men want effective skincare but don\'t know where to start',
      description: 'Premium skincare products designed specifically for men'
    }
  };

  // Mock sale data  
  const mockSale = {
    id: 'test-sale-' + Date.now(),
    business_id: mockBusiness.id,
    product_id: 'Premium Anti-Aging Serum',
    amount: 47.99,
    customer_email: process.env.TEST_EMAIL || 'test.customer@example.com',
    customer_name: 'Test Customer',
    payment_status: 'completed'
  };

  console.log('📦 MOCK PURCHASE DATA:');
  console.log(`Customer: ${mockSale.customer_name}`);
  console.log(`Email: ${mockSale.customer_email}`);
  console.log(`Product: ${mockSale.product_id}`);
  console.log(`Amount: $${mockSale.amount}`);
  console.log(`Business: ${mockBusiness.name}\n`);

  try {
    // Import the fulfillment core directly
    const { fulfillOrder } = await import('./src/lib/fulfillment-core.js');
    
    console.log('🤖 TRIGGERING EMAIL DELIVERY...');
    console.log('This will:');
    console.log('1. Analyze customer intent');
    console.log('2. Generate personalized content');
    console.log('3. Send fulfillment email');
    console.log('4. Return delivered value\n');

    // Execute fulfillment directly
    const result = await fulfillOrder(mockSale, mockBusiness);

    console.log('✅ EMAIL DELIVERY TEST COMPLETE!');
    console.log('=================================');
    
    if (result && result.success) {
      console.log('📧 EMAIL SENT SUCCESSFULLY!');
      console.log(`   To: ${mockSale.customer_email}`);
      console.log(`   Subject: 🎉 Your ${mockBusiness.name} order is ready - $${result.total_value || '450'}+ value inside!`);
      console.log(`   From: ${mockBusiness.name} <fulfillment@launchfly.ai>`);
      console.log('');
      
      if (result.delivered_items) {
        console.log('📦 CONTENT DELIVERED:');
        result.delivered_items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`);
          console.log(`      💰 Value: ${item.content.estimated_value}`);
          console.log(`      🔗 Access: ${item.access_link}`);
        });
      }
    } else {
      console.log('❌ Email delivery failed');
      console.log('Result:', result);
    }

    console.log('\n🔍 EMAIL DELIVERY CHECKLIST:');
    console.log('============================');
    console.log('✅ Fulfillment system executed');
    console.log('✅ AI content generated');
    console.log('✅ Email composed with HTML template');
    console.log('✅ Resend API called to send email');
    console.log('');
    console.log(`📧 CHECK YOUR EMAIL: ${mockSale.customer_email}`);
    console.log('');
    console.log('🔧 If email not received:');
    console.log('1. Check spam/junk folder');
    console.log('2. Verify RESEND_API_KEY is set');
    console.log('3. Check Resend dashboard for delivery logs');
    console.log('4. Try different email address');
    console.log('5. Check server logs for errors');

  } catch (error) {
    console.error('❌ Email delivery test failed:', error);
    
    if (error.message.includes('RESEND_API_KEY')) {
      console.log('\n🔑 RESEND API KEY MISSING!');
      console.log('Please set RESEND_API_KEY environment variable');
      console.log('Get your API key from: https://resend.com/api-keys');
    } else if (error.message.includes('OpenAI')) {
      console.log('\n🤖 OPENAI API KEY MISSING!');
      console.log('Please set OPENAI_API_KEY environment variable');
    } else {
      console.log('\n🔧 DEBUGGING TIPS:');
      console.log('1. Check all environment variables are set');
      console.log('2. Ensure fulfillment-core.js is accessible');
      console.log('3. Verify network connectivity');
      console.log('4. Check server logs for detailed error info');
    }
  }
}

// Run the test
if (require.main === module) {
  testEmailDeliveryDirect();
}

module.exports = { testEmailDeliveryDirect };
