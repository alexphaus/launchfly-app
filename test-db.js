import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function run() {
  const businessId = "06203464-2b76-4468-8d2e-6630ab0ed71a";
  
  const { data: inst } = await supabase
    .from('whatsapp_instances')
    .select('base_url, api_key, instance_name')
    .eq('business_id', businessId)
    .eq('provider', 'evolution')
    .eq('active', true);
    
  console.log("whatsapp_instances:", inst);
  
  const { data: biz } = await supabase
    .from('businesses')
    .select('whatsapp_api_config')
    .eq('id', businessId);
    
  console.log("businesses:", biz);
}

run();
