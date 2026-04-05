const { createClient } = require('@supabase/supabase-js');
const BIZ_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Fix 1: Activate the Purchasing OS assistant and set correct tools
  const { data: updatedAssistant, error: aErr } = await supabase
    .from('assistants')
    .update({
      active: true,
      tools_enabled: ['manage_job', 'send_whatsapp', 'query_database', 'send_report'],
    })
    .eq('business_id', BIZ_ID)
    .eq('name', 'Purchasing OS')
    .select('id, name, active, tools_enabled');
  
  if (aErr) console.error('❌ Assistant update error:', aErr.message);
  else console.log('✅ Assistant fixed:', JSON.stringify(updatedAssistant, null, 2));

  // Fix 2: Update Test Supplier A to a dummy number so it won't clash with owner
  const { data: updatedSupplier, error: sErr } = await supabase
    .from('suppliers')
    .update({ whatsapp_number: '+639111222333' })
    .eq('business_id', BIZ_ID)
    .eq('name', 'Test Supplier A')
    .select('id, name, whatsapp_number');

  if (sErr) console.error('❌ Supplier A update error:', sErr.message);
  else console.log('✅ Supplier A number ensured:', JSON.stringify(updatedSupplier, null, 2));

  // Verify Supplier B still has the Alex real phone (this is expected for supplier quote reply testing)
  const { data: suppB } = await supabase
    .from('suppliers')
    .select('id, name, whatsapp_number')
    .eq('business_id', BIZ_ID)
    .eq('name', 'Test Supplier B')
    .single();
  
  console.log('ℹ️  Supplier B (Alex phone):', suppB?.whatsapp_number, '— same as owner:', suppB?.whatsapp_number === '+639627459049' ? '⚠️ CONFLICT (owner checked first, so OK for owner path testing)' : '✅ OK');
}
run().catch(console.error);
// Separate: check all assistants for BIZ_ID
async function checkAll() {
  const { data } = await supabase.from('assistants').select('id, name, active, tools_enabled').eq('business_id', BIZ_ID);
  console.log('\nAll assistants:', JSON.stringify(data, null, 2));
}
checkAll().catch(console.error);
