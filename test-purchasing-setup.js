const { createClient } = require('@supabase/supabase-js');
const BIZ_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log('\n=== 1. Suppliers table ===');
  const { data: suppliers, error: supErr } = await supabase.from('suppliers').select('*').eq('business_id', BIZ_ID);
  if (supErr) console.error('ERROR:', supErr.message);
  else console.log(JSON.stringify(suppliers, null, 2));

  console.log('\n=== 2. Jobs table (last 3) ===');
  const { data: jobs, error: jobErr } = await supabase.from('jobs').select('*').eq('business_id', BIZ_ID).order('created_at', { ascending: false }).limit(3);
  if (jobErr) console.error('ERROR:', jobErr.message);
  else console.log(JSON.stringify(jobs, null, 2));

  console.log('\n=== 3. Business owner phone ===');
  const { data: biz } = await supabase.from('businesses').select('id,name,whatsapp_notify_number,whatsapp_number,phone_number').eq('id', BIZ_ID).single();
  console.log(JSON.stringify(biz, null, 2));

  console.log('\n=== 4. Purchasing OS assistant ===');
  const { data: assistant } = await supabase.from('assistants').select('id,name,active,tools_enabled').eq('business_id', BIZ_ID).eq('name', 'Purchasing OS');
  console.log(JSON.stringify(assistant, null, 2));
}
run().catch(console.error);
