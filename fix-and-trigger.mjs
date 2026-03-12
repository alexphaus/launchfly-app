import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const assistantId = '11595834-4950-4bfe-af18-b651947a9bd5';

// Get current config
const { data: assistant } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('id', assistantId)
  .single();

const config = assistant.trigger_config;
const rule = config.rules.find(r => r.id === 'rule_lf_daily_prospecting');

console.log('BEFORE:', JSON.stringify(rule.schedule));

// Fix: hour should be 8 (not 0), and update scheduleId
rule.schedule.hour = 8;
rule.schedule.scheduleId = 'scd_5hXqi2kajnHXcqcByXjbCoqtJUAP';

console.log('AFTER:', JSON.stringify(rule.schedule));

const { error } = await supabase
  .from('assistants')
  .update({ trigger_config: config })
  .eq('id', assistantId);

if (error) console.error('Error:', error);
else console.log('✓ Updated Sarah DB — 8:00 AM Bangkok, Mon-Fri');

// Now let's trigger it manually RIGHT NOW so we don't wait until tomorrow
console.log('\n--- Triggering search_leads manually NOW ---');
const res = await fetch('https://app.launchfly.ai/api/assistants/trigger?businessId=06203464-2b76-4468-8d2e-6630ab0ed71a', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'daily_schedule' }),
});
const text = await res.text();
console.log('Trigger response:', res.status, text.substring(0, 500));
