import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const BIZ = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Cancel any pending QStash messages
const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

console.log('=== Canceling pending QStash messages ===');
let cursor = '';
const allIds = new Set();
for (let page = 0; page < 10; page++) {
  const url = `${QSTASH_BASE}/v2/events?state=CREATED&count=200${cursor ? `&cursor=${cursor}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  const events = Array.isArray(data) ? data : data.events || [];
  for (const e of events) {
    if (e.messageId) allIds.add(e.messageId);
  }
  cursor = data.cursor || '';
  if (!cursor || events.length === 0) break;
}
console.log(`Found ${allIds.size} pending messages`);
for (const mid of allIds) {
  await fetch(`${QSTASH_BASE}/v2/messages/${mid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}
console.log('Canceled all pending messages');

// Delete all prospecting leads
console.log('\n=== Cleaning DB ===');
const { data: deleted } = await s.from('quote_leads')
  .delete()
  .eq('business_id', BIZ)
  .eq('source', 'prospecting')
  .select('id');
console.log(`Deleted ${deleted?.length || 0} prospecting leads`);

// Delete all chat_history for this business (to start fresh)
const { data: delChats } = await s.from('chat_history')
  .delete()
  .eq('business_id', BIZ)
  .select('id');
console.log(`Deleted ${delChats?.length || 0} chat_history entries`);

console.log('\n✅ Clean slate. After Vercel deploys, trigger the daily_schedule again.');
console.log('The deploy fixes:');
console.log('  1. Chat messages will now show content (not undefined)');
console.log('  2. AI gatekeeper is more lenient (defaults to YES)');
console.log('  3. Schedule timezone is properly converted to UTC');
