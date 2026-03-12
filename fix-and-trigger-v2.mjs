import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const assistantId = '11595834-4950-4bfe-af18-b651947a9bd5';

const { data: assistant } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('id', assistantId)
  .single();

const config = assistant.trigger_config;
const rule = config.rules.find(r => r.id === 'rule_lf_daily_prospecting');

// Fix: hour 0 → 8, update schedule ID
rule.scheduleConfig.hour = 8;
rule.scheduleConfig.qstashScheduleId = 'scd_5hXqi2kajnHXcqcByXjbCoqtJUAP';

console.log('Updated scheduleConfig:', JSON.stringify(rule.scheduleConfig, null, 2));

const { error } = await supabase
  .from('assistants')
  .update({ trigger_config: config })
  .eq('id', assistantId);

if (error) console.error('DB Error:', error);
else console.log('✓ DB updated — 8:00 AM Bangkok, Mon-Fri');

// Trigger manually RIGHT NOW
console.log('\n--- Triggering pipeline NOW ---');
const res = await fetch('https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
console.log('Status:', res.status);
const text = await res.text();
console.log('Response:', text.substring(0, 1000));
