require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check all recent quote_leads with call_outcome = no_answer for the test phone
  const { data: leads } = await sb
    .from('quote_leads')
    .select('id, phone, name, call_outcome, status, created_at, updated_at')
    .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
    .ilike('phone', '%34683233450%')
    .order('created_at', { ascending: false })
    .limit(30);
  
  console.log(`Quote leads for +34683233450: ${leads?.length || 0}`);
  if (leads) {
    leads.forEach(l => {
      console.log(`  ${l.id} | outcome=${l.call_outcome} | status=${l.status} | created=${l.created_at} | updated=${l.updated_at}`);
    });
  }

  // Also check how many call-related chat_history messages exist
  const { data: history } = await sb
    .from('chat_history')
    .select('id, role, message, created_at')
    .eq('business_id', '06203464-2b76-4468-8d2e-6630ab0ed71a')
    .eq('phone', '34683233450')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log(`\nChat history for 34683233450: ${history?.length || 0}`);
  if (history) {
    history.forEach(h => {
      console.log(`  ${h.created_at} | ${h.role} | ${h.message?.substring(0, 80)}`);
    });
  }
}
check();
