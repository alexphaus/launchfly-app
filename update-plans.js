const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jahdnckxduwkxodyjbnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE'
);

async function updateCocoConnoisseurPlans() {
  try {
    // Get the current business data
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', 'cococonnoisseur')
      .single();
      
    if (fetchError) {
      console.error('Error fetching business:', fetchError);
      return;
    }
    
    console.log('Current business found:', business.name);
    
    // Update the business data to add IDs to plans
    const businessData = business.business_data;
    const pricingTableIndex = businessData.layout.findIndex(section => section.component === 'PricingTable');
    
    if (pricingTableIndex !== -1 && businessData.layout[pricingTableIndex].props.plans) {
      const plans = businessData.layout[pricingTableIndex].props.plans;
      
      // Add IDs to existing plans
      plans.forEach((plan, index) => {
        if (!plan.id) {
          if (plan.name === 'Trial Pack') {
            plan.id = 'trial-pack';
          } else if (plan.name === 'Monthly Plan') {
            plan.id = 'monthly-plan';
          } else {
            plan.id = `plan-${index + 1}`;
          }
        }
      });
      
      console.log('Updated plans:', plans.map(p => ({ id: p.id, name: p.name })));
      
      // Update the business data in the database
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ business_data: businessData })
        .eq('id', business.id);
        
      if (updateError) {
        console.error('Error updating business:', updateError);
      } else {
        console.log('✅ Successfully updated CocoConnoisseur plans with IDs');
      }
    } else {
      console.log('❌ No PricingTable section found in layout');
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

updateCocoConnoisseurPlans();
