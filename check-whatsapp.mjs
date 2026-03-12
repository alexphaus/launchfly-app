import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

// Check ALL chat_history for this business (any filter could be wrong)
const { data: chats, error } = await s
  .from('chat_history')
  .select('*')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('Chat history err:', error?.message || 'none');
console.log('Chat history count:', chats?.length || 0);
chats?.forEach(c => console.log(`  ${c.created_at} | ${c.phone} | ${c.role} | ${c.message?.substring(0, 80)}`));

// Also check with phone +60123456789 specifically
const { data: klChats } = await s
  .from('chat_history')
  .select('*')
  .ilike('phone', '%60123456789%')
  .limit(5);
console.log('\nChat history for +60123456789:', klChats?.length || 0);
klChats?.forEach(c => console.log(`  ${c.business_id} | ${c.phone} | ${c.role} | ${c.message?.substring(0, 60)}`));

// Check UltraMsg delivery log
console.log('\n--- Checking UltraMsg sent messages ---');
const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
const ultraToken = process.env.ULTRAMSG_TOKEN;
if (instanceId && ultraToken) {
  const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages?token=${ultraToken}&page=1&limit=10&sort=desc&status=sent`);
  const msgs = await res.json();
  console.log('UltraMsg sent messages:', Array.isArray(msgs) ? msgs.length : 'error');
  if (Array.isArray(msgs)) {
    msgs.slice(0, 5).forEach(m => {
      console.log(`  ${m.created_at || m.date} | to:${m.to} | ${(m.body || m.message)?.substring(0, 60)}`);
    });
  } else {
    console.log('Response:', JSON.stringify(msgs).substring(0, 200));
  }
} else {
  console.log('No ULTRAMSG credentials found');
}
