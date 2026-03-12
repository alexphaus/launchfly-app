import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;
const targetUrl = 'https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a';

// Delete ALL existing schedules to start clean
const listRes = await fetch(`${QSTASH_BASE}/v2/schedules`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const schedules = await listRes.json();
console.log(`Found ${schedules.length} schedules to delete`);
for (const s of schedules) {
  await fetch(`${QSTASH_BASE}/v2/schedules/${s.scheduleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  console.log(`  Deleted ${s.scheduleId}`);
}

// 14:50 Singapore (UTC+8) = 06:50 UTC
// Cron: minute hour * * day
const cron = '50 6 * * 1,2,3,4,5';
console.log(`\nCreating schedule with UTC cron: ${cron} (= 14:50 Singapore time)`);

const res = await fetch(`${QSTASH_BASE}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': cron,
    'Upstash-Retries': '0',
  },
  body: JSON.stringify({
    businessId: '06203464-2b76-4468-8d2e-6630ab0ed71a',
    event: 'daily_schedule',
    ruleId: 'rule_lf_daily_prospecting',
  }),
});
const data = await res.json();
console.log('Created schedule:', data.scheduleId);

// Verify
const verifyRes = await fetch(`${QSTASH_BASE}/v2/schedules`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const verified = await verifyRes.json();
for (const s of verified) {
  console.log(`  ${s.scheduleId} cron:${s.cron} next:${s.nextScheduleTime ? new Date(s.nextScheduleTime).toISOString() : 'N/A'}`);
}

// Update DB with new schedule ID
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
const { data: assistant } = await sb.from('assistants').select('id, trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const dailyRule = assistant.trigger_config.rules.find(r => r.event === 'daily_schedule');
if (dailyRule && data.scheduleId) {
  dailyRule.scheduleConfig.qstashScheduleId = data.scheduleId;
  await sb.from('assistants').update({ trigger_config: assistant.trigger_config }).eq('id', assistant.id);
  console.log('DB updated with new schedule ID:', data.scheduleId);
}

// Now trigger manually for immediate test
console.log('\n--- Manual trigger NOW ---');
const trigRes = await fetch(`${QSTASH_BASE}/v2/publish/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    businessId: '06203464-2b76-4468-8d2e-6630ab0ed71a',
    event: 'daily_schedule',
    ruleId: 'rule_lf_daily_prospecting',
  }),
});
const trigData = await trigRes.json();
console.log('Manual trigger sent:', trigData.messageId ? 'OK' : JSON.stringify(trigData));
console.log('\nDone! The schedule will fire daily at 14:50 SG / 06:50 UTC Mon-Fri.');
console.log('Manual trigger should run the pipeline now with improved AI prompt.');
