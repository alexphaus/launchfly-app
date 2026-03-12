import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Get leads just created  
const { data: leads } = await supabase
  .from('quote_leads')
  .select('name, phone, source, job_type, created_at')
  .eq('business_id', businessId)
  .eq('source', 'prospecting')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('=== Prospecting leads ===');
leads?.forEach((l, i) => console.log(`${i+1}. ${l.name} | ${l.phone} | ${l.job_type} | ${l.created_at}`));

// Test one directly
if (leads?.length) {
  const testLead = leads[0];
  console.log(`\n--- Testing prospect_found for: ${testLead.name} (${testLead.phone}) ---`);
  
  const res = await fetch(`https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'prospect_found',
      phone: testLead.phone,
      name: testLead.name,
      metadata: {
        source: 'apify_prospecting',
        category: testLead.job_type,
        rating: '4.5',
        reviews: '10',
      },
    }),
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}
