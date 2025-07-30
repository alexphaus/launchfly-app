#!/usr/bin/env node

// Test production routing
async function testProductionRouting() {
  console.log('🧪 Testing Production Routing...\n');
  
  const testUrls = [
    'https://pizzaxperience.launchfly.ai',
    'https://axceleratebusiness.launchfly.ai',
    // Add more subdomains you want to test
  ];
  
  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      if (text.includes('Hello world!')) {
        console.log('❌ Still showing Hello world - routing not working');
      } else if (text.includes('Business Not Found')) {
        console.log('⚠️  Route working but business not found in database');
      } else if (text.includes('dynamic-website')) {
        console.log('✅ Dynamic website rendering correctly');
      } else {
        console.log('⚠️  Unknown response');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('---');
  }
}

testProductionRouting();
