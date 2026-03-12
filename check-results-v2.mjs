import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Check ALL quote_leads (not just business filtered)
const { data: leads, error: e1, count } = await supabase
  .from('quote_leads')
  .select('*', { count: 'exact' })
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('quote_leads count:', count, 'error:', e1?.message);
if (leads?.length) {
  console.log('Sample:', JSON.stringify(leads[0], null, 2));
}

// Check customers count
const { count: custCount, error: e2 } = await supabase
  .from('customers')
  .select('*', { count: 'exact', head: true })
  .eq('business_id', businessId);

console.log('\ncustomers count:', custCount, 'error:', e2?.message);

// Check chat_history count for today
const today = new Date().toISOString().split('T')[0];
const { count: msgCount, error: e3 } = await supabase
  .from('chat_history')
  .select('*', { count: 'exact', head: true })
  .eq('business_id', businessId)
  .gte('created_at', today);

console.log('today messages count:', msgCount, 'error:', e3?.message);

// Check Vercel function logs via QStash events
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const eventsRes = await fetch(`${url}/v2/events?count=10`, {
  headers: { Authorization: `Bearer ${token}` },
});
const events = await eventsRes.json();
console.log('\n=== Recent QStash events ===');
(events.events || events)?.slice(0, 10).forEach(e => {
  console.log(`  ${e.state} | ${new Date(e.time).toISOString()} | ${e.url?.substring(0,80)} | status:${e.responseStatus}`);
});
