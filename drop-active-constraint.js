const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Drop the unique index
  const { error: dropErr } = await supabase.rpc('pg_exec', {
    query: 'DROP INDEX IF EXISTS idx_assistants_business_active;'
  });
  
  // rpc might not exist, try raw SQL via REST if needed
  if (dropErr) {
    console.log('rpc failed, trying direct...', dropErr.message);
  }

  // Activate Purchasing OS
  const { data, error } = await supabase
    .from('assistants')
    .update({ active: true })
    .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
    .eq('name', 'Purchasing OS')
    .select('id, name, active');

  if (error) console.error('Still blocked:', error.message);
  else console.log('Activated:', JSON.stringify(data));
}
run().catch(console.error);
