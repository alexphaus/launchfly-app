import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Critical: which assistant is ACTIVE? fireEvent queries .eq('active', true)
const { data: assistants } = await s
  .from('assistants')
  .select('id, name, active, trigger_config')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a');

for (const a of assistants) {
  const rules = a.trigger_config?.rules || [];
  const hasProspect = rules.some(r => r.event === 'prospect_found');
  const hasDaily = rules.some(r => r.event === 'daily_schedule');
  console.log(`${a.name} | active: ${a.active} | rules: ${rules.length} | prospect_found: ${hasProspect} | daily_schedule: ${hasDaily}`);
}

// Also check Vercel logs proxy — see if there are any recent errors
// Check if there are recent quote_leads entries that have "prospecting" sent status
const { data: leads } = await s
  .from('quote_leads')
  .select('id, name, phone, status, source, attempts, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\nRecent prospecting leads:');
leads?.forEach(l => console.log(`  ${l.name} | ${l.phone} | status: ${l.status} | attempts: ${l.attempts}`));
