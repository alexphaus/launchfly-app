import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const businessId = '06203464-2b76-4468-8d2e-6630ab0ed71a';

// 1. Delete the old buried prospecting leads
const { data: oldLeads, error: e1 } = await supabase
  .from('quote_leads')
  .delete()
  .eq('business_id', businessId)
  .eq('source', 'prospecting')
  .select('id, name, phone');

console.log(`Deleted ${oldLeads?.length || 0} buried prospecting leads`);
oldLeads?.forEach(l => console.log(`  ✗ ${l.name} | ${l.phone}`));

// 2. Also clean up the chat_history entry from the broken send
const { data: oldMsgs } = await supabase
  .from('chat_history')
  .delete()
  .eq('business_id', businessId)
  .eq('phone', '60 3-3385 2007')
  .select('id');

console.log(`Cleaned ${oldMsgs?.length || 0} broken chat entries`);

// 3. Check what schedule the UI created (user just saved at 1:20 PM SE Asia)
const { data: assistant } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('id', '11595834-4950-4bfe-af18-b651947a9bd5')
  .single();

const rule = assistant.trigger_config.rules.find(r => r.id === 'rule_lf_daily_prospecting');
console.log('\nCurrent schedule config:', JSON.stringify(rule.scheduleConfig, null, 2));
console.log('Search config:', JSON.stringify(rule.actions[0].config, null, 2));

// 4. Verify the UI-created QStash schedule exists
const token = process.env.QSTASH_TOKEN;
const url = process.env.QSTASH_URL;
const schedId = rule.scheduleConfig?.qstashScheduleId;
if (schedId) {
  const res = await fetch(`${url}/v2/schedules/${schedId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const info = await res.json();
    console.log(`\n✓ QStash schedule ${schedId}: cron=${info.cron}`);
  } else {
    console.log(`\n✗ QStash schedule ${schedId} not found (${res.status})`);
  }
}

// 5. Also check if my old manual schedule still exists
const oldId = 'scd_5hXqi2kajnHXcqcByXjbCoqtJUAP';
const oldRes = await fetch(`${url}/v2/schedules/${oldId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (oldRes.ok) {
  console.log(`⚠ Old manual schedule ${oldId} still exists — deleting...`);
  await fetch(`${url}/v2/schedules/${oldId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('  Deleted.');
} else {
  console.log(`✓ Old manual schedule already gone`);
}

console.log('\n--- Ready to trigger fresh search ---');
