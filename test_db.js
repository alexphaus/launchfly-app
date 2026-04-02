const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://jahdnckxduwkxodyjbnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE'
);

async function run() {
  const { data } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a');
  console.log(JSON.stringify(data, null, 2));

  // legacy check
  const { data: data2 } = await supabase
    .from('businesses')
    .select('whatsapp_api_config')
    .eq('id', '06203464-2b76-4468-8d2e-6630ab0ed71a');
  console.log('Legacy:', JSON.stringify(data2, null, 2));
}

run();
