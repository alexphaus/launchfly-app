const { createClient } = require('@supabase/supabase-js');
const BIZ_ID = '9187ade5-0f06-4633-ad84-71f5e41b2680';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: b } = await supabase.from('businesses').select('name, industry, whatsapp_notify_number').eq('id', BIZ_ID).single();
  console.log("Biz:", b);

  const { data: ast } = await supabase.from('assistants').select('id, name, active, tools_enabled').eq('business_id', BIZ_ID);
  console.log("\nAssists before:", JSON.stringify(ast, null, 2));
}
run().catch(console.error);
