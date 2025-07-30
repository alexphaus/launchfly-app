#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
  console.log('⚠️  Could not load .env.local file');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verifyBusiness() {
  const testSubdomains = ['pizzaxperience', 'axceleratebusiness'];
  
  console.log('🔍 Verifying business data...\n');
  
  for (const subdomain of testSubdomains) {
    console.log(`Checking: ${subdomain}`);
    
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('subdomain', subdomain)
        .single();
        
      if (error) {
        console.log(`❌ ${subdomain}: ${error.message}`);
        
        // If business doesn't exist, create a test one
        if (error.code === 'PGRST116') {
          console.log(`🔧 Creating test business for ${subdomain}...`);
          await createTestBusiness(subdomain);
        }
      } else {
        console.log(`✅ ${subdomain}: Found business`);
        console.log(`   Status: ${business.status}`);
        console.log(`   Has data: ${!!business.business_data}`);
        console.log(`   Test URL: https://${subdomain}.launchfly.ai`);
        console.log(`   Manual URL: https://www.launchfly.ai/sites/${subdomain}`);
      }
    } catch (err) {
      console.log(`❌ ${subdomain}: ${err.message}`);
    }
    
    console.log('---');
  }
}

async function createTestBusiness(subdomain) {
  const testData = {
    name: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
    subdomain: subdomain,
    status: 'ready',
    user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    form_data: { name: 'Test User' },
    business_data: {
      businessName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
      tagline: 'A test business for debugging',
      theme: {
        colors: {
          primary: '#3b82f6',
          secondary: '#1e40af'
        }
      },
      layout: [
        {
          component: 'NavBar',
          props: { businessName: subdomain }
        },
        {
          component: 'Hero',
          props: {
            title: 'Test Business',
            subtitle: 'This is a test business for debugging'
          }
        }
      ]
    }
  };
  
  try {
    const { error } = await supabase
      .from('businesses')
      .insert(testData);
      
    if (error) {
      console.log(`❌ Failed to create test business: ${error.message}`);
    } else {
      console.log(`✅ Created test business for ${subdomain}`);
    }
  } catch (err) {
    console.log(`❌ Error creating test business: ${err.message}`);
  }
}

verifyBusiness();
