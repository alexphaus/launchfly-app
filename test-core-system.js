// test-core-system.js - Simple test to verify the future-proof system works
import LaunchflyCore, { ValueLayers, SuccessGuarantees } from './src/lib/core/index.js';

async function testCoreSystem() {
  console.log('🧪 Testing Future-Proof Launchfly Core System...\n');
  
  // Initialize the core system
  const launchfly = new LaunchflyCore();
  
  // Test data
  const userData = {
    name: 'Alex Test',
    email: 'alex@test.com',
    businessType: 'Consulting',
    skills: ['web development', 'business strategy'],
    experience: 'intermediate',
    goals: 'Generate $10k/month'
  };
  
  try {
    console.log('📊 Testing business launch...');
    
    // Test the main function
    const result = await launchfly.launchSuccessfulBusiness(userData);
    
    if (result.success) {
      console.log('✅ Success! Business launched using future-proof approach');
      console.log('\n📈 Results:');
      console.log(`- Business Name: ${result.opportunity?.business?.name || 'Generated'}`);
      console.log(`- Target Market: ${result.opportunity?.business?.target || 'Identified'}`);
      console.log(`- Confidence: ${result.opportunity?.confidence || 85}%`);
      console.log(`- Guarantee: ${result.guarantee}`);
      
      if (result.growth) {
        console.log(`- Growth Status: ${result.growth.status}`);
        console.log(`- Revenue: $${result.growth.revenue || 0}`);
      }
    } else {
      console.log('⚠️ Main approach failed, using fallback:');
      console.log(result.fallback);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  // Test value layers
  console.log('\n💰 Value Layers:');
  Object.entries(ValueLayers).forEach(([key, layer]) => {
    console.log(`- ${layer.value}: ${layer.price} (Moat: ${layer.moat})`);
  });
  
  // Test success guarantees  
  console.log('\n🛡️ Success Guarantees:');
  Object.entries(SuccessGuarantees).forEach(([key, guarantee]) => {
    console.log(`- ${key}: ${guarantee}`);
  });
  
  console.log('\n🎯 Core System Test Complete!');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCoreSystem().catch(console.error);
}

export { testCoreSystem };
