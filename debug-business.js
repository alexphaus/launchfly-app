const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jahdnckxduwkxodyjbnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE'
);

async function checkBusiness() {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', 'cococonnoisseur')
      .single();
      
    if (error) {
      console.log('Error:', error);
      return;
    }
    
    console.log('Business found:');
    console.log('- Name:', data.name);
    console.log('- Status:', data.status);
    console.log('- Has business_data:', !!data.business_data);
    
    if (data.business_data) {
      console.log('\nBusiness Data Structure:');
      console.log('- Keys available:', Object.keys(data.business_data));
      
      if (data.business_data.products) {
        console.log('\nProducts:');
        data.business_data.products.forEach((p, i) => {
          console.log(`  [${i}] ID: ${p.id || 'no-id'}, Name: ${p.name}, Price: ${p.price}`);
        });
      } else {
        console.log('\n❌ No products found in business_data');
      }
      
      if (data.business_data.plans) {
        console.log('\nPlans:');
        data.business_data.plans.forEach((p, i) => {
          console.log(`  [${i}] ID: ${p.id || 'no-id'}, Name: ${p.name}, Price: ${p.price}`);
        });
      } else {
        console.log('\n❌ No plans found in business_data');
      }
      
      // Log the full structure
      console.log('\n📋 Full business_data:');
      console.log(JSON.stringify(data.business_data, null, 2));
    } else {
      console.log('\n❌ No business_data found');
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkBusiness();
