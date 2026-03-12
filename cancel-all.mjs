import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const QSTASH_BASE = process.env.QSTASH_URL || 'https://qstash.upstash.io';
const TOKEN = process.env.QSTASH_TOKEN;

// Step 1: Get all pending message IDs
const allIds = new Set();
let cursor = '';
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

console.log(`Found ${allIds.size} unique pending messages to cancel`);

// Step 2: Cancel each message
let cancelled = 0, failed = 0;
for (const mid of allIds) {
  const res = await fetch(`${QSTASH_BASE}/v2/messages/${mid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (res.ok || res.status === 404) cancelled++;
  else {
    failed++;
    console.log(`  Failed to cancel ${mid}: ${res.status}`);
  }
}
console.log(`Cancelled: ${cancelled}, Failed: ${failed}`);

// Step 3: Delete all prospecting leads
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: deleted } = await s.from('quote_leads')
  .delete()
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .select('id');
console.log(`\nDeleted ${deleted?.length || 0} prospecting leads from DB`);

// Step 4: Check remaining state
const { data: remaining } = await s.from('quote_leads')
  .select('id')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting');
console.log(`Remaining prospecting leads: ${remaining?.length || 0}`);

console.log('\n✅ Clean slate — ready for UI test');
