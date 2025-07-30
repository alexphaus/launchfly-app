#!/usr/bin/env node

// Test the enhanced business generator
const { generateBusinessWithAI } = require('./src/lib/business-generator.js');

async function testEnhancedGenerator() {
  console.log('🧪 Testing Enhanced Business Generator...\n');
  
  // Test different business types
  const testCases = [
    {
      name: "Fitness Business",
      userData: {
        background: "I'm a certified personal trainer with 5 years experience",
        goals: "Help people transform their bodies and build confidence through fitness",
        monthlyIncome: "$5000",
        budget: "$500",
        timeAvailable: "Full-time",
        experienceLevel: "Intermediate"
      }
    },
    {
      name: "Creative Design Business", 
      userData: {
        background: "Graphic designer with portfolio of brand work",
        goals: "Create stunning visual identities for startups and small businesses",
        monthlyIncome: "$8000",
        budget: "$1000", 
        timeAvailable: "Full-time",
        experienceLevel: "Advanced"
      }
    },
    {
      name: "Tech Consulting Business",
      userData: {
        background: "Software engineer with 10 years experience in enterprise systems",
        goals: "Help businesses modernize their technology infrastructure",
        monthlyIncome: "$10000",
        budget: "$2000",
        timeAvailable: "Part-time",
        experienceLevel: "Expert"
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('User Data:', JSON.stringify(testCase.userData, null, 2));
    
    try {
      // Note: We'll just test the business type inference and layout generation
      // without calling OpenAI to avoid API costs during testing
      
      const { inferBusinessType, getVisualStyleForBusiness, generateLayoutTemplate } = require('./src/lib/business-generator.js');
      
      const businessType = inferBusinessType(testCase.userData);
      const visualStyle = getVisualStyleForBusiness(businessType, testCase.userData);
      const layoutTemplate = generateLayoutTemplate(businessType);
      
      console.log('✅ Business Type Detected:', businessType);
      console.log('🎨 Visual Style:', visualStyle.substring(0, 100) + '...');
      console.log('📐 Layout Template Generated:', layoutTemplate.substring(0, 200) + '...');
      console.log('Components in Layout:', (layoutTemplate.match(/"component":/g) || []).length);
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
  
  console.log('\n🎉 Enhanced generator testing complete!');
  console.log('\n📝 Key Improvements:');
  console.log('• Business-specific layout templates');
  console.log('• Dynamic component selection based on industry');
  console.log('• Enhanced visual styling recommendations');
  console.log('• More varied and engaging website structures');
  console.log('• GPT-4 for better creativity and specificity');
}

testEnhancedGenerator();
