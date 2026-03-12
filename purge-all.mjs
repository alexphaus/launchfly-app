import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const QSTASH_BASE = process.env.QSTASH_URL || 'https://qstash.upstash.io';
const TOKEN = process.env.QSTASH_TOKEN;

// Collect all message IDs
const allIds = new Set();
let cursor = '';
for (let page = 0; page < 50; page++) {
  const url = `${QSTASH_BASE}/v2/events?state=CREATED&count=1000${cursor ? `&cursor=${cursor}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  const events = Array.isArray(data) ? data : data.events || [];
  for (const e of events) {
    if (e.messageId) allIds.add(e.messageId);
  }
  cursor = data.cursor || '';
  if (!cursor || events.length === 0) break;
  process.stdout.write(`  page ${page+1}: ${allIds.size} IDs so far\r`);
}

console.log(`\nFound ${allIds.size} unique pending messages`);

// Cancel in parallel batches of 50
const ids = [...allIds];
let cancelled = 0;
const batchSize = 50;
for (let i = 0; i < ids.length; i += batchSize) {
  const batch = ids.slice(i, i + batchSize);
  const results = await Promise.allSettled(
    batch.map(mid =>
      fetch(`${QSTASH_BASE}/v2/messages/${mid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
    )
  );
  cancelled += results.filter(r => r.status === 'fulfilled' && (r.value.ok || r.value.status === 404)).length;
  process.stdout.write(`  ${cancelled}/${ids.length} cancelled\r`);
}
console.log(`\nCancelled: ${cancelled}/${ids.length}`);

// Delete all prospecting leads
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: deleted } = await s.from('quote_leads')
  .delete()
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .select('id');
console.log(`Deleted ${deleted?.length || 0} prospecting leads`);

// Verify clean
const { count } = await s.from('quote_leads')
  .select('id', { count: 'exact', head: true })
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting');
console.log(`Remaining: ${count || 0}`);
console.log('\n✅ Clean slate');
