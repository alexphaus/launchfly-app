import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// All messages today
const { data: msgs } = await supabase
  .from('chat_history')
  .select('id, customer_id, phone, direction, message, created_at')
  .eq('business_id', businessId)
  .gte('created_at', '2026-03-12T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`=== All messages since midnight UTC (${msgs?.length}) ===`);
msgs?.forEach(m => console.log(`  ${m.direction} | ${m.phone || '?'} | ${m.created_at} | ${m.message?.substring(0, 80)}`));

// Check if any customers exist at all
const { data: allCusts, count: custTotal } = await supabase
  .from('customers')
  .select('*', { count: 'exact' })
  .eq('business_id', businessId)
  .limit(5);

console.log(`\n=== Customers total: ${custTotal} ===`);
allCusts?.forEach(c => console.log(`  ${c.name} | ${c.phone} | ${c.status} | ${c.created_at}`));

// Check the stagger timing by looking at quote_leads created_at
const { data: leads } = await supabase
  .from('quote_leads')
  .select('name, phone, source, created_at')
  .eq('business_id', businessId)
  .eq('source', 'prospecting')
  .order('created_at', { ascending: true });

console.log(`\n=== Prospecting leads (order by created_at asc) ===`);
leads?.forEach((l, i) => {
  const t = new Date(l.created_at);
  console.log(`  ${i}: ${l.name.substring(0, 40).padEnd(42)} | ${l.phone.padEnd(18)} | ${t.toISOString()}`);
});
