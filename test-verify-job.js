const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data } = await supabase.from('jobs').select('*').eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a').order('created_at', { ascending: false }).limit(3);
  console.log(JSON.stringify(data, null, 2));
}
run().catch(console.error);
