const { createClient } = require('@supabase/supabase-js');
const { startCustomerAcquisition } = require('./src/lib/customer-acquisition');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function directCustomerAcquisition() {
  const businessId = '94f30cf6-e8e0-48c9-9133-c67cc9712730';
  
  console.log('🚀 Starting direct customer acquisition for business:', businessId);
  
  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
    
  if (!business) {
    console.log('❌ Business not found');
    return;
  }
  
  console.log('✅ Business found:', business.name);
  
  const businessData = {
    name: business.name,
    industry: 'Technology',
    business_data: business.business_data
  };
  
  try {
    console.log('🎯 Starting customer acquisition...');
    const result = await startCustomerAcquisition(businessId, businessData);
    console.log('✅ Customer acquisition completed:', result);
  } catch (error) {
    console.error('❌ Customer acquisition failed:', error.message);
  }
}

directCustomerAcquisition().catch(console.error);
