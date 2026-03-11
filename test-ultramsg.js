require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BIZ_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const TEST_PHONE = '+34683233450'; // your number

async function test() {
  // 1) Get credentials from DB
  const { data, error } = await sb.from('businesses').select('whatsapp_api_config').eq('id', BIZ_ID).single();
  if (error || !data?.whatsapp_api_config) {
    console.error('No config found:', error?.message);
    return;
  }
  const { instanceId, token } = data.whatsapp_api_config;
  console.log('Using instance:', instanceId);

  // 2) Send test message
  const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, to: TEST_PHONE, body: `Test from Launchfly UltraMsg at ${new Date().toLocaleTimeString()}` })
  });
  const json = await res.json();
  console.log('Response:', JSON.stringify(json, null, 2));
}
test();
