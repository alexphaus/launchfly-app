import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Check both assistants for prospect_found rules
const { data: assistants, error } = await s
  .from('assistants')
  .select('id, name, trigger_config')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a');

if (error) console.log('DB error:', error.message);
if (!assistants || assistants.length === 0) {
  // Try without is_active filter
  const { data: all } = await s.from('assistants').select('id, name, business_id').limit(5);
  console.log('All assistants:', JSON.stringify(all));
  process.exit(1);
}
for (const a of assistants) {
  const rules = a.trigger_config?.rules || [];
  console.log(`\n=== ${a.name} (active: ${a.is_active}) ===`);
  console.log('All events:', [...new Set(rules.map(r => r.event))].join(', '));
  
  const prospectRules = rules.filter(r => r.event === 'prospect_found');
  if (prospectRules.length > 0) {
    for (const r of prospectRules) {
      console.log(`  prospect_found rule: ${r.id} enabled=${r.enabled}`);
      console.log('  actions:', r.actions?.map(a => a.type).join(' → '));
    }
  } else {
    console.log('  NO prospect_found rules');
  }
}

// Also check QStash events to see if prospect_found was dispatched
const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;
const evRes = await fetch(`${QSTASH_BASE}/v2/events?count=30`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const evData = await evRes.json();
const events = Array.isArray(evData) ? evData : evData.events || [];
console.log('\n=== Recent QStash Events ===');
events.slice(0, 15).forEach(e => {
  const time = new Date(e.time).toISOString();
  const url = e.url || '';
  console.log(`${time} ${e.state} ${url.substring(url.length - 50)}`);
});
