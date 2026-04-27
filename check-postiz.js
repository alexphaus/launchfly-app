import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function run() {
  const businessId = "06203464-2b76-4468-8d2e-6630ab0ed71a";
  
  const { data: integration, error } = await supabase
    .from('business_integrations')
    .select('*')
    .eq('business_id', businessId)
    .eq('service_name', 'postiz')
    .maybeSingle();
    
  if (error) {
    console.error("Error fetching integration:", error);
    return;
  }
  
  console.log("Postiz Integration:", integration);
}

run();
