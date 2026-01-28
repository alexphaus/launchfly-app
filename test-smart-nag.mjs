// Test Smart Nag - Create service_record due today and trigger cron
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TEST_PHONE = '+34683233450';

async function setupTestNag() {
  console.log('🔍 Looking for customer with phone:', TEST_PHONE);
  
  // 1. Find customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id, business_id, name, first_name, status')
    .or(`phone.eq.${TEST_PHONE},phone.eq.34683233450`)
    .single();
  
  if (!customer) {
    console.log('❌ No customer found. Recent customers:');
    const { data: recent } = await supabase
      .from('customers')
      .select('id, phone, name, business_id')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log(recent);
    return;
  }
  
  console.log('✅ Found customer:', customer);
  
  // 2. Check existing service records
  const { data: existing } = await supabase
    .from('service_records')
    .select('*')
    .eq('customer_id', customer.id);
  console.log('📋 Existing service_records:', existing?.length || 0);
  
  // 3. Create a service_record that's DUE TODAY
  const now = new Date();
  const warrantyEnd = new Date(now);
  warrantyEnd.setDate(warrantyEnd.getDate() + 30);
  const serviceDate = new Date(now);
  serviceDate.setMonth(serviceDate.getMonth() - 6); // 6 months ago
  
  const { data: record, error } = await supabase
    .from('service_records')
    .insert({
      business_id: customer.business_id,
      customer_id: customer.id,
      service_type: 'cleaning',
      service_name: 'Aircon General Cleaning',
      units_serviced: 1,
      warranty_days: 30,
      warranty_expires_at: warrantyEnd.toISOString(),
      service_interval_days: 180,
      next_service_due_at: now.toISOString(), // DUE NOW!
      registered_via: 'manual',
      registered_by: 'system',
      service_date: serviceDate.toISOString(),
      reminder_sent: false,
    })
    .select()
    .single();
    
  if (error) {
    console.log('❌ Error creating service_record:', error.message);
    return;
  }
  
  console.log('✅ Created service_record:', record.id);
  console.log('   next_service_due_at:', record.next_service_due_at);
  
  // 4. Update customer status
  await supabase.from('customers').update({
    status: 'completed',
    next_reminder_due: now.toISOString(),
  }).eq('id', customer.id);
  
  console.log('\n🎯 Service record ready! Now triggering cron...\n');
  
  // 5. Trigger the cron
  const cronUrl = process.env.NEXT_PUBLIC_SITE_URL 
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/service-reminders`
    : 'http://localhost:3000/api/cron/service-reminders';
  
  console.log('📡 Calling:', cronUrl);
  
  try {
    const res = await fetch(cronUrl, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });
    const json = await res.json();
    console.log('📨 Cron response:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('⚠️ Cron call failed:', e.message);
    console.log('   Try manually: curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" ' + cronUrl);
  }
}

setupTestNag().catch(console.error);
