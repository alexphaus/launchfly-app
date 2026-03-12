import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
const BIZ = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

// Leads
const { data: leads } = await s.from('quote_leads')
  .select('id, name, phone, status, source, attempts, created_at')
  .eq('business_id', BIZ).eq('source', 'prospecting')
  .order('created_at', { ascending: false }).limit(20);

console.log(`=== PROSPECTING LEADS (${leads?.length || 0}) ===`);
leads?.forEach(l => {
  const t = l.created_at.substring(0, 19);
  console.log(`  ${t} | ${(l.name || '').substring(0, 35).padEnd(36)} | ${l.phone.padEnd(16)} | ${l.status} | att:${l.attempts}`);
});

// Chat history
const { data: chats } = await s.from('chat_history')
  .select('phone, role, content, created_at')
  .eq('business_id', BIZ)
  .order('created_at', { ascending: false }).limit(20);

console.log(`\n=== CHAT HISTORY (${chats?.length || 0}) ===`);
chats?.forEach(c => {
  const t = c.created_at.substring(0, 19);
  console.log(`  ${t} | ${c.role.padEnd(10)} | ${(c.phone || '').padEnd(16)} | ${(c.content || 'NO CONTENT').substring(0, 80)}`);
});

// QStash messages
const msgRes = await fetch(`${QSTASH_BASE}/v2/messages`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const msgs = await msgRes.json();
const msgList = Array.isArray(msgs) ? msgs : msgs.messages || [];

console.log(`\n=== QSTASH PENDING MESSAGES (${msgList.length}) ===`);
msgList.forEach(m => {
  const url = (m.url || m.destination || '').replace('https://app.launchfly.ai', '');
  const notBefore = m.notBefore ? new Date(m.notBefore * 1000).toISOString() : 'now';
  console.log(`  ${m.messageId?.substring(0, 12)} | fires: ${notBefore} | ${url.substring(0, 60)}`);
});

// QStash schedules
const schedRes = await fetch(`${QSTASH_BASE}/v2/schedules`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const scheds = await schedRes.json();
console.log(`\n=== SCHEDULES (${scheds.length}) ===`);
scheds.forEach(sc => {
  const dest = (sc.destination || '').replace('https://app.launchfly.ai', '');
  console.log(`  ${sc.scheduleId} | cron: ${sc.cron} | paused: ${sc.isPaused} | ${dest.substring(0, 60)}`);
});
