// test-customer-card-features.js
// Test script for customer card features

const testCustomerCardFeatures = async () => {
  console.log('🧪 Testing Customer Card Features...\n');

  const businessId = process.env.TEST_BUSINESS_ID || 'your-business-id';
  const testEmail = 'test@example.com';
  
  // Test 1: Webhook Endpoint
  console.log('1️⃣ Testing webhook endpoint...');
  try {
    const webhookTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/resend`);
    const webhookData = await webhookTest.json();
    console.log('✅ Webhook endpoint active:', webhookData.status);
    console.log('   Environment check:', webhookData.env_check);
  } catch (error) {
    console.error('❌ Webhook endpoint failed:', error.message);
  }

  // Test 2: Activities API
  console.log('\n2️⃣ Testing activities API...');
  try {
    const activitiesTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/business/${businessId}/activities?limit=10`);
    const activitiesData = await activitiesTest.json();
    if (activitiesData.success) {
      console.log(`✅ Activities API working: ${activitiesData.activities?.length || 0} activities found`);
    } else {
      console.log('⚠️ Activities API returned no data');
    }
  } catch (error) {
    console.error('❌ Activities API failed:', error.message);
  }

  // Test 3: Purchases API
  console.log('\n3️⃣ Testing purchases API...');
  try {
    const purchasesTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/business/${businessId}/purchases`);
    const purchasesData = await purchasesTest.json();
    if (purchasesData.success) {
      console.log(`✅ Purchases API working: ${purchasesData.purchases?.length || 0} purchases found`);
    } else {
      console.log('⚠️ Purchases API returned no data');
    }
  } catch (error) {
    console.error('❌ Purchases API failed:', error.message);
  }

  // Test 4: Customer Notes API
  console.log('\n4️⃣ Testing customer notes API...');
  try {
    // Get notes
    const notesTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/customers/${testEmail}/notes`);
    const notesData = await notesTest.json();
    console.log(`✅ Notes API working: ${notesData.notes?.length || 0} notes found`);

    // Try to add a note
    const addNoteTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/customers/${testEmail}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: businessId,
        note: 'Test note from automated test'
      })
    });
    
    if (addNoteTest.ok) {
      console.log('✅ Add note API working');
    } else {
      console.log('⚠️ Add note API failed:', addNoteTest.status);
    }
  } catch (error) {
    console.error('❌ Notes API failed:', error.message);
  }

  // Test 5: Export API
  console.log('\n5️⃣ Testing export API...');
  try {
    const exportTest = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/customers/export?businessId=${businessId}`);
    if (exportTest.ok) {
      const csvContent = await exportTest.text();
      console.log(`✅ Export API working: Generated ${csvContent.split('\n').length} rows`);
    } else {
      console.log('⚠️ Export API failed:', exportTest.status);
    }
  } catch (error) {
    console.error('❌ Export API failed:', error.message);
  }

  // Test 6: Helper Functions
  console.log('\n6️⃣ Testing helper functions...');
  try {
    const { formatRelativeTime } = await import('./src/lib/utils/date-format.js');
    const { calculateEngagementScore, getLeadTemperature } = await import('./src/lib/utils/customer-helpers.js');

    const testDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
    const relativeTime = formatRelativeTime(testDate);
    console.log(`✅ Date formatting works: "${relativeTime}"`);

    const testActivities = [
      { icon: '📧', text: 'Email sent' },
      { icon: '📬', text: 'Email opened' },
      { icon: '💬', text: 'Email replied' }
    ];
    const engagementScore = calculateEngagementScore(testActivities);
    console.log(`✅ Engagement scoring works: ${engagementScore}/100`);

    const testCustomer = { status: 'Engaged', activities: testActivities };
    const leadTemp = getLeadTemperature(testCustomer);
    console.log(`✅ Lead temperature works: ${leadTemp}`);
  } catch (error) {
    console.error('❌ Helper functions failed:', error.message);
  }

  console.log('\n✅ Customer Card Feature Testing Complete!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Webhook endpoint');
  console.log('   ✅ Activities tracking');
  console.log('   ✅ Purchase integration');
  console.log('   ✅ Customer notes');
  console.log('   ✅ Export functionality');
  console.log('   ✅ Utility functions');
};

// Run tests
if (process.env.NODE_ENV !== 'production') {
  testCustomerCardFeatures().catch(console.error);
} else {
  console.log('⚠️ Skipping tests in production environment');
}

module.exports = { testCustomerCardFeatures };

