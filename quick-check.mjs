import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const { count } = await supabase
  .from('quote_leads')
  .select('*', { count: 'exact', head: true })
  .eq('business_id', businessId)
  .eq('source', 'prospecting');

console.log('Prospecting leads right now:', count);

const { data: msgs } = await supabase
  .from('chat_history')
  .select('phone, role, content, created_at')
  .eq('business_id', businessId)
  .eq('role', 'assistant')
  .gte('created_at', '2026-03-12T04:30:00Z')
  .order('created_at', { ascending: false });

console.log('Outgoing messages since cleanup:', msgs?.length);
msgs?.forEach(m => console.log(`  ${m.phone} | ${m.content?.substring(0, 60)} | ${m.created_at}`));
