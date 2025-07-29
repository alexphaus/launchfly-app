#!/usr/bin/env node

// Check specific business data
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
  console.log('⚠️  Could not load .env.local file.');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkBusiness() {
  console.log('🔍 Checking business data for subdomain: axceleratebusiness\n');
  
  try {
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', 'axceleratebusiness')
      .single();
      
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('✅ Business found:');
    console.log('  ID:', business.id);
    console.log('  Name:', business.name);
    console.log('  Subdomain:', business.subdomain);
    console.log('  Status:', business.status);
    console.log('  Has business_data:', !!business.business_data);
    
    if (business.business_data) {
      const data = business.business_data;
      console.log('\n📋 Business Data:');
      console.log('  Business Name:', data.businessName);
      console.log('  Tagline:', data.tagline);
      console.log('  Theme Colors:', data.theme?.colors?.primary);
      console.log('  Layout Components:', data.layout?.length || 0);
    }
    
    console.log('\n🧪 Test URLs:');
    console.log('  Local: http://localhost:3000/sites/axceleratebusiness');
    console.log('  Production: https://axceleratebusiness.launchfly.ai');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

checkBusiness();
