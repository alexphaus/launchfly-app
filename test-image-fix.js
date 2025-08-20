// Simple test to generate a new image for one product with storage
const businessId = '54c0ec82-d17b-41b2-9442-0163a3b7b9a4'; // ModernMan Skin Co.

async function testImageGeneration() {
  try {
    console.log('🧪 Testing image generation with storage...\n');
    
    // Generate new images for all products (this will use the new storage system)
    const response = await fetch('http://localhost:3000/api/generate/product-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: businessId,
        generateAll: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Image generation test completed!');
    console.log('=====================================');
    console.log(`📊 Total products: ${result.summary.total}`);
    console.log(`✅ Successful: ${result.summary.successful}`);
    console.log(`❌ Failed: ${result.summary.failed}`);
    console.log(`💾 Stored permanently: ${result.summary.stored || 0}`);
    
    if (result.results && result.results.length > 0) {
      console.log('\n📸 Generated Images:');
      console.log('===================');
      
      result.results.slice(0, 3).forEach((productResult, index) => {
        console.log(`\n${index + 1}. ${productResult.productName}`);
        console.log(`   Status: ${productResult.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Images: ${productResult.images?.length || 0}`);
        console.log(`   Stored: ${productResult.stored ? '✅ Yes' : '❌ No'}`);
        
        if (productResult.images && productResult.images.length > 0) {
          console.log(`   URL: ${productResult.images[0].substring(0, 80)}...`);
        }
      });
    }
    
    console.log('\n🌐 Check your store:');
    console.log('   → http://localhost:3000/sites/modernmanskinco');
    console.log('\n💡 Images should now persist after refresh!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImageGeneration();
