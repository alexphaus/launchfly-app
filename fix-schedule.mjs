import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;

// Step 1: Delete the old schedule (no timezone applied)
console.log('Deleting old schedule...');
const del = await fetch(`${QSTASH_BASE}/v2/schedules/scd_63Zsc7uGdozRGsyxYfHweL7Hkvn3`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${TOKEN}` },
});
console.log('Delete:', del.status, del.statusText);

// Step 2: Recreate with correct Asia/Singapore timezone
const targetUrl = 'https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a';
console.log('Creating new schedule with Asia/Singapore timezone...');
const create = await fetch(`${QSTASH_BASE}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': '50 14 * * 1,2,3,4,5',
    'Upstash-Retries': '0',
    'Upstash-Cron-Timezone': 'Asia/Singapore',
  },
  body: JSON.stringify({
    businessId: '06203464-2b76-4468-8d2e-6630ab0ed71a',
    event: 'daily_schedule',
    ruleId: 'rule_lf_daily_prospecting',
  }),
});
const data = await create.json();
console.log('New schedule:', JSON.stringify(data, null, 2));
if (data.nextScheduleTime) {
  console.log('Next fire (UTC):', new Date(data.nextScheduleTime).toISOString());
}

// Step 3: Update the DB with the new schedule ID
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

const { data: assistant } = await s
  .from('assistants')
  .select('id, trigger_config')
  .eq('id', '11595834-4950-4bfe-af18-b651947a9bd5')
  .single();

if (assistant && data.scheduleId) {
  const rules = assistant.trigger_config.rules;
  const dailyRule = rules.find(r => r.event === 'daily_schedule');
  if (dailyRule) {
    dailyRule.scheduleConfig.qstashScheduleId = data.scheduleId;
    await s.from('assistants').update({ trigger_config: assistant.trigger_config }).eq('id', assistant.id);
    console.log('Updated DB with new scheduleId:', data.scheduleId);
  }
}

// Step 4: Trigger manually right now so user can test
console.log('\nManually triggering daily_schedule now...');
const trigger = await fetch(`${QSTASH_BASE}/v2/publish/${targetUrl}`, {
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
const trigData = await trigger.json();
console.log('Manual trigger result:', JSON.stringify(trigData));
