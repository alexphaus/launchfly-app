import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key);

const { data, error } = await s
  .from('assistants')
  .select('id, trigger_config')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .limit(1)
  .single();

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

const rules = data?.trigger_config?.rules || [];
console.log('Total rules:', rules.length);
rules.forEach((r, i) => {
  console.log(`\nRule ${i}: event=${r.event} id=${r.id} enabled=${r.enabled}`);
  if (r.event === 'daily_schedule') {
    console.log('  scheduleConfig:', JSON.stringify(r.scheduleConfig, null, 2));
  }
  if (r.actions) {
    r.actions.forEach((a, j) => console.log(`  Action ${j}: ${a.type}`, a.config ? JSON.stringify(a.config).substring(0, 100) : ''));
  }
});
