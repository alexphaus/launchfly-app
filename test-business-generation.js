require('dotenv').config({ path: '.env.local' });

async function testBusinessGeneration() {
  console.log('🧪 Testing Business Generation Pipeline\n');
  
  const testData = {
    name: 'Alex Test User',
    email: 'test@example.com',
    skills: 'Web development and design',
    businessType: 'Online Service',
    goal: 'Build a sustainable business',
    preferences: 'Focus on tech solutions'
  };
  
  try {
    console.log('1️⃣ Testing analyzeOpportunity...');
    const { analyzeOpportunity } = require('./src/core/analyze');
    
    const sessionId = 'test_session_' + Date.now();
    const analysis = await analyzeOpportunity(testData, sessionId);
    console.log('✅ Analysis successful:', {
      businessType: analysis?.businessName || 'N/A',
      niche: analysis?.niche || 'N/A',
      confidence: analysis?.confidence || 'N/A',
      fullAnalysis: analysis
    });
    
    console.log('\n2️⃣ Testing launchBusiness...');
    const { launchBusiness } = require('./src/core/launch');
    
    const result = await launchBusiness(analysis, sessionId, 'test_business_id');
    
    console.log('✅ Launch successful:', {
      businessId: result?.businessId || 'N/A',
      productsCount: result?.products?.length || 0,
      websiteGenerated: !!result?.websiteData
    });
    
    console.log('\n🎉 Full pipeline test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Pipeline test failed:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}

testBusinessGeneration().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test error:', error);
  process.exit(1);
});
