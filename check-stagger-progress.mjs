import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// All outgoing messages to Malaysian numbers (prospecting)
const { data: msgs } = await supabase
  .from('chat_history')
  .select('phone, role, content, created_at')
  .eq('business_id', businessId)
  .eq('role', 'assistant')
  .order('created_at', { ascending: true });

console.log(`=== All outgoing messages (${msgs?.length}) ===`);
msgs?.forEach(m => {
  const t = new Date(m.created_at);
  const phone = m.phone?.padEnd(20) || '?';
  console.log(`  ${t.toISOString()} | ${phone} | ${m.content?.substring(0, 80)}`);
});

// How many stagger delays are pending?
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;

const res = await fetch(`${url}/v2/events?count=50`, {
  headers: { Authorization: `Bearer ${token}` },
});
const events = await res.json();
const list = events.events || events;

const resumeEvents = list.filter(e => e.url?.includes('/trigger/resume'));
const activeResumes = resumeEvents.filter(e => e.state === 'CREATED' || e.state === 'ACTIVE');
const deliveredResumes = resumeEvents.filter(e => e.state === 'DELIVERED');

console.log(`\n=== QStash resume events ===`);
console.log(`  CREATED/ACTIVE (pending): ${activeResumes.length}`);
console.log(`  DELIVERED: ${deliveredResumes.length}`);
activeResumes.forEach((e, i) => {
  console.log(`  Pending ${i+1}: ${new Date(e.time).toISOString()} | ${e.state}`);
});
