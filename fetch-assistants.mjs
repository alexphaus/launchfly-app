import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';
  const { data: assistants } = await supabase
    .from('assistants')
    .select('id, name, active')
    .eq('business_id', businessId);
  console.log(assistants);
}
main();
