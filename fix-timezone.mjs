import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const QSTASH_BASE = process.env.QSTASH_URL;
const TOKEN = process.env.QSTASH_TOKEN;
const targetUrl = 'https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a';

// Delete the current schedule (which has no timezone)
console.log('Deleting current schedule...');
await fetch(`${QSTASH_BASE}/v2/schedules/scd_7g2UjHUjcThkv3SYHpKbmWKbiPne`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${TOKEN}` },
});

// Test 1: Create with Upstash-Timezone header (used in old scripts)
console.log('\nCreating schedule with Upstash-Timezone: Asia/Singapore...');
const res1 = await fetch(`${QSTASH_BASE}/v2/schedules/${targetUrl}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Upstash-Cron': '50 14 * * 1,2,3,4,5',
    'Upstash-Retries': '0',
    'Upstash-Timezone': 'Asia/Singapore',
  },
  body: JSON.stringify({
    businessId: '06203464-2b76-4468-8d2e-6630ab0ed71a',
    event: 'daily_schedule',
    ruleId: 'rule_lf_daily_prospecting',
  }),
});
const data1 = await res1.json();
console.log('Schedule created:', data1.scheduleId);

// Check what nextScheduleTime looks like
const res2 = await fetch(`${QSTASH_BASE}/v2/schedules/${data1.scheduleId}`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const sched = await res2.json();
console.log('Full schedule:', JSON.stringify(sched, null, 2));
if (sched.nextScheduleTime) {
  console.log('nextScheduleTime:', new Date(sched.nextScheduleTime).toISOString());
} else {
  console.log('No nextScheduleTime in response');
}

// If Singapore timezone applied: 14:50 SG = 06:50 UTC
// Since it's past 06:50 UTC today, next should be 2026-03-13T06:50:00.000Z
const expected = '2026-03-13T06:50:00.000Z';
const actual = new Date(sched.nextScheduleTime).toISOString();
console.log(`\nExpected next fire: ${expected}`);
console.log(`Actual next fire:   ${actual}`);
console.log(`Timezone applied: ${actual === expected ? 'YES ✅' : 'NO ❌'}`);

// Update DB with new schedule ID
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
const { data: assistant } = await s.from('assistants').select('id, trigger_config').eq('id', '11595834-4950-4bfe-af18-b651947a9bd5').single();
const dailyRule = assistant.trigger_config.rules.find(r => r.event === 'daily_schedule');
if (dailyRule) {
  dailyRule.scheduleConfig.qstashScheduleId = data1.scheduleId;
  await s.from('assistants').update({ trigger_config: assistant.trigger_config }).eq('id', assistant.id);
  console.log('DB updated with new schedule ID');
}
