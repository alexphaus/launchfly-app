import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase
    .from('demo_sessions')
    .delete()
    .eq('phone', '34683233450');
  console.log(error ? error : 'Deleted session 34683233450');
  
  const { error: err2 } = await supabase
    .from('demo_sessions')
    .delete()
    .eq('phone', '+34683233450');
  console.log(err2 ? err2 : 'Deleted session +34683233450');
}

run();
