import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const BIZ = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

// Step 1: Purge ALL pending DLQ messages via bulk endpoint
console.log('Purging all pending QStash messages...');
const purge = await fetch(`${QSTASH_BASE}/v2/messages`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${TOKEN}` },
});
console.log('Purge result:', purge.status, purge.statusText);

// Step 2: Delete prospecting leads
const { data: deleted } = await s.from('quote_leads')
  .delete()
  .eq('business_id', BIZ)
  .eq('source', 'prospecting')
  .select('id');
console.log(`Deleted ${deleted?.length || 0} prospecting leads`);

// Step 3: Delete all chat_history for this business
const { data: delChats } = await s.from('chat_history')
  .delete()
  .eq('business_id', BIZ)
  .select('id');
console.log(`Deleted ${delChats?.length || 0} chat_history entries`);

// Step 4: Verify clean state
const { count: leadsLeft } = await s.from('quote_leads')
  .select('id', { count: 'exact', head: true })
  .eq('business_id', BIZ)
  .eq('source', 'prospecting');
const { count: chatsLeft } = await s.from('chat_history')
  .select('id', { count: 'exact', head: true })
  .eq('business_id', BIZ);
console.log(`\nVerification: ${leadsLeft} prospecting leads, ${chatsLeft} chat entries remaining`);

// Step 5: Verify QStash schedule still exists
const schedRes = await fetch(`${QSTASH_BASE}/v2/schedules`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const scheds = await schedRes.json();
console.log(`QStash schedules: ${scheds.length}`);
scheds.forEach(sc => console.log(`  ${sc.scheduleId} cron:${sc.cron}`));

console.log('\n✅ Clean slate ready. Wait for Vercel to deploy, then manually trigger or wait for tomorrow 2:50 PM SG.');
