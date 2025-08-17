// quick-image-test.js
// Quick test to check if OpenAI API is working

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing OpenAI API configuration...\n');

// Check environment variables
console.log('Environment variables:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

if (!process.env.OPENAI_API_KEY) {
  console.log('\n❌ OpenAI API key is missing!');
  console.log('💡 You need to add OPENAI_API_KEY to your .env.local file');
  console.log('   Get your API key from: https://platform.openai.com/api-keys');
  process.exit(1);
}

// Test OpenAI API with a simple request
async function testOpenAI() {
  try {
    console.log('\n🎨 Testing OpenAI DALL-E 3...');
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A simple white product bottle on clean background, professional product photography",
        n: 1,
        size: "1024x1024",
        quality: "standard" // Use standard quality for faster testing
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log('❌ OpenAI API Error:', response.status, errorData);
      
      if (response.status === 401) {
        console.log('💡 This means your API key is invalid or expired');
      } else if (response.status === 429) {
        console.log('💡 This means you hit the rate limit or ran out of credits');
      } else if (response.status === 400) {
        console.log('💡 This means there was an issue with the request format');
      }
      
      return;
    }
    
    const result = await response.json();
    
    if (result.data && result.data[0]) {
      console.log('✅ OpenAI API is working!');
      console.log('🖼️ Generated image URL:', result.data[0].url);
      console.log('\n🎉 Your API is ready for product image generation!');
    } else {
      console.log('❌ Unexpected response format:', result);
    }
    
  } catch (error) {
    console.log('❌ Error testing OpenAI API:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('💡 This might be a network connectivity issue');
    }
  }
}

testOpenAI();
