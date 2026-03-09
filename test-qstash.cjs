const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const token = process.env.QSTASH_TOKEN;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.launchfly.ai';
const targetUrl = appUrl + '/api/assistants/trigger/resume';

console.log('QStash token:', token ? token.substring(0, 20) + '...' : 'MISSING');
console.log('Target URL:', targetUrl);

const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
console.log('QStash base:', qstashBase);

// Test publish with 10s delay
fetch(qstashBase + '/v2/publish/' + targetUrl, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Upstash-Delay': '10s',
    'Upstash-Retries': '0',
  },
  body: JSON.stringify({
    actions: [{ type: 'send_whatsapp', config: { message: 'QStash delay test' } }],
    ctx: { businessId: 'test-only', event: 'test', phone: '+0000000000' },
    scheduledAt: new Date().toISOString(),
  }),
}).then(async r => {
  const body = await r.text();
  console.log('QStash status:', r.status);
  console.log('QStash body:', body);
  process.exit(r.status === 200 || r.status === 202 ? 0 : 1);
}).catch(e => {
  console.error('QStash error:', e.message);
  process.exit(1);
});
