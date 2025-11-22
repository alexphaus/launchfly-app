const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function test() {
  const email = `test-${Date.now()}@example.com`;
  const businessName = `Test Lead Magnet ${Date.now()}`;
  const subdomain = `lm-test-${Date.now()}`;
  
  console.log('1. Creating Business...');
  // Note: This requires the Next.js server to be running on localhost:3000
  const res = await fetch('http://localhost:3000/api/wizard/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: email,
      template: 'lead-magnet',
      plan: 'starter',
      businessName: businessName,
      subdomain: subdomain,
      leadMagnetTopic: 'Productivity for Developers',
      leadMagnetLanguage: 'English'
    })
  });
  
  if (!res.ok) {
      console.error('Failed to create business', await res.text());
      return;
  }

  const data = await res.json();
  console.log('Business Created:', data);
  
  if (!data.businessId) {
    console.error('Failed to create business ID');
    return;
  }

  console.log('2. Triggering Content Generation...');
  const genRes = await fetch('http://localhost:3000/api/lead-magnet/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: data.businessId,
      topic: 'Productivity for Developers',
      language: 'English'
    })
  });
  
  if (!genRes.ok) {
      console.error('Generation failed', await genRes.text());
      return;
  }
  const genData = await genRes.json();
  console.log('Generation Result:', genData);

  // Verify content in DB
  const { data: business } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', data.businessId)
    .single();
    
  if (business.business_data.leadMagnet) {
    console.log('✅ Lead Magnet Content Found in DB');
    console.log('Title:', business.business_data.leadMagnet.lead_magnet.title);
  } else {
    console.error('❌ Lead Magnet Content Missing');
  }

  console.log('3. Testing Capture...');
  const captureRes = await fetch('http://localhost:3000/api/lead-magnet/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-lead@example.com',
      businessId: data.businessId
    })
  });
  
  if (!captureRes.ok) {
      console.error('Capture failed', await captureRes.text());
      return;
  }
  
  const captureData = await captureRes.json();
  console.log('Capture Result:', captureData);

  // Verify Customer
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', data.businessId);
    
  console.log('Customers found:', customers.length);
  if (customers.length > 0) console.log('✅ Customer Created');
  
  // Verify Activity
  const { data: activities } = await supabase
    .from('ai_activities')
    .select('*')
    .eq('business_id', data.businessId);
    
  console.log('Activities found:', activities.length);
  if (activities.length > 0) console.log('✅ Activity Logged');
}

test().catch(console.error);

