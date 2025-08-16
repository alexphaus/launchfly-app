const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function triggerGrowthStrategy() {
  const businessId = '94f30cf6-e8e0-48c9-9133-c67cc9712730';
  
  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
    
  if (!business) {
    console.log('Business not found');
    return;
  }
  
  console.log('Business found:', business.name);
  console.log('Business status:', business.status);
  
  // Try to trigger growth strategy via API
  try {
    const response = await fetch('http://localhost:3000/api/inngest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.INNGEST_SIGNING_KEY
      },
      body: JSON.stringify({
        name: 'growth/strategy.started',
        data: {
          businessId: businessId,
          businessData: business.business_data,
          strategies: ['customer-acquisition']
        }
      })
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('Error triggering growth strategy:', error.message);
  }
}

triggerGrowthStrategy().catch(console.error);
