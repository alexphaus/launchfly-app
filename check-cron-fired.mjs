import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);
const BIZ = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// 1. Check recent quote_leads
const { data: leads } = await supabase
  .from('quote_leads')
  .select('id, name, phone, source, created_at, status')
  .eq('business_id', BIZ)
  .order('created_at', { ascending: false })
  .limit(10);

console.log('RECENT QUOTE_LEADS:');
if (leads?.length) {
  leads.forEach(r => console.log(`  ${r.created_at} | ${r.name} | ${r.phone} | src=${r.source} | ${r.status}`));
} else {
  console.log('  (none found)');
}

// 2. Check recent chat_history (outgoing messages)
const { data: chats } = await supabase
  .from('chat_history')
  .select('phone, role, message, created_at')
  .eq('business_id', BIZ)
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\nRECENT OUTGOING MESSAGES:');
if (chats?.length) {
  chats.forEach(r => console.log(`  ${r.created_at} | ${r.phone} | ${(r.message || '').substring(0, 80)}`));
} else {
  console.log('  (none)');
}

// 3. Check QStash schedules
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const res = await fetch(`${url}/v2/schedules`, {
  headers: { Authorization: `Bearer ${token}` },
});
const schedules = await res.json();
console.log('\nACTIVE QSTASH SCHEDULES:');
for (const s of schedules) {
  console.log(`  ${s.scheduleId} | cron=${s.cron} | dest=${s.destination?.substring(0, 80)} | paused=${s.isPaused}`);
}

// 4. Check QStash events/logs (recent)
const logsRes = await fetch(`${url}/v2/events?count=10`, {
  headers: { Authorization: `Bearer ${token}` },
});
const logs = await logsRes.json();
console.log('\nRECENT QSTASH EVENTS:');
if (logs.events?.length) {
  for (const e of logs.events) {
    const time = new Date(e.time).toISOString();
    console.log(`  ${time} | state=${e.state} | url=${(e.url || '').substring(0, 80)}`);
  }
} else {
  console.log('  (none or different format)');
  console.log('  Raw:', JSON.stringify(logs).substring(0, 300));
}
