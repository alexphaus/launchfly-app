import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

async function run() {
  const start = Date.now();
  console.log('Querying chat_history...');
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    // .eq('business_id', 'some_id') 
    .order('created_at', { ascending: false })
    .limit(25);
  
  if (error) console.error(error);
  else console.log(`Finished chat history in ${Date.now() - start}ms. Found ${data?.length} rows.`);

  const start2 = Date.now();
  console.log('Querying customers...');
  const { data: d2, error: e2 } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);
  
  if (e2) console.error(e2);
  else console.log(`Finished customers in ${Date.now() - start2}ms. Found ${d2?.length} rows.`);
}

run();
