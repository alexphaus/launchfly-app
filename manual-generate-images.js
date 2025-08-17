// manual-generate-images.js
// Quick script to manually generate images for your Gentleman Glow products

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('🎨 Manual Product Image Generation');
console.log('==================================');

async function generateImagesForGentlemanGlow() {
  const businessId = '5f82d853-7d5a-447c-884d-0692a382cd43'; // Gentleman Glow business ID
  
  console.log('📸 Generating images for Gentleman Glow products...');
  console.log('This will create professional product photos for your skincare line!\n');
  
  try {
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
    
    console.log('✅ SUCCESS! Image generation completed:');
    console.log('=====================================');
    console.log(`📊 Total products: ${result.summary.total}`);
    console.log(`✅ Successful: ${result.summary.successful}`);
    console.log(`❌ Failed: ${result.summary.failed}\n`);
    
    console.log('📋 Generated Images by Product:');
    console.log('==============================');
    
    result.results.forEach((productResult, index) => {
      console.log(`\n${index + 1}. ${productResult.productName}`);
      console.log(`   Status: ${productResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`   Images: ${productResult.images.length}`);
      
      if (productResult.images.length > 0) {
        productResult.images.forEach((imageUrl, imgIndex) => {
          const imageType = imgIndex === 0 ? 'Primary' : 
                          imgIndex === 1 ? 'Variant' : 'Lifestyle';
          console.log(`   ${imageType}: ${imageUrl}`);
        });
      }
      
      if (productResult.error) {
        console.log(`   Error: ${productResult.error}`);
      }
    });
    
    console.log('\n🎉 Image generation complete!');
    console.log('\n🌐 View your updated store:');
    console.log('   → http://localhost:3000/sites/gentlemanglow');
    console.log('\n💡 Your products now have professional AI-generated photos!');
    console.log('   This dramatically improves the shopping experience and conversion rates.');
    
  } catch (error) {
    console.error('❌ Error generating images:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure your development server is running: npm run dev');
      console.log('2. Ensure OpenAI API key is configured in environment variables');
      console.log('3. Check that the business ID exists in your database');
    }
  }
}

// Run the image generation
generateImagesForGentlemanGlow();
