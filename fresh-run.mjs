import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const assistantId = '11595834-4950-4bfe-af18-b651947a9bd5';

// Create schedule matching user's UI: 1:20 PM Bangkok, Mon-Fri
const targetUrl = `https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`;
const res = await fetch(`${url}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': '20 13 * * 1,2,3,4,5',
    'Upstash-Retries': '1',
    'Upstash-Cron-Timezone': 'Asia/Bangkok',
  },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
const data = await res.json();
console.log('Created schedule:', data.scheduleId);

// Update DB to match UI settings
const { data: assistant } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('id', assistantId)
  .single();

const config = assistant.trigger_config;
const rule = config.rules.find(r => r.id === 'rule_lf_daily_prospecting');

rule.scheduleConfig = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  hour: 13,
  minute: 20,
  timezone: 'Asia/Bangkok',
  qstashScheduleId: data.scheduleId,
};
rule.actions[0].config.searchMaxResults = 100;

await supabase
  .from('assistants')
  .update({ trigger_config: config })
  .eq('id', assistantId);

console.log('✓ DB updated: 1:20 PM Bangkok, maxResults=100, scheduleId=' + data.scheduleId);

// Now trigger immediately
console.log('\n--- Triggering fresh search NOW ---');
const triggerRes = await fetch(`https://app.launchfly.ai/api/assistants/trigger?businessId=${businessId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
const result = await triggerRes.json();
console.log('Result:', JSON.stringify(result, null, 2));
