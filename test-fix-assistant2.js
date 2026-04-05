const { createClient } = require('@supabase/supabase-js');
const BIZ_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Fix only tools_enabled — do NOT try to set active: true (unique constraint)
  const { data, error } = await supabase
    .from('assistants')
    .update({ tools_enabled: ['manage_job', 'send_whatsapp', 'query_database', 'send_report'] })
    .eq('business_id', BIZ_ID)
    .eq('name', 'Purchasing OS')
    .select('id, name, active, tools_enabled');
  
  if (error) console.error('❌ Update error:', error.message);
  else console.log('✅ Assistant tools fixed:', JSON.stringify(data, null, 2));
}
run().catch(console.error);
