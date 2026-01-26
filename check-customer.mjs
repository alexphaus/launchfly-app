// check-customer.mjs
// Check customer record for phone number

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env file
const envFile = readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_KEY);

const phone = process.argv[2] || '34683233450';

(async () => {
  console.log(`🔍 Searching for phone containing: ${phone}`);
  
  const { data, error } = await supabase
    .from('customers')
    .select('id, phone, status, business_id, created_at, notes')
    .or(`phone.ilike.%${phone}%`)
    .limit(5);
  
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No customers found with that phone');
    
    // Check all recent customers
    const { data: recent } = await supabase
      .from('customers')
      .select('id, phone, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('\n📋 Recent customers:');
    recent?.forEach(c => {
      console.log(`  - ${c.phone} | ${c.status} | ${c.created_at}`);
    });
    return;
  }
  
  console.log('\n✅ Customers found:');
  data.forEach(c => {
    console.log(`\n📱 Phone: ${c.phone}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Business ID: ${c.business_id}`);
    console.log(`   Created: ${c.created_at}`);
    console.log(`   Notes: ${c.notes?.substring(0, 100)}...`);
  });
})();
