const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTestCustomer() {
  // Your CUSTOMER test phone number (not the technician)
  const testPhone = '+34683233450';  // Spanish customer phone
  const businessId = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';  // DANS. AIRCON TEAM
  
  console.log('Setting up test customer for returning customer flow...\n');
  
  // 1. Create customer record
  const { data: customer, error: custErr } = await supabase.from('customers').insert({
    phone: testPhone,
    name: 'Spanish Customer',
    email: 'spanish.customer@example.com',
    business_id: businessId,
    status: 'active'
  }).select().single();
  
  if (custErr) {
    console.log('❌ Customer error:', custErr.message);
    return;
  }
  console.log('✅ Customer created:', customer.id);
  
  // 2. Create service record with warranty
  const serviceDate = new Date();
  const warrantyExpires = new Date(serviceDate);
  warrantyExpires.setDate(warrantyExpires.getDate() + 30);
  const nextDue = new Date(serviceDate);
  nextDue.setDate(nextDue.getDate() + 90);
  
  const { data: record, error: recErr } = await supabase.from('service_records').insert({
    business_id: businessId,
    customer_id: customer.id,
    service_type: 'cleaning',
    service_name: 'Aircon Cleaning',
    appliance_type: 'aircon',
    units_serviced: 2,
    amount: 150,
    currency: 'MYR',
    warranty_days: 30,
    warranty_expires_at: warrantyExpires.toISOString(),
    service_interval_days: 90,
    next_service_due_at: nextDue.toISOString(),
    service_date: serviceDate.toISOString(),
    registered_via: 'manual'
  }).select().single();
  
  if (recErr) {
    console.log('❌ Record error:', recErr.message);
    return;
  }
  
  console.log('✅ Service record created:', record.id);
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📱 Customer phone:', testPhone);
  console.log('🛠️  Service: Aircon Cleaning');
  console.log('🛡️  Warranty expires:', warrantyExpires.toLocaleDateString('en-GB'));
  console.log('📅 Next due:', nextDue.toLocaleDateString('en-GB'));
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('👉 Now scan the DANS. AIRCON TEAM sticker from phone', testPhone);
  console.log('   You should see: "Welcome back, Alex! Warranty: Active until..."');
}

setupTestCustomer().catch(console.error);
