require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const businessId = '525b6e62-efb4-4c85-aee0-da47eedbdcc4';

  // 1. Check imported contacts
  const { data: customers } = await supabase
    .from('customers')
    .select('id, phone, name, status, source, last_blast_at, notes, tags')
    .eq('source', 'reactivation_import')
    .eq('business_id', businessId)
    .limit(5);
  console.log('=== IMPORTED CUSTOMERS ===');
  console.log(JSON.stringify(customers, null, 2));

  // 2. Check recent bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, customer_name, customer_phone, slot_date, slot_time, estimate, status, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('\n=== RECENT BOOKINGS ===');
  console.log(JSON.stringify(bookings, null, 2));

  // 3. Check business config
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, business_data')
    .eq('id', businessId)
    .single();
  const config = biz?.business_data || {};
  console.log('\n=== BUSINESS CONFIG ===');
  console.log('currency:', config.currency);
  console.log('cleaningPrice:', config.cleaningPrice);
  console.log('niche:', config.niche);
})();
