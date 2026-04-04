import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BIZ_ID = '9187ade5-0f06-4633-ad84-71f5e41b2680';

// Check business
const { data: biz } = await supabase
  .from('businesses')
  .select('name, whatsapp_number, whatsapp_notify_number, whatsapp_api_config, phone_number, business_data')
  .eq('id', BIZ_ID)
  .single();
console.log('Business:', JSON.stringify(biz, null, 2));

// Check existing assistants
const { data: assistants } = await supabase
  .from('assistants')
  .select('id, name, active, goal, tone, created_at')
  .eq('business_id', BIZ_ID);
console.log('\nExisting assistants:', JSON.stringify(assistants, null, 2));

// Check WA instance
const { data: inst } = await supabase
  .from('whatsapp_instances')
  .select('id, instance_name, provider, base_url, active')
  .eq('business_id', BIZ_ID);
console.log('\nWA instances:', JSON.stringify(inst, null, 2));
