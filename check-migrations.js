const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://jahdnckxduwkxodyjbnq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE'
);

async function check() {
  const r1 = await sb.from('_bot_message_ids').select('message_id').limit(1);
  console.log('_bot_message_ids:', r1.error ? 'MISSING: ' + r1.error.message : 'EXISTS');

  const r2 = await sb.from('customers').select('ai_paused_until').limit(1);
  console.log('ai_paused_until:', r2.error ? 'MISSING: ' + r2.error.message : 'EXISTS');

  const r3 = await sb.from('customers').select('phone, ai_paused_until').not('ai_paused_until', 'is', null).limit(5);
  console.log('Paused customers:', r3.data?.length || 0, JSON.stringify(r3.data));
}
check();
