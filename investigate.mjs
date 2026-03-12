import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get ALL chat_history for this business
const { data } = await s.from('chat_history')
  .select('phone, role, content, created_at')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: true });

console.log('Total messages:', data?.length);
console.log('');

// Group by phone
const byPhone = {};
for (const m of data || []) {
  const p = m.phone || 'unknown';
  if (!byPhone[p]) byPhone[p] = [];
  byPhone[p].push(m);
}

for (const [phone, msgs] of Object.entries(byPhone)) {
  console.log(`--- ${phone} (${msgs.length} messages) ---`);
  for (const m of msgs) {
    const t = new Date(m.created_at).toISOString().substring(11, 19);
    console.log(`  ${t} [${m.role}] ${(m.content || '').substring(0, 90)}`);
  }
  console.log('');
}

// Count unique phones that got outgoing messages
const outgoing = (data || []).filter(m => m.role === 'assistant');
const uniquePhones = new Set(outgoing.map(m => m.phone));
console.log(`=== Summary ===`);
console.log(`Total messages in DB: ${data?.length}`);
console.log(`Outgoing (assistant): ${outgoing.length}`);
console.log(`Unique phones contacted: ${uniquePhones.size}`);
console.log(`Phones:`, [...uniquePhones].join(', '));
