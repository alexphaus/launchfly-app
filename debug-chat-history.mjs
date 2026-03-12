import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Try direct raw query to chat_history
const { data: msgs, error: e } = await supabase
  .from('chat_history')
  .select('*')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Chat history error:', e?.message || 'none');
console.log('Chat history count:', msgs?.length);
if (msgs?.length) {
  console.log('Columns:', Object.keys(msgs[0]).join(', '));
  msgs.forEach(m => {
    console.log(`  ${m.direction || m.role} | ${m.phone || m.customer_phone || '?'} | ${new Date(m.created_at).toISOString()} | ${(m.message || m.content || '').substring(0, 80)}`);
  });
}

// Also try with just today
const { data: todayMsgs, error: e2, count } = await supabase
  .from('chat_history')
  .select('*', { count: 'exact' })
  .eq('business_id', businessId)
  .gte('created_at', '2026-03-12T00:00:00Z')
  .limit(5);

console.log('\nToday messages error:', e2?.message || 'none');
console.log('Today count:', count);
if (todayMsgs?.length) {
  todayMsgs.forEach(m => console.log(`  ${JSON.stringify(m).substring(0, 200)}`));
}

// Quickly test if the Vercel endpoint is alive
const res = await fetch(`https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'test_ping' }),
});
console.log('\nEndpoint alive check:', res.status, await res.text());
