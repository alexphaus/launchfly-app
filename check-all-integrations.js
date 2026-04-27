import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function run() {
  const businessId = "06203464-2b76-4468-8d2e-6630ab0ed71a";
  
  const { data: integrations, error } = await supabase
    .from('business_integrations')
    .select('service_name, base_url, status')
    .eq('business_id', businessId);
    
  if (error) {
    console.error("Error fetching integrations:", error);
    return;
  }
  
  console.log("Integrations:", integrations);
}

run();
