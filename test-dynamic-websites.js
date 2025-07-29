#!/usr/bin/env node

// Test script to verify dynamic website generation
// Run with: node test-dynamic-websites.js

const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local manually
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (error) {
  console.log('⚠️  Could not load .env.local file. Make sure environment variables are set.');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDynamicWebsites() {
  console.log('🧪 Testing Dynamic Website Generation System...\n');
  
  try {
    // 1. Check if there are any ready businesses
    console.log('1. Checking for ready businesses...');
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('status', 'ready')
      .limit(5);
      
    if (error) {
      console.error('❌ Error fetching businesses:', error);
      return;
    }
    
    if (businesses.length === 0) {
      console.log('⚠️  No ready businesses found. Generate a business first through the dashboard.');
      return;
    }
    
    console.log(`✅ Found ${businesses.length} ready business(es)`);
    
    // 2. Display business details
    businesses.forEach((business, index) => {
      console.log(`\n📋 Business ${index + 1}:`);
      console.log(`   Name: ${business.name}`);
      console.log(`   Subdomain: ${business.subdomain}`);
      console.log(`   Website URL: https://${business.subdomain}.launchfly.site`);
      console.log(`   Status: ${business.status}`);
      
      if (business.business_data) {
        const data = business.business_data;
        console.log(`   Business Name: ${data.businessName || 'Not set'}`);
        console.log(`   Tagline: ${data.tagline || 'Not set'}`);
        console.log(`   Has Theme: ${data.theme ? '✅' : '❌'}`);
        console.log(`   Has Layout: ${data.layout && data.layout.length > 0 ? '✅' : '❌'}`);
        
        if (data.theme) {
          console.log(`   Primary Color: ${data.theme.colors?.primary || 'Not set'}`);
        }
        
        if (data.layout) {
          console.log(`   Layout Components: ${data.layout.map(l => l.component).join(', ')}`);
        }
      }
    });
    
    // 3. Test data structure
    console.log('\n3. Validating data structure...');
    let allValid = true;
    
    businesses.forEach((business, index) => {
      if (!business.business_data) {
        console.log(`❌ Business ${index + 1}: Missing business_data`);
        allValid = false;
        return;
      }
      
      const data = business.business_data;
      const required = ['businessName', 'tagline'];
      const missing = required.filter(field => !data[field]);
      
      if (missing.length > 0) {
        console.log(`⚠️  Business ${index + 1}: Missing fields: ${missing.join(', ')}`);
      }
      
      if (!data.theme) {
        console.log(`⚠️  Business ${index + 1}: Missing theme data`);
      }
      
      if (!data.layout || data.layout.length === 0) {
        console.log(`⚠️  Business ${index + 1}: Missing layout data`);
      }
    });
    
    if (allValid) {
      console.log('✅ All businesses have valid data structures');
    }
    
    // 4. Instructions
    console.log('\n🚀 Next Steps:');
    console.log('1. Start your Next.js development server: npm run dev');
    console.log('2. Test the websites by visiting:');
    businesses.forEach((business, index) => {
      console.log(`   • http://localhost:3000/sites/${business.subdomain}`);
    });
    console.log('\n💡 For production testing with subdomains:');
    console.log('   Configure your domain to point to your app');
    console.log('   Then visit: https://[subdomain].launchfly.site');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDynamicWebsites();
