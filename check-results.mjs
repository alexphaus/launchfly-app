import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// Check new quote_leads
const { data: leads } = await supabase
  .from('quote_leads')
  .select('id, name, phone, city, source, created_at')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`=== Latest leads (${leads?.length}) ===`);
leads?.forEach(l => console.log(`  ${l.name} | ${l.phone} | ${l.city} | ${l.source} | ${l.created_at}`));

// Check new customers (prospects)
const { data: customers } = await supabase
  .from('customers')
  .select('id, name, phone, status, tags, created_at')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`\n=== Latest customers (${customers?.length}) ===`);
customers?.forEach(c => console.log(`  ${c.name} | ${c.phone} | ${c.status} | ${JSON.stringify(c.tags)} | ${c.created_at}`));

// Check outgoing messages
const { data: msgs } = await supabase
  .from('chat_history')
  .select('id, customer_id, direction, message, created_at')
  .eq('business_id', businessId)
  .eq('direction', 'outgoing')
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`\n=== Latest outgoing messages (${msgs?.length}) ===`);
msgs?.forEach(m => console.log(`  to:${m.customer_id} | ${m.message?.substring(0, 80)} | ${m.created_at}`));
