import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function fix() {
  const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const { data, error } = await supabase
    .from('business_integrations')
    .update({ status: 'active' })
    .eq('business_id', businessId)
    .eq('service_name', 'evolution_api');

  console.log('Update complete.', error || 'No errors.');
}

fix();
