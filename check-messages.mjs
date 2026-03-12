import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Check outgoing messages with more detail
const { data: msgs } = await supabase
  .from('chat_history')
  .select('id, customer_id, direction, message, phone, created_at')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`=== Recent messages (${msgs?.length}) ===`);
msgs?.forEach(m => {
  const dir = m.direction === 'outgoing' ? '→OUT' : '←IN';
  console.log(`  ${dir} | ${m.phone || '?'} | ${m.message?.substring(0, 100)} | ${m.created_at}`);
});

// Check new customers (created from prospect_found)
const { data: customers } = await supabase
  .from('customers')
  .select('id, name, phone, status, created_at')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\n=== Customers (${customers?.length}) ===`);
customers?.forEach(c => console.log(`  ${c.name} | ${c.phone} | ${c.status} | ${c.created_at}`));

// Check recent quote_leads count with source=prospecting
const { count } = await supabase
  .from('quote_leads')
  .select('*', { count: 'exact', head: true })
  .eq('business_id', businessId)
  .eq('source', 'prospecting');

console.log(`\nProspecting leads total: ${count}`);
