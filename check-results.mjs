import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Check latest prospecting leads
const { data: leads } = await s
  .from('quote_leads')
  .select('id, name, phone, status, source, attempts, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .eq('source', 'prospecting')
  .order('created_at', { ascending: false })
  .limit(15);
console.log(`Prospecting leads: ${leads?.length || 0}`);
leads?.forEach(l => console.log(`  ${l.created_at.substring(11, 19)} | ${l.name?.substring(0, 35)} | ${l.phone} | ${l.status} | attempts:${l.attempts}`));

// Check chat_history for WhatsApp messages
const { data: chats } = await s
  .from('chat_history')
  .select('phone, role, message, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: false })
  .limit(10);
console.log(`\nChat messages: ${chats?.length || 0}`);
chats?.forEach(c => console.log(`  ${c.created_at?.substring(11, 19)} | ${c.role} | ${c.phone} | ${c.message?.substring(0, 80)}`));

// Check QStash events
const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;
const evRes = await fetch(`${QSTASH_BASE}/v2/events?count=20`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const evData = await evRes.json();
const events = Array.isArray(evData) ? evData : evData.events || [];
console.log(`\nRecent QStash events:`);
events.forEach(e => {
  const time = new Date(e.time).toISOString().substring(11, 19);
  const url = (e.url || '').replace('https://app.launchfly.ai', '');
  console.log(`  ${time} ${e.state.padEnd(10)} ${url.substring(0, 60)}`);
});
