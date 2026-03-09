import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check ALL recent chat history
const { data, error } = await sb.from('chat_history').select('*')
  .order('created_at', { ascending: false }).limit(5);

if (error) {
  console.log('Error:', error.message);
} else if (!data?.length) {
  console.log('NO CHAT HISTORY AT ALL');
} else {
  console.log(`Found ${data.length} records:`);
  data.forEach(c => {
    console.log(`[${c.role}] biz=${c.business_id?.substring(0,8)} phone=${c.phone||c.customer_phone||'?'} | ${(c.content||'').substring(0,120)}`);
    console.log(`  created: ${c.created_at}`);
  });
}

// Also check specifically for the send_whatsapp breadcrumb
console.log('\n--- Checking for Launchfly chat history specifically ---');
const { data: lf } = await sb.from('chat_history').select('*')
  .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
  .order('created_at', { ascending: false }).limit(5);
console.log(`Launchfly records: ${lf?.length || 0}`);
lf?.forEach(c => {
  console.log(`[${c.role}] phone=${c.phone||c.customer_phone||'?'} | ${(c.content||'').substring(0,120)}`);
});
