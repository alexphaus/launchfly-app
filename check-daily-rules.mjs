import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);
const BIZ = '06203464-2b76-4468-8d2e-6630ab0ed71a';

const { data } = await supabase
  .from('assistants')
  .select('trigger_config')
  .eq('business_id', BIZ)
  .eq('active', true)
  .single();

const rules = data.trigger_config.rules;
const dailyRules = rules.filter(r => r.event === 'daily_schedule');
console.log('daily_schedule rules:', dailyRules.length);
dailyRules.forEach(r => {
  console.log('  id:', r.id, '| enabled:', r.enabled);
  console.log('  schedule:', JSON.stringify(r.scheduleConfig));
  console.log('  actions:', r.actions.map(a => a.type).join(' -> '));
  const sa = r.actions.find(a => a.type === 'search_leads');
  if (sa) console.log('  search config:', JSON.stringify(sa.config));
});

// Also update Sarah with new schedule ID
const NEW_ID = 'scd_5uDLnJKnVF1b1k4t2g1Z6A199e6C';
const updated = rules.map(r => {
  if (r.event === 'daily_schedule' && r.scheduleConfig) {
    r.scheduleConfig.qstashScheduleId = NEW_ID;
  }
  return r;
});
const { error } = await supabase
  .from('assistants')
  .update({ trigger_config: { ...data.trigger_config, rules: updated } })
  .eq('business_id', BIZ)
  .eq('active', true);
console.log('\nUpdated schedule ID to', NEW_ID, error ? 'ERROR: ' + error.message : 'OK');
