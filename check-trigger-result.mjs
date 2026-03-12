import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

// Delete the stale duplicate schedule
console.log('Deleting duplicate schedule scd_7re75...');
const del = await fetch(`${QSTASH_BASE}/v2/schedules/scd_7re75ij7ysNg53PvcpnHwbGJrgPp`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${TOKEN}` },
});
console.log('Delete duplicate:', del.status);

// Check remaining schedules
const res = await fetch(`${QSTASH_BASE}/v2/schedules`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const schedules = await res.json();
console.log('Remaining schedules:', schedules.length);
schedules.forEach(s => console.log(' ', s.scheduleId, s.cron));

// Now check: did the trigger create leads + send WhatsApp?
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Check recent prospecting leads
const { data: leads } = await s
  .from('quote_leads')
  .select('id, name, phone, status, source, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\nRecent prospecting leads: ${leads?.length || 0}`);
leads?.forEach(l => console.log(`  ${l.name} | ${l.phone} | ${l.status} | ${l.created_at}`));

// Check recent chat_history (WhatsApp messages sent)
const { data: chats } = await s
  .from('chat_history')
  .select('phone, role, message, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\nRecent chat messages: ${chats?.length || 0}`);
chats?.forEach(c => console.log(`  ${c.created_at} | ${c.role} | ${c.phone} | ${c.message?.substring(0, 80)}`));

// Check activity log
const { data: activity } = await s
  .from('activity_log')
  .select('action, details, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\nRecent activity: ${activity?.length || 0}`);
activity?.forEach(a => {
  const d = typeof a.details === 'string' ? a.details : JSON.stringify(a.details)?.substring(0, 100);
  console.log(`  ${a.created_at} | ${a.action} | ${d}`);
});
