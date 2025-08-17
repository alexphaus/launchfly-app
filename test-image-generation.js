// test-image-generation.js
// Test script for product image generation

console.log('🎨 Testing Product Image Generation System');
console.log('==========================================');

const testProducts = [
  {
    id: 'modern-grind-face-wash',
    name: 'Revive Face Wash',
    price: '$24.99',
    description: 'Deep cleansing face wash with natural ingredients for daily use',
    category: 'skincare',
    variants: [
      { name: 'Original', color: '#ffffff' },
      { name: 'Charcoal', color: '#333333' }
    ]
  },
  {
    id: 'hydrate-moisturizer',
    name: 'Hydrate Moisturizer', 
    price: '$32.99',
    description: 'Lightweight daily moisturizer with hyaluronic acid and vitamins',
    category: 'skincare',
    variants: [
      { name: 'Regular', color: '#f0f0f0' },
      { name: 'Tinted', color: '#f4e4bc' }
    ]
  }
];

const testBusinessData = {
  name: 'ModernGrind',
  industry: 'Male skincare and grooming',
  niche: 'Premium men\'s skincare',
  businessName: 'ModernGrind'
};

async function testImageGeneration() {
  try {
    console.log('\n📸 Testing image generation for sample products...');
    
    // Make API call to generate images
    const response = await fetch('http://localhost:3000/api/generate/product-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind business ID
        generateAll: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('\n✅ Image Generation Results:');
    console.log('============================');
    console.log(`Total products: ${result.summary.total}`);
    console.log(`Successful: ${result.summary.successful}`);
    console.log(`Failed: ${result.summary.failed}`);
    
    console.log('\n📋 Detailed Results:');
    result.results.forEach((productResult, index) => {
      console.log(`\n${index + 1}. ${productResult.productName}`);
      console.log(`   Success: ${productResult.success ? '✅' : '❌'}`);
      console.log(`   Images generated: ${productResult.images.length}`);
      
      if (productResult.images.length > 0) {
        productResult.images.forEach((imageUrl, imgIndex) => {
          console.log(`   Image ${imgIndex + 1}: ${imageUrl.substring(0, 80)}...`);
        });
      }
      
      if (productResult.error) {
        console.log(`   Error: ${productResult.error}`);
      }
    });
    
    console.log('\n🎉 Image generation test completed!');
    console.log('\nNext steps:');
    console.log('1. Check your moderngrind site to see the generated images');
    console.log('2. Visit: http://localhost:3000/sites/moderngrind');
    console.log('3. Browse the product pages to see the new images');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure your development server is running:');
      console.log('   npm run dev');
    }
  }
}

// Add a manual test function for specific products
async function testManualImageGeneration() {
  console.log('\n🧪 Testing manual image generation...');
  
  try {
    // Test the image generation library directly
    const { generateProductImages } = require('./src/lib/product-image-generator');
    
    const sampleProduct = testProducts[0];
    const images = await generateProductImages(sampleProduct, testBusinessData);
    
    console.log('✅ Direct library test results:');
    console.log(`Generated ${images.length} images for ${sampleProduct.name}`);
    images.forEach((url, index) => {
      console.log(`Image ${index + 1}: ${url}`);
    });
    
  } catch (error) {
    console.log('❌ Direct library test failed:', error.message);
    console.log('This is expected if OpenAI API key is not configured');
  }
}

// Run the test
console.log('\n🚀 Starting image generation test...');
console.log('This will generate professional product photos for your e-commerce store!\n');

testImageGeneration();
